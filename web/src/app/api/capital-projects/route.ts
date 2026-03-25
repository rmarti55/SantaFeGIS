import { NextRequest, NextResponse } from "next/server";
import {
  queryCapitalProjects,
  esriCapitalProjectsToGeoJSON,
} from "@/lib/arcgis";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const division = searchParams.get("projtype") ?? "";
  const phase = searchParams.get("projphase") ?? "";

  const conditions: string[] = [];

  if (division) {
    conditions.push(`Division = '${division.replace(/'/g, "''")}'`);
  }
  if (phase) {
    conditions.push(`Phase = '${phase.replace(/'/g, "''")}'`);
  }

  const where = conditions.length > 0 ? conditions.join(" AND ") : "1=1";

  try {
    const data = await queryCapitalProjects({
      where,
      outFields: "*",
      returnGeometry: true,
      outSR: 4326,
      f: "json",
    });

    if (data.error) {
      return NextResponse.json(
        { error: data.error.message },
        { status: 500 }
      );
    }

    const geojson = esriCapitalProjectsToGeoJSON(data.features ?? []);

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
