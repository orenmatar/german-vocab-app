"""
Settings module — schema, defaults, and persistence.

All app settings are defined here with user-friendly names and descriptions.
Values are persisted in data/settings.json and editable via the Settings tab.
"""

import json
from pathlib import Path

SETTINGS_FILE = Path(__file__).parent / "data" / "settings.json"

# =============================================================================
# SCHEMA — defines every setting with name, description, type, range, default
# =============================================================================

SETTINGS_SCHEMA = [
    {
        "section": "Batch Composition",
        "description": "How many words you practice and how they're mixed together.",
        "settings": [
            {
                "key": "BATCH_SIZE",
                "name": "Words per batch",
                "description": "Number of words in each practice session.",
                "type": "int",
                "default": 10,
                "min": 3,
                "max": 30,
            },
            {
                "key": "MASTERED_BOX",
                "name": "Mastered at box level",
                "description": "A word is considered 'mastered' when it reaches this box level. Mastered words move to the review pool.",
                "type": "int",
                "default": 4,
                "min": 2,
                "max": 5,
            },
            {
                "key": "MAX_ACTIVE_POOL",
                "name": "Max active words",
                "description": "Maximum words in the 'currently learning' pool. No new words are introduced until active words drop below this.",
                "type": "int",
                "default": 15,
                "min": 5,
                "max": 50,
            },
            {
                "key": "NEW_PER_BATCH",
                "name": "New words per batch",
                "description": "Maximum new (never-practiced) words to introduce in each batch.",
                "type": "int",
                "default": 2,
                "min": 0,
                "max": 10,
            },
            {
                "key": "REVIEW_PER_BATCH",
                "name": "Review words per batch",
                "description": "Number of mastered words included per batch for review.",
                "type": "int",
                "default": 2,
                "min": 0,
                "max": 5,
            },
        ],
    },
    {
        "section": "Practice Modes",
        "description": "When each mode unlocks. Progression: Comprehension → Multiple Choice → Fill-in-the-Blank.",
        "settings": [
            {
                "key": "MULTIPLE_CHOICE_MIN_BOX",
                "name": "Multiple choice unlocks at box",
                "description": "Minimum box level for 'pick from 4 options' mode.",
                "type": "int",
                "default": 2,
                "min": 1,
                "max": 5,
            },
            {
                "key": "MULTIPLE_CHOICE_PROBABILITY",
                "name": "Multiple choice probability",
                "description": "How often eligible words get multiple choice mode (0.0–1.0).",
                "type": "float",
                "default": 0.7,
                "min": 0.0,
                "max": 1.0,
            },
            {
                "key": "FILL_IN_THE_BLANK_MIN_BOX",
                "name": "Fill-in-the-blank unlocks at box",
                "description": "Minimum box level for 'type the answer' mode.",
                "type": "int",
                "default": 3,
                "min": 1,
                "max": 5,
            },
            {
                "key": "FILL_IN_THE_BLANK_PROBABILITY",
                "name": "Fill-in-the-blank probability",
                "description": "How often eligible words get fill-in-the-blank mode (0.0–1.0).",
                "type": "float",
                "default": 0.5,
                "min": 0.0,
                "max": 1.0,
            },
        ],
    },
    {
        "section": "Grammar Hints",
        "description": "How grammar hints from your Grammar tab get woven into practice sentences.",
        "settings": [
            {
                "key": "GRAMMAR_ATTACH_RATIO",
                "name": "Grammar hint ratio",
                "description": "Fraction of batch words that can get a grammar hint (0.0–1.0). E.g. 0.5 = up to half.",
                "type": "float",
                "default": 0.5,
                "min": 0.0,
                "max": 1.0,
            },
            {
                "key": "GRAMMAR_MAX_REPEAT",
                "name": "Max repeats per hint",
                "description": "Maximum times the same grammar hint can appear in one batch.",
                "type": "int",
                "default": 2,
                "min": 1,
                "max": 5,
            },
        ],
    },
]

# =============================================================================
# Build defaults dict from schema
# =============================================================================

DEFAULTS = {}
for _section in SETTINGS_SCHEMA:
    for _s in _section["settings"]:
        DEFAULTS[_s["key"]] = _s["default"]

# Current values (loaded from file, falls back to defaults)
_current = dict(DEFAULTS)


# =============================================================================
# Load / Save / Access
# =============================================================================

def load():
    """Load settings from JSON file, falling back to defaults for missing keys."""
    global _current
    _current = dict(DEFAULTS)
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            saved = json.load(f)
        _current.update(saved)


def save():
    """Persist current settings to JSON file."""
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(_current, f, indent=2, ensure_ascii=False)


def get(key):
    """Get a single setting value."""
    return _current.get(key, DEFAULTS.get(key))


def get_all():
    """Get all current setting values as a dict."""
    return dict(_current)


def update(updates):
    """Update settings from a dict. Validates types and clamps to min/max."""
    # Build a lookup for validation
    schema_lookup = {}
    for section in SETTINGS_SCHEMA:
        for s in section["settings"]:
            schema_lookup[s["key"]] = s

    for key, value in updates.items():
        if key not in schema_lookup:
            continue

        spec = schema_lookup[key]

        # Type coercion
        if spec["type"] == "int":
            value = int(value)
        elif spec["type"] == "float":
            value = float(value)

        # Clamp to min/max
        if "min" in spec:
            value = max(spec["min"], value)
        if "max" in spec:
            value = min(spec["max"], value)

        _current[key] = value

    save()


def get_schema_with_values():
    """Return the full schema with current values filled in, for the frontend."""
    result = []
    for section in SETTINGS_SCHEMA:
        section_copy = {
            "section": section["section"],
            "description": section["description"],
            "settings": [],
        }
        for s in section["settings"]:
            setting_copy = dict(s)
            setting_copy["value"] = _current.get(s["key"], s["default"])
            section_copy["settings"].append(setting_copy)
        result.append(section_copy)
    return result


# Load on import
load()
