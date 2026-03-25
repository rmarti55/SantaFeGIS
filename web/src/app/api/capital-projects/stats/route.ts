import { NextResponse } from "next/server";
import { queryCapitalProjects } from "@/lib/arcgis";

export const runtime = "edge";

export async function GET() {
  try {
    const [byType, byPhase, byFunding, totals] = await Promise.all([
      queryCapitalProjects({
        where: "1=1",
        outFields: "Division",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "OBJECTID",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "Division",
      }),
      queryCapitalProjects({
        where: "1=1",
        outFields: "Phase",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "OBJECTID",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "Phase",
      }),
      queryCapitalProjects({
        where: "1=1",
        outFields: "Funded",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "OBJECTID",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "Funded",
      }),
      queryCapitalProjects({
        where: "1=1",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "OBJECTID",
            outStatisticFieldName: "total_count",
            statisticType: "count",
          },
          {
            onStatisticField: "TotalCost",
            outStatisticFieldName: "total_cost",
            statisticType: "sum",
          },
          {
            onStatisticField: "TotalCost",
            outStatisticFieldName: "avg_cost",
            statisticType: "avg",
          },
        ],
      }),
    ]);

    const byTypeData = (byType.features ?? [])
      .map(
        (f: { attributes: { Division: string; count: number } }) => ({
          type: f.attributes.Division,
          count: f.attributes.count,
        })
      )
      .sort(
        (a: { count: number }, b: { count: number }) => b.count - a.count
      );

    const byPhaseData = (byPhase.features ?? [])
      .map(
        (f: { attributes: { Phase: string; count: number } }) => ({
          phase: f.attributes.Phase,
          count: f.attributes.count,
        })
      )
      .sort(
        (a: { count: number }, b: { count: number }) => b.count - a.count
      );

    const byFundingData = (byFunding.features ?? [])
      .map(
        (f: { attributes: { Funded: string; count: number } }) => ({
          source: f.attributes.Funded,
          count: f.attributes.count,
        })
      )
      .sort(
        (a: { count: number }, b: { count: number }) => b.count - a.count
      );

    const summary = totals.features?.[0]?.attributes ?? {};

    return NextResponse.json(
      {
        total: summary.total_count ?? 0,
        totalCost: summary.total_cost ?? 0,
        avgCost: Math.round(summary.avg_cost ?? 0),
        byType: byTypeData,
        byPhase: byPhaseData,
        byFunding: byFundingData,
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
