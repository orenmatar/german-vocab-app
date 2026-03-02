# German Vocab App

A local-first German vocabulary learning app, **completely written by [Claude](https://claude.ai) (Anthropic's AI)** via Claude Code. No human code was written — the entire codebase, architecture, and feature set was designed and implemented through an AI coding session.

---

## What it does

You add German words you want to learn. The app uses an LLM (Anthropic Claude or OpenAI GPT) to generate practice content around those words — sentences, reading passages, and more — so you learn vocabulary in context rather than from flashcards.

---

## No database — just a local file

There is no database. All data is stored in a single JSON file at `data/words.json`, which is created automatically on first run. Your word list, Leitner box progress, practice history, and grammar hints all live in that file. `data/grammar.json` and `data/settings.json` store your grammar hints and settings respectively.

This means:
- No setup, no migrations, no database server
- Easy to back up — just copy the `data/` folder
- Local only — nothing leaves your machine except LLM API calls

---

## Features

### Adding Words

Type a German word or phrase into the input at the top of the **My Words** tab and hit Add. The LLM automatically:
- Validates that it's a real German word
- Corrects spelling/capitalisation if needed
- Fills in the article (`der`/`die`/`das`), plural form, a German definition, and an English translation

Words are tracked with a **Leitner box** (1–5). New words start in box 1. Every time you practise, correct answers move the word up a box, wrong answers move it down. Words in higher boxes appear less frequently — the system focuses your time on what you don't know yet.

---

### Practice Modes

Hit the **Practice** tab to start. There are two ways to practise:

#### Standard Batch (`Start Practice`)
The app picks ~10 words, weighted by how much you struggle with them, calls the LLM once to generate a sentence for each word, and walks you through them one by one. Each word gets one of these modes depending on its box level:

- **Comprehension** (all boxes) — Read a German sentence with the target word highlighted. Click "Show Translation" to reveal the English translation, the word's definition, and any grammar note. Then rate yourself: *Got it* or *Didn't get it*.

- **Multiple Choice** (box 2+) — The sentence is shown with a blank. Pick the correct word from 4 options. Immediate feedback with the full sentence reveal.

- **Fill in the Blank** (box 3+) — Type the missing word. Umlaut-insensitive matching (ä/ö/ü/ß are forgiven). If you were technically right but typed it differently, there's an "I was actually right" override button.

- **Sentence Writing** (box 4+) — Given just the word and its definition, write your own German sentence using it. The LLM grades your sentence and gives corrected feedback.

After the batch, you see a score and can start the next batch or go back to your word list.

#### Reading Passage (`Reading Passage`)
Instead of word-by-word practice, the LLM writes a short cohesive German text (2–3 paragraphs, ~150 words, B1–B2 level) that naturally incorporates 7–9 of your words. The passage reads like a real story or anecdote, not a textbook exercise.

- **Highlighted words** — vocabulary words appear in teal and are clickable. Click one to see a popup with its German definition (and optionally its English translation, hidden behind a button so you're pushed to understand from German first).
- **Show Translation** — reveals the full English translation of the passage plus any grammar notes.
- **Done Reading** — moves to a review screen where you rate each word: *Knew it* or *Didn't know*. Results update the Leitner boxes.

---

### Grammar Hints

The **Grammar** tab lets you add grammar instructions like:
- `use Konjunktiv II`
- `use a relative clause`
- `use Passiv`
- `write in Perfekt`

When the LLM generates sentences or passages, it randomly assigns these hints to some of the words/passages, weaving grammar practice into your vocabulary sessions automatically. Each sentence that uses a grammar hint shows a short explanation of how the grammar was applied.

You can enable/disable individual hints with the toggle, or delete them. Disabled hints are ignored during practice.

---

### Settings

The **Settings** tab lets you tune how the practice algorithm works — batch size, how aggressively new words are introduced, what box level unlocks each mode, and more. All settings are saved automatically.

---

## Tech stack

- **Backend**: Python 3.12 + Flask
- **Frontend**: Vanilla HTML, CSS, JavaScript — no frameworks, no build tools
- **LLM**: Anthropic Claude (default) or OpenAI GPT, swappable via `LLM_PROVIDER` env var
- **Audio** (optional): OpenAI TTS — if an OpenAI key is set, you can listen to sentences read aloud before seeing them, with speed control

---

## Running locally

**1. Clone and set up**
```bash
git clone https://github.com/orenmatar/german-vocab-app.git
cd german-vocab-app
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**2. Add your API key**
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY or OPENAI_API_KEY
```

**3. Run**
```bash
python app.py
```

Open http://localhost:5000

---

## Project structure

```
app.py                        # Flask server — all routes and API endpoints
selection.py                  # Word selection logic — Leitner weighting
settings.py                   # Settings schema and persistence
llm/
  client.py                   # Provider-agnostic LLM wrapper
  prompts/
    generate_sentences.txt    # Prompt for per-word sentence generation
    generate_passage.txt      # Prompt for reading passage generation
    validate_word.txt         # Prompt for word validation on add
    judge_sentence.txt        # Prompt for grading sentence writing mode
data/                         # Auto-created, gitignored — your local data
  words.json                  # Word list + Leitner progress
  grammar.json                # Grammar hints
  settings.json               # Settings overrides
templates/
  index.html                  # Single-page app
static/
  style.css                   # Styles
  app.js                      # All frontend logic
```
