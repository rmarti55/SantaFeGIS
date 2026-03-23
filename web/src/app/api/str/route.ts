import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = process.env.DATABASE_URL;
  if (!url)
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });

  const sql = neon(url, { fullResults: false });
  const { searchParams } = new URL(req.url);

  const status = searchParams.get("status") ?? "";
  const rentalType = searchParams.get("rentalType") ?? "";
  const bbox = searchParams.get("bbox") ?? "";

  const conditions: string[] = ["s.geom IS NOT NULL"];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`s.status = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  }

  if (rentalType) {
    conditions.push(`s.rental_type = $${paramIdx}`);
    params.push(rentalType);
    paramIdx++;
  }

  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      const [west, south, east, north] = parts;
      conditions.push(
        `s.geom && ST_MakeEnvelope($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, 4326)`
      );
      params.push(west, south, east, north);
      paramIdx += 4;
    }
  }

  const where = conditions.join(" AND ");

  const query = `
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(sub.feat), '[]')
    ) AS geojson
    FROM (
      SELECT json_build_object(
        'type', 'Feature',
        'id', s.id,
        'geometry', ST_AsGeoJSON(s.geom)::json,
        'properties', json_build_object(
          'id', s.id,
          'source', s.source,
          'address', s.address,
          'match_addr', s.match_addr,
          'business_license', s.business_license,
          'business_name', s.business_name,
          'dba', s.dba,
          'status', s.status,
          'license_type', s.license_type,
          'rental_type', s.rental_type,
          'zoning', s.zoning,
          'issue_date', s.issue_date,
          'expiration_date', s.expiration_date,
          'owner_name', a.owner_name,
          'owner_city', TRIM(a.owner_city),
          'owner_state', TRIM(a.owner_state),
          'is_head_of_family', a.is_head_of_family,
          'second_home_score', a.second_home_score,
          'is_likely_second_home', a.is_likely_second_home,
          'parcel_matched', (a.objectid IS NOT NULL)
        )
      ) AS feat
      FROM short_term_rentals s
      LEFT JOIN LATERAL (
        SELECT a2.objectid, a2.owner_name, a2.owner_city, a2.owner_state,
               a2.is_head_of_family, a2.second_home_score, a2.is_likely_second_home
        FROM accounts a2
        WHERE a2.geom IS NOT NULL
          AND ST_DWithin(s.geom, a2.geom, 0.0003)
        ORDER BY ST_Distance(s.geom, a2.geom)
        LIMIT 1
      ) a ON true
      WHERE ${where}
      ORDER BY s.address ASC
      LIMIT 5000
    ) sub
  `;

  try {
    const rows = (await sql.query(query, params)) as Record<string, unknown>[];
    const geojson = rows[0]?.geojson;
    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
