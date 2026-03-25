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
  const zoom = parseInt(searchParams.get("zoom") ?? "14", 10);

  const forceHeat = searchParams.get("mode") === "heat";
  const heatMode = forceHeat || zoom < 14;
  const tolerance = zoom >= 17 ? 0 : zoom >= 15 ? 0.00001 : zoom >= 14 ? 0.00005 : 0;
  const limit = heatMode ? 50000 : zoom >= 15 ? 10000 : 6000;

  const geomExpr = heatMode
    ? `ST_AsGeoJSON(ST_Centroid(geom))::json`
    : tolerance > 0
      ? `ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, ${tolerance}))::json`
      : `ST_AsGeoJSON(geom)::json`;

  const conditions: string[] = [
    "geom IS NOT NULL",
    "TRIM(tax_district) LIKE 'CI%'",
    "COALESCE(is_exempt_gov, 0) != 1",
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
  } else {
    conditions.push("property_class IN ('SRES', 'MRES', 'CRES')");
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

  const propsExpr = heatMode
    ? `json_build_object(
          'objectid', objectid,
          'score', second_home_score
        )`
    : `json_build_object(
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
          'neighborhood', neighborhood_name,
          'score', second_home_score,
          'is_likely_second_home', is_likely_second_home,
          'score_out_of_state', COALESCE(score_out_of_state, 0),
          'score_diff_city', COALESCE(score_diff_city, 0),
          'score_entity', COALESCE(score_entity, 0),
          'score_high_value', COALESCE(score_high_value, 0),
          'score_multi_owner', COALESCE(score_multi_owner, 0),
          'score_mailing_match', COALESCE(score_mailing_match, 0),
          'score_head_of_family', COALESCE(score_head_of_family, 0),
          'score_po_box', COALESCE(score_po_box, 0),
          'is_po_box', COALESCE(is_po_box, false)
        )`;

  const query = `
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(sub.feat), '[]')
    ) AS geojson
    FROM (
      SELECT json_build_object(
        'type', 'Feature',
        'id', objectid,
        'geometry', ${geomExpr},
        'properties', ${propsExpr}
      ) AS feat
      FROM accounts
      WHERE ${where}
      ORDER BY objectid
      LIMIT ${limit}
    ) sub
  `;

  try {
    const rows = await sql.query(query, params) as Record<string, unknown>[];
    const geojson = rows[0]?.geojson as Record<string, unknown> | undefined;
    const body = { ...(geojson ?? {}), mode: heatMode ? "heat" : "parcels" };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
