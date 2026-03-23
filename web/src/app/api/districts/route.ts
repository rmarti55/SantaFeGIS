import { NextResponse } from "next/server";
import { queryDistricts } from "@/lib/arcgis";

export const runtime = "edge";

export async function GET() {
  try {
    const data = await queryDistricts({
      where: "1=1",
      outFields: "FID,CouncilDis,Councilor",
      returnGeometry: true,
      outSR: 4326,
      f: "geojson",
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
