# German Vocab App

A local-only German vocabulary learning app. Users add German words, then practice them by reading LLM-generated sentences that use the words in context.

## Tech Stack
- **Backend**: Python 3.12 + Flask (venv at `.venv/`)
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks, no build tools)
- **Data**: Single JSON file (`data/words.json`)
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
    generate_sentences.txt   # System prompt for sentence generation (editable without code changes)
    judge_translation.txt    # Reserved for future translation mode
data/
  words.json            # All persistent data — word list + progress
templates/
  index.html            # Single-page app served by Flask
static/
  style.css             # Warm, clean design — Source Serif 4 + Inter fonts
  app.js                # Frontend logic — word management, practice flow, batch handling
```

## Key Architecture Decisions
- **Words are keyed by their German text** — no separate IDs. `german` field is the unique key everywhere.
- **Leitner box system** (boxes 1–5) drives word selection weighting and mode selection.
- **LLM is called once per batch** (10 words), not per word. Prompts are read from files at runtime.
- **Umlaut-insensitive comparison** for fill-in-the-blank: ä→a, ö→o, ü→u, ß→ss, then lowercase.
- **JSON is saved after every action** (add/delete/practice result). No caching concerns — it's local.

## Practice Modes
- **Comprehension** (all boxes): Read a German sentence, reveal translation, self-rate.
- **Fill-in-the-blank** (box 2+): Type the missing word. Includes "I was actually right" override.

## Conventions
- Keep it simple — no unnecessary dependencies or over-engineering
- No package managers or build steps
- Selection formulas in `selection.py` are clearly commented for easy tweaking
- LLM prompts live in text files, not hardcoded in Python
