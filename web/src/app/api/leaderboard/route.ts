import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "edge";

export async function GET() {
  const sql = getDb();

  try {
    const topByCount = await sql`
      SELECT
        TRIM(owner_name) AS owner_name,
        TRIM(owner_state) AS owner_state,
        COUNT(*) AS property_count,
        ROUND(SUM(COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0))) AS total_value
      FROM accounts
      WHERE TRIM(tax_district) LIKE 'CI%'
        AND owner_name IS NOT NULL AND TRIM(owner_name) != ''
      GROUP BY TRIM(owner_name), TRIM(owner_state)
      HAVING COUNT(*) >= 2
      ORDER BY property_count DESC, total_value DESC
      LIMIT 25
    `;

    const topByValue = await sql`
      SELECT
        TRIM(owner_name) AS owner_name,
        TRIM(owner_state) AS owner_state,
        COUNT(*) AS property_count,
        ROUND(SUM(COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0))) AS total_value
      FROM accounts
      WHERE TRIM(tax_district) LIKE 'CI%'
        AND owner_name IS NOT NULL AND TRIM(owner_name) != ''
      GROUP BY TRIM(owner_name), TRIM(owner_state)
      HAVING SUM(COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0)) > 0
      ORDER BY total_value DESC
      LIMIT 25
    `;

    const mostExpensive = await sql`
      SELECT
        situs_line_1 AS address,
        TRIM(owner_name) AS owner_name,
        TRIM(owner_state) AS owner_state,
        property_class,
        neighborhood_name AS neighborhood,
        COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0) AS market_value,
        second_home_score AS score,
        is_likely_second_home
      FROM accounts
      WHERE TRIM(tax_district) LIKE 'CI%'
        AND (COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0)) > 0
      ORDER BY (COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0)) DESC
      LIMIT 25
    `;

    return NextResponse.json({
      topByCount,
      topByValue,
      mostExpensive,
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
