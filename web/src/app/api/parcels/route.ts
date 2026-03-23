import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });

  const sql = neon(url, { fullResults: false });
  const { searchParams } = new URL(req.url);

  const minScore = parseInt(searchParams.get("minScore") ?? "0", 10);
  const maxScore = parseInt(searchParams.get("maxScore") ?? "99", 10);
  const ownerState = searchParams.get("ownerState") ?? "";
  const propertyClass = searchParams.get("propertyClass") ?? "";
  const bbox = searchParams.get("bbox") ?? "";

  const conditions: string[] = [
    "geom IS NOT NULL",
    `second_home_score >= ${Number(minScore) || 0}`,
    `second_home_score <= ${Number(maxScore) || 99}`,
  ];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (ownerState && /^[A-Z]{2}$/.test(ownerState.toUpperCase())) {
    conditions.push(`TRIM(owner_state) = $${paramIdx}`);
    params.push(ownerState.toUpperCase());
    paramIdx++;
  }

  if (propertyClass && /^[A-Z]{2,5}$/.test(propertyClass.toUpperCase())) {
    conditions.push(`property_class = $${paramIdx}`);
    params.push(propertyClass.toUpperCase());
    paramIdx++;
  }

  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      const [west, south, east, north] = parts;
      conditions.push(
        `geom && ST_MakeEnvelope($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, 4326)`
      );
      params.push(west, south, east, north);
      paramIdx += 4;
    }
  }

  const where = conditions.join(" AND ");

  const query = `
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'id', objectid,
          'geometry', ST_AsGeoJSON(geom)::json,
          'properties', json_build_object(
            'objectid', objectid,
            'address', situs_line_1,
            'city', situs_city,
            'zip', situs_zip,
            'owner_name', owner_name,
            'owner_city', owner_city,
            'owner_state', owner_state,
            'owner_zip', owner_zip,
            'property_class', property_class,
            'acreage', acreage,
            'market_value', COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0),
            'assessed_value', COALESCE(current_assessed_land,0) + COALESCE(current_assessed_imp,0),
            'is_head_of_family', is_head_of_family,
            'is_senior_freeze', is_senior_freeze,
            'neighborhood', neighborhood_name,
            'score', second_home_score,
            'is_likely_second_home', is_likely_second_home
          )
        )
      ), '[]')
    ) AS geojson
    FROM accounts
    WHERE ${where}
    LIMIT 50000
  `;

  try {
    const rows = await sql.query(query, params) as Record<string, unknown>[];
    const geojson = rows[0]?.geojson;
    return NextResponse.json(geojson, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
