# German Vocab Learning App — Claude Code Instructions

## Overview

Build a local-only German vocabulary learning app. The user adds German words, then practices them by reading LLM-generated sentences that use those words in context — not by memorizing flashcard translations.

Stack: Python (Flask) backend, vanilla HTML/CSS/JS frontend, single JSON file for all data, LLM API for sentence generation.

The user launches it with `python app.py`, opens `localhost:5000` in a browser, and everything runs locally.

---

## Architecture

```
german-vocab/
├── app.py                  # Flask server — routes, API endpoints, LLM calls
├── llm/
│   ├── client.py           # Provider-agnostic LLM wrapper (swap OpenAI/Anthropic/etc easily)
│   └── prompts/
│       ├── generate_sentences.txt    # System prompt for sentence generation
│       └── judge_translation.txt     # System prompt for judging user translations (future)
├── data/
│   └── words.json          # All persistent data — word list + progress
├── static/
│   ├── style.css
│   └── app.js
├── templates/
│   └── index.html          # Single page app (or a couple of pages)
├── selection.py             # Word selection logic — weighted random, easy to swap formulas
├── requirements.txt         # flask, requests (or anthropic/openai SDK)
└── .env                     # API key (ANTHROPIC_API_KEY or OPENAI_API_KEY)
```

---

## Data Model — `words.json`

```json
{
  "words": [
    {
      "german": "aber",
      "context_note": "from my textbook chapter 3",
      "added_at": "2025-01-15T10:30:00",
      "box": 1,
      "times_seen": 0,
      "times_correct": 0,
      "last_seen": null,
      "history": [
        {
          "timestamp": "2025-01-16T09:00:00",
          "mode": "comprehension",
          "correct": true
        }
      ]
    }
  ]
}
```

Fields:
- `german`: The word itself. **This is the unique key** — no separate ID needed. Use it to look up words everywhere.
- `context_note`: Optional — user can note where they saw it.
- `added_at`: Timestamp.
- `box`: Integer 1–5 (Leitner-style). Starts at 1. Used in selection weighting.
- `times_seen`, `times_correct`: Running counters.
- `last_seen`: Timestamp of last practice.
- `history`: Array of past practice attempts. **Optional/low priority.** Include it but keep entries minimal (just timestamp, mode, correct — no sentence text). Even with 500 words × 50 attempts each, the JSON stays well under 5MB and saves in milliseconds. Add a code comment making it easy to disable if the user decides they don't want it.

The JSON file is read on startup and written after every practice action. Keep it simple — just `json.dump` every time.

---

## Word Selection — `selection.py`

This module picks which words to practice next. **It must be very easy to modify the formulas.**

Export a single function: `select_words(words: list, count: int = 10) -> list`

The function should:
1. Take the full word list and return `count` words to practice.
2. Assign a weight to each word based on configurable factors.
3. Do weighted random sampling (without replacement) to pick the batch.

### Default weighting formula

```python
def compute_weight(word):
    box = word["box"]
    times_seen = word["times_seen"]
    last_seen = word["last_seen"]  # datetime or None
    
    # Base weight — lower box = higher weight
    base = 1.0 / (2 ** (box - 1))
    # So box 1 = 1.0, box 2 = 0.5, box 3 = 0.25, box 4 = 0.125, box 5 = 0.0625
    
    # Time decay — words not seen recently get a boost
    if last_seen is None:
        recency_boost = 2.0  # Never seen = high priority
    else:
        hours_since = (now - last_seen).total_seconds() / 3600
        recency_boost = min(2.0, 1.0 + hours_since / 24.0)  # Grows over days
    
    # New word boost — words seen < 3 times get extra weight so they repeat
    repetition_boost = 2.0 if times_seen < 3 else 1.0
    
    return base * recency_boost * repetition_boost
```

Then normalize: `probability[i] = weight[i] / sum(all_weights)`

**Important**: Put the formula in a clearly marked section with comments. The user will want to tweak these constants and possibly the whole formula. Make it obvious how to do that.

### Box progression rules

- Correct answer → `box = min(box + 1, 5)`
- Wrong answer → `box = max(box - 1, 1)` (go down one, not all the way to 1 — less punishing)

These rules should also be easy to change (e.g., the user might want wrong → box 1).

---

## Practice Modes

### Mode 1: Comprehension

1. Show a German sentence that uses the target word (the target word is visually highlighted — bold or colored).
2. User reads it, thinks about the meaning.
3. User clicks "Show Translation" → English translation appears below.
4. User clicks "Got it ✓" or "Didn't get it ✗".
5. Move to next word.

**Available for all words, regardless of box level.**

### Mode 2: Fill-in-the-Blank

1. Show the German sentence with the target word replaced by a blank: `Ich bin müde, _____ ich kann nicht schlafen.`
2. User types their answer in an input field.
3. On submit:
   - **Comparison ignores umlauts.** Normalize both strings: ä→a, ö→o, ü→u, ß→ss, then compare lowercase. So if the answer is "aber" and user types "aber", that's correct. If the word is "über" and user types "uber", that's also correct.
   - If correct → show green confirmation, mark correct, move on.
   - If wrong → show the correct answer, BUT also show an "I was actually right" button (because sometimes multiple words fit the blank). If user clicks that → count it as correct.
4. Move to next word.

**Only offered for words with `box >= 2`** (i.e., they've gotten it right at least once in comprehension mode). This threshold should be a simple constant to change.

### Mode selection logic

When building a batch:
- For each selected word, pick the mode based on its box level.
- Box 1: always comprehension.
- Box 2+: randomly choose between comprehension and fill-in-the-blank (e.g., 50/50, or weighted toward fill-in-the-blank for higher boxes). Make this ratio easy to configure.

---

## LLM Integration

### `llm/client.py`

A thin wrapper that abstracts the LLM provider. Should look roughly like:

```python
def call_llm(system_prompt: str, user_prompt: str, model: str = None) -> str:
    """
    Calls the configured LLM provider and returns the response text.
    Provider is determined by env var LLM_PROVIDER (default: "anthropic").
    API key from env var (ANTHROPIC_API_KEY or OPENAI_API_KEY).
    """
```

Support at least Anthropic and OpenAI. The user should be able to switch by changing one env variable. Use the respective Python SDKs (anthropic, openai).

### `llm/prompts/generate_sentences.txt`

This is the system prompt for generating practice sentences. It should be a plain text file that the code reads at runtime, so the user can edit it without touching code.

The prompt should instruct the model to:
- Generate one German sentence per word, plus its English translation.
- Keep sentences relatively simple (A2–B1 level).
- Use the word clearly and naturally — the sentence should make the word's meaning obvious from context.
- Vary grammatical structures: different verb conjugations (ich/du/er/wir/ihr/sie), different tenses (Präsens, Perfekt, Präteritum), Akkusativ and Dativ cases where applicable, different sentence structures.
- For nouns: use with articles, vary between definite/indefinite, show plural forms sometimes.
- For verbs: conjugate differently each time, use in main and subordinate clauses.
- Return JSON array.

Expected input to LLM (user message): a JSON list of German words.

Expected output from LLM:
```json
[
  {
    "word": "aber",
    "sentence": "Ich bin müde, aber ich kann nicht schlafen.",
    "translation": "I am tired, but I can't sleep.",
    "blank_sentence": "Ich bin müde, _____ ich kann nicht schlafen."
  }
]
```

The prompt should explicitly ask for the `blank_sentence` field where the target word is replaced with `_____`.

### Error handling

If the LLM call fails (network, rate limit, bad JSON), show a clear error in the UI and let the user retry. Don't crash.

---

## Batch Flow — Step by Step

This is the core practice loop. It must be very clear how batching works.

### What a "batch" is

A batch = 10 words selected from the user's word list, plus LLM-generated sentences for those 10 words. The user practices one word at a time within a batch. When they finish all 10, they can request the next batch.

### Detailed sequence

**1. User clicks "Start Practice" (or "Continue" after finishing a batch)**

Frontend sends: `POST /api/practice/batch`

**2. Backend selects words**

- `selection.py` picks 10 words (or fewer if the word list is smaller) using the weighted formula.
- For each word, decide the practice mode based on box level (comprehension vs fill-in-the-blank).

**3. Backend calls the LLM — one call for the whole batch**

- Build the user prompt: a JSON list of the 10 selected German words.
- Send it to the LLM with the system prompt from `llm/prompts/generate_sentences.txt`.
- The LLM returns a JSON array with one sentence per word (German sentence, English translation, and a version with the target word blanked out).
- Parse the JSON response. If parsing fails, retry once, then return an error.

**4. Backend returns the full batch to the frontend**

Response format:
```json
{
  "batch": [
    {
      "german": "aber",
      "mode": "comprehension",
      "sentence": "Ich bin müde, aber ich kann nicht schlafen.",
      "translation": "I am tired, but I can't sleep.",
      "blank_sentence": "Ich bin müde, _____ ich kann nicht schlafen."
    },
    {
      "german": "schnell",
      "mode": "fill_in_the_blank",
      "sentence": "Der Zug fährt sehr schnell durch die Stadt.",
      "translation": "The train goes very fast through the city.",
      "blank_sentence": "Der Zug fährt sehr _____ durch die Stadt."
    }
  ]
}
```

**5. Frontend presents words one at a time**

- Show word 1 of 10 in the appropriate mode.
- User interacts (reads + reveals + rates, or types answer).
- On answer: frontend sends `POST /api/practice/result` with the word and result.
- Backend updates the word's box/counters/history and saves JSON.
- Frontend shows brief feedback, then moves to word 2 of 10.
- Show progress: "3 / 10".

**6. Batch complete**

- After word 10, show a summary: "7/10 correct" or similar.
- Two buttons: "Next Batch" (goes back to step 1) or "Done" (returns to word list).
- "Next Batch" triggers a new `POST /api/practice/batch`, which selects a fresh 10 words (the selection formula will naturally pick different words because the ones just practiced have updated `last_seen` timestamps and possibly higher boxes).

### Important notes on batching

- The LLM call happens ONCE per batch, not per word. This keeps it fast and cheap.
- The frontend should show a loading spinner/message while waiting for the LLM (can take a few seconds).
- If the user has fewer than 10 words, just use all of them.
- If the user has 0 words, show a message: "Add some words first!" with a link to the word list.
- Each batch is independent. There's no need to track batch state on the backend — the frontend holds the current batch in memory and sends results one at a time.

---

## Pages / UI

Single-page app with two views, switched via tabs or navigation at the top.

### Design direction

Clean, warm, focused. Think "nice notebook" — not flashy, not corporate. 

- Muted warm background (off-white / light cream).
- A single accent color for interactive elements (a warm teal or muted blue-green).
- Clean readable typography — something like Source Serif for sentences (readability matters for German text), and a clean sans-serif for UI elements. Load from Google Fonts.
- Generous spacing. The practice view should feel calm, not cluttered.
- Cards with subtle shadows for sentence display.
- Smooth but minimal transitions (fade in sentences, subtle button feedback).
- Mobile-friendly isn't required (desktop use) but don't make it unusable on smaller screens.

### View 1: Word List ("My Words")

- Text input field to add a new German word.
- Optional text input for context note.
- "Add" button. On add, the word is saved to the JSON immediately.
- Below: a table/list of all words, showing:
  - The word
  - Box level (maybe as dots or a small visual indicator)
  - Times seen / times correct
  - Context note (if any)
  - A delete button (with confirmation)
- Optionally: sort by box level, by date added, alphabetically.
- Show total word count somewhere.

### View 2: Practice

- A "Start Practice" button.
- When clicked:
  1. Backend selects 10 words using the selection formula.
  2. Backend calls the LLM to generate sentences for those 10 words.
  3. Show a loading indicator while waiting for LLM response.
  4. Present words one at a time in the appropriate mode (comprehension or fill-in-the-blank).
- Progress indicator: "3 / 10" or a simple progress bar.
- After each answer, show brief feedback, then auto-advance or have a "Next" button.
- After finishing 10 words:
  - Show a mini summary (e.g., "7/10 correct").
  - Offer "Continue" (loads next batch) or "Done" (back to word list).
- If fewer than 10 words exist, just use all of them.
- If no words exist, show a friendly message pointing to the word list.

### General UI

- Navigation: two tabs at the top — "My Words" and "Practice". Simple, always visible.
- The whole thing should feel pleasant to use for 15–20 minutes at a time. No visual noise.

---

## Flask Routes — `app.py`

### Page routes
- `GET /` → Serve the SPA (index.html)

### API routes
- `GET /api/words` → Return the full word list.
- `POST /api/words` → Add a new word. Body: `{ "german": "aber", "context_note": "..." }`. Sets defaults, saves to JSON, returns the new word. Reject if the word already exists.
- `DELETE /api/words/<german>` → Delete a word by its German text. Save to JSON.
- `POST /api/practice/batch` → Select words and generate sentences. See **Batch Flow** section below.
- `POST /api/practice/result` → Record a practice result. Body: `{ "german": "aber", "correct": true, "mode": "comprehension" }`. Updates box, counters, history. Saves to JSON.

### Startup
- Load `words.json` on startup. If file doesn't exist, create it with `{"words": []}`.
- Load `.env` for API keys (use `python-dotenv`).

---

## Setup & Running

```bash
# Install dependencies
pip install flask python-dotenv anthropic openai

# Set up .env file
echo "ANTHROPIC_API_KEY=sk-..." > .env
echo "LLM_PROVIDER=anthropic" >> .env

# Run
python app.py
# Opens at http://localhost:5000
```

The `requirements.txt` should list: flask, python-dotenv, anthropic, openai.

---

## Key Principles for Implementation

1. **Keep it simple.** No ORMs, no build tools, no npm, no frameworks. Vanilla JS on the frontend, Flask on the backend, one JSON file.
2. **Make formulas obvious.** The selection weights, box progression rules, and mode selection logic should all be in clearly commented sections that are trivial to find and modify.
3. **LLM prompts are files.** Never hardcode prompts in Python. Read them from `llm/prompts/` at call time.
4. **LLM provider is swappable.** One env var change, no code changes.
5. **Umlaut-insensitive comparison.** Always normalize before comparing user input: ä→a, ö→o, ü→u, ß→ss, lowercase.
6. **Persist aggressively.** Write to JSON after every meaningful action (add word, delete word, record result). This is local, performance doesn't matter.
7. **Graceful LLM failures.** If the API call fails, show the error, let the user retry. Never lose data.
8. **The UI should be clean and warm.** Not flashy. Think of it as a tool you use every morning with coffee. Follow the design direction described above.

---

## Future Ideas (NOT for initial build)

These are noted for later. Do not build them now:
- Full translation mode (English → write German, LLM judges correctness).
- Audio pronunciation (TTS).
- Import words from a text/CSV.
- Tagging/grouping words by topic.
- Stats/charts showing progress over time.
- Keyboard shortcuts for faster practice flow.
