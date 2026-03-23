import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "edge";

export async function GET() {
  const sql = getDb();

  try {
    const [overview] = await sql`
      WITH matched AS (
        SELECT
          s.id,
          s.rental_type,
          s.status,
          a.owner_name,
          a.owner_city,
          a.owner_state,
          a.is_head_of_family,
          a.second_home_score,
          a.is_likely_second_home,
          (a.objectid IS NOT NULL) AS parcel_matched
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
        WHERE s.geom IS NOT NULL
      )
      SELECT
        COUNT(*) AS total_str,
        COUNT(*) FILTER (WHERE parcel_matched) AS matched,
        COUNT(*) FILTER (WHERE NOT parcel_matched) AS unmatched,
        COUNT(*) FILTER (WHERE is_likely_second_home = true) AS likely_second_home,
        COUNT(*) FILTER (WHERE parcel_matched AND is_likely_second_home = false) AS likely_primary,
        COUNT(*) FILTER (WHERE parcel_matched AND second_home_score BETWEEN 2 AND 3) AS possible_second_home,
        COUNT(*) FILTER (WHERE parcel_matched AND is_head_of_family = 1) AS head_of_family,
        COUNT(*) FILTER (WHERE parcel_matched AND TRIM(owner_state) != 'NM' AND TRIM(owner_state) != '' AND owner_state IS NOT NULL) AS out_of_state_owner,
        COUNT(*) FILTER (WHERE parcel_matched AND TRIM(owner_state) = 'NM') AS in_state_owner,
        ROUND(100.0 * COUNT(*) FILTER (WHERE is_likely_second_home = true) / NULLIF(COUNT(*) FILTER (WHERE parcel_matched), 0), 1) AS pct_second_home,
        ROUND(100.0 * COUNT(*) FILTER (WHERE parcel_matched AND is_likely_second_home = false) / NULLIF(COUNT(*) FILTER (WHERE parcel_matched), 0), 1) AS pct_primary
      FROM matched
    `;

    const topStates = await sql`
      WITH matched AS (
        SELECT TRIM(a.owner_state) AS owner_state
        FROM short_term_rentals s
        LEFT JOIN LATERAL (
          SELECT a2.owner_state
          FROM accounts a2
          WHERE a2.geom IS NOT NULL
            AND ST_DWithin(s.geom, a2.geom, 0.0003)
          ORDER BY ST_Distance(s.geom, a2.geom)
          LIMIT 1
        ) a ON true
        WHERE s.geom IS NOT NULL AND a.owner_state IS NOT NULL
      )
      SELECT owner_state AS state, COUNT(*) AS count
      FROM matched
      WHERE owner_state != 'NM' AND owner_state != ''
      GROUP BY owner_state
      ORDER BY count DESC
      LIMIT 10
    `;

    const scoreBreakdown = await sql`
      WITH matched AS (
        SELECT a.second_home_score
        FROM short_term_rentals s
        LEFT JOIN LATERAL (
          SELECT a2.second_home_score
          FROM accounts a2
          WHERE a2.geom IS NOT NULL
            AND ST_DWithin(s.geom, a2.geom, 0.0003)
          ORDER BY ST_Distance(s.geom, a2.geom)
          LIMIT 1
        ) a ON true
        WHERE s.geom IS NOT NULL AND a.second_home_score IS NOT NULL
      )
      SELECT
        COUNT(*) FILTER (WHERE second_home_score >= 6) AS very_likely,
        COUNT(*) FILTER (WHERE second_home_score BETWEEN 4 AND 5) AS likely,
        COUNT(*) FILTER (WHERE second_home_score BETWEEN 2 AND 3) AS possible,
        COUNT(*) FILTER (WHERE second_home_score <= 1) AS unlikely
      FROM matched
    `;

    const byRentalType = await sql`
      WITH matched AS (
        SELECT
          s.rental_type,
          a.is_likely_second_home,
          (a.objectid IS NOT NULL) AS parcel_matched
        FROM short_term_rentals s
        LEFT JOIN LATERAL (
          SELECT a2.objectid, a2.is_likely_second_home
          FROM accounts a2
          WHERE a2.geom IS NOT NULL
            AND ST_DWithin(s.geom, a2.geom, 0.0003)
          ORDER BY ST_Distance(s.geom, a2.geom)
          LIMIT 1
        ) a ON true
        WHERE s.geom IS NOT NULL
      )
      SELECT
        COALESCE(rental_type, 'Unknown') AS rental_type,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_likely_second_home = true) AS second_home,
        COUNT(*) FILTER (WHERE parcel_matched AND is_likely_second_home = false) AS primary_home,
        COUNT(*) FILTER (WHERE NOT parcel_matched) AS unmatched
      FROM matched
      GROUP BY rental_type
      ORDER BY total DESC
    `;

    return NextResponse.json(
      {
        overview,
        topOwnerStates: topStates,
        scoreBreakdown: scoreBreakdown[0],
        byRentalType,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
