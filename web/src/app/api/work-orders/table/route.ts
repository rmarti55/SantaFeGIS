import { NextRequest, NextResponse } from "next/server";
import {
  PROBLEM_TYPES,
  STATUS_LABELS,
  reclassifyProblemType,
  expandSubProblem,
} from "@/lib/arcgis";
import { getDb } from "@/lib/db";

const ALLOWED_SORTS: Record<string, string> = {
  CreationDate: '"CreationDate"',
  problemtype: "problemtype_from_extra",
  Problem: '"What_is_the_problem_you_are_reporting_"',
  status: "status_from_extra",
  time_to_resolve: '"Days_to_Resolve"',
  resolved_on: '"Resolved_on"',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(10, parseInt(searchParams.get("pageSize") ?? "50", 10))
  );
  const sortByParam = searchParams.get("sortBy") ?? "CreationDate";
  const sortDir = searchParams.get("sortDir") === "asc" ? "ASC" : "DESC";
  const search = searchParams.get("search") ?? "";
  const problemtype = searchParams.get("problemtype") ?? "";
  const problem = searchParams.get("problem") ?? "";
  const status = searchParams.get("status") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const orderField = ALLOWED_SORTS[sortByParam] ?? '"CreationDate"';

  const whereClauses: string[] = [];
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

  if (search && search.length >= 2) {
    whereClauses.push(`"What_is_the_problem_you_are_reporting_" ILIKE $${paramIndex}`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Exclude rows with null objectid to prevent duplicate React keys
  whereClauses.push("objectid IS NOT NULL");

  const whereClause = whereClauses.length > 0 ? whereClauses.join(" AND ") : "1=1";
  const offset = (page - 1) * pageSize;

  try {
    const db = getDb();
    const query = `
      SELECT
        objectid, problemtype_from_extra, status_from_extra,
        "What_is_the_problem_you_are_reporting_" AS problem,
        "CreationDate", "Resolved_on" AS resolved_on,
        "Days_to_Resolve" AS time_to_resolve,
        COUNT(*) OVER() AS total_count
      FROM crm_full
      WHERE ${whereClause}
      ORDER BY ${orderField} ${sortDir}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const rows = await db.query(query, params) as Array<{
      objectid: number;
      problemtype_from_extra: string | null;
      status_from_extra: string | null;
      problem: string | null;
      CreationDate: number;
      resolved_on: number | null;
      time_to_resolve: number | null;
      total_count: number;
    }>;

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    const mappedRows = rows.map((row) => {
      const rawProblemtype = row.problemtype_from_extra || "other";
      const effectiveType = reclassifyProblemType(rawProblemtype, row.problem || "");

      return {
        objectid: row.objectid,
        problemtype: effectiveType,
        problemtype_original: rawProblemtype,
        problemtype_label: PROBLEM_TYPES[effectiveType as keyof typeof PROBLEM_TYPES] ?? effectiveType,
        problem: row.problem ?? null,
        status: row.status_from_extra,
        status_label: STATUS_LABELS[row.status_from_extra as keyof typeof STATUS_LABELS] ?? row.status_from_extra,
        created: Number(row.CreationDate),
        resolved: row.resolved_on != null ? Number(row.resolved_on) : null,
        days_to_resolve: row.time_to_resolve != null ? Number(row.time_to_resolve) : null,
      };
    });

    return NextResponse.json(
      {
        rows: mappedRows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
