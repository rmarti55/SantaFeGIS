#!/usr/bin/env python3
"""
Ingest the full CRM snapshot (CRM___01122026) with all 150 fields into Postgres.
This replaces the stripped Public_CRM layer with complete narrative, resolution, and type-specific data.
"""

import os
import sys
import requests
import json
from datetime import datetime

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("Error: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# ArcGIS layer
BASE_URL = "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/CRM___01122026/FeatureServer/0"

def get_db_connection():
    """Connect to Postgres using DATABASE_URL env var."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")

    conn = psycopg2.connect(db_url)
    return conn

def create_crm_full_table(conn):
    """Create crm_full table with all 150 fields from the snapshot."""
    cur = conn.cursor()

    # Drop if exists (for re-runs)
    cur.execute("DROP TABLE IF EXISTS crm_full CASCADE")

    # Create table matching the ArcGIS schema
    # We'll make most columns TEXT since ArcGIS fields are variable
    sql = """
    CREATE TABLE crm_full (
        id SERIAL PRIMARY KEY,
        objectid INTEGER,
        globalid TEXT UNIQUE,  -- ArcGIS GUID, globally unique merge key
        data_source TEXT DEFAULT 'snapshot',  -- 'snapshot' | 'live_full' | 'public_partial'

        -- Form fields (main questions)
        problemtype TEXT,
        problemtype_from_extra TEXT,  -- derived for API compat (populated post-ingest)
        "What_is_the_problem_you_are_reporting_" TEXT,
        "Please_describe_details_of_your_concern_as_much_as_possible_to_help_our_team_understand_and_get_it_addressed" TEXT,

        -- Assignment and resolution
        "Assigned_to" TEXT,
        status TEXT,
        status_from_extra TEXT,  -- derived for API compat (populated post-ingest)
        "Resolution" TEXT,
        "Field_Notes" TEXT,
        "responsecomments" TEXT,
        "responsenotes" TEXT,
        "response_notes" TEXT,

        -- Metadata
        "Submitted_on" BIGINT,
        "Resolved_on" BIGINT,
        "CreationDate" BIGINT,
        "On_behalf_of_Councilor" TEXT,
        "WorkOrderNumber" TEXT,
        "Days_to_Resolve" INTEGER,

        -- Geometry
        "X_Longitude" NUMERIC,
        "Y_Latitude" NUMERIC,
        "x" NUMERIC,
        "y" NUMERIC,

        -- Encampment fields
        "Where_is_the_encampment_located_" TEXT,
        "How_many_people_are_at_the_encampment__estimate__" TEXT,
        "Can_you_identify_any_of_the_following_at_the_encampment_" TEXT,
        "Is_the_Encampment_Active_or_Abandoned_" TEXT,

        -- Vehicle fields
        "Where_is_the_vehicle_located_" TEXT,
        "What_is_the_license_plate_number_of_the_vehicle_" TEXT,
        "What_is_the_make_and_model_of_the_vehicle_" TEXT,
        "What_color_is_the_vehicle_" TEXT,
        "Has_the_vehicle_been_parked_unmoved_on_the_street_for_more_than_30_days_" TEXT,

        -- Pothole fields
        "Approximately_how_large_is_the_pothole_" TEXT,

        -- Dumping fields
        "What_type_of_objects_are_illegally_dumped_" TEXT,

        -- Graffiti fields
        "What_is_the_graffiti_located_on_" TEXT,

        -- Property fields
        "Is_the_property_residential__commercial__or_public_" TEXT,
        "What_is_the_main_type_of_item_that_make_this_property__unsightly__" TEXT,

        -- PII (store, never display)
        "Name" TEXT,
        "Please_provide_your_phone_number_" TEXT,
        "Please_provide_your_email_address_" TEXT,
        "What_is_your_birthday_" TEXT,
        "What_is_your_drivers_license_number_" TEXT,

        -- City employee
        "Are_you_an_employee_of_the_City_of_Santa_Fe_submitting_on_behalf_of_a_constituent_" TEXT,
        "Employee_Name_" TEXT,
        "Department_" TEXT,

        -- Store all other fields as JSONB for flexibility
        extra_fields JSONB,

        -- Audit
        ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX crm_full_globalid ON crm_full (globalid);
    CREATE INDEX crm_full_objectid ON crm_full (objectid);
    CREATE INDEX crm_full_wonum ON crm_full ("WorkOrderNumber");
    CREATE INDEX crm_full_status ON crm_full (status);
    """
    cur.execute(sql)
    conn.commit()
    print("✓ Created crm_full table")

def fetch_records(limit=1000, offset=0):
    """Fetch records from ArcGIS layer in pages."""
    params = {
        "where": "1=1",
        "outFields": "*",
        "resultRecordCount": limit,
        "resultOffset": offset,
        "returnGeometry": False,
        "f": "json"
    }

    url = f"{BASE_URL}/query"
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Error fetching records at offset {offset}: {e}")
        return None

def ingest_records(conn, records):
    """Insert records into crm_full table."""
    if not records:
        return 0

    cur = conn.cursor()

    # Map field names to column names
    known_fields = {
        'objectid', 'globalid', 'problemtype', 'status', 'CreationDate',
        'Assigned_to', 'Resolution', 'Field_Notes', 'responsecomments',
        'responsenotes', 'response_notes', 'Submitted_on', 'Resolved_on',
        'On_behalf_of_Councilor', 'WorkOrderNumber', 'Days_to_Resolve',
        'X_Longitude', 'Y_Latitude', 'x', 'y',
        'Name', 'Please_provide_your_phone_number_', 'Please_provide_your_email_address_',
        'What_is_your_birthday_', 'What_is_your_drivers_license_number_',
        'Are_you_an_employee_of_the_City_of_Santa_Fe_submitting_on_behalf_of_a_constituent_',
        'Employee_Name_', 'Department_'
    }

    # Add all other field names from our CREATE TABLE
    known_fields.update([
        'What_is_the_problem_you_are_reporting_',
        'Please_describe_details_of_your_concern_as_much_as_possible_to_help_our_team_understand_and_get_it_addressed',
        'Where_is_the_encampment_located_', 'How_many_people_are_at_the_encampment__estimate__',
        'Can_you_identify_any_of_the_following_at_the_encampment_', 'Is_the_Encampment_Active_or_Abandoned_',
        'Where_is_the_vehicle_located_', 'What_is_the_license_plate_number_of_the_vehicle_',
        'What_is_the_make_and_model_of_the_vehicle_', 'What_color_is_the_vehicle_',
        'Has_the_vehicle_been_parked_unmoved_on_the_street_for_more_than_30_days_',
        'Approximately_how_large_is_the_pothole_', 'What_type_of_objects_are_illegally_dumped_',
        'What_is_the_graffiti_located_on_', 'Is_the_property_residential__commercial__or_public_',
        'What_is_the_main_type_of_item_that_make_this_property__unsightly__'
    ])

    rows_to_insert = []
    for rec in records:
        attrs = rec.get('attributes', {})

        # Extract known fields
        known_vals = {k: attrs.get(k) for k in known_fields if k in attrs}

        # Remaining fields go into JSONB
        extra = {k: v for k, v in attrs.items() if k not in known_fields}

        row = (
            attrs.get('OBJECTID_1') or attrs.get('ObjectID') or attrs.get('objectid'),
            attrs.get('GlobalID') or attrs.get('globalid'),
            'snapshot',  # data_source
            known_vals.get('problemtype'),
            known_vals.get('problemtype'),  # problemtype_from_extra (same as problemtype for now)
            known_vals.get('What_is_the_problem_you_are_reporting_'),
            known_vals.get('Please_describe_details_of_your_concern_as_much_as_possible_to_help_our_team_understand_and_get_it_addressed'),
            known_vals.get('Assigned_to'),
            known_vals.get('status'),
            known_vals.get('status'),  # status_from_extra (same as status for now)
            known_vals.get('Resolution'),
            known_vals.get('Field_Notes'),
            known_vals.get('responsecomments'),
            known_vals.get('responsenotes'),
            known_vals.get('response_notes'),
            known_vals.get('Submitted_on'),
            known_vals.get('Resolved_on'),
            known_vals.get('CreationDate'),
            known_vals.get('On_behalf_of_Councilor'),
            known_vals.get('WorkOrderNumber'),
            known_vals.get('Days_to_Resolve'),
            known_vals.get('X_Longitude'),
            known_vals.get('Y_Latitude'),
            known_vals.get('x'),
            known_vals.get('y'),
            known_vals.get('Where_is_the_encampment_located_'),
            known_vals.get('How_many_people_are_at_the_encampment__estimate__'),
            known_vals.get('Can_you_identify_any_of_the_following_at_the_encampment_'),
            known_vals.get('Is_the_Encampment_Active_or_Abandoned_'),
            known_vals.get('Where_is_the_vehicle_located_'),
            known_vals.get('What_is_the_license_plate_number_of_the_vehicle_'),
            known_vals.get('What_is_the_make_and_model_of_the_vehicle_'),
            known_vals.get('What_color_is_the_vehicle_'),
            known_vals.get('Has_the_vehicle_been_parked_unmoved_on_the_street_for_more_than_30_days_'),
            known_vals.get('Approximately_how_large_is_the_pothole_'),
            known_vals.get('What_type_of_objects_are_illegally_dumped_'),
            known_vals.get('What_is_the_graffiti_located_on_'),
            known_vals.get('Is_the_property_residential__commercial__or_public_'),
            known_vals.get('What_is_the_main_type_of_item_that_make_this_property__unsightly__'),
            known_vals.get('Name'),
            known_vals.get('Please_provide_your_phone_number_'),
            known_vals.get('Please_provide_your_email_address_'),
            known_vals.get('What_is_your_birthday_'),
            known_vals.get('What_is_your_drivers_license_number_'),
            known_vals.get('Are_you_an_employee_of_the_City_of_Santa_Fe_submitting_on_behalf_of_a_constituent_'),
            known_vals.get('Employee_Name_'),
            known_vals.get('Department_'),
            json.dumps(extra) if extra else None
        )
        rows_to_insert.append(row)

    # Insert all rows at once
    sql = """
    INSERT INTO crm_full (
        objectid, globalid, data_source, problemtype, problemtype_from_extra, "What_is_the_problem_you_are_reporting_",
        "Please_describe_details_of_your_concern_as_much_as_possible_to_help_our_team_understand_and_get_it_addressed",
        "Assigned_to", status, status_from_extra, "Resolution", "Field_Notes", responsecomments,
        responsenotes, response_notes, "Submitted_on", "Resolved_on", "CreationDate",
        "On_behalf_of_Councilor", "WorkOrderNumber", "Days_to_Resolve",
        "X_Longitude", "Y_Latitude", x, y,
        "Where_is_the_encampment_located_", "How_many_people_are_at_the_encampment__estimate__",
        "Can_you_identify_any_of_the_following_at_the_encampment_", "Is_the_Encampment_Active_or_Abandoned_",
        "Where_is_the_vehicle_located_", "What_is_the_license_plate_number_of_the_vehicle_",
        "What_is_the_make_and_model_of_the_vehicle_", "What_color_is_the_vehicle_",
        "Has_the_vehicle_been_parked_unmoved_on_the_street_for_more_than_30_days_",
        "Approximately_how_large_is_the_pothole_", "What_type_of_objects_are_illegally_dumped_",
        "What_is_the_graffiti_located_on_", "Is_the_property_residential__commercial__or_public_",
        "What_is_the_main_type_of_item_that_make_this_property__unsightly__",
        "Name", "Please_provide_your_phone_number_", "Please_provide_your_email_address_",
        "What_is_your_birthday_", "What_is_your_drivers_license_number_",
        "Are_you_an_employee_of_the_City_of_Santa_Fe_submitting_on_behalf_of_a_constituent_",
        "Employee_Name_", "Department_", extra_fields
    ) VALUES %s
    """

    try:
        execute_values(cur, sql, rows_to_insert)
        conn.commit()
        return len(rows_to_insert)
    except Exception as e:
        conn.rollback()
        print(f"Error inserting records: {e}")
        raise

def fetch_live_open_tickets(limit=1000, offset=0):
    """Fetch live open tickets from CRM_Report_a_Problem_Received_In_progress."""
    base_url = "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/CRM_Report_a_Problem_Received_In_progress/FeatureServer/0"
    params = {
        "where": "1=1",
        "outFields": "*",
        "resultRecordCount": limit,
        "resultOffset": offset,
        "returnGeometry": False,
        "f": "json"
    }

    try:
        resp = requests.get(f"{base_url}/query", params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Error fetching live open tickets at offset {offset}: {e}")
        return None

def ingest_live_open_tickets(conn):
    """Ingest live open tickets from CRM_Report_a_Problem_Received_In_progress with upsert logic."""
    print("🔄 Phase 2: Ingesting live open tickets (CRM_Report_a_Problem_Received_In_progress)...")

    total_inserted = 0
    total_updated = 0
    offset = 0
    page_size = 1000

    cur = conn.cursor()

    while True:
        print(f"  Fetching live open tickets at offset {offset}...", end=" ", flush=True)
        result = fetch_live_open_tickets(limit=page_size, offset=offset)

        if not result or not result.get('features'):
            print("done.")
            break

        features = result['features']

        for rec in features:
            attrs = rec.get('attributes', {})
            globalid = attrs.get('globalid')

            if not globalid:
                continue

            # Simple upsert: always update status/resolved fields if they exist
            upsert_sql = """
                INSERT INTO crm_full (
                    globalid, data_source, objectid, problemtype, problemtype_from_extra,
                    "What_is_the_problem_you_are_reporting_", status, status_from_extra,
                    "Assigned_to", "Resolution", "Field_Notes", "CreationDate", "Resolved_on",
                    "WorkOrderNumber", "On_behalf_of_Councilor", "Please_provide_your_phone_number_",
                    "Please_provide_your_email_address_", "Y_Latitude", "X_Longitude",
                    responsenotes, responsecomments, response_notes, extra_fields
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (globalid) DO UPDATE SET
                    status = EXCLUDED.status,
                    status_from_extra = EXCLUDED.status_from_extra,
                    "Resolved_on" = EXCLUDED."Resolved_on",
                    "Resolution" = EXCLUDED."Resolution",
                    "Field_Notes" = EXCLUDED."Field_Notes"
            """

            insert_vals = [
                globalid,
                'live_full',
                attrs.get('objectid'),
                attrs.get('problemtype', ''),
                attrs.get('problemtype', ''),
                attrs.get('Problem', attrs.get('problem2')),
                attrs.get('status'),
                attrs.get('status'),
                attrs.get('assignedto'),
                attrs.get('resolution'),
                attrs.get('fieldnotes'),
                attrs.get('CreationDate'),
                attrs.get('resolved_on'),
                attrs.get('WorkOrderNumber'),
                attrs.get('councilor'),
                attrs.get('phone_number'),
                attrs.get('email'),
                attrs.get('Latitude'),
                attrs.get('Longitude'),
                attrs.get('responsenotes'),
                attrs.get('responsecomments'),
                attrs.get('response_notes'),
                json.dumps({k: v for k, v in attrs.items() if k not in ['objectid', 'globalid', 'CreationDate', 'Problem', 'problemtype', 'status', 'resolved_on', 'Resolution', 'Field_Notes', 'assignedto', 'fieldnotes', 'WorkOrderNumber', 'councilor', 'phone_number', 'email', 'Latitude', 'Longitude', 'responsenotes', 'responsecomments', 'response_notes']}) if attrs else None
            ]

            try:
                cur.execute(upsert_sql, insert_vals)
                if cur.rowcount > 0:
                    if 'INSERT' in cur.statusmessage:
                        total_inserted += 1
                    else:
                        total_updated += 1
            except Exception as e:
                print(f"\nError upserting record {globalid}: {e}")
                conn.rollback()
                cur = conn.cursor()
                continue

        conn.commit()
        print(f"✓ {len(features)} records processed")

        if len(features) < page_size:
            break

        offset += page_size

    print(f"✅ Phase 2 complete: {total_inserted} inserted, {total_updated} updated")

def fetch_public_crm_recent(limit=1000, offset=0):
    """Fetch ALL records from Public_CRM to backfill status on snapshot rows."""
    base_url = "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/Public_CRM/FeatureServer/0"

    params = {
        "where": "1=1",
        "outFields": "objectid, globalid, problemtype, problem2, status, resolved_on, CreationDate",
        "resultRecordCount": limit,
        "resultOffset": offset,
        "returnGeometry": False,
        "f": "json"
    }

    try:
        resp = requests.get(f"{base_url}/query", params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"Error fetching recent Public_CRM records at offset {offset}: {e}")
        return None

def ingest_public_crm_recent(conn):
    """Backfill status for all records from Public_CRM; insert any new globalids."""
    print("🔄 Phase 3: Ingesting ALL Public_CRM (backfilling status on snapshot rows)...")

    total_inserted = 0
    total_updated = 0
    offset = 0
    page_size = 1000

    cur = conn.cursor()

    while True:
        print(f"  Fetching Public_CRM at offset {offset}...", end=" ", flush=True)
        result = fetch_public_crm_recent(limit=page_size, offset=offset)

        if not result or not result.get('features'):
            print("done.")
            break

        features = result['features']

        for rec in features:
            attrs = rec.get('attributes', {})
            globalid = attrs.get('globalid')

            if not globalid:
                continue

            # For existing rows (snapshot): backfill status and resolved_on
            # For new globalids: insert with minimal fields
            upsert_sql = """
                INSERT INTO crm_full (
                    globalid, data_source, objectid, problemtype, problemtype_from_extra,
                    "What_is_the_problem_you_are_reporting_", status, status_from_extra,
                    "Resolved_on", "CreationDate"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (globalid) DO UPDATE SET
                    status = EXCLUDED.status,
                    status_from_extra = EXCLUDED.status_from_extra,
                    "Resolved_on" = EXCLUDED."Resolved_on"
            """

            insert_vals = [
                globalid,
                'public_partial',
                attrs.get('objectid'),
                attrs.get('problemtype'),
                attrs.get('problemtype'),
                attrs.get('problem2'),
                attrs.get('status'),
                attrs.get('status'),
                attrs.get('resolved_on'),
                attrs.get('CreationDate'),
            ]

            try:
                cur.execute(upsert_sql, insert_vals)
                if cur.rowcount > 0:
                    # pgresult: INSERT 0 1 = new row, UPDATE 1 = existing row updated
                    if cur.statusmessage and cur.statusmessage.startswith('INSERT'):
                        total_inserted += 1
                    else:
                        total_updated += 1
            except Exception as e:
                print(f"\nError upserting record {globalid}: {e}")
                conn.rollback()
                cur = conn.cursor()
                continue

        conn.commit()
        print(f"✓ {len(features)} records processed")

        if len(features) < page_size:
            break

        offset += page_size

    print(f"✅ Phase 3 complete: {total_inserted} new records inserted, {total_updated} existing rows updated")

def main():
    print("🔄 Ingesting full CRM snapshot (CRM___01122026)...")

    conn = get_db_connection()
    create_crm_full_table(conn)

    # Fetch in pages (1000 records per page)
    total_ingested = 0
    offset = 0
    page_size = 1000

    while True:
        print(f"  Fetching records at offset {offset}...", end=" ", flush=True)
        result = fetch_records(limit=page_size, offset=offset)

        if not result or not result.get('features'):
            print("done.")
            break

        features = result['features']
        ingested = ingest_records(conn, features)
        total_ingested += ingested
        print(f"✓ {ingested} records")

        if len(features) < page_size:
            break

        offset += page_size

    print(f"\n✅ Phase 1 complete: {total_ingested} records from snapshot")

    # Phase 2: Ingest live open tickets
    ingest_live_open_tickets(conn)

    # Phase 3: Ingest recent Public_CRM (closed tickets)
    ingest_public_crm_recent(conn)

    print("\n✅ All phases complete. Computing final statistics...")

    # Show summary
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM crm_full")
    count = cur.fetchone()[0]
    print(f"Total records in crm_full: {count}")

    cur.execute("SELECT COUNT(*) FROM crm_full WHERE status = 'closed'")
    closed = cur.fetchone()[0]
    print(f"Closed: {closed}")

    cur.execute("SELECT COUNT(*) FROM crm_full WHERE status IN ('Received', 'In progress')")
    open_count = cur.fetchone()[0]
    print(f"Open: {open_count}")

    conn.close()

if __name__ == "__main__":
    main()
