import { NextResponse } from "next/server";

export const runtime = "edge";

const HISTORIC_DISTRICTS_URL =
  "https://gis.santafenm.gov/server/rest/services/OverlayDistricts/MapServer/18/query";

export async function GET() {
  const url = new URL(HISTORIC_DISTRICTS_URL);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", "HDSTNAM,HDIST_CD");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "geojson");

  try {
    const resp = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `ArcGIS query failed: ${resp.status}` },
        { status: 502 }
      );
    }

    const geojson = await resp.json();

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
