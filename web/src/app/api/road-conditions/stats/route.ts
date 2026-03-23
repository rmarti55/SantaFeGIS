import { NextResponse } from "next/server";
import { queryPavementMaintenance, queryRoadsPriority } from "@/lib/arcgis";

export const runtime = "edge";

export async function GET() {
  try {
    const [byCondition, byRepaveYear, priorityBreakdown] = await Promise.all([
      queryPavementMaintenance({
        returnGeometry: false,
        outStatistics: [
          { statisticType: "count", onStatisticField: "OBJECTID_1", outStatisticFieldName: "cnt" },
          { statisticType: "sum", onStatisticField: "MILES", outStatisticFieldName: "total_miles" },
        ],
        groupByFieldsForStatistics: "RCLCOND",
      }),
      queryPavementMaintenance({
        returnGeometry: false,
        outStatistics: [
          { statisticType: "count", onStatisticField: "OBJECTID_1", outStatisticFieldName: "cnt" },
          { statisticType: "sum", onStatisticField: "MILES", outStatisticFieldName: "total_miles" },
        ],
        groupByFieldsForStatistics: "YearRepave",
      }),
      queryRoadsPriority({
        returnGeometry: false,
        outStatistics: [
          { statisticType: "count", onStatisticField: "OBJECTID_1", outStatisticFieldName: "cnt" },
          { statisticType: "sum", onStatisticField: "MILES", outStatisticFieldName: "total_miles" },
        ],
        groupByFieldsForStatistics: "Priority",
      }),
    ]);

    const mapFeatures = (
      features: { attributes: Record<string, unknown> }[],
      keyField: string
    ) =>
      features
        .map((f) => ({
          key: String(f.attributes[keyField] ?? "").trim() || "(blank)",
          count: (f.attributes.cnt as number) ?? 0,
          miles: Math.round(((f.attributes.total_miles as number) ?? 0) * 100) / 100,
        }))
        .sort((a, b) => b.count - a.count);

    const conditionData = mapFeatures(byCondition.features ?? [], "RCLCOND");

    const repaveRaw = (byRepaveYear.features ?? []) as { attributes: Record<string, unknown> }[];
    const decades: Record<string, { count: number; miles: number }> = {};
    for (const f of repaveRaw) {
      const year = (f.attributes.YearRepave as number) ?? 0;
      const cnt = (f.attributes.cnt as number) ?? 0;
      const miles = (f.attributes.total_miles as number) ?? 0;
      let bucket: string;
      if (year <= 0) {
        bucket = "Unknown";
      } else if (year < 2000) {
        bucket = "1990s";
      } else if (year < 2010) {
        bucket = "2000s";
      } else {
        bucket = "2010s";
      }
      if (!decades[bucket]) decades[bucket] = { count: 0, miles: 0 };
      decades[bucket].count += cnt;
      decades[bucket].miles += miles;
    }
    const byDecade = Object.entries(decades)
      .map(([key, v]) => ({ key, count: v.count, miles: Math.round(v.miles * 100) / 100 }))
      .sort((a, b) => b.count - a.count);

    const priorityData = mapFeatures(priorityBreakdown.features ?? [], "Priority");

    const totalSegments = conditionData.reduce((s, d) => s + d.count, 0);
    const totalMiles =
      Math.round(conditionData.reduce((s, d) => s + d.miles, 0) * 100) / 100;

    const currentYear = new Date().getFullYear();
    const oldRoads = repaveRaw
      .filter((f) => {
        const y = (f.attributes.YearRepave as number) ?? 0;
        return y > 0 && currentYear - y >= 15;
      })
      .reduce(
        (acc, f) => ({
          count: acc.count + ((f.attributes.cnt as number) ?? 0),
          miles: acc.miles + ((f.attributes.total_miles as number) ?? 0),
        }),
        { count: 0, miles: 0 }
      );

    return NextResponse.json(
      {
        totalSegments,
        totalMiles,
        byCondition: conditionData,
        byDecade,
        byPriority: priorityData,
        oldRoads: {
          count: oldRoads.count,
          miles: Math.round(oldRoads.miles * 100) / 100,
        },
      },
      {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
