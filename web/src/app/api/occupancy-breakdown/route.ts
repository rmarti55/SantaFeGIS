import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "edge";

export async function GET() {
  const sql = getDb();

  try {
    const [topLevel] = await sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_owner_occupied = TRUE) AS owner_occupied,
        COUNT(*) FILTER (WHERE is_owner_occupied = FALSE) AS not_owner_occupied,
        COUNT(*) FILTER (WHERE is_owner_occupied IS NULL) AS unknown
      FROM accounts
      WHERE property_class IN ('SRES','MRES','CRES')
        AND TRIM(tax_district) LIKE 'CI%'
        AND COALESCE(is_exempt_gov, 0) != 1
    `;

    const [ownerOccDetail] = await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE is_owner_occupied = TRUE
            AND (is_head_of_family = 1 OR is_senior_freeze = 1 OR is_veteran_1 = 1 OR is_veteran_2 = 1)
        ) AS with_exemption,
        COUNT(*) FILTER (
          WHERE is_owner_occupied = TRUE
            AND is_head_of_family = 0
            AND COALESCE(is_senior_freeze, 0) = 0
            AND COALESCE(is_veteran_1, 0) = 0
            AND COALESCE(is_veteran_2, 0) = 0
        ) AS address_match_only
      FROM accounts
      WHERE property_class IN ('SRES','MRES','CRES')
        AND TRIM(tax_district) LIKE 'CI%'
        AND COALESCE(is_exempt_gov, 0) != 1
    `;

    const notOwnerOcc = await sql`
      SELECT
        CASE
          WHEN TRIM(owner_state) != 'NM' AND TRIM(owner_state) != '' AND owner_state IS NOT NULL
            THEN 'Out of State'
          WHEN TRIM(owner_state) = 'NM' AND UPPER(TRIM(owner_city)) != UPPER(TRIM(situs_city))
            THEN 'NM, Different City'
          WHEN TRIM(owner_state) = 'NM' AND UPPER(TRIM(owner_city)) = UPPER(TRIM(situs_city))
            THEN 'Same City'
          ELSE 'Unknown'
        END AS category,
        COUNT(*) AS count,
        COUNT(*) FILTER (
          WHERE is_head_of_family = 1 OR is_senior_freeze = 1 OR is_veteran_1 = 1 OR is_veteran_2 = 1
        ) AS has_exemption,
        COUNT(*) FILTER (
          WHERE owner_name ~* '(\\mLLC\\M|\\mINC\\M|\\mCORP\\M|\\mTRUST\\M|\\mL\\.?L\\.?C|\\mREVOCABLE\\M|\\mESTATE\\M|\\mPROPERT|\\mHOLDING|\\mINVEST)'
        ) AS entity_owned,
        COUNT(*) FILTER (WHERE score_multi_owner = 2) AS multi_property,
        COUNT(*) FILTER (WHERE is_po_box = TRUE) AS po_box
      FROM accounts
      WHERE property_class IN ('SRES','MRES','CRES')
        AND TRIM(tax_district) LIKE 'CI%'
        AND COALESCE(is_exempt_gov, 0) != 1
        AND is_owner_occupied = FALSE
      GROUP BY 1
      ORDER BY count DESC
    `;

    const entityTypes = await sql`
      SELECT
        CASE
          WHEN owner_name ~* '\\mTRUST\\M|\\mREVOCABLE\\M' THEN 'Trust'
          WHEN owner_name ~* '\\mLLC\\M|\\mL\\.?L\\.?C' THEN 'LLC'
          WHEN owner_name ~* '\\mINC\\M|\\mCORP\\M' THEN 'Corp/Inc'
          WHEN owner_name ~* '\\mESTATE\\M' THEN 'Estate'
          ELSE 'Other Entity'
        END AS entity_type,
        COUNT(*) AS count
      FROM accounts
      WHERE property_class IN ('SRES','MRES','CRES')
        AND TRIM(tax_district) LIKE 'CI%'
        AND COALESCE(is_exempt_gov, 0) != 1
        AND owner_name ~* '(\\mLLC\\M|\\mINC\\M|\\mCORP\\M|\\mTRUST\\M|\\mL\\.?L\\.?C|\\mREVOCABLE\\M|\\mESTATE\\M|\\mPROPERT|\\mHOLDING|\\mINVEST)'
      GROUP BY 1
      ORDER BY count DESC
    `;

    const topStates = await sql`
      SELECT TRIM(owner_state) AS state, COUNT(*) AS count
      FROM accounts
      WHERE property_class IN ('SRES','MRES','CRES')
        AND TRIM(tax_district) LIKE 'CI%'
        AND COALESCE(is_exempt_gov, 0) != 1
        AND is_owner_occupied = FALSE
        AND TRIM(owner_state) != 'NM' AND TRIM(owner_state) != ''
        AND owner_state IS NOT NULL
      GROUP BY TRIM(owner_state)
      ORDER BY count DESC
      LIMIT 10
    `;

    return NextResponse.json({
      topLevel,
      ownerOccupiedDetail: ownerOccDetail,
      notOwnerOccupied: notOwnerOcc,
      entityTypes,
      topStates,
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
