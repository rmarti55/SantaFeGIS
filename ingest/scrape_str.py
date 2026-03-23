"""
Scrape City of Santa Fe Short-Term Rental (STR) permit data from two
ArcGIS REST endpoints and load into Neon Postgres with PostGIS geometries.

Layer 7:  ShortTermRentals/MapServer/7  — "Short Term Rentals 2024" (~1,239 records)
Layer 127: Public_Viewer/MapServer/127   — "Short Term Rental Permits Issued as of 04162025" (~905 records)

Usage:
    pip install -r requirements.txt
    export DATABASE_URL="postgresql://..."
    python scrape_str.py
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

LAYER7_URL = (
    "https://gis.santafenm.gov/server/rest/services"
    "/ShortTermRentals/MapServer/7/query"
)

LAYER127_URL = (
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


def fetch_page(base_url, offset, retries=3):
    params = {
        "f": "json",
        "where": "1=1",
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


def upsert_layer7(conn, features):
    """Layer 7 fields: OBJECTID, Status, Business_L, Address, Business_1,
    Business_2 (renewal status), Business_3 (renewal year), Short_Term, Zoning"""
    if not features:
        return 0

    sql = """
        INSERT INTO short_term_rentals
            (source, objectid, address, business_license, license_type,
             renewal_status, renewal_year, rental_type, zoning, status, geom)
        VALUES
            ('layer7', %s, %s, %s, %s, %s, %s, %s, %s, %s,
             ST_SetSRID(ST_MakePoint(%s, %s), 4326))
        ON CONFLICT (source, objectid) DO UPDATE SET
            address = EXCLUDED.address,
            business_license = EXCLUDED.business_license,
            license_type = EXCLUDED.license_type,
            renewal_status = EXCLUDED.renewal_status,
            renewal_year = EXCLUDED.renewal_year,
            rental_type = EXCLUDED.rental_type,
            zoning = EXCLUDED.zoning,
            status = EXCLUDED.status,
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
            clean(a.get("Business_L")),
            clean(a.get("Business_1")),
            clean(a.get("Business_2")),
            a.get("Business_3"),
            clean(a.get("Short_Term")),
            clean(a.get("Zoning")),
            clean(a.get("Status")),
            g["x"], g["y"],
        ))

    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, rows, page_size=100)
    conn.commit()
    return len(rows)


def upsert_layer127(conn, features):
    """Layer 127 fields: OBJECTID, Match_addr, Business_L, Address, Business_N,
    DBA, Business_S (status), Business_1 (license type label), Business_2 (license type),
    Business_3 (issue status), Business_4 (year), Business_5 (issue date),
    Business_6 (expiration date), Short_Term"""
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


def ingest_layer(conn, name, base_url, upsert_fn):
    print(f"\n--- Ingesting {name} ---")
    offset = 0
    total = 0
    t0 = time.time()

    while True:
        print(f"  Fetching offset {offset}...", end=" ", flush=True)
        data = fetch_page(base_url, offset)
        if data is None:
            break

        features = data.get("features", [])
        if not features:
            print("No more features.")
            break

        t1 = time.time()
        count = upsert_fn(conn, features)
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
    print(f"  Done {name}: {total} records in {total_time:.0f}s")
    return total


def merge_duplicates(conn):
    """Merge rows that share the same business_license across layers.

    For each license that appears in both layer7 and layer127, keep a single
    merged row that takes the best data from each:
      - business_name, dba, issue_date, expiration_date, match_addr from layer127
      - zoning from layer7
      - status prefers layer127's 'Active' over layer7's single-char codes
      - rental_type prefers the more specific layer127 value
      - address prefers layer127's cleaner format
    """
    print("\nMerging duplicate licenses across layers...")
    with conn.cursor() as cur:
        # Merge layer7 fields into matching layer127 rows
        cur.execute("""
            UPDATE short_term_rentals AS dst
            SET
                zoning = COALESCE(dst.zoning, src.zoning)
            FROM short_term_rentals AS src
            WHERE dst.source = 'layer127'
              AND src.source = 'layer7'
              AND dst.business_license IS NOT NULL
              AND dst.business_license = src.business_license;
        """)
        merged = cur.rowcount
        print(f"  Merged zoning into {merged} layer127 rows")

        # Delete layer7 rows that have a matching layer127 row
        cur.execute("""
            DELETE FROM short_term_rentals AS l7
            USING short_term_rentals AS l127
            WHERE l7.source = 'layer7'
              AND l127.source = 'layer127'
              AND l7.business_license IS NOT NULL
              AND l7.business_license = l127.business_license;
        """)
        deleted = cur.rowcount
        print(f"  Deleted {deleted} duplicate layer7 rows")

    conn.commit()


def print_summary(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT source, COUNT(*) FROM short_term_rentals GROUP BY source ORDER BY source;
        """)
        print("\n=== Summary ===")
        for row in cur.fetchall():
            print(f"  {row[0]}: {row[1]} records")

        cur.execute("SELECT COUNT(*) FROM short_term_rentals;")
        print(f"  Total: {cur.fetchone()[0]} records")

        cur.execute("""
            SELECT rental_type, COUNT(*)
            FROM short_term_rentals
            GROUP BY rental_type ORDER BY COUNT(*) DESC;
        """)
        print("\n  By rental type:")
        for row in cur.fetchall():
            print(f"    {row[0] or 'NULL'}: {row[1]}")

        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT business_license FROM short_term_rentals
                WHERE business_license IS NOT NULL
                GROUP BY business_license HAVING COUNT(*) > 1
            ) dupes;
        """)
        remaining_dupes = cur.fetchone()[0]
        print(f"\n  Remaining duplicate licenses: {remaining_dupes}")


def main():
    conn = get_db()
    init_db(conn)

    ingest_layer(conn, "Layer 7 (STR 2024)", LAYER7_URL, upsert_layer7)
    ingest_layer(conn, "Layer 127 (Permits 2025)", LAYER127_URL, upsert_layer127)
    merge_duplicates(conn)

    print_summary(conn)
    conn.close()


if __name__ == "__main__":
    main()
