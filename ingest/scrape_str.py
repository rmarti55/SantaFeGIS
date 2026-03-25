"""
Scrape City of Santa Fe Short-Term Rental (STR) permit data from the
official ArcGIS REST endpoint and load into Neon Postgres with PostGIS
geometries.

Source: Public_Viewer/MapServer/127 — "Short Term Rental Permits Issued
as of 04162025" (~905 records, ~901 Active).

Layer 7 (ShortTermRentals/MapServer/7) was previously ingested but has
been dropped: it is a stale 2024-era snapshot containing 1,239 records
including denied, voided, and in-process applications that inflated the
count beyond the city's 1,000-license cap.

Usage:
    pip install -r requirements.txt
    export DATABASE_URL="postgresql://..."
    python scrape_str.py              # ingest all permits (default)
    python scrape_str.py --active-only  # ingest only Active permits
"""

import argparse
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

PERMITS_URL = (
    "https://gis.santafenm.gov/server/rest/services"
    "/Public_Viewer/MapServer/127/query"
)

PAGE_SIZE = 500


def get_db():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: Set DATABASE_URL in .env or environment")
        sys.exit(1)
    return psycopg2.connect(url)


def init_db(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS short_term_rentals (
                id                  SERIAL PRIMARY KEY,
                source              TEXT NOT NULL,
                objectid            INTEGER NOT NULL,
                address             TEXT,
                match_addr          TEXT,
                business_license    TEXT,
                business_name       TEXT,
                dba                 TEXT,
                status              TEXT,
                license_type        TEXT,
                renewal_status      TEXT,
                renewal_year        DOUBLE PRECISION,
                rental_type         TEXT,
                zoning              TEXT,
                issue_date          TIMESTAMPTZ,
                expiration_date     TIMESTAMPTZ,
                geom                GEOMETRY(Point, 4326),
                UNIQUE (source, objectid)
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_str_geom
            ON short_term_rentals USING GIST (geom);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_str_status
            ON short_term_rentals (status);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_str_rental_type
            ON short_term_rentals (rental_type);
        """)
    conn.commit()
    print("Database initialized.")


def esri_ts_to_dt(ts):
    """Convert ESRI epoch-millis timestamp to datetime, or None."""
    if ts is None:
        return None
    try:
        return datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
    except (ValueError, OSError, TypeError):
        return None


def fetch_page(base_url, offset, where="1=1", retries=3):
    params = {
        "f": "json",
        "where": where,
        "outFields": "*",
        "outSR": "4326",
        "returnGeometry": "true",
        "resultOffset": offset,
        "resultRecordCount": PAGE_SIZE,
        "orderByFields": "OBJECTID ASC",
    }
    for attempt in range(retries):
        try:
            resp = requests.get(base_url, params=params, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, json.JSONDecodeError) as e:
            wait = 2 ** (attempt + 1)
            print(f"  Retry {attempt+1}/{retries} after error: {e} (waiting {wait}s)")
            time.sleep(wait)
    print(f"FAILED to fetch offset {offset} after {retries} retries")
    return None


def clean(val):
    if isinstance(val, str):
        return val.strip() or None
    return val


def upsert_permits(conn, features):
    """Upsert permit features from Layer 127 / MIL1 Layer 3.

    Fields: OBJECTID, Match_addr, Business_L, Address, Business_N,
    DBA, Business_S (status), Business_1 (license type label),
    Business_2 (license type), Business_3 (issue status),
    Business_4 (year), Business_5 (issue date),
    Business_6 (expiration date), Short_Term
    """
    if not features:
        return 0

    sql = """
        INSERT INTO short_term_rentals
            (source, objectid, address, match_addr, business_license,
             business_name, dba, status, license_type, renewal_status,
             renewal_year, issue_date, expiration_date, rental_type, geom)
        VALUES
            ('layer127', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
             ST_SetSRID(ST_MakePoint(%s, %s), 4326))
        ON CONFLICT (source, objectid) DO UPDATE SET
            address = EXCLUDED.address,
            match_addr = EXCLUDED.match_addr,
            business_license = EXCLUDED.business_license,
            business_name = EXCLUDED.business_name,
            dba = EXCLUDED.dba,
            status = EXCLUDED.status,
            license_type = EXCLUDED.license_type,
            renewal_status = EXCLUDED.renewal_status,
            renewal_year = EXCLUDED.renewal_year,
            issue_date = EXCLUDED.issue_date,
            expiration_date = EXCLUDED.expiration_date,
            rental_type = EXCLUDED.rental_type,
            geom = EXCLUDED.geom
    """

    rows = []
    for feat in features:
        a = feat.get("attributes", {})
        g = feat.get("geometry")
        if not g:
            continue
        rows.append((
            a.get("OBJECTID"),
            clean(a.get("Address")),
            clean(a.get("Match_addr")),
            clean(a.get("Business_L")),
            clean(a.get("Business_N")),
            clean(a.get("DBA")),
            clean(a.get("Business_S")),
            clean(a.get("Business_2")),
            clean(a.get("Business_3")),
            a.get("Business_4"),
            esri_ts_to_dt(a.get("Business_5")),
            esri_ts_to_dt(a.get("Business_6")),
            clean(a.get("Short_Term")),
            g["x"], g["y"],
        ))

    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, rows, page_size=100)
    conn.commit()
    return len(rows)


def ingest_permits(conn, where="1=1"):
    print("\n--- Ingesting STR Permits (Layer 127) ---")
    if where != "1=1":
        print(f"  Filter: {where}")
    offset = 0
    total = 0
    t0 = time.time()

    while True:
        print(f"  Fetching offset {offset}...", end=" ", flush=True)
        data = fetch_page(PERMITS_URL, offset, where=where)
        if data is None:
            break

        features = data.get("features", [])
        if not features:
            print("No more features.")
            break

        t1 = time.time()
        count = upsert_permits(conn, features)
        total += count
        elapsed = time.time() - t1
        print(f"upserted {count} in {elapsed:.1f}s (total: {total})")

        exceeded = data.get("exceededTransferLimit", False) or data.get(
            "properties", {}
        ).get("exceededTransferLimit", False)
        if not exceeded:
            print("  All records fetched.")
            break

        offset += PAGE_SIZE
        time.sleep(0.3)

    total_time = time.time() - t0
    print(f"  Done: {total} records in {total_time:.0f}s")
    return total


def cleanup_legacy_layer7(conn):
    """Remove stale layer7 rows left over from previous ingests."""
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM short_term_rentals WHERE source = 'layer7';"
        )
        deleted = cur.rowcount
    conn.commit()
    if deleted:
        print(f"\nCleaned up {deleted} legacy layer7 rows.")
    return deleted


GEOCODE_URL = (
    "https://geocode.arcgis.com/arcgis/rest/services"
    "/World/GeocodeServer/findAddressCandidates"
)

UNIT_RE = re.compile(
    r"\s*(Unit|Ste|Suite|Apt|#)\s*.*$", re.IGNORECASE
)


def _strip_unit(addr):
    """Remove unit/apt/suite suffix so the geocoder can match the building."""
    return UNIT_RE.sub("", addr).strip()


def fix_nan_geometries(conn):
    """Geocode records whose coordinates are NaN using the Esri World Geocoder."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, address, match_addr
            FROM short_term_rentals
            WHERE ST_X(geom) = 'NaN' OR ST_Y(geom) = 'NaN'
               OR ST_X(geom) IS NULL OR ST_Y(geom) IS NULL;
        """)
        bad_rows = cur.fetchall()

    if not bad_rows:
        print("\nNo NaN geometries to fix.")
        return 0

    print(f"\n--- Geocoding {len(bad_rows)} records with bad coordinates ---")
    fixed = 0

    for row_id, address, match_addr in bad_rows:
        raw = address or match_addr or ""
        raw = raw.strip()
        if not raw:
            print(f"  id={row_id}: no address to geocode, skipping")
            continue

        query_addr = _strip_unit(raw)
        params = {
            "SingleLine": f"{query_addr}, Santa Fe, NM",
            "outFields": "Score,Match_addr",
            "outSR": "4326",
            "maxLocations": "1",
            "f": "json",
        }

        try:
            resp = requests.get(GEOCODE_URL, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except (requests.RequestException, json.JSONDecodeError) as e:
            print(f"  id={row_id} ({raw}): geocode failed — {e}")
            continue

        candidates = data.get("candidates", [])
        if not candidates:
            print(f"  id={row_id} ({raw}): no geocode results")
            continue

        best = candidates[0]
        score = best.get("score", 0)
        loc = best.get("location", {})
        lon, lat = loc.get("x"), loc.get("y")

        if score < 90 or lon is None or lat is None:
            print(f"  id={row_id} ({raw}): low score ({score}), skipping")
            continue

        if math.isnan(lon) or math.isnan(lat):
            print(f"  id={row_id} ({raw}): geocoder returned NaN, skipping")
            continue

        matched = best.get("attributes", {}).get("Match_addr", "")
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE short_term_rentals
                   SET geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                       match_addr = COALESCE(match_addr, %s)
                   WHERE id = %s""",
                (lon, lat, matched, row_id),
            )
        conn.commit()
        fixed += 1
        print(f"  id={row_id} ({raw}): score={score} -> ({lon:.5f}, {lat:.5f})")
        time.sleep(0.2)

    print(f"  Fixed {fixed}/{len(bad_rows)} records.")
    return fixed


def print_summary(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM short_term_rentals;")
        print(f"\n=== Summary ===")
        print(f"  Total: {cur.fetchone()[0]} records")

        cur.execute("""
            SELECT status, COUNT(*)
            FROM short_term_rentals
            GROUP BY status ORDER BY COUNT(*) DESC;
        """)
        print("\n  By status:")
        for row in cur.fetchall():
            print(f"    {row[0] or 'NULL'}: {row[1]}")

        cur.execute("""
            SELECT rental_type, COUNT(*)
            FROM short_term_rentals
            GROUP BY rental_type ORDER BY COUNT(*) DESC;
        """)
        print("\n  By rental type:")
        for row in cur.fetchall():
            print(f"    {row[0] or 'NULL'}: {row[1]}")


def main():
    parser = argparse.ArgumentParser(
        description="Ingest Santa Fe STR permit data"
    )
    parser.add_argument(
        "--active-only",
        action="store_true",
        help="Only ingest permits with status 'Active' (default: all statuses)",
    )
    args = parser.parse_args()

    conn = get_db()
    init_db(conn)
    cleanup_legacy_layer7(conn)

    where = "Business_S='Active'" if args.active_only else "1=1"
    ingest_permits(conn, where=where)
    fix_nan_geometries(conn)

    print_summary(conn)
    conn.close()


if __name__ == "__main__":
    main()
