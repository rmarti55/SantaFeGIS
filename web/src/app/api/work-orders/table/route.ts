import { NextRequest, NextResponse } from "next/server";
import {
  queryCRM,
  PROBLEM_TYPES,
  STATUS_LABELS,
  reclassifyProblemType,
  expandSubProblem,
} from "@/lib/arcgis";

export const runtime = "edge";

const ALLOWED_SORTS: Record<string, string> = {
  CreationDate: "CreationDate",
  problemtype: "problemtype",
  Problem: "Problem",
  status: "status",
  time_to_resolve: "time_to_resolve",
  resolved_on: "resolved_on",
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

  const orderField = ALLOWED_SORTS[sortByParam] ?? "CreationDate";

  const conditions: string[] = [];

  if (problemtype) {
    conditions.push(`problemtype = '${problemtype.replace(/'/g, "''")}'`);
  }
  if (problem) {
    const expanded = expandSubProblem(problem);
    if (expanded.length === 1) {
      conditions.push(`Problem = '${expanded[0].replace(/'/g, "''")}'`);
    } else {
      const inList = expanded.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
      conditions.push(`Problem IN (${inList})`);
    }
  }
  if (status) {
    conditions.push(`status = '${status.replace(/'/g, "''")}'`);
  }
  if (dateFrom) {
    conditions.push(
      `CreationDate >= timestamp '${dateFrom.replace(/'/g, "")} 00:00:00'`
    );
  }
  if (dateTo) {
    conditions.push(
      `CreationDate <= timestamp '${dateTo.replace(/'/g, "")} 23:59:59'`
    );
  }
  if (search && search.length >= 2) {
    const escaped = search.replace(/'/g, "''").replace(/%/g, "\\%");
    conditions.push(`Problem LIKE '%${escaped}%'`);
  }

  const where = conditions.length > 0 ? conditions.join(" AND ") : "1=1";
  const offset = (page - 1) * pageSize;

  try {
    const [dataResult, countResult] = await Promise.all([
      queryCRM({
        where,
        outFields: "*",
        returnGeometry: false,
        orderByFields: `${orderField} ${sortDir}`,
        resultOffset: offset,
        resultRecordCount: pageSize,
      }),
      queryCRM({
        where,
        returnGeometry: false,
        returnCountOnly: true,
      }),
    ]);

    interface CRMRow {
      objectid: number;
      problemtype: string;
      Problem: string | null;
      status: string;
      CreationDate: number;
      resolved_on: number | null;
      time_to_resolve: number | null;
    }

    const rows = (dataResult.features ?? []).map(
      (f: { attributes: CRMRow }) => {
        const a = f.attributes;
        const effectiveType = reclassifyProblemType(a.problemtype, a.Problem);
        return {
          objectid: a.objectid,
          problemtype: effectiveType,
          problemtype_original: a.problemtype,
          problemtype_label: PROBLEM_TYPES[effectiveType] ?? effectiveType,
          problem: a.Problem ?? null,
          status: a.status,
          status_label: STATUS_LABELS[a.status] ?? a.status,
          created: a.CreationDate,
          resolved: a.resolved_on,
          days_to_resolve: a.time_to_resolve,
        };
      }
    );

    const total = countResult.count ?? 0;

    return NextResponse.json(
      {
        rows,
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
