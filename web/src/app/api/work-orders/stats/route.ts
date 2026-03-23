import { NextResponse } from "next/server";
import { queryCRM } from "@/lib/arcgis";

export const runtime = "edge";

export async function GET() {
  try {
    const [byType, byStatus, totals] = await Promise.all([
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
        where: "1=1",
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
        where: "1=1",
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
    ]);

    const byTypeData = (byType.features ?? []).map(
      (f: { attributes: { problemtype: string; count: number } }) => ({
        type: f.attributes.problemtype,
        count: f.attributes.count,
      })
    ).sort(
      (a: { count: number }, b: { count: number }) => b.count - a.count
    );

    const byStatusData = (byStatus.features ?? []).map(
      (f: { attributes: { status: string; count: number } }) => ({
        status: f.attributes.status,
        count: f.attributes.count,
      })
    );

    const summary = totals.features?.[0]?.attributes ?? {};

    return NextResponse.json(
      {
        total: summary.total_count ?? 0,
        avgResolveDays: Math.round(summary.avg_resolve_days ?? 0),
        byType: byTypeData,
        byStatus: byStatusData,
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
