import { NextRequest, NextResponse } from "next/server";
import { queryCRM, consolidateSubProblem } from "@/lib/arcgis";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const problemtype = searchParams.get("problemtype") ?? "";

  if (!problemtype) {
    return NextResponse.json([]);
  }

  try {
    const data = await queryCRM({
      where: `problemtype = '${problemtype.replace(/'/g, "''")}'`,
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
    });

    const raw = (data.features ?? [])
      .map((f: { attributes: { Problem: string | null; count: number } }) => {
        const orig = f.attributes.Problem ?? "";
        const consolidated = orig ? consolidateSubProblem(orig) : "";
        return { code: consolidated, name: consolidated || "(unspecified)", count: f.attributes.count };
      })
      .filter((p: { code: string }) => p.code && p.code !== "null");

    const merged = new Map<string, number>();
    for (const { code, count } of raw) {
      merged.set(code, (merged.get(code) ?? 0) + count);
    }
    const problems = [...merged.entries()]
      .map(([code, count]) => ({ code, name: code, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(problems, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
