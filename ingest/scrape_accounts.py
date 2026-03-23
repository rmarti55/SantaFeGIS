"""
Scrape all Santa Fe County property accounts from the ArcGIS REST API
and load them into Neon Postgres with PostGIS geometries.

Usage:
    pip install -r requirements.txt
    export DATABASE_URL="postgresql://..."
    python scrape_accounts.py
"""

import json
import os
import sys
import time

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = (
    "https://sfcomaps.santafecountynm.gov/restsvc/rest/services"
    "/LAND/Accounts/MapServer/0/query"
)
PAGE_SIZE = 500

FIELDS = [
    "OBJECTID", "UPC", "parcel_number", "pact_code", "roll_code",
    "active_status", "situs_line_1", "situs_line_2", "situs_city",
    "situs_state", "situs_zip", "owner_name", "owner_care_of",
    "owner_line_1", "owner_line_2", "owner_city", "owner_state",
    "owner_zip", "owner_country", "subdiv_name", "subdiv_lot",
    "subdiv_block", "tax_district", "property_class",
    "acreage", "neighborhood_num", "neighborhood_name",
    "prior_market_land_res", "prior_market_imp_res",
    "prior_assessed_land", "prior_assessed_imp",
    "current_market_land_res", "current_market_land_comm",
    "current_market_imp_res", "current_market_imp_comm",
    "current_assessed_land", "current_assessed_imp",
    "current_exemption", "is_exempt_gov", "is_exempt_nongov",
    "is_head_of_family", "is_veteran_1", "is_veteran_2",
    "is_disabled_veteran", "is_senior_freeze", "is_affordable_housing",
]

DB_COLUMNS = [f.lower() for f in FIELDS]


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
            CREATE TABLE IF NOT EXISTS accounts (
                objectid        INTEGER PRIMARY KEY,
                upc             TEXT,
                parcel_number   TEXT,
                pact_code       TEXT,
                roll_code       TEXT,
                active_status   TEXT,
                situs_line_1    TEXT,
                situs_line_2    TEXT,
                situs_city      TEXT,
                situs_state     TEXT,
                situs_zip       TEXT,
                owner_name      TEXT,
                owner_care_of   TEXT,
                owner_line_1    TEXT,
                owner_line_2    TEXT,
                owner_city      TEXT,
                owner_state     TEXT,
                owner_zip       TEXT,
                owner_country   TEXT,
                subdiv_name     TEXT,
                subdiv_lot      TEXT,
                subdiv_block    TEXT,
                tax_district    TEXT,
                property_class  TEXT,
                acreage         TEXT,
                neighborhood_num INTEGER,
                neighborhood_name TEXT,
                prior_market_land_res   DOUBLE PRECISION,
                prior_market_imp_res    DOUBLE PRECISION,
                prior_assessed_land     DOUBLE PRECISION,
                prior_assessed_imp      DOUBLE PRECISION,
                current_market_land_res DOUBLE PRECISION,
                current_market_land_comm DOUBLE PRECISION,
                current_market_imp_res  DOUBLE PRECISION,
                current_market_imp_comm DOUBLE PRECISION,
                current_assessed_land   DOUBLE PRECISION,
                current_assessed_imp    DOUBLE PRECISION,
                current_exemption       DOUBLE PRECISION,
                is_exempt_gov       INTEGER,
                is_exempt_nongov    INTEGER,
                is_head_of_family   INTEGER,
                is_veteran_1        INTEGER,
                is_veteran_2        INTEGER,
                is_disabled_veteran INTEGER,
                is_senior_freeze    INTEGER,
                is_affordable_housing INTEGER,
                second_home_score   INTEGER DEFAULT 0,
                is_likely_second_home BOOLEAN DEFAULT FALSE,
                geom GEOMETRY(Geometry, 4326)
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_accounts_geom ON accounts USING GIST (geom);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_accounts_situs_city ON accounts (situs_city);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_accounts_property_class ON accounts (property_class);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_accounts_score ON accounts (second_home_score);")
    conn.commit()
    print("Database initialized.")


def fetch_page(offset, retries=3):
    params = {
        "f": "geojson",
        "where": "1=1",
        "outFields": ",".join(FIELDS),
        "outSR": "4326",
        "returnGeometry": "true",
        "resultOffset": offset,
        "resultRecordCount": PAGE_SIZE,
        "orderByFields": "OBJECTID ASC",
    }
    for attempt in range(retries):
        try:
            resp = requests.get(BASE_URL, params=params, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, json.JSONDecodeError) as e:
            wait = 2 ** (attempt + 1)
            print(f"  Retry {attempt+1}/{retries} after error: {e} (waiting {wait}s)")
            time.sleep(wait)
    print(f"FAILED to fetch offset {offset} after {retries} retries")
    return None


def insert_features(conn, features):
    if not features:
        return 0

    cols_sql = ", ".join(DB_COLUMNS + ["geom"])
    param_placeholders = ", ".join(["%s"] * len(DB_COLUMNS))
    vals_sql = f"{param_placeholders}, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)"
    conflict_sets = ", ".join(
        f"{c} = EXCLUDED.{c}" for c in DB_COLUMNS if c != "objectid"
    )
    conflict_sets += ", geom = EXCLUDED.geom"

    sql = f"""
        INSERT INTO accounts ({cols_sql})
        VALUES ({vals_sql})
        ON CONFLICT (objectid) DO UPDATE SET {conflict_sets}
    """

    rows = []
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry")
        vals = []
        for field in FIELDS:
            v = props.get(field)
            if isinstance(v, str):
                v = v.strip()
            vals.append(v)
        vals.append(json.dumps(geom) if geom else None)
        rows.append(vals)

    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, rows, page_size=100)
    conn.commit()
    return len(features)


def score_second_homes(conn):
    print("\nScoring second homes...")
    with conn.cursor() as cur:
        cur.execute("UPDATE accounts SET second_home_score = 0, is_likely_second_home = FALSE;")

        cur.execute("""
            UPDATE accounts SET second_home_score = second_home_score + 3
            WHERE TRIM(owner_state) != '' AND TRIM(owner_state) != 'NM'
              AND owner_state IS NOT NULL;
        """)
        print(f"  +3 owner out-of-state: {cur.rowcount} rows")

        cur.execute("""
            UPDATE accounts SET second_home_score = second_home_score + 2
            WHERE TRIM(owner_state) = 'NM'
              AND UPPER(TRIM(owner_city)) != UPPER(TRIM(situs_city))
              AND owner_city IS NOT NULL AND situs_city IS NOT NULL
              AND TRIM(owner_city) != '';
        """)
        print(f"  +2 owner different NM city: {cur.rowcount} rows")

        cur.execute("""
            UPDATE accounts SET second_home_score = second_home_score + 1
            WHERE property_class IN ('SRES', 'MRES', 'CRES')
              AND (is_head_of_family = 0 OR is_head_of_family IS NULL);
        """)
        print(f"  +1 no head-of-family: {cur.rowcount} rows")

        cur.execute("""
            UPDATE accounts SET second_home_score = second_home_score + 2
            WHERE owner_name ~* '(\\mLLC\\M|\\mINC\\M|\\mCORP\\M|\\mLTD\\M|\\mLP\\M|\\mTRUST\\M|\\mL\\.?L\\.?C|\\mREVOCABLE\\M|\\mIRREVOCABLE\\M|\\mESTATE\\M|\\mPROPERT(Y|IES)\\M|\\mINVEST\\M|\\mHOLDING\\M|\\mGROUP\\M|\\mPARTNERS\\M|\\mVENTURE\\M)'
              AND property_class IN ('SRES', 'MRES', 'CRES');
        """)
        print(f"  +2 entity ownership: {cur.rowcount} rows")

        cur.execute("""
            WITH q AS (
                SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY COALESCE(current_market_imp_res,0) + COALESCE(current_market_land_res,0)) AS p75
                FROM accounts
                WHERE property_class IN ('SRES', 'MRES', 'CRES')
            )
            UPDATE accounts SET second_home_score = second_home_score + 1
            FROM q
            WHERE property_class IN ('SRES', 'MRES', 'CRES')
              AND (COALESCE(current_market_imp_res,0) + COALESCE(current_market_land_res,0)) > q.p75;
        """)
        print(f"  +1 high value: {cur.rowcount} rows")

        cur.execute("""
            WITH multi AS (
                SELECT UPPER(TRIM(owner_name)) AS oname
                FROM accounts
                WHERE owner_name IS NOT NULL AND TRIM(owner_name) != ''
                GROUP BY UPPER(TRIM(owner_name))
                HAVING COUNT(*) > 1
            )
            UPDATE accounts SET second_home_score = second_home_score + 2
            FROM multi
            WHERE UPPER(TRIM(accounts.owner_name)) = multi.oname
              AND property_class IN ('SRES', 'MRES', 'CRES');
        """)
        print(f"  +2 multi-property owner: {cur.rowcount} rows")

        cur.execute("""
            UPDATE accounts SET is_likely_second_home = (second_home_score >= 4);
        """)
        print(f"  Flagged likely second homes: {cur.rowcount} rows updated")

        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE second_home_score >= 6) AS very_likely,
                COUNT(*) FILTER (WHERE second_home_score BETWEEN 4 AND 5) AS likely,
                COUNT(*) FILTER (WHERE second_home_score BETWEEN 2 AND 3) AS possible,
                COUNT(*) FILTER (WHERE second_home_score <= 1) AS unlikely
            FROM accounts
            WHERE property_class IN ('SRES', 'MRES', 'CRES');
        """)
        row = cur.fetchone()
        print(f"\n  Results (residential only):")
        print(f"    Very likely (6+): {row[0]}")
        print(f"    Likely (4-5):     {row[1]}")
        print(f"    Possible (2-3):   {row[2]}")
        print(f"    Unlikely (0-1):   {row[3]}")

    conn.commit()


def main():
    conn = get_db()
    init_db(conn)

    offset = 0
    total = 0
    t0 = time.time()
    while True:
        print(f"Fetching offset {offset}...", end=" ", flush=True)
        data = fetch_page(offset)
        if data is None:
            break

        features = data.get("features", [])
        if not features:
            print("No more features.")
            break

        t1 = time.time()
        count = insert_features(conn, features)
        total += count
        elapsed = time.time() - t1
        print(f"inserted {count} in {elapsed:.1f}s (total: {total})")

        exceeded = data.get("exceededTransferLimit", False) or data.get(
            "properties", {}
        ).get("exceededTransferLimit", False)
        if not exceeded:
            print("All records fetched.")
            break

        offset += PAGE_SIZE
        time.sleep(0.3)

    total_time = time.time() - t0
    print(f"\nDone. Total records ingested: {total} in {total_time:.0f}s")

    score_second_homes(conn)
    conn.close()


if __name__ == "__main__":
    main()
