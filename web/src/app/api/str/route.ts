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

  const conditions: string[] = ["geom IS NOT NULL"];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`status = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  }

  if (rentalType) {
    conditions.push(`rental_type = $${paramIdx}`);
    params.push(rentalType);
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
      'features', COALESCE(json_agg(sub.feat), '[]')
    ) AS geojson
    FROM (
      SELECT json_build_object(
        'type', 'Feature',
        'id', id,
        'geometry', ST_AsGeoJSON(geom)::json,
        'properties', json_build_object(
          'id', id,
          'source', source,
          'address', address,
          'match_addr', match_addr,
          'business_license', business_license,
          'business_name', business_name,
          'dba', dba,
          'status', status,
          'license_type', license_type,
          'rental_type', rental_type,
          'zoning', zoning,
          'issue_date', issue_date,
          'expiration_date', expiration_date
        )
      ) AS feat
      FROM short_term_rentals
      WHERE ${where}
      ORDER BY address ASC
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
