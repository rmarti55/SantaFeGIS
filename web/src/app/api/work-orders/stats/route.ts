import { NextRequest, NextResponse } from "next/server";
import { queryCRM, consolidateSubProblem } from "@/lib/arcgis";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const problemtype = searchParams.get("problemtype") ?? "";

  const baseWhere = problemtype
    ? `problemtype = '${problemtype.replace(/'/g, "''")}'`
    : "1=1";

  try {
    const queries: Promise<Record<string, unknown>>[] = [
      queryCRM({
        where: "1=1",
        outFields: "problemtype",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "objectid",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "problemtype",
      }),
      queryCRM({
        where: baseWhere,
        outFields: "status",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "objectid",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "status",
      }),
      queryCRM({
        where: baseWhere,
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "objectid",
            outStatisticFieldName: "total_count",
            statisticType: "count",
          },
          {
            onStatisticField: "time_to_resolve",
            outStatisticFieldName: "avg_resolve_days",
            statisticType: "avg",
          },
        ],
      }),
      queryCRM({
        where: baseWhere,
        outFields: "Problem",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "objectid",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "Problem",
      }),
    ];

    const [byType, byStatus, totals, byProblem] = await Promise.all(queries);

    type Feature<T> = { attributes: T };

    const byTypeData = (
      (byType as { features?: Feature<{ problemtype: string; count: number }>[] }).features ?? []
    )
      .map((f) => ({
        type: f.attributes.problemtype,
        count: f.attributes.count,
      }))
      .sort((a, b) => b.count - a.count);

    const byStatusData = (
      (byStatus as { features?: Feature<{ status: string | null; count: number }>[] }).features ?? []
    )
      .filter((f) => {
        const s = f.attributes.status;
        return s != null && s !== "" && s !== "null" && s.trim() !== "";
      })
      .map((f) => ({
        status: f.attributes.status!,
        count: f.attributes.count,
      }))
      .sort((a, b) => b.count - a.count);

    const byProblemRaw = (
      (byProblem as { features?: Feature<{ Problem: string | null; count: number }>[] }).features ?? []
    )
      .filter((f) => f.attributes.Problem && f.attributes.Problem !== "null")
      .map((f) => ({
        problem: consolidateSubProblem(f.attributes.Problem!),
        count: f.attributes.count,
      }));

    const byProblemMerged = new Map<string, number>();
    for (const { problem, count } of byProblemRaw) {
      byProblemMerged.set(problem, (byProblemMerged.get(problem) ?? 0) + count);
    }
    const byProblemData = [...byProblemMerged.entries()]
      .map(([problem, count]) => ({ problem, count }))
      .sort((a, b) => b.count - a.count);

    const summary =
      ((totals as { features?: Feature<{ total_count: number; avg_resolve_days: number }>[] }).features ?? [])[0]
        ?.attributes ?? { total_count: 0, avg_resolve_days: 0 };

    return NextResponse.json(
      {
        total: summary.total_count ?? 0,
        avgResolveDays: Math.round(summary.avg_resolve_days ?? 0),
        byType: byTypeData,
        byStatus: byStatusData,
        byProblem: byProblemData,
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
