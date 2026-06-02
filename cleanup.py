"""
Shared cleanup logic — used by both the CLI script (scripts/cleanup_words.py)
and the in-app endpoint (/api/words/cleanup-propose, /api/words/cleanup-apply).

Two phases:
  Phase 1 — one smart-LLM call across all words → proposes merges, moves-to-phrases, deletes.
  Phase 2 — batched smart-LLM calls on survivors → refreshed definitions where needed.

The proposal is a pure data structure; apply_proposal() does the destructive write.
History is preserved on merges (counters summed, history concatenated, dates max/min).
"""
import json
import time
from datetime import datetime
from pathlib import Path

from llm.client import call_llm, parse_json_response

ROOT = Path(__file__).resolve().parent
PROMPTS_DIR = ROOT / "llm" / "prompts"
REFRESH_BATCH_SIZE = 25


# ---------- Phase 1 ----------

def phase1_propose_actions(words, progress=None):
    """One LLM call → list of {german, action, ...}. progress: optional callable(msg)."""
    if progress: progress(f"Phase 1: analyzing {len(words)} words for merges/moves/deletes...")
    prompt = (PROMPTS_DIR / "cleanup_merge.txt").read_text(encoding="utf-8")
    payload = [
        {
            "german": w["german"],
            "article": w.get("article", ""),
            "english_translation": w.get("english_translation", ""),
            "variants": w.get("variants", []),
            "times_seen": w.get("times_seen", 0),
        }
        for w in words
    ]
    raw = call_llm(prompt, json.dumps(payload, ensure_ascii=False), quality="smart")
    parsed = parse_json_response(raw)
    actions = parsed.get("actions", [])

    by_german = {a["german"]: a for a in actions if "german" in a}
    missing = [w["german"] for w in words if w["german"] not in by_german]
    for m in missing:
        actions.append({"german": m, "action": "keep"})
        by_german[m] = actions[-1]

    # Demote bad merges (target not in DB or also being merged/deleted/moved)
    valid_germans = {w["german"] for w in words}
    for a in actions:
        if a.get("action") != "merge":
            continue
        target = a.get("into")
        if target not in valid_germans:
            a["action"] = "keep"; a.pop("into", None); continue
        target_action = by_german.get(target, {}).get("action")
        if target_action in ("merge", "delete", "to_phrase"):
            a["action"] = "keep"; a.pop("into", None)

    return actions


# ---------- Phase 2 ----------

def phase2_refresh_definitions(words, progress=None):
    """Batched LLM calls → {german: {german_definition, english_translation}} for words that change."""
    prompt = (PROMPTS_DIR / "cleanup_refresh.txt").read_text(encoding="utf-8")
    refresh_map = {}
    batches = [words[i:i + REFRESH_BATCH_SIZE] for i in range(0, len(words), REFRESH_BATCH_SIZE)]
    for i, batch in enumerate(batches, 1):
        if progress: progress(f"Phase 2: definitions batch {i}/{len(batches)} ({len(batch)} words)")
        payload = [
            {
                "german": w["german"],
                "article": w.get("article", ""),
                "plural": w.get("plural", ""),
                "preteritum": w.get("preteritum", ""),
                "partizip2": w.get("partizip2", ""),
                "variants": w.get("variants", []),
                "current_definition": w.get("german_definition", ""),
                "current_translation": w.get("english_translation", ""),
                "context_note": w.get("context_note", ""),
            }
            for w in batch
        ]
        try:
            raw = call_llm(prompt, json.dumps(payload, ensure_ascii=False), quality="smart")
            parsed = parse_json_response(raw)
        except Exception as e:
            if progress: progress(f"  batch {i} FAILED: {e}")
            continue
        for a in parsed.get("actions", []):
            if a.get("action") == "rewrite" and a.get("german"):
                refresh_map[a["german"]] = {
                    "german_definition": (a.get("german_definition") or "").strip(),
                    "english_translation": (a.get("english_translation") or "").strip(),
                }
        time.sleep(0.2)
    return refresh_map


def build_proposal(words, progress=None):
    """Run both phases. Returns a proposal dict (no destructive writes)."""
    phase1 = phase1_propose_actions(words, progress=progress)
    counts = {"keep": 0, "merge": 0, "to_phrase": 0, "delete": 0}
    for a in phase1:
        counts[a.get("action", "keep")] = counts.get(a.get("action", "keep"), 0) + 1
    by_german = {a["german"]: a for a in phase1}
    survivors = [w for w in words if by_german.get(w["german"], {}).get("action", "keep") == "keep"]
    refresh = phase2_refresh_definitions(survivors, progress=progress)
    return {
        "generated_at": datetime.now().isoformat(),
        "input_word_count": len(words),
        "phase1_counts": counts,
        "phase1_actions": phase1,
        "phase2_refresh_count": len(refresh),
        "phase2_refresh": refresh,
    }


# ---------- Apply ----------

def merge_word_into(headword, absorbed):
    """Mutate headword in-place to absorb the absorbed entry, preserving history."""
    headword["times_seen"] = headword.get("times_seen", 0) + absorbed.get("times_seen", 0)
    headword["times_correct"] = headword.get("times_correct", 0) + absorbed.get("times_correct", 0)
    headword["box"] = max(headword.get("box", 1), absorbed.get("box", 1))
    if absorbed.get("added_at") and (not headword.get("added_at") or absorbed["added_at"] < headword["added_at"]):
        headword["added_at"] = absorbed["added_at"]
    if absorbed.get("last_seen"):
        if not headword.get("last_seen") or absorbed["last_seen"] > headword["last_seen"]:
            headword["last_seen"] = absorbed["last_seen"]
    headword["starred"] = bool(headword.get("starred")) or bool(absorbed.get("starred"))
    headword["known"] = bool(headword.get("known")) or bool(absorbed.get("known"))
    h_hist = list(headword.get("history", []))
    a_hist = list(absorbed.get("history", []))
    headword["history"] = sorted(h_hist + a_hist, key=lambda x: x.get("timestamp", ""))
    existing = list(headword.get("variants", []))
    new_variants = [absorbed["german"]] + list(absorbed.get("variants", []))
    for v in new_variants:
        if v and v != headword["german"] and v not in existing:
            existing.append(v)
    headword["variants"] = existing
    h_note = (headword.get("context_note") or "").strip()
    a_note = (absorbed.get("context_note") or "").strip()
    if a_note and a_note != h_note:
        headword["context_note"] = (h_note + " | " + a_note).strip(" |")


def apply_proposal(proposal, words_data, phrases_data):
    """Apply the proposal to in-memory data dicts. Mutates them. Returns a summary."""
    word_by_german = {w["german"]: w for w in words_data["words"]}
    phrase_keys = {p["german"] for p in phrases_data["phrases"]}

    actions = proposal["phase1_actions"]
    refresh = proposal.get("phase2_refresh", {})

    summary = {"kept": 0, "merged_away": 0, "moved_to_phrases": 0, "deleted": 0,
               "definitions_refreshed": 0, "skipped": []}

    merges = [a for a in actions if a["action"] == "merge"]
    to_phrases = [a for a in actions if a["action"] == "to_phrase"]
    deletes = [a for a in actions if a["action"] == "delete"]

    for m in merges:
        absorbed = word_by_german.get(m["german"])
        headword = word_by_german.get(m.get("into", ""))
        if not absorbed or not headword:
            summary["skipped"].append(("merge", m["german"], "missing entry")); continue
        merge_word_into(headword, absorbed)
        summary["merged_away"] += 1
        absorbed["_remove"] = True

    for m in to_phrases:
        w = word_by_german.get(m["german"])
        if not w:
            summary["skipped"].append(("to_phrase", m["german"], "missing")); continue
        if w["german"] not in phrase_keys:
            phrases_data["phrases"].append({
                "german": w["german"],
                "context_note": w.get("context_note", ""),
                "german_explanation": w.get("german_definition", ""),
                "english_translation": w.get("english_translation", ""),
                "added_at": w.get("added_at") or datetime.now().isoformat(),
                "starred": bool(w.get("starred")),
            })
            phrase_keys.add(w["german"])
        w["_remove"] = True
        summary["moved_to_phrases"] += 1

    for m in deletes:
        w = word_by_german.get(m["german"])
        if not w:
            summary["skipped"].append(("delete", m["german"], "missing")); continue
        w["_remove"] = True
        summary["deleted"] += 1

    for w in words_data["words"]:
        if w.get("_remove"):
            continue
        r = refresh.get(w["german"])
        if not r:
            continue
        if r.get("german_definition"):
            w["german_definition"] = r["german_definition"]
        if r.get("english_translation"):
            w["english_translation"] = r["english_translation"]
        summary["definitions_refreshed"] += 1

    survivors = [w for w in words_data["words"] if not w.get("_remove")]
    for w in survivors:
        w.pop("_remove", None)
    words_data["words"] = survivors
    summary["kept"] = len(survivors)
    return summary
