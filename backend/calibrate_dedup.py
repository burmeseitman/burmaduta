# backend/calibrate_dedup.py
"""
Calibrates DEDUP_SIMILARITY_THRESHOLD against real data.

Restoring sentence-transformers changes what the scraper discards. The old
threshold of 0.85 was being applied to bigram Jaccard scores, because the
embedding model had silently failed to load; real multilingual embeddings do not
distribute the same way, so the same number means something different now.

This replays the scraper's actual comparison — reports from the same township
within a 24h window — over recent history, and reports how many pairs each
candidate threshold would treat as duplicates.

Read-only: it issues SELECTs and never writes.

    docker compose exec api python backend/calibrate_dedup.py
    docker compose exec api python backend/calibrate_dedup.py --days 30 --show-pairs 15
"""
import argparse
import itertools
from datetime import timedelta

from db_manager import DBManager
from deduplicator import NewsDeduplicator

CANDIDATE_THRESHOLDS = [0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95]
WINDOW_HOURS = 24  # mirrors scraper.py's get_recent_news_by_township(hours=24)


def _text(row):
    return (row.get("summary") or row.get("raw_text") or "").strip()


def main():
    parser = argparse.ArgumentParser(description="Calibrate the dedup threshold.")
    parser.add_argument("--days", type=int, default=14, help="History window (default 14).")
    parser.add_argument("--limit", type=int, default=1500, help="Max rows to pull (default 1500).")
    parser.add_argument("--max-pairs", type=int, default=4000, help="Cap on comparisons (default 4000).")
    parser.add_argument("--show-pairs", type=int, default=8, help="Highest-scoring pairs to print (default 8).")
    args = parser.parse_args()

    db = DBManager()
    if db.mock_mode:
        print("❌ DBManager is in mock mode — no live database. Calibration needs real data.")
        return 1

    rows = db.get_all_news(days=args.days, limit=args.limit)
    print(f"↪ Pulled {len(rows)} rows from the last {args.days} day(s).")

    dedup = NewsDeduplicator()
    dedup.initialize_model()
    if getattr(dedup, "degraded", False) or not dedup.model:
        print(
            "\n❌ The embedding model did not load, so these scores would be Jaccard,\n"
            "   not embeddings. Fix the model first — calibrating now would tune the\n"
            "   threshold to the fallback and lock in the wrong value."
        )
        return 1
    print("✅ Embedding model loaded — scores below are cosine similarity.\n")

    # Group by township, the same way the scraper narrows candidates.
    by_township = {}
    for row in rows:
        ts = row.get("township")
        if ts and _text(row):
            by_township.setdefault(ts, []).append(row)

    pairs = []
    for ts, items in by_township.items():
        for a, b in itertools.combinations(items, 2):
            ta, tb = a.get("created_at"), b.get("created_at")
            if ta and tb and abs(ta - tb) > timedelta(hours=WINDOW_HOURS):
                continue
            pairs.append((ts, a, b))
            if len(pairs) >= args.max_pairs:
                break
        if len(pairs) >= args.max_pairs:
            break

    if not pairs:
        print("No same-township pairs inside the 24h window. Try a longer --days.")
        return 0

    print(f"↪ Scoring {len(pairs)} same-township pairs within {WINDOW_HOURS}h...\n")
    scored = []
    for ts, a, b in pairs:
        score = dedup.get_similarity_score(_text(a), _text(b))
        scored.append((score, ts, a, b))
    scored.sort(key=lambda x: x[0], reverse=True)

    total = len(scored)
    print("Score distribution:")
    buckets = [(0.0, 0.5), (0.5, 0.6), (0.6, 0.7), (0.7, 0.8), (0.8, 0.85), (0.85, 0.9), (0.9, 0.95), (0.95, 1.01)]
    for lo, hi in buckets:
        n = sum(1 for s, *_ in scored if lo <= s < hi)
        bar = "█" * int(40 * n / total) if total else ""
        print(f"  {lo:.2f}–{hi:.2f}  {n:5d}  {bar}")

    print("\nWhat each threshold would discard as duplicate:")
    print(f"  {'threshold':>10}  {'pairs':>7}  {'% of pairs':>10}")
    for t in CANDIDATE_THRESHOLDS:
        n = sum(1 for s, *_ in scored if s > t)
        marker = "   <- current" if abs(t - 0.85) < 1e-9 else ""
        print(f"  {t:>10.2f}  {n:>7d}  {100.0 * n / total:>9.1f}%{marker}")

    print(f"\nTop {args.show_pairs} scoring pairs — check these are genuinely the same incident:")
    for score, ts, a, b in scored[: args.show_pairs]:
        print(f"\n  [{score:.3f}] {ts}")
        print(f"     #{a.get('id')}: {_text(a)[:110]}")
        print(f"     #{b.get('id')}: {_text(b)[:110]}")

    print(
        "\nPick the lowest threshold at which the top pairs are still true duplicates.\n"
        "Scoring above it discards the later report permanently — err high when unsure.\n"
        "Set DEDUP_SIMILARITY_THRESHOLD in .env, then restart the scraper."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
