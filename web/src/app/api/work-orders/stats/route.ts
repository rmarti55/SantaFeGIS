import { NextRequest, NextResponse } from "next/server";
import { consolidateSubProblem } from "@/lib/arcgis";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const problemtype = searchParams.get("problemtype") ?? "";

  try {
    const db = getDb();
    const params: (string | number)[] = [];
    let paramIndex = 1;

    const baseWhereClause = problemtype
      ? `LOWER(problemtype_from_extra) = $${paramIndex++}`
      : "1=1";

    if (problemtype) {
      params.push(problemtype.toLowerCase());
    }

    // Query 1: Count by problemtype (always all types, not filtered by baseWhere)
    const byTypeQuery = `
      SELECT problemtype_from_extra, COUNT(*) AS count
      FROM crm_full
      WHERE problemtype_from_extra IS NOT NULL
      GROUP BY problemtype_from_extra
      ORDER BY count DESC
    `;

    // Query 2: Count by status — null/blank status (snapshot records) grouped as 'historical'
    const byStatusQuery = `
      SELECT
        COALESCE(NULLIF(TRIM(status_from_extra), ''), 'historical') AS status_from_extra,
        COUNT(*) AS count
      FROM crm_full
      WHERE ${baseWhereClause}
      GROUP BY COALESCE(NULLIF(TRIM(status_from_extra), ''), 'historical')
      ORDER BY count DESC
    `;

    // Query 3: Total count and avg days to resolve
    // Days_to_Resolve can be negative (data entry errors) — exclude <= 0
    const totalsQuery = `
      SELECT
        COUNT(*) AS total_count,
        AVG(CASE WHEN "Days_to_Resolve" > 0 THEN "Days_to_Resolve" END) AS avg_resolve_days
      FROM crm_full
      WHERE ${baseWhereClause}
    `;

    // Query 4: All problems (will slice into top20 and pieTop10 in app code)
    const allProblemsQuery = `
      SELECT "What_is_the_problem_you_are_reporting_" AS problem, COUNT(*) AS count
      FROM crm_full
      WHERE ${baseWhereClause} AND "What_is_the_problem_you_are_reporting_" IS NOT NULL
      GROUP BY "What_is_the_problem_you_are_reporting_"
      ORDER BY count DESC
    `;

    // Query 5: Open problems
    const openProblemsQuery = problemtype
      ? null
      : `
      SELECT "What_is_the_problem_you_are_reporting_" AS problem, COUNT(*) AS count
      FROM crm_full
      WHERE status_from_extra NOT IN ('closed', 'cs_only_resolved') AND status_from_extra IS NOT NULL
        AND "What_is_the_problem_you_are_reporting_" IS NOT NULL
      GROUP BY "What_is_the_problem_you_are_reporting_"
      ORDER BY count DESC
      LIMIT 10
    `;

    const queries: Promise<any>[] = [
      db.query(byTypeQuery),
      db.query(byStatusQuery, problemtype ? [problemtype.toLowerCase()] : []),
      db.query(totalsQuery, problemtype ? [problemtype.toLowerCase()] : []),
      db.query(allProblemsQuery, problemtype ? [problemtype.toLowerCase()] : []),
    ];

    if (openProblemsQuery) {
      queries.push(db.query(openProblemsQuery));
    } else {
      queries.push(Promise.resolve([]));
    }

    const [byTypeRows, byStatusRows, totalsRows, allProblemsRows, openProblemsRows] =
      await Promise.all(queries);

    // Process byType
    const byTypeData = byTypeRows
      .map((row: any) => ({
        type: row.problemtype_from_extra,
        count: Number(row.count),
      }))
      .filter((r: { type: string | null }) => r.type != null);

    // Process byStatus
    const byStatusData = byStatusRows
      .map((row: any) => ({
        status: row.status_from_extra,
        count: Number(row.count),
      }))
      .filter((r: { status: string | null }) => r.status != null && r.status !== "");

    // Process totals (convert string numbers to actual numbers)
    const rawSummary = totalsRows[0] ?? { total_count: 0, avg_resolve_days: null };
    const summary = {
      total_count: Number(rawSummary.total_count),
      avg_resolve_days: rawSummary.avg_resolve_days != null ? Number(rawSummary.avg_resolve_days) : null,
    };

    // Process all problems: consolidate, merge, sort, and slice
    const byProblemRaw = allProblemsRows
      .map((row: any) => ({
        problem: row.problem ? consolidateSubProblem(row.problem) : null,
        count: Number(row.count),
      }))
      .filter((r: { problem: string | null }) => r.problem != null && r.problem !== "");

    const byProblemMerged = new Map<string, number>();
    for (const { problem, count } of byProblemRaw) {
      byProblemMerged.set(problem, (byProblemMerged.get(problem) ?? 0) + count);
    }

    const byProblemData = [...byProblemMerged.entries()]
      .map(([problem, count]) => ({ problem, count }))
      .sort((a, b) => b.count - a.count);

    // Slice for top20 and top10
    const subproblemTop20 = problemtype ? [] : byProblemData.slice(0, 20);
    const subproblemPieTop10 = problemtype ? [] : byProblemData.slice(0, 10);
    const pieTop10Sum = subproblemPieTop10.reduce((s, r) => s + r.count, 0);
    const subproblemPieRestCount = problemtype ? 0 : Math.max(0, (summary.total_count ?? 0) - pieTop10Sum);

    // Process open problems
    const openProblems = problemtype
      ? []
      : openProblemsRows.map((row: any) => ({
          problem: row.problem,
          count: Number(row.count),
        }));

    return NextResponse.json(
      {
        total: summary.total_count ?? 0,
        avgResolveDays: Math.round(summary.avg_resolve_days ?? 0),
        byType: byTypeData,
        byStatus: byStatusData,
        byProblem: byProblemData,
        subproblemTop20,
        subproblemPieTop10,
        subproblemPieRestCount,
        openProblems,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
