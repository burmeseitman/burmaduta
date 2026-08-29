# backend/backfill_locations.py
"""
Names the administrative area for rows that were stored as bare coordinates.

The agent used to write latitude/longitude without region, township or city
whenever it geocoded through OSM Nominatim, or whenever the model handed back
coordinates of its own. Those rows plot correctly but carry no place name, so
the map labels them by position and every name-based filter treats them as
unlocated. tool_geo_inferencer now fills the admin fields in as it writes, but
rows already in the table keep their nulls -- this backfills them.

For each row it finds the closest entry in the 330+ township ontology and
copies that entry's region and city. The township name itself is only applied
when the row sits close enough that the name is actually true of it, which is a
much tighter radius than "near enough to share a region".

Only ever fills gaps -- an existing name always wins -- so it is safe to re-run,
and nothing is written without --apply; the default run reports what it would do.

    # preview the rows with no place name at all
    docker compose exec api python backend/backfill_locations.py

    # write those
    docker compose exec api python backend/backfill_locations.py --apply

    # widest sweep: also rows named "unknown", and rows missing only some fields
    docker compose exec api python backend/backfill_locations.py --apply \
        --include-unknown --fill-partial
"""
import argparse

from agent_core import AgentTools
from db_manager import DBManager

# Region and city hold across a wide area, so a coarse match still tells the
# truth. A township name does not -- claim it only when the row is genuinely
# inside it, or the label reads as fact while being wrong.
REGION_RADIUS_DEGREES = 0.75    # ~80km
TOWNSHIP_RADIUS_DEGREES = 0.15  # ~16km

# What the pipeline writes when the model could not name a place. It is a
# value, not a null, so these rows look located until you read them.
UNKNOWN_MARKER = "မသိရ"

LOCATION_COLUMNS = ("region", "township", "city")


def blank_test(column, include_unknown):
    """SQL that is true when this column holds no usable place name."""
    if include_unknown:
        return f"COALESCE(NULLIF(NULLIF(BTRIM({column}), ''), %(unknown)s), '') = ''"
    return f"COALESCE(BTRIM({column}), '') = ''"


def select_query(include_unknown, fill_partial):
    """
    Rows worth visiting: they carry usable coordinates, and are missing either
    every place name (the default) or any one of them (--fill-partial).
    """
    joiner = "\n       OR " if fill_partial else "\n      AND "
    blanks = joiner.join(blank_test(c, include_unknown) for c in LOCATION_COLUMNS)
    return f"""
    SELECT id, latitude, longitude, region, township, city
    FROM news_events
    WHERE ({blanks})
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude <> 0 AND longitude <> 0
    ORDER BY id
"""

# Only ever fills a gap: an existing name wins over anything inferred here, so
# re-running the script cannot overwrite a real value or drift a row's location.
UPDATE_ROW = """
    UPDATE news_events
    SET region   = COALESCE(NULLIF(NULLIF(BTRIM(region), ''), %(unknown)s), %(region)s),
        city     = COALESCE(NULLIF(NULLIF(BTRIM(city), ''), %(unknown)s), %(city)s),
        township = COALESCE(NULLIF(NULLIF(BTRIM(township), ''), %(unknown)s), %(township)s)
    WHERE id = %(id)s
"""


def is_blank(value, include_unknown):
    """The Python side of blank_test, so the preview matches what SQL will do."""
    text = (value or "").strip()
    return text == "" or (include_unknown and text == UNKNOWN_MARKER)


def resolve(lat, lon):
    """
    Return the admin fields to write for one coordinate, or None when the row
    is too far from anything we know to label honestly.
    """
    nearest = AgentTools._nearest_known_township(lat, lon, max_degrees=REGION_RADIUS_DEGREES)
    if not nearest:
        return None

    return {
        "region": nearest["region"],
        "city": nearest["city"],
        # Beyond this radius we know the region but not the township.
        "township": nearest["name"] if nearest["distance_degrees"] <= TOWNSHIP_RADIUS_DEGREES else None,
        "name": nearest["name"],
        "distance_degrees": nearest["distance_degrees"],
    }


def main():
    parser = argparse.ArgumentParser(description="Backfill admin names for coordinate-only news rows.")
    parser.add_argument("--apply", action="store_true", help="Write the changes. Without it the run is a preview.")
    parser.add_argument("--include-unknown", action="store_true",
                        help=f"Also treat rows whose fields are all '{UNKNOWN_MARKER}' as unnamed.")
    parser.add_argument("--fill-partial", action="store_true",
                        help="Also complete rows that have some names but not all (e.g. a township with no region).")
    parser.add_argument("--limit", type=int, default=0, help="Stop after N rows (0 = no limit).")
    parser.add_argument("--batch-size", type=int, default=500, help="Rows per commit (default 500).")
    parser.add_argument("--show", type=int, default=10, help="Sample rows to print (default 10).")
    args = parser.parse_args()

    db = DBManager()
    if db.mock_mode:
        print("❌ DBManager is in mock mode — no live database. Backfill needs the real table.")
        return 1

    db._ensure_connection()
    if not db.conn:
        print("❌ No database connection.")
        return 1

    query = select_query(args.include_unknown, args.fill_partial)
    if args.limit > 0:
        query += f"\n    LIMIT {int(args.limit)}"

    with db.conn.cursor() as cur:
        cur.execute(query, {"unknown": UNKNOWN_MARKER})
        rows = cur.fetchall()

    scope = "any name blank" if args.fill_partial else "all names blank"
    if args.include_unknown:
        scope += f" (counting '{UNKNOWN_MARKER}' as blank)"
    print(f"↪ {len(rows)} row(s) with {scope} and usable coordinates.")
    if not rows:
        print("Nothing to backfill.")
        return 0

    updates = []
    region_only = 0
    unresolved = []
    unchanged = 0
    for row_id, lat, lon, region, township, city in rows:
        resolved = resolve(float(lat), float(lon))
        if not resolved:
            unresolved.append((row_id, lat, lon))
            continue

        # A row can match the query and still have nothing to gain -- row 2 of a
        # second run, say, where the region is already set and the township is
        # too far away to name. Writing it back would be a no-op that the report
        # counts as work, so leave it alone and say so.
        current = {"region": region, "township": township, "city": city}
        changes = {
            col: resolved[col]
            for col in LOCATION_COLUMNS
            if resolved[col] and is_blank(current[col], args.include_unknown)
        }
        if not changes:
            unchanged += 1
            continue

        if "township" not in changes:
            region_only += 1
        updates.append({
            "id": row_id,
            "region": changes.get("region"),
            "city": changes.get("city"),
            "township": changes.get("township"),
            "unknown": UNKNOWN_MARKER,
            "_name": resolved["name"],
            "_dist": resolved["distance_degrees"],
        })

    print(f"   {len(updates)} to update — {len(updates) - region_only} gaining a township name, "
          f"{region_only} without one.")
    if unchanged:
        print(f"   {unchanged} already as complete as the coordinates allow — skipped.")
    print(f"   {len(unresolved)} too far from any known township (>{REGION_RADIUS_DEGREES}°) — left untouched.")

    if args.show and updates:
        print(f"\nSample of what would be written (first {min(args.show, len(updates))}):")
        for u in updates[: args.show]:
            township = u["township"] or f"(unchanged — nearest {u['_name']} is {u['_dist']:.2f}° away)"
            print(f"  #{u['id']:>7}  region={u['region']}  city={u['city']}  township={township}")

    if unresolved and args.show:
        print(f"\nSkipped (nothing within {REGION_RADIUS_DEGREES}°), first {min(args.show, len(unresolved))}:")
        for row_id, lat, lon in unresolved[: args.show]:
            print(f"  #{row_id:>7}  {lat}, {lon}")

    if not updates:
        print("Nothing to backfill.")
        return 0

    if not args.apply:
        print(f"\nPreview only — nothing written. Re-run with --apply to update {len(updates)} row(s).")
        return 0

    written = 0
    try:
        with db.conn.cursor() as cur:
            for start in range(0, len(updates), args.batch_size):
                batch = updates[start : start + args.batch_size]
                for u in batch:
                    cur.execute(UPDATE_ROW, u)
                db.conn.commit()
                written += len(batch)
                print(f"   committed {written}/{len(updates)}")
    except Exception as e:
        db.conn.rollback()
        print(f"\n❌ Backfill failed after {written} row(s): {e}")
        print("   The committed batches stand; re-running skips what is already named.")
        return 1

    print(f"\n✅ Backfilled {written} row(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
