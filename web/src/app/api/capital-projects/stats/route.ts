import { NextResponse } from "next/server";
import { queryCapitalProjects } from "@/lib/arcgis";

export const runtime = "edge";

export async function GET() {
  try {
    const [byType, byPhase, byFunding, totals] = await Promise.all([
      queryCapitalProjects({
        where: "1=1",
        outFields: "projtype",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "OBJECTID",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "projtype",
      }),
      queryCapitalProjects({
        where: "1=1",
        outFields: "projphase",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "OBJECTID",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "projphase",
      }),
      queryCapitalProjects({
        where: "1=1",
        outFields: "fundsource",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "OBJECTID",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "fundsource",
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
            onStatisticField: "estcost",
            outStatisticFieldName: "total_cost",
            statisticType: "sum",
          },
          {
            onStatisticField: "estcost",
            outStatisticFieldName: "avg_cost",
            statisticType: "avg",
          },
        ],
      }),
    ]);

    const byTypeData = (byType.features ?? [])
      .map(
        (f: { attributes: { projtype: string; count: number } }) => ({
          type: f.attributes.projtype,
          count: f.attributes.count,
        })
      )
      .sort(
        (a: { count: number }, b: { count: number }) => b.count - a.count
      );

    const byPhaseData = (byPhase.features ?? [])
      .map(
        (f: { attributes: { projphase: string; count: number } }) => ({
          phase: f.attributes.projphase,
          count: f.attributes.count,
        })
      )
      .sort(
        (a: { count: number }, b: { count: number }) => b.count - a.count
      );

    const byFundingData = (byFunding.features ?? [])
      .map(
        (f: { attributes: { fundsource: string; count: number } }) => ({
          source: f.attributes.fundsource,
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
