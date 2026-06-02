"""
CLI wrapper for the cleanup module.

Usage:
    python scripts/cleanup_words.py dry-run     # produces data/cleanup_proposal.json
    python scripts/cleanup_words.py apply       # applies the proposal to words.json/phrases.json
"""
import argparse
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from cleanup import build_proposal, apply_proposal

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
WORDS_FILE = DATA_DIR / "words.json"
PHRASES_FILE = DATA_DIR / "phrases.json"
PROPOSAL_FILE = DATA_DIR / "cleanup_proposal.json"


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def progress(msg):
    print(f"  {msg}", flush=True)


def run_dry_run():
    words_data = load_json(WORDS_FILE)
    words = words_data["words"]
    print(f"Loaded {len(words)} words.")
    proposal = build_proposal(words, progress=progress)
    save_json(PROPOSAL_FILE, proposal)
    print()
    print(f"Phase 1 counts: {proposal['phase1_counts']}")
    print(f"Phase 2 refresh count: {proposal['phase2_refresh_count']}")
    print(f"Proposal written: {PROPOSAL_FILE}")


def run_apply():
    if not PROPOSAL_FILE.exists():
        print(f"No proposal at {PROPOSAL_FILE}. Run dry-run first.")
        sys.exit(1)
    proposal = load_json(PROPOSAL_FILE)
    words_data = load_json(WORDS_FILE)
    phrases_data = load_json(PHRASES_FILE)
    summary = apply_proposal(proposal, words_data, phrases_data)
    save_json(WORDS_FILE, words_data)
    save_json(PHRASES_FILE, phrases_data)
    print("APPLIED.")
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["dry-run", "apply"])
    args = parser.parse_args()
    if args.mode == "dry-run":
        run_dry_run()
    else:
        run_apply()
