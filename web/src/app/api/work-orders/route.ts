import { NextRequest, NextResponse } from "next/server";
import {
  reclassifyProblemType,
  expandSubProblem,
  STATUS_LABELS,
  PROBLEM_TYPES,
} from "@/lib/arcgis";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const problemtype = searchParams.get("problemtype") ?? "";
  const problem = searchParams.get("problem") ?? "";
  const status = searchParams.get("status") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const bbox = searchParams.get("bbox") ?? "";
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "2000", 10), 2000);

  const whereClauses: string[] = ["x IS NOT NULL AND y IS NOT NULL"];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (problemtype) {
    whereClauses.push(`LOWER(problemtype_from_extra) = $${paramIndex}`);
    params.push(problemtype.toLowerCase());
    paramIndex++;
  }

  if (problem) {
    const expanded = expandSubProblem(problem);
    const placeholders = expanded
      .map(() => `$${paramIndex++}`)
      .join(",");
    whereClauses.push(`"What_is_the_problem_you_are_reporting_" IN (${placeholders})`);
    params.push(...expanded);
  }

  if (status) {
    whereClauses.push(`LOWER(status_from_extra) = $${paramIndex}`);
    params.push(status.toLowerCase());
    paramIndex++;
  }

  if (dateFrom) {
    whereClauses.push(`"CreationDate" >= $${paramIndex}`);
    params.push(new Date(dateFrom).getTime());
    paramIndex++;
  }

  if (dateTo) {
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    whereClauses.push(`"CreationDate" <= $${paramIndex}`);
    params.push(endOfDay.getTime());
    paramIndex++;
  }

  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      const [west, south, east, north] = parts;
      whereClauses.push(`x BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      whereClauses.push(`y BETWEEN $${paramIndex + 2} AND $${paramIndex + 3}`);
      params.push(west, east, south, north);
      paramIndex += 4;
    }
  }

  const whereClause = whereClauses.join(" AND ");

  try {
    const db = getDb();
    const query = `
      SELECT
        id, objectid, globalid, problemtype_from_extra, status_from_extra,
        "What_is_the_problem_you_are_reporting_" AS "Problem",
        "CreationDate", "Resolved_on", "Days_to_Resolve", x, y
      FROM crm_full
      WHERE ${whereClause}
      ORDER BY "CreationDate" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = await db.query(query, params) as Array<{
      id: number;
      objectid: number;
      globalid: string;
      problemtype_from_extra: string | null;
      status_from_extra: string | null;
      Problem: string | null;
      CreationDate: number;
      Resolved_on: number | null;
      Days_to_Resolve: number | null;
      x: number;
      y: number;
    }>;

    // Convert to GeoJSON FeatureCollection
    const features = rows.map((row) => {
      const rawProblemtype = row.problemtype_from_extra || "other";
      const reclassified = reclassifyProblemType(rawProblemtype, row.Problem || "");

      return {
        type: "Feature",
        id: row.id,
        geometry: {
          type: "Point",
          coordinates: [Number(row.x), Number(row.y)],
        },
        properties: {
          id: row.id,
          objectid: row.objectid,
          globalid: row.globalid,
          problemtype: reclassified,
          problemtype_original: rawProblemtype,
          problemtype_label: PROBLEM_TYPES[reclassified as keyof typeof PROBLEM_TYPES] || rawProblemtype,
          Problem: row.Problem,
          status: row.status_from_extra,
          status_label: STATUS_LABELS[row.status_from_extra as keyof typeof STATUS_LABELS] || row.status_from_extra,
          resolved_on: row.Resolved_on != null ? Number(row.Resolved_on) : null,
          CreationDate: Number(row.CreationDate),
          time_to_resolve: row.Days_to_Resolve != null ? Number(row.Days_to_Resolve) : null,
        },
      };
    });

    const geojson = {
      type: "FeatureCollection",
      features,
    };

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
