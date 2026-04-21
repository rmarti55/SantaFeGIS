#!/usr/bin/env python3
"""
Scrape City of Santa Fe Sunshine Portal: Contracts, Gift Reports.
Stores into Postgres tables: contracts, gift_reports.
"""

import os
import sys
import re
import time
import json
from datetime import datetime

try:
    import requests
except ImportError:
    print("Error: requests not installed. Run: pip install requests")
    sys.exit(1)

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("Error: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

BASE_URL = "https://santafenm.gov/city-clerk-1/sunshine-portal/contracts-1"
GIFT_URL = "https://santafenm.gov/city-clerk-1/sunshine-portal/gift-reporting"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SantaFeOpenData/1.0)"}


def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(db_url)


def create_tables(conn):
    cur = conn.cursor()
    cur.execute("DROP TABLE IF EXISTS contracts CASCADE")
    cur.execute("DROP TABLE IF EXISTS gift_reports CASCADE")
    cur.execute("""
        CREATE TABLE contracts (
            id SERIAL PRIMARY KEY,
            contract_number TEXT UNIQUE,
            item TEXT,
            start_date DATE,
            department TEXT,
            vendor TEXT,
            purpose TEXT,
            amount_cents BIGINT,
            pdf_url TEXT,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX contracts_dept ON contracts (department);
        CREATE INDEX contracts_vendor ON contracts (vendor);
        CREATE INDEX contracts_start_date ON contracts (start_date);
        CREATE INDEX contracts_amount ON contracts (amount_cents);
    """)
    cur.execute("""
        CREATE TABLE gift_reports (
            id SERIAL PRIMARY KEY,
            description TEXT,
            reportee TEXT,
            report_date DATE,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    print("✓ Created contracts and gift_reports tables")


def parse_amount_cents(raw: str) -> int:
    """Convert '$1,234.56' or '1234.56' to integer cents."""
    cleaned = raw.replace("$", "").replace(",", "").strip()
    try:
        return round(float(cleaned) * 100)
    except ValueError:
        return 0


def parse_date(raw: str):
    """Parse '3/16/2026' -> date object, or None."""
    raw = raw.strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%-m/%-d/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def parse_contracts_html(html: str) -> list[dict]:
    """Parse contract rows from HTML tbody."""
    contracts = []
    tbody_match = re.search(r"<tbody>(.*?)</tbody>", html, re.DOTALL)
    if not tbody_match:
        return contracts

    tbody = tbody_match.group(1)

    # Each contract is a <tr><td>...</td></tr> with labeled divs
    row_pattern = re.compile(r"<tr>\s*<td>(.*?)</td>\s*</tr>", re.DOTALL)
    for row_match in row_pattern.finditer(tbody):
        cell = row_match.group(1)

        def extract(label: str) -> str:
            m = re.search(
                rf"<strong>{re.escape(label)}</strong>\s*(.*?)(?=<div>|<strong>|</td>)",
                cell,
                re.DOTALL,
            )
            if not m:
                return ""
            return re.sub(r"<[^>]+>", "", m.group(1)).strip()

        item = extract("Item:")
        start_date_raw = extract("Start Date:")
        department = extract("Department:")
        vendor = extract("Vendor:")
        purpose = extract("Purpose/Scope:")
        amount_raw = extract("Amount of Contract:")
        contract_number = extract("Contract Number:")

        # PDF link
        pdf_match = re.search(r'href="(https?://santafenm\.gov/media/sunshine_contracts/[^"]+)"', cell)
        pdf_url = pdf_match.group(1) if pdf_match else None

        if not contract_number:
            continue

        contracts.append(
            {
                "contract_number": contract_number,
                "item": item or None,
                "start_date": parse_date(start_date_raw),
                "department": department or None,
                "vendor": vendor or None,
                "purpose": purpose or None,
                "amount_cents": parse_amount_cents(amount_raw),
                "pdf_url": pdf_url,
            }
        )
    return contracts


def fetch_contracts_page(session: requests.Session, year: int, offset: int) -> tuple[list[dict], bool]:
    """Fetch one page of contracts for a given year. Returns (contracts, has_more)."""
    params = {
        "search_query": "",
        "search_vendor": "",
        "date_type": "custom_range",
        "search_start_date": f"01/01/{year}",
        "search_end_date": f"12/31/{year}",
    }
    if offset > 0:
        params["params"] = f"start_date/desc/P{offset}"
    else:
        params["params"] = "start_date/desc"

    try:
        r = session.get(BASE_URL, params=params, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  Error fetching year={year} offset={offset}: {e}")
        return [], False

    contracts = parse_contracts_html(r.text)
    has_more = len(contracts) >= 25  # 25 per page
    return contracts, has_more


def ingest_contracts(conn):
    print("🔄 Scraping contracts from Sunshine Portal...")
    session = requests.Session()
    session.headers.update(HEADERS)

    cur = conn.cursor()
    total_inserted = 0
    total_skipped = 0

    current_year = datetime.now().year
    years = list(range(2021, current_year + 1))

    for year in years:
        print(f"  Year {year}:", end=" ", flush=True)
        year_count = 0
        offset = 0

        while True:
            contracts, has_more = fetch_contracts_page(session, year, offset)
            if not contracts:
                break

            rows = [
                (
                    c["contract_number"],
                    c["item"],
                    c["start_date"],
                    c["department"],
                    c["vendor"],
                    c["purpose"],
                    c["amount_cents"],
                    c["pdf_url"],
                )
                for c in contracts
            ]

            try:
                execute_values(
                    cur,
                    """
                    INSERT INTO contracts
                        (contract_number, item, start_date, department, vendor, purpose, amount_cents, pdf_url)
                    VALUES %s
                    ON CONFLICT (contract_number) DO UPDATE SET
                        item = EXCLUDED.item,
                        start_date = EXCLUDED.start_date,
                        department = EXCLUDED.department,
                        vendor = EXCLUDED.vendor,
                        purpose = EXCLUDED.purpose,
                        amount_cents = EXCLUDED.amount_cents,
                        pdf_url = EXCLUDED.pdf_url
                    """,
                    rows,
                )
                conn.commit()
                year_count += len(contracts)
                total_inserted += len(contracts)
            except Exception as e:
                conn.rollback()
                print(f"\n  Error inserting: {e}")
                total_skipped += len(contracts)

            print(f".", end="", flush=True)

            if not has_more:
                break

            offset += 25
            time.sleep(0.5)

        print(f" {year_count} contracts")

    print(f"\n✅ Contracts complete: {total_inserted} upserted, {total_skipped} skipped")


def parse_gift_reports_html(html: str) -> list[dict]:
    """Parse gift report rows."""
    reports = []
    tbody_match = re.search(r"<tbody>(.*?)</tbody>", html, re.DOTALL)
    if not tbody_match:
        return reports

    tbody = tbody_match.group(1)
    row_pattern = re.compile(r"<tr>(.*?)</tr>", re.DOTALL)
    for row_match in row_pattern.finditer(tbody):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row_match.group(1), re.DOTALL)
        if len(cells) < 3:
            continue
        description = re.sub(r"<[^>]+>", "", cells[0]).strip()
        reportee = re.sub(r"<[^>]+>", "", cells[1]).strip()
        date_raw = re.sub(r"<[^>]+>", "", cells[2]).strip()
        if not description:
            continue
        reports.append(
            {
                "description": description or None,
                "reportee": reportee or None,
                "report_date": parse_date(date_raw),
            }
        )
    return reports


def ingest_gift_reports(conn):
    print("🔄 Scraping gift reports...")
    session = requests.Session()
    session.headers.update(HEADERS)

    try:
        r = session.get(GIFT_URL, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print(f"  Error: {e}")
        return

    reports = parse_gift_reports_html(r.text)
    if not reports:
        print("  No gift reports found")
        return

    cur = conn.cursor()
    rows = [(rep["description"], rep["reportee"], rep["report_date"]) for rep in reports]
    try:
        execute_values(
            cur,
            "INSERT INTO gift_reports (description, reportee, report_date) VALUES %s",
            rows,
        )
        conn.commit()
        print(f"✅ Gift reports: {len(reports)} inserted")
    except Exception as e:
        conn.rollback()
        print(f"  Error: {e}")


def main():
    conn = get_db_connection()
    create_tables(conn)
    ingest_contracts(conn)
    ingest_gift_reports(conn)

    # Summary
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*), SUM(amount_cents) FROM contracts")
    count, total_cents = cur.fetchone()
    print(f"\n📊 contracts: {count} rows, ${(total_cents or 0)/100:,.0f} total spend")
    cur.execute("SELECT COUNT(*) FROM gift_reports")
    print(f"📊 gift_reports: {cur.fetchone()[0]} rows")
    conn.close()


if __name__ == "__main__":
    main()
