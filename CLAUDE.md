# German Vocab App

A local-only German vocabulary learning app. Users add German words, practice them via LLM-generated exercises, and track progress with a Leitner spaced-repetition system.

## Tech Stack
- **Backend**: Python 3.12 + Flask (venv at `.venv/`)
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks, no build tools)
- **Data**: JSON files in `data/` (no database)
- **LLM**: Anthropic or OpenAI (swappable via `LLM_PROVIDER` env var)

## Running
```
python app.py  →  http://localhost:5000
```
API keys configured in `.env` (see `.env.example`).

## Project Structure
```
app.py                  # Flask server — all routes and API endpoints
selection.py            # Word selection logic — weighted random formula (easy to tweak)
llm/
  client.py             # Provider-agnostic LLM wrapper (Anthropic/OpenAI)
  prompts/
    validate_word.txt        # Validates/corrects new words; returns article, plural, preteritum, partizip2
    generate_sentences.txt   # Generates a batch of 10 practice sentences
    judge_sentence.txt       # Grades user's sentence-writing attempt; optionally checks grammar rule
    generate_passage.txt     # Generates a reading passage using ~8 vocab words
    validate_grammar.txt     # Enriches messy grammar notes into structured rule_name/explanation/examples
    judge_translation.txt    # Reserved for future use
data/
  words.json            # Word list + Leitner box progress
  grammar.json          # Grammar hints + enriched rule data
  settings.json         # User preferences for practice sessions
templates/
  index.html            # Single-page app served by Flask
static/
  style.css             # Warm, clean design — Source Serif 4 + Inter fonts
  app.js                # Frontend logic — word management, practice flow, batch handling
```

## Word Schema
Each word in `words.json` has:
- `german` — canonical form (unique key; nouns capitalized, verbs infinitive)
- `article` — "der"/"die"/"das" or "" for non-nouns
- `plural` — plural form or ""
- `preteritum` — 3rd person sg Präteritum or "" for non-verbs
- `partizip2` — Partizip II or "" for non-verbs
- `german_definition` — simple German definition
- `english_translation`
- `box` — Leitner box 1–5
- `starred` — bool, user-marked important word; gets 2× weight boost in selection (default false; old words without this field treated as false)
- `context_note` — optional user hint at add time

## Grammar Schema
Each entry in `grammar.json` has:
- `hint` — original user text (preserved)
- `rule_name` — clean grammatical name (e.g. "Konjunktiv II")
- `explanation` — 1–2 sentence explanation
- `examples` — list of 3 example sentences
- `enabled` — bool, whether it appears in practice

## Key Architecture Decisions
- **Words are keyed by their German text** — no separate IDs. `german` field is the unique key everywhere.
- **Leitner box system** (boxes 1–5) drives word selection weighting and mode selection.
- **LLM is called once per batch** (10 words), not per word. Prompts are read from files at runtime.
- **Umlaut-insensitive comparison** for fill-in-the-blank: ä→a, ö→o, ü→u, ß→ss, then lowercase.
- **JSON is saved after every action** (add/delete/practice result). No caching concerns — it's local.
- **Word card component** (`buildWordCard()` in app.js) — reusable HTML snippet showing article, word, plural, Prät., Partizip II, German definition, and translation-on-click. Used in all practice reveal areas.
- **Grammar enrichment** — when user adds/edits a grammar note, it passes through `validate_grammar.txt` LLM to produce structured data. `enrich-all` endpoint handles legacy notes.

## Practice Modes (batch of 10 words)
- **Comprehension** (all boxes): Read LLM sentence, reveal translation + word card, self-rate got it / didn't.
- **Multiple choice** (box 2+): Sentence with blank, pick correct word from 4 options.
- **Fill-in-the-blank** (box 3+): Type the missing word. Umlaut-tolerant. "I was actually right" override.
- **Reading passage** (separate flow): LLM writes a 2–3 paragraph text using ~8 vocab words. Words are highlighted and clickable (shows word card popup). After reading, user rates each word knew/didn't.
- **Writing passage** (separate flow): LLM picks a grammar hint + 10 word suggestions + generates a topic. User writes a paragraph, LLM grades it (score, grammar usage, vocab detected, corrections).

## Audio
- Optional TTS audio in comprehension mode (listen before reading the sentence).
- Enabled via opt-in checkbox on practice start screen; speed controls (1x, 0.8x, 0.65x).
- Audio is fetched per-sentence from `/api/tts`.

## Conventions
- Keep it simple — no unnecessary dependencies or over-engineering
- No package managers or build steps
- Selection formulas in `selection.py` are clearly commented for easy tweaking
- LLM prompts live in text files, not hardcoded in Python

## After each coding session
- Always commit AND push changes to remote: `git add -A && git commit -m "..." && git push`
- Update CLAUDE.md file and the README.md file with any meaningful changes, if relevant