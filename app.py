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
        "added_at": datetime.now().isoformat(),
        "box": 1,
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


@app.route("/api/words/<german>", methods=["DELETE"])
def delete_word(german):
    word = find_word(data, german)
    if not word:
        return jsonify({"error": f"'{german}' not found."}), 404

    data["words"].remove(word)
    save_data(data)
    return jsonify({"ok": True})


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

    # Build enriched word objects for the LLM (skip sentence_writing words)
    word_list = []
    for i, (word, mode) in enumerate(selected):
        if mode == "sentence_writing":
            continue
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

    # Call LLM for non-sentence-writing words
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

        if mode == "sentence_writing":
            # Optionally attach a grammar challenge (enriched points only)
            sw_grammar = None
            enriched_gps = [
                gp for gp in grammar_data["grammar_points"]
                if gp.get("enabled", True) and gp.get("rule_name")
            ]
            if enriched_gps and random.random() < 0.6:
                gp = random.choice(enriched_gps)
                sw_grammar = {
                    "rule_name": gp["rule_name"],
                    "hint": gp["hint"],
                    "explanation": gp["explanation"],
                    "examples": gp.get("examples", []),
                }

            item = {
                "german": german,
                "mode": mode,
                "sentence": "",
                "translation": "",
                "blank_sentence": "",
                "blank_answer": german,
                "german_definition": word.get("german_definition", ""),
                "word_in_sentence": german,
                "grammar_note": "",
                "sw_grammar": sw_grammar,
            }
            batch.append(item)
            continue

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
        if mode in ("fill_in_the_blank", "multiple_choice"):
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

    return jsonify(result)


@app.route("/api/practice/judge", methods=["POST"])
def practice_judge():
    body = request.get_json()
    word = body.get("word", "").strip()
    sentence = body.get("sentence", "").strip()
    german_definition = body.get("german_definition", "").strip()

    if not word or not sentence:
        return jsonify({"error": "Word and sentence are required."}), 400

    prompt_path = PROMPTS_DIR / "judge_sentence.txt"
    system_prompt = prompt_path.read_text(encoding="utf-8")

    grammar_rule = body.get("grammar_rule", "").strip()
    rule_name = body.get("rule_name", "").strip()

    judge_input = {
        "word": word,
        "german_definition": german_definition,
        "sentence": sentence,
    }
    if grammar_rule:
        judge_input["grammar_rule"] = grammar_rule
        judge_input["rule_name"] = rule_name

    user_prompt = json.dumps(judge_input, ensure_ascii=False)

    try:
        response_text = call_llm(system_prompt, user_prompt)
        result = parse_json_response(response_text)
    except Exception as e:
        return jsonify({"error": f"Judging failed: {str(e)}"}), 500

    return jsonify(result)


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
