"""
Word selection logic — picks which words to practice next.

Uses a three-tier system:
  - NEW: words never practiced (times_seen == 0)
  - ACTIVE: words currently being learned (times_seen > 0, box < MASTERED_BOX)
  - MASTERED: well-learned words (box >= MASTERED_BOX)

Batch composition focuses on active words, introduces new words gradually,
and reviews mastered words occasionally.

EASY TO MODIFY: Tweak constants via the Settings tab (stored in data/settings.json).
"""

import random
from datetime import datetime

import settings


# =============================================================================
# WEIGHTING FORMULA
# =============================================================================

def compute_weight(word):
    """
    Compute a selection weight for a single word.
    Higher weight = more likely to be selected for practice.

    Simple formula:
      - Lower box = higher base weight (words you struggle with appear more)
      - Words not seen recently get a gentle boost (caps at 2x after 2 days)
    """
    box = word["box"]
    last_seen = word["last_seen"]  # ISO string or None

    # Base weight: lower box = higher weight
    base = 1.0 / (2 ** (box - 1))

    # Recency boost: words not seen recently get a gentle boost
    if last_seen is None:
        recency = 2.0
    else:
        hours_since = (datetime.now() - datetime.fromisoformat(last_seen)).total_seconds() / 3600
        recency = min(2.0, 1.0 + hours_since / 48.0)

    weight = base * recency

    # Starred words get a 2× boost
    if word.get("starred", False):
        weight *= 2.0

    return weight


def weighted_sample(words, count):
    """Weighted random sampling without replacement."""
    if not words or count <= 0:
        return []

    count = min(count, len(words))

    weights = [compute_weight(w) for w in words]
    total = sum(weights)

    if total == 0:
        weights = [1.0] * len(words)
        total = len(words)

    probabilities = [w / total for w in weights]

    indices = list(range(len(words)))
    selected_indices = []

    for _ in range(count):
        prob_sum = sum(probabilities[i] for i in indices if i not in selected_indices)
        if prob_sum == 0:
            break

        r = random.random() * prob_sum
        cumulative = 0
        for i in indices:
            if i in selected_indices:
                continue
            cumulative += probabilities[i]
            if cumulative >= r:
                selected_indices.append(i)
                break

    return [words[i] for i in selected_indices]


# =============================================================================
# BOX PROGRESSION RULES
# =============================================================================

def update_box(word, correct):
    """
    Correct → box goes up by 1 (max 5)
    Wrong → box goes down by 1 (min 1)
    """
    if correct:
        word["box"] = min(word["box"] + 1, 5)
    else:
        word["box"] = max(word["box"] - 1, 1)


# =============================================================================
# MODE SELECTION
#
# Progression: comprehension → multiple choice
# =============================================================================

def pick_mode(word):
    """
    Decide the practice mode for a word based on its box level.

    - Box 1: always comprehension
    - Box 2+: mostly multiple choice, sometimes comprehension
    """
    if word["box"] < settings.get("MULTIPLE_CHOICE_MIN_BOX"):
        return "comprehension"

    # Box 2+: mostly multiple choice
    if random.random() < settings.get("MULTIPLE_CHOICE_PROBABILITY"):
        return "multiple_choice"
    return "comprehension"


# =============================================================================
# MAIN SELECTION FUNCTION — Three-tier system
# =============================================================================

def select_words(words, count=None):
    """
    Select `count` words using the three-tier system.

    Priority:
    1. ACTIVE words (currently learning) fill most of the batch
    2. NEW words introduced gradually when active pool has room
    3. MASTERED words included for periodic review
    """
    if not words:
        return []

    if count is None:
        count = settings.get("BATCH_SIZE")
    count = min(count, len(words))

    # Categorize into tiers
    new_words = [w for w in words if w["times_seen"] == 0]
    active_words = [w for w in words if w["times_seen"] > 0 and w["box"] < settings.get("MASTERED_BOX")]
    mastered_words = [w for w in words if w["box"] >= settings.get("MASTERED_BOX")]

    selected = []
    selected_set = set()  # Track by german word to avoid duplicates

    def add_from_pool(pool, max_count, use_weights=True):
        available = [w for w in pool if w["german"] not in selected_set]
        if not available:
            return
        pick_count = min(max_count, len(available))
        if use_weights:
            sampled = weighted_sample(available, pick_count)
        else:
            sampled = random.sample(available, pick_count)
        for w in sampled:
            selected.append(w)
            selected_set.add(w["german"])

    # 1. Reserve slots for new words upfront (so active pool doesn't eat them)
    review_per_batch = settings.get("REVIEW_PER_BATCH")
    should_introduce_new = len(active_words) < settings.get("MAX_ACTIVE_POOL") and len(new_words) > 0
    new_reserve = min(settings.get("NEW_PER_BATCH"), len(new_words)) if should_introduce_new else 0

    # 2. Fill from active pool (priority — these are words we're working on)
    active_slots = count - review_per_batch - new_reserve
    if active_words:
        add_from_pool(active_words, min(active_slots, len(active_words)))

    # 3. Introduce new words into the reserved slots
    if new_reserve > 0:
        add_from_pool(new_words, new_reserve, use_weights=False)

    # 4. Add mastered words for review (scale down when pool is small)
    if len(mastered_words) <= 7:
        review_count = min(1, len(mastered_words))
    else:
        review_count = min(review_per_batch, len(mastered_words))
    if review_count > 0:
        add_from_pool(mastered_words, review_count)

    # 5. Fill any remaining slots from all pools
    remaining = count - len(selected)
    if remaining > 0:
        all_remaining = [w for w in words if w["german"] not in selected_set]
        add_from_pool(all_remaining, remaining)

    # Assign modes
    result = [(w, pick_mode(w)) for w in selected]
    return result


# =============================================================================
# GRAMMAR SELECTION
# =============================================================================

def select_grammar_for_batch(batch_size, grammar_points):
    """
    Assign grammar hints to random positions in a batch.
    Only uses enabled grammar points.
    Returns a dict mapping batch index → grammar hint string.
    """
    enabled_points = [gp for gp in grammar_points if gp.get("enabled", True)]

    if not enabled_points:
        return {}

    max_with_grammar = int(batch_size * settings.get("GRAMMAR_ATTACH_RATIO"))
    if max_with_grammar == 0:
        return {}

    # Build pool: each grammar point repeated up to MAX_REPEAT times
    pool = []
    for gp in enabled_points:
        pool.extend([gp["hint"]] * settings.get("GRAMMAR_MAX_REPEAT"))

    random.shuffle(pool)

    # Pick which batch indices get grammar (random subset)
    indices = random.sample(range(batch_size), min(max_with_grammar, batch_size))

    # Assign hints from pool to indices
    assignments = {}
    for i, idx in enumerate(indices):
        if i < len(pool):
            assignments[idx] = pool[i]

    return assignments
