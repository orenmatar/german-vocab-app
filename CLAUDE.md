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
settings.py             # App settings definitions and defaults
llm/
  client.py             # Provider-agnostic LLM wrapper (Anthropic/OpenAI)
  prompts/
    validate_word.txt           # Validates/corrects new words; returns article, plural, preteritum, partizip2
    generate_sentences.txt      # Generates a batch of 10 practice sentences
    generate_passage.txt        # Generates a reading passage using ~8 vocab words
    validate_grammar.txt        # Enriches messy grammar notes into structured rule_name/explanation/examples
    validate_phrase.txt         # Validates/corrects a German phrase; returns german_explanation + english_translation
    generate_writing_topic.txt  # Generates a writing topic from a grammar hint + suggested words
    judge_writing_passage.txt   # Grades user's paragraph (score, grammar usage, vocab, corrections)
    analyze_mistakes.txt        # Groups writing errors into recurring patterns; updates pattern list
    generate_mistake_drill.txt  # Generates targeted fill-in-the-blank drill for a specific mistake pattern
    judge_sentence.txt          # Legacy — graded sentence writing (mode removed); kept for reference
    judge_translation.txt       # Reserved for future use
data/
  words.json            # Word list + Leitner box progress
  grammar.json          # Grammar hints + enriched rule data
  phrases.json          # Multi-word phrases / idioms / sentence openers
  insights.json         # Recurring writing mistake patterns
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
- `context_note` — optional user hint at add time (editable post-hoc; see Edit Word modal)
- `variants` — optional list of related forms the user wants practiced together (e.g. `Dreck` with `["dreckig"]`, `Gestank` with `["stinken"]`). Passed to sentence/passage generation prompts; the LLM may use a variant in place of the headword in any given sentence. `_is_plausible_form()` accepts variants when validating `word_in_sentence` and `blank_answer`. Backfilled to `[]` on read for old entries.
- `added_at` — ISO timestamp of when word was added
- `times_seen` — total number of practice rounds this word has appeared in
- `times_correct` — total correct answers
- `last_seen` — ISO timestamp of last practice, or null

## Phrase Schema
Each entry in `phrases.json` has:
- `german` — the phrase (unique key; multi-word expressions like "auf jeden Fall", "es ist bekannt, dass", "du kannst immer noch X")
- `german_explanation` — short German explanation, usually ending with "z.B.: [example]"
- `english_translation` — concise English equivalent
- `context_note` — optional hint/example from the user (passed to the LLM at add time to disambiguate meaning)
- `starred` — bool, user-marked important phrase
- `added_at` — ISO timestamp

No Leitner box, no times_seen. Adding a phrase goes through `validate_phrase.txt` (same flow as words: corrects typos/capitalization, fills explanation + translation, prompts the user to accept corrections).

## Grammar Schema
Each entry in `grammar.json` has:
- `hint` — original user text (preserved)
- `rule_name` — clean grammatical name (e.g. "Konjunktiv II")
- `explanation` — 1–2 sentence explanation
- `examples` — list of 3 example sentences
- `enabled` — bool, whether it appears in practice

## LLM Model Strategy
Two quality tiers, both providers:

| Tier | Anthropic | OpenAI |
|------|-----------|--------|
| `fast` (default) | `claude-haiku-4-5-20251001` | `gpt-4o-mini` |
| `smart` | `claude-sonnet-4-5` | `gpt-4o` |

- Pass `quality="fast"` or `quality="smart"` to `call_llm()`. Default is `"fast"`.
- `thinking_budget` (int) enables Anthropic extended thinking and **auto-promotes to `smart`**. Ignored for OpenAI.
- **Fast tasks**: word validation, phrase validation, sentence generation, passage generation, topic generation, grammar validation, mistake drill
- **Smart tasks**: writing judge (`thinking_budget=8000`), mistake analysis (`thinking_budget=6000`)
- To swap models, edit `ANTHROPIC_FAST_MODEL` / `ANTHROPIC_SMART_MODEL` / `OPENAI_FAST_MODEL` / `OPENAI_SMART_MODEL` in `llm/client.py` — no other changes needed.

## Key Architecture Decisions
- **Words are keyed by their German text** — no separate IDs. `german` field is the unique key everywhere.
- **Leitner box system** (boxes 1–5) drives word selection weighting and mode selection.
- **LLM is called once per batch** (10 words), not per word. Prompts are read from files at runtime.
- **JSON is saved after every action** (add/delete/practice result). No caching concerns — it's local.
- **Word card component** (`buildWordCard()` in app.js) — reusable HTML snippet showing article, word, plural, Prät., Partizip II, German definition, and translation-on-click. Used in all practice reveal areas.
- **Practice actions component** (`buildPracticeActions()` in app.js) — renders ★ star and ✕ delete mini-buttons for use inside practice sessions. Supports custom onclick function names via `opts.starFn` / `opts.deleteFn` so the same helper works in both sentence practice and passage review.
- **In-session deletion safety** — words deleted during sentence practice are added to `deletedDuringSession` (a Set). `advanceToNext()` skips any upcoming batch items for deleted words. Words deleted on the passage review screen are tracked in `passageDeletedWords` and skipped when recording results on Finish.
- **Grammar enrichment** — when user adds/edits a grammar note, it passes through `validate_grammar.txt` LLM to produce structured data. `enrich-all` endpoint handles legacy notes.
- **Custom modal system** — `showAlert(msg)` and `showConfirm(msg, okText, cancelText)` in app.js replace all native `alert()`/`confirm()` calls, which are blocked by Arc and modern Chromium. Both return Promises; all callers use `await`.
- **Flask JSON error handlers** — 404 and 500 on `/api/*` routes return `{"error": "..."}` JSON instead of HTML. The fetch helper in app.js checks `Content-Type` before calling `.json()` and shows a readable message if it gets HTML.
- **URL routing for words with slashes** — word routes use `<path:german>` converter so names like "abnehmen / zunehmen" don't break Flask routing.

## Practice Modes (batch of 10 words)
- **Comprehension** (all boxes): Read LLM sentence, reveal translation + word card, self-rate got it / didn't.
- **Multiple choice** (box 2+): Sentence with blank, pick correct word from 4 options. On a wrong answer, shows a word card for the picked word (so user can learn what it actually means) before showing the correct word's card.
- **Reading passage** (separate flow): LLM writes a 2–3 paragraph text using ~8 vocab words. Words are highlighted and clickable (shows word card popup). After reading, user rates each word knew/didn't.
- **Writing passage** (separate flow): LLM picks a grammar hint + 10 word suggestions + generates a topic. User writes a paragraph, LLM grades it (score, grammar usage, vocab detected, corrections).
- **Free Write** (separate flow): User writes their own text on any topic. Optionally picks a grammar focus from enabled grammar points (dropdown with live preview). Same judge/feedback/insights pipeline as Writing Passage. No suggested words or LLM-generated topic. Ctrl/Cmd+Enter submits.

## In-Practice Word Management
After the word reveal in sentence practice (comprehension + MC), and on the passage review screen, each word card shows ★ and ✕ buttons so the user can star or delete a word without leaving the session.
- **Star**: immediate PATCH to backend, updates `words` array and button state in place.
- **Delete**: confirm dialog → DELETE to backend → word removed from `words` array → session continues safely (deleted words skipped going forward).

## Edit Word Modal
Each row in the Words list has a ✎ pencil button that opens a modal to edit `context_note` and `variants` (comma-separated text → list). PATCH `/api/words/<path:german>` accepts both fields (in addition to `starred`). Used for words added before variants existed, or to add a hint after first practicing.

## Add-word Validation Flow
- `validate_word.txt` validates the main word AND any variants in a single LLM call. Returns `corrected_variants` + `variants_note`.
- Frontend silently accepts the corrections when the change is only case/umlaut/ß (uses `normalize()` and `sameNormalizedSet()` helpers in app.js). Anything bigger (real spelling fix, dropped unrecognizable variant) shows a single combined confirm dialog so the user can accept or cancel.
- The LLM is instructed to be generous with variant corrections (umlauts, case, small typos) and only DROP a variant if it's truly gibberish — drops are summarized in `variants_note`.

## Words Page — Statistics Bar
Above the word list, a row of stat tiles shows:
- **Mastered** (green) — `box >= MASTERED_BOX` setting (default 4)
- **In progress** — `times_seen > 0` and not yet mastered
- **Never seen** (grey) — `times_seen == 0`, words added but never practiced
- **Box 1 only** (red) — still at box 1
- **Accuracy %** — overall `times_correct / times_seen` across all words
Stats are fetched from `/api/words/stats` and refresh on add/delete.

## Prep Tab
A "Conversation Prep" tab for sampling words to review before social situations.

**Config:** batch size (5–30, default 15) + selection strategy (weighted by box / random).

**Per-card actions:**
- 🔒 **Lock** — pin word so it survives Reshuffle (visual border highlight)
- ★ **Star** — toggle star, synced to DB and main word list
- **↺ Reset box** — reset word's Leitner box to 1 (also available on the Words page)
- **⟳ Replace** — swap this word for a different one without touching the DB
- **✕ Delete** — remove from DB (with confirm)

**Toolbar actions:**
- **↺ Reshuffle** — re-sample all unlocked slots
- **Copy (full)** — clipboard text: `1. der Hund (Pl. die Hunde) — german def — translation`
- **Copy (words)** — clipboard text: `1. der Hund (Pl. die Hunde)` (words + forms only)
- **🖨 Print** — `window.print()` with print CSS: nav/buttons hidden, 2-column card grid

**Backend endpoints:**
- `GET /api/prep/sample?count=N&strategy=weighted|random`
- `POST /api/prep/replace` — `{exclude: [...], strategy}` → returns one replacement word
- `POST /api/words/<path:german>/reset-box` — resets box to 1 (used by both Prep and Words page)

**Copy format (full):**
- Nouns: `der Hund (Pl. die Hunde) — ein domestiziertes Tier... — dog`
- Verbs: `gehen (ging · gegangen) — sich fortbewegen — to go`
- Other: `schnell — mit hoher Geschwindigkeit — fast`

## Phrases Tab
Collection-only tab (no practice flow yet) for multi-word expressions / idioms / sentence openers. Sits right after "My Words" in the nav. Uses the wide content layout.

- **Add form**: phrase input + optional context-note input. Context is passed to `validate_phrase.txt` so the LLM disambiguates the right meaning (e.g. "Bank" — money vs. seat).
- **LLM enrichment**: corrects typos/capitalization (e.g. "auf jedem fall" → "auf jeden Fall"), fills `german_explanation` + `english_translation`. User is asked to accept any correction before save.
- **Per-phrase actions**: ★ star, ✕ delete. No box dots, no stats.
- **List controls**: starred-only filter, sort by Date Added / Alphabetical.

**Backend endpoints:**
- `GET /api/phrases`
- `POST /api/phrases` — save a phrase
- `POST /api/phrases/validate` — `{phrase, context_note}` → `{is_valid, corrected, german_explanation, english_translation, correction_note}`
- `PATCH /api/phrases/<path:german>` — `{starred}`
- `DELETE /api/phrases/<path:german>`

## Insights Tab
Tracks recurring writing mistake patterns over time. After each Writing Passage session, corrections are passed through `analyze_mistakes.txt` to cluster them into named patterns (e.g. "Wrong case after preposition"). Patterns are stored in `data/insights.json`. From the Insights tab, users can click "Practice" on any pattern to run a targeted fill-in-the-blank drill generated by `generate_mistake_drill.txt`.

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
- Update CLAUDE.md with any meaningful changes
