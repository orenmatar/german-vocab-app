"""
German Vocab Learning App — Flask Server

Run with: python app.py
Opens at: http://localhost:5000
"""

import json
import os
import random
from datetime import datetime, timedelta
from pathlib import Path

from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from dotenv import load_dotenv

from selection import select_words, update_box, select_grammar_for_batch, weighted_sample
from llm.client import call_llm, parse_json_response, generate_tts_audio
import settings

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")
app.permanent_session_lifetime = timedelta(days=30)

DATA_FILE = Path(__file__).parent / "data" / "words.json"
GRAMMAR_FILE = Path(__file__).parent / "data" / "grammar.json"
MISTAKES_FILE = Path(__file__).parent / "data" / "mistakes.json"
PROMPTS_DIR = Path(__file__).parent / "llm" / "prompts"

# --- Auth ---

APP_PASSWORD = os.environ.get("APP_PASSWORD", "")


@app.before_request
def require_auth():
    # Skip auth if no password is configured (local dev)
    if not APP_PASSWORD:
        return None
    # Allow the login page and static files through
    if request.endpoint in ("login", "static"):
        return None
    if not session.get("authenticated"):
        return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        if request.form.get("password") == APP_PASSWORD:
            session["authenticated"] = True
            session.permanent = True
            return redirect(url_for("index"))
        error = "Wrong password."
    return render_template("login.html", error=error)

# --- Data persistence ---

def load_data():
    if not DATA_FILE.exists():
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        save_data({"words": []})
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def find_word(data, german):
    for w in data["words"]:
        if w["german"] == german:
            return w
    return None


def load_grammar():
    if not GRAMMAR_FILE.exists():
        GRAMMAR_FILE.parent.mkdir(parents=True, exist_ok=True)
        save_grammar({"grammar_points": []})
    with open(GRAMMAR_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_grammar(gdata):
    GRAMMAR_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(GRAMMAR_FILE, "w", encoding="utf-8") as f:
        json.dump(gdata, f, indent=2, ensure_ascii=False)


def load_mistakes():
    if not MISTAKES_FILE.exists():
        MISTAKES_FILE.parent.mkdir(parents=True, exist_ok=True)
        save_mistakes({"mistake_patterns": []})
    with open(MISTAKES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_mistakes(mdata):
    MISTAKES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MISTAKES_FILE, "w", encoding="utf-8") as f:
        json.dump(mdata, f, indent=2, ensure_ascii=False)


def _normalize_de(s):
    """Normalize German text for comparison: lowercase, strip umlauts."""
    return s.lower().replace("ä", "a").replace("ö", "o").replace("ü", "u").replace("ß", "ss")


def _is_plausible_form(word, candidate):
    """Check if candidate could plausibly be a conjugated/declined form of word.

    Uses 3-char substring matching with umlaut normalization.
    Returns True if they share any 3-char substring, or if one contains the other.
    For separable verbs (candidate has " / "), checks each part separately.
    """
    w = _normalize_de(word)

    # Handle separable verb notation: "fange / an"
    parts = [p.strip() for p in candidate.split(" / ")] if " / " in candidate else [candidate]

    for part in parts:
        c = _normalize_de(part)
        # Direct containment
        if w in c or c in w:
            return True
        # Shared 3-char substring
        check_len = min(3, len(w))
        for i in range(len(w) - check_len + 1):
            if w[i:i + check_len] in c:
                return True

    return False


# Load data on startup
data = load_data()
grammar_data = load_grammar()
mistakes_data = load_mistakes()


# --- Error handlers (return JSON for API routes) ---

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found"}), 404
    return e

@app.errorhandler(500)
def server_error(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": str(e)}), 500
    return e


# --- Page routes ---

@app.route("/")
def index():
    return render_template("index.html")


# --- API routes ---

@app.route("/api/words", methods=["GET"])
def get_words():
    return jsonify(data["words"])


@app.route("/api/words", methods=["POST"])
def add_word():
    body = request.get_json()
    german = body.get("german", "").strip()

    if not german:
        return jsonify({"error": "Word is required."}), 400

    if find_word(data, german):
        return jsonify({"error": f"'{german}' already exists."}), 409

    word = {
        "german": german,
        "context_note": body.get("context_note", "").strip(),
        "german_definition": body.get("german_definition", "").strip(),
        "english_translation": body.get("english_translation", "").strip(),
        "article": body.get("article", "").strip(),
        "plural": body.get("plural", "").strip(),
        "preteritum": body.get("preteritum", "").strip(),
        "partizip2": body.get("partizip2", "").strip(),
        "added_at": datetime.now().isoformat(),
        "box": 1,
        "starred": False,
        "times_seen": 0,
        "times_correct": 0,
        "last_seen": None,
        # History: array of past practice attempts.
        # To disable history tracking, comment out the "history" lines in this file
        # and in the /api/practice/result endpoint.
        "history": [],
    }

    data["words"].append(word)
    save_data(data)
    return jsonify(word), 201


@app.route("/api/words/stats", methods=["GET"])
def word_stats():
    words_list = data["words"]
    mastered_box = settings.get("MASTERED_BOX")
    total = len(words_list)
    mastered = sum(1 for w in words_list if w.get("box", 1) >= mastered_box)
    never_seen = sum(1 for w in words_list if w.get("times_seen", 0) == 0)
    box1 = sum(1 for w in words_list if w.get("box", 1) == 1)
    active = sum(1 for w in words_list if w.get("times_seen", 0) > 0 and w.get("box", 1) < mastered_box)
    total_seen = sum(w.get("times_seen", 0) for w in words_list)
    total_correct = sum(w.get("times_correct", 0) for w in words_list)
    accuracy = round(total_correct / total_seen * 100) if total_seen > 0 else None
    return jsonify({
        "total": total,
        "mastered": mastered,
        "active": active,
        "never_seen": never_seen,
        "box1": box1,
        "accuracy": accuracy,
    })


@app.route("/api/words/validate", methods=["POST"])
def validate_word():
    body = request.get_json()
    word = body.get("word", "").strip()
    context_note = body.get("context_note", "").strip()

    if not word:
        return jsonify({"error": "Word is required."}), 400

    prompt_path = PROMPTS_DIR / "validate_word.txt"
    system_prompt = prompt_path.read_text(encoding="utf-8")

    user_prompt = json.dumps({"word": word, "context_note": context_note}, ensure_ascii=False)

    try:
        response_text = call_llm(system_prompt, user_prompt)
        result = parse_json_response(response_text)
    except Exception as e:
        return jsonify({"error": f"Validation failed: {str(e)}"}), 500

    return jsonify(result)


@app.route("/api/words/<path:german>", methods=["PATCH"])
def patch_word(german):
    body = request.get_json()
    word = find_word(data, german)
    if not word:
        return jsonify({"error": f"'{german}' not found."}), 404
    if "starred" in body:
        word["starred"] = bool(body["starred"])
    save_data(data)
    return jsonify(word)


@app.route("/api/words/<path:german>", methods=["DELETE"])
def delete_word(german):
    word = find_word(data, german)
    if not word:
        return jsonify({"error": f"'{german}' not found."}), 404

    data["words"].remove(word)
    save_data(data)
    return jsonify({"ok": True})


@app.route("/api/words/<path:german>/reset-box", methods=["POST"])
def reset_word_box(german):
    word = find_word(data, german)
    if not word:
        return jsonify({"error": f"'{german}' not found."}), 404
    word["box"] = 1
    save_data(data)
    return jsonify(word)


@app.route("/api/prep/sample", methods=["GET"])
def prep_sample():
    count = min(int(request.args.get("count", 15)), len(data["words"]))
    if count == 0:
        return jsonify([])
    strategy = request.args.get("strategy", "weighted")
    if strategy == "random":
        selected = random.sample(data["words"], count)
    else:
        selected = weighted_sample(data["words"], count)
    return jsonify(selected)


@app.route("/api/prep/replace", methods=["POST"])
def prep_replace():
    body = request.get_json()
    exclude = set(body.get("exclude", []))
    strategy = body.get("strategy", "weighted")
    pool = [w for w in data["words"] if w["german"] not in exclude]
    if not pool:
        return jsonify({"error": "No more words available to swap in."}), 400
    if strategy == "random":
        word = random.choice(pool)
    else:
        candidates = weighted_sample(pool, min(5, len(pool)))
        word = candidates[0] if candidates else random.choice(pool)
    return jsonify(word)


@app.route("/api/practice/batch", methods=["POST"])
def practice_batch():
    if not data["words"]:
        return jsonify({"error": "No words added yet. Add some words first!"}), 400

    # Select words using weighted formula
    selected = select_words(data["words"])

    if not selected:
        return jsonify({"error": "Could not select words."}), 500

    # Assign grammar hints to batch positions
    grammar_assignments = select_grammar_for_batch(
        len(selected), grammar_data["grammar_points"]
    )

    # Build enriched word objects for the LLM
    word_list = []
    for i, (word, mode) in enumerate(selected):
        entry = {
            "word": word["german"],
            "context_note": word.get("context_note", ""),
            "german_definition": word.get("german_definition", ""),
            "article": word.get("article", ""),
            "plural": word.get("plural", ""),
        }
        if i in grammar_assignments:
            entry["grammar_hint"] = grammar_assignments[i]
        word_list.append(entry)

    # Call LLM for all words
    sentence_map = {}
    if word_list:
        # Load the prompt from file
        prompt_path = PROMPTS_DIR / "generate_sentences.txt"
        system_prompt = prompt_path.read_text(encoding="utf-8")

        user_prompt = json.dumps(word_list, ensure_ascii=False)

        # Call the LLM — one call for the whole batch
        try:
            response_text = call_llm(system_prompt, user_prompt)
            sentences = parse_json_response(response_text)
        except json.JSONDecodeError:
            # Retry once on JSON parse failure
            try:
                response_text = call_llm(system_prompt, user_prompt)
                sentences = parse_json_response(response_text)
            except Exception as e:
                return jsonify({"error": f"Failed to parse LLM response: {str(e)}"}), 500
        except Exception as e:
            return jsonify({"error": f"LLM call failed: {str(e)}"}), 500

        # Build a lookup from LLM results
        for s in sentences:
            sentence_map[s["word"]] = s

    # Build the batch response
    batch = []
    for i, (word, mode) in enumerate(selected):
        german = word["german"]

        s = sentence_map.get(german)
        if not s:
            continue

        # Validate word_in_sentence — LLM sometimes confuses grammar hint
        # elements with the target word. Fall back to the word itself if bad.
        word_in_sentence = s.get("word_in_sentence", german)
        if not _is_plausible_form(german, word_in_sentence):
            word_in_sentence = german

        # Validate blank_answer — if it's not a form of the target word,
        # the blank is wrong. Demote to comprehension mode.
        blank_answer = s.get("blank_answer", german)
        if mode == "multiple_choice":
            if not _is_plausible_form(german, blank_answer):
                mode = "comprehension"

        item = {
            "german": german,
            "mode": mode,
            "sentence": s.get("sentence", ""),
            "translation": s.get("translation", ""),
            "blank_sentence": s.get("blank_sentence", ""),
            "blank_answer": blank_answer,
            "german_definition": word.get("german_definition", ""),
            "english_translation": word.get("english_translation", ""),
            "article": word.get("article", ""),
            "plural": word.get("plural", ""),
            "preteritum": word.get("preteritum", ""),
            "partizip2": word.get("partizip2", ""),
            "word_in_sentence": word_in_sentence,
            "grammar_note": s.get("grammar_note", ""),
        }
        batch.append(item)

    return jsonify({"batch": batch})


@app.route("/api/practice/result", methods=["POST"])
def practice_result():
    body = request.get_json()
    german = body.get("german", "")
    correct = body.get("correct", False)
    mode = body.get("mode", "comprehension")

    word = find_word(data, german)
    if not word:
        return jsonify({"error": f"'{german}' not found."}), 404

    # Update box level
    update_box(word, correct)

    # Update counters
    word["times_seen"] += 1
    if correct:
        word["times_correct"] += 1
    word["last_seen"] = datetime.now().isoformat()

    # Record in history (comment out these lines to disable history tracking)
    word["history"].append({
        "timestamp": datetime.now().isoformat(),
        "mode": mode,
        "correct": correct,
    })

    save_data(data)
    return jsonify({"ok": True, "new_box": word["box"]})


@app.route("/api/practice/passage", methods=["POST"])
def practice_passage():
    if not data["words"]:
        return jsonify({"error": "No words added yet."}), 400

    candidates = weighted_sample(data["words"], min(10, len(data["words"])))
    enabled_grammar = [gp for gp in grammar_data["grammar_points"] if gp.get("enabled", True)]
    selected_grammar = random.sample(enabled_grammar, min(3, len(enabled_grammar)))

    word_list = [
        {
            "word": w["german"],
            "context_note": w.get("context_note", ""),
            "german_definition": w.get("german_definition", ""),
            "english_translation": w.get("english_translation", ""),
            "article": w.get("article", ""),
            "plural": w.get("plural", ""),
        }
        for w in candidates
    ]

    system_prompt = (PROMPTS_DIR / "generate_passage.txt").read_text(encoding="utf-8")
    user_prompt = json.dumps(
        {"words": word_list, "grammar_hints": [gp["hint"] for gp in selected_grammar]},
        ensure_ascii=False,
    )

    try:
        response_text = call_llm(system_prompt, user_prompt)
        result = parse_json_response(response_text)
    except json.JSONDecodeError:
        try:
            response_text = call_llm(system_prompt, user_prompt)
            result = parse_json_response(response_text)
        except Exception as e:
            return jsonify({"error": f"LLM call failed: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": f"LLM call failed: {str(e)}"}), 500

    # Hard-cap at 9 words regardless of what the LLM returned
    result["words_used"] = result.get("words_used", [])[:9]

    # Attach word metadata for the frontend popup
    word_meta = {w["german"]: w for w in data["words"]}
    for wu in result.get("words_used", []):
        meta = word_meta.get(wu["word"], {})
        wu["article"] = meta.get("article", "")
        wu["plural"] = meta.get("plural", "")
        wu["german_definition"] = meta.get("german_definition", "")
        wu["english_translation"] = meta.get("english_translation", "")
        wu["preteritum"] = meta.get("preteritum", "")
        wu["partizip2"] = meta.get("partizip2", "")

    return jsonify(result)


@app.route("/api/practice/writing-setup", methods=["POST"])
def practice_writing_setup():
    """Generate a writing passage prompt: grammar hint + suggested words + topic."""
    if not data["words"]:
        return jsonify({"error": "No words added yet."}), 400

    # Pick a random enabled grammar point (prefer enriched ones)
    enriched_gps = [
        gp for gp in grammar_data["grammar_points"]
        if gp.get("enabled", True) and gp.get("rule_name")
    ]
    grammar_hint = None
    if enriched_gps:
        gp = random.choice(enriched_gps)
        grammar_hint = {
            "rule_name": gp["rule_name"],
            "hint": gp["hint"],
            "explanation": gp["explanation"],
            "examples": gp.get("examples", []),
        }

    # Pick up to 10 suggested words (weighted sample)
    candidates = weighted_sample(data["words"], min(10, len(data["words"])))
    suggested_words = [
        {
            "german": w["german"],
            "article": w.get("article", ""),
            "plural": w.get("plural", ""),
            "preteritum": w.get("preteritum", ""),
            "partizip2": w.get("partizip2", ""),
            "german_definition": w.get("german_definition", ""),
            "english_translation": w.get("english_translation", ""),
        }
        for w in candidates
    ]

    # Generate topic via LLM
    system_prompt = (PROMPTS_DIR / "generate_writing_topic.txt").read_text(encoding="utf-8")
    user_prompt = json.dumps(
        {
            "grammar_hint": grammar_hint,
            "suggested_words": [
                {"word": w["german"], "english_translation": w["english_translation"]}
                for w in suggested_words
            ],
        },
        ensure_ascii=False,
    )

    try:
        response_text = call_llm(system_prompt, user_prompt)
        topic_data = parse_json_response(response_text)
    except Exception as e:
        return jsonify({"error": f"LLM call failed: {str(e)}"}), 500

    return jsonify({
        "grammar_hint": grammar_hint,
        "suggested_words": suggested_words,
        "topic": topic_data.get("topic", ""),
        "topic_de": topic_data.get("topic_de", ""),
        "grammar_connection": topic_data.get("grammar_connection", ""),
    })


@app.route("/api/practice/writing-judge", methods=["POST"])
def practice_writing_judge():
    """Grade a user-written German paragraph."""
    body = request.get_json()
    passage = body.get("passage", "").strip()
    topic = body.get("topic", "").strip()
    grammar_hint = body.get("grammar_hint")
    suggested_word_names = body.get("suggested_words", [])

    if not passage:
        return jsonify({"error": "Passage is required."}), 400

    system_prompt = (PROMPTS_DIR / "judge_writing_passage.txt").read_text(encoding="utf-8")
    user_prompt = json.dumps(
        {
            "passage": passage,
            "topic": topic,
            "grammar_hint": grammar_hint,
            "suggested_words": suggested_word_names,
        },
        ensure_ascii=False,
    )

    try:
        response_text = call_llm(system_prompt, user_prompt,
                                  thinking_budget=8000)
        result = parse_json_response(response_text)
    except Exception as e:
        return jsonify({"error": f"Judging failed: {str(e)}"}), 500

    # Flag whether there are errors worth analyzing (frontend will call /writing-analyze)
    result["has_errors"] = bool(result.get("errors"))
    return jsonify(result)


@app.route("/api/practice/writing-analyze", methods=["POST"])
def practice_writing_analyze():
    """Analyze writing errors and update the persistent mistake patterns."""
    body = request.get_json()
    errors = body.get("errors", [])

    if not errors:
        return jsonify({"ok": True})

    system_prompt = (PROMPTS_DIR / "analyze_mistakes.txt").read_text(encoding="utf-8")
    existing = [
        {"id": mp["id"], "category": mp["category"], "description": mp["description"]}
        for mp in mistakes_data["mistake_patterns"]
    ]
    user_prompt = json.dumps({"errors": errors, "existing_patterns": existing}, ensure_ascii=False)

    try:
        response_text = call_llm(system_prompt, user_prompt,
                                  thinking_budget=6000)
        analysis = parse_json_response(response_text)
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500

    today = datetime.now().date().isoformat()

    # Apply updates to existing patterns
    pattern_map = {mp["id"]: mp for mp in mistakes_data["mistake_patterns"]}
    for upd in analysis.get("updates", []):
        mp = pattern_map.get(upd["id"])
        if mp:
            mp["count"] += 1
            mp["last_seen"] = today
            ex = upd.get("example", {})
            if ex.get("mistake"):
                mp["examples"].append({
                    "mistake": ex["mistake"],
                    "correction": ex["correction"],
                    "date": today,
                })
                # Keep only the 5 most recent examples
                mp["examples"] = mp["examples"][-5:]

    # Add new patterns
    existing_ids = [mp["id"] for mp in mistakes_data["mistake_patterns"]]
    next_num = 1
    while f"mp_{next_num}" in existing_ids:
        next_num += 1

    for np in analysis.get("new_patterns", []):
        if not np.get("category"):
            continue
        ex = np.get("example", {})
        mp = {
            "id": f"mp_{next_num}",
            "category": np["category"],
            "description": np.get("description", ""),
            "count": 1,
            "first_seen": today,
            "last_seen": today,
            "examples": [],
        }
        if ex.get("mistake"):
            mp["examples"].append({
                "mistake": ex["mistake"],
                "correction": ex["correction"],
                "date": today,
            })
        mistakes_data["mistake_patterns"].append(mp)
        next_num += 1

    save_mistakes(mistakes_data)
    return jsonify({"ok": True})


# --- Grammar API ---

@app.route("/api/grammar", methods=["GET"])
def get_grammar():
    return jsonify(grammar_data["grammar_points"])


@app.route("/api/grammar", methods=["POST"])
def add_grammar():
    body = request.get_json()
    raw_input = body.get("hint", "").strip()

    if not raw_input:
        return jsonify({"error": "Hint is required."}), 400

    # Enrich via LLM
    system_prompt = (PROMPTS_DIR / "validate_grammar.txt").read_text(encoding="utf-8")
    try:
        response_text = call_llm(system_prompt, raw_input)
        enriched = parse_json_response(response_text)
    except Exception as e:
        return jsonify({"error": f"Failed to process grammar hint: {str(e)}"}), 500

    if not enriched.get("ok"):
        return jsonify({"error": enriched.get("question", "Could not understand this grammar rule. Please rephrase.")}), 422

    # Generate a simple incremental ID
    existing_ids = [gp["id"] for gp in grammar_data["grammar_points"]]
    next_num = 1
    while f"gp_{next_num}" in existing_ids:
        next_num += 1

    gp = {
        "id": f"gp_{next_num}",
        "hint": enriched["hint"],
        "rule_name": enriched["rule_name"],
        "explanation": enriched["explanation"],
        "examples": enriched.get("examples", []),
        "added_at": datetime.now().isoformat(),
        "enabled": True,
    }

    grammar_data["grammar_points"].append(gp)
    save_grammar(grammar_data)
    return jsonify(gp), 201


@app.route("/api/grammar/enrich-all", methods=["POST"])
def enrich_all_grammar():
    """Enrich any existing grammar points that haven't been processed yet."""
    system_prompt = (PROMPTS_DIR / "validate_grammar.txt").read_text(encoding="utf-8")
    updated = 0

    for gp in grammar_data["grammar_points"]:
        if gp.get("rule_name"):
            continue  # already enriched
        try:
            response_text = call_llm(system_prompt, gp["hint"])
            enriched = parse_json_response(response_text)
            if enriched.get("ok"):
                gp["hint"] = enriched["hint"]
                gp["rule_name"] = enriched["rule_name"]
                gp["explanation"] = enriched["explanation"]
                gp["examples"] = enriched.get("examples", [])
            else:
                # LLM couldn't parse it — use hint as fallback so we don't retry forever
                gp["rule_name"] = gp["hint"]
                gp["explanation"] = ""
                gp["examples"] = []
        except Exception:
            # Mark as processed with fallback so the banner doesn't reappear
            gp["rule_name"] = gp["hint"]
            gp["explanation"] = ""
            gp["examples"] = []
        updated += 1

    if updated:
        save_grammar(grammar_data)
    return jsonify({"updated": updated})


@app.route("/api/grammar/<gp_id>", methods=["PATCH"])
def toggle_grammar(gp_id):
    body = request.get_json()
    for gp in grammar_data["grammar_points"]:
        if gp["id"] == gp_id:
            if "enabled" in body:
                gp["enabled"] = bool(body["enabled"])
            if "raw_input" in body:
                raw = body["raw_input"].strip()
                system_prompt = (PROMPTS_DIR / "validate_grammar.txt").read_text(encoding="utf-8")
                try:
                    response_text = call_llm(system_prompt, raw)
                    enriched = parse_json_response(response_text)
                except Exception as e:
                    return jsonify({"error": f"Failed to process: {str(e)}"}), 500
                if not enriched.get("ok"):
                    return jsonify({"error": enriched.get("question", "Could not understand this grammar rule.")}), 422
                gp["hint"] = enriched["hint"]
                gp["rule_name"] = enriched["rule_name"]
                gp["explanation"] = enriched["explanation"]
                gp["examples"] = enriched.get("examples", [])
            save_grammar(grammar_data)
            return jsonify(gp)
    return jsonify({"error": "Grammar point not found."}), 404


@app.route("/api/grammar/<gp_id>", methods=["DELETE"])
def delete_grammar(gp_id):
    for gp in grammar_data["grammar_points"]:
        if gp["id"] == gp_id:
            grammar_data["grammar_points"].remove(gp)
            save_grammar(grammar_data)
            return jsonify({"ok": True})
    return jsonify({"error": "Grammar point not found."}), 404


# --- Mistakes / Insights API ---

@app.route("/api/mistakes", methods=["GET"])
def get_mistakes():
    patterns = sorted(
        mistakes_data["mistake_patterns"],
        key=lambda x: (-x["count"], x["last_seen"]),
    )
    return jsonify(patterns)


@app.route("/api/mistakes/<mp_id>", methods=["DELETE"])
def delete_mistake(mp_id):
    for mp in mistakes_data["mistake_patterns"]:
        if mp["id"] == mp_id:
            mistakes_data["mistake_patterns"].remove(mp)
            save_mistakes(mistakes_data)
            return jsonify({"ok": True})
    return jsonify({"error": "Pattern not found."}), 404


@app.route("/api/mistakes/<mp_id>/drill", methods=["POST"])
def generate_mistake_drill(mp_id):
    mp = next((m for m in mistakes_data["mistake_patterns"] if m["id"] == mp_id), None)
    if not mp:
        return jsonify({"error": "Pattern not found."}), 404

    system_prompt = (PROMPTS_DIR / "generate_mistake_drill.txt").read_text(encoding="utf-8")
    user_prompt = json.dumps(
        {
            "category": mp["category"],
            "description": mp["description"],
            "examples": mp.get("examples", [])[-3:],
        },
        ensure_ascii=False,
    )

    try:
        response_text = call_llm(system_prompt, user_prompt)
        exercises = parse_json_response(response_text)
    except Exception as e:
        return jsonify({"error": f"Drill generation failed: {str(e)}"}), 500

    return jsonify({"exercises": exercises})


# --- Audio API ---

@app.route("/api/practice/audio", methods=["POST"])
def practice_audio():
    body = request.get_json()
    text = body.get("text", "").strip()

    if not text:
        return jsonify({"error": "Text is required."}), 400

    audio_b64 = generate_tts_audio(text)
    if audio_b64 is None:
        return jsonify({"error": "Audio generation unavailable."}), 503

    return jsonify({"audio": f"data:audio/mp3;base64,{audio_b64}"})


# --- Config API ---

@app.route("/api/config", methods=["GET"])
def get_config():
    audio_enabled = bool(os.environ.get("OPENAI_API_KEY"))
    return jsonify({"audio_enabled": audio_enabled})



# --- Settings API ---

@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(settings.get_schema_with_values())


@app.route("/api/settings", methods=["PATCH"])
def update_settings():
    body = request.get_json()
    settings.update(body)
    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, port=port)
