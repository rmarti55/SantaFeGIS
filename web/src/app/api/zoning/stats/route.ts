import { NextResponse } from "next/server";
import { queryZoning } from "@/lib/arcgis";

export const runtime = "edge";

export async function GET() {
  try {
    const [byZdesc, totals] = await Promise.all([
      queryZoning({
        where: "1=1",
        outFields: "ZDESC",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "OBJECTID",
            outStatisticFieldName: "count",
            statisticType: "count",
          },
        ],
        groupByFieldsForStatistics: "ZDESC",
      }),
      queryZoning({
        where: "1=1",
        returnGeometry: false,
        outStatistics: [
          {
            onStatisticField: "OBJECTID",
            outStatisticFieldName: "total_count",
            statisticType: "count",
          },
        ],
      }),
    ]);

    const byZdescData = (byZdesc.features ?? [])
      .map(
        (f: { attributes: { ZDESC: string; count: number } }) => ({
          zdesc: f.attributes.ZDESC,
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
        byZdesc: byZdescData,
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
