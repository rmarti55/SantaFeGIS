import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "edge";

export async function GET() {
  const sql = getDb();

  try {
    const [summary] = await sql`
      SELECT
        COUNT(*) AS total_parcels,
        COUNT(*) FILTER (WHERE property_class IN ('SRES','MRES','CRES')) AS total_residential,
        COUNT(*) FILTER (WHERE is_likely_second_home = true) AS likely_second_homes,
        COUNT(*) FILTER (WHERE second_home_score BETWEEN 2 AND 3 AND property_class IN ('SRES','MRES','CRES')) AS possible_second_homes,
        ROUND(AVG(COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0)) FILTER (WHERE is_likely_second_home = true)) AS avg_value_second_home,
        ROUND(AVG(COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0)) FILTER (WHERE is_likely_second_home = false AND property_class IN ('SRES','MRES','CRES'))) AS avg_value_primary
      FROM accounts
      WHERE TRIM(tax_district) LIKE 'CI%'
        AND COALESCE(is_exempt_gov, 0) != 1
    `;

    const topStates = await sql`
      SELECT TRIM(owner_state) AS state, COUNT(*) AS count
      FROM accounts
      WHERE TRIM(tax_district) LIKE 'CI%'
        AND COALESCE(is_exempt_gov, 0) != 1
        AND is_likely_second_home = true
        AND TRIM(owner_state) != 'NM' AND TRIM(owner_state) != ''
        AND owner_state IS NOT NULL
      GROUP BY TRIM(owner_state)
      ORDER BY count DESC
      LIMIT 10
    `;

    const byNeighborhood = await sql`
      SELECT
        TRIM(neighborhood_name) AS neighborhood,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_likely_second_home = true) AS second_homes,
        ROUND(100.0 * COUNT(*) FILTER (WHERE is_likely_second_home = true) / NULLIF(COUNT(*), 0), 1) AS pct
      FROM accounts
      WHERE TRIM(tax_district) LIKE 'CI%'
        AND COALESCE(is_exempt_gov, 0) != 1
        AND property_class IN ('SRES','MRES','CRES')
        AND neighborhood_name IS NOT NULL AND TRIM(neighborhood_name) != ''
      GROUP BY TRIM(neighborhood_name)
      HAVING COUNT(*) >= 10
      ORDER BY pct DESC
      LIMIT 20
    `;

    return NextResponse.json({
      summary: summary,
      topOwnerStates: topStates,
      neighborhoodBreakdown: byNeighborhood,
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
