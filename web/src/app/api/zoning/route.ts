import { NextRequest, NextResponse } from "next/server";
import { esriZoningToGeoJSON } from "@/lib/arcgis";

export const runtime = "edge";

const ZONING_URL =
  "https://gis.santafenm.gov/server/rest/services/Zoning_MIL1/MapServer/6/query";

const PAGE_SIZE = 2000;

async function fetchAllPages(
  where: string,
  geometryFilter: string
): Promise<unknown[]> {
  const allFeatures: unknown[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(ZONING_URL);
    url.searchParams.set("f", "json");
    url.searchParams.set("where", where);
    url.searchParams.set(
      "outFields",
      "OBJECTID,OBJECTID_1,ZDESC,ZORDNO,ZCASNO,DESC_,ZAHyperlin,COMMENTS"
    );
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("resultOffset", String(offset));
    url.searchParams.set("resultRecordCount", String(PAGE_SIZE));
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");

    if (geometryFilter) {
      url.searchParams.set("geometry", geometryFilter);
      url.searchParams.set("geometryType", "esriGeometryEnvelope");
      url.searchParams.set("inSR", "4326");
    }

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`ArcGIS error: ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    const features = data.features ?? [];
    allFeatures.push(...features);

    hasMore = features.length === PAGE_SIZE;
    offset += PAGE_SIZE;
    if (offset > 20000) break;
  }

  return allFeatures;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const category = searchParams.get("category") ?? "";
  const zdesc = searchParams.get("zdesc") ?? "";
  const bbox = searchParams.get("bbox") ?? "";

  const conditions: string[] = [];

  if (zdesc) {
    conditions.push(`ZDESC = '${zdesc.replace(/'/g, "''")}'`);
  }

  if (category) {
    // category filter handled client-side (all codes fetched, filtered on map)
    // but we can support direct ZDESC-based server filtering when needed
  }

  const where = conditions.length > 0 ? conditions.join(" AND ") : "1=1";

  let geometryFilter = "";
  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      const [west, south, east, north] = parts;
      geometryFilter = JSON.stringify({
        xmin: west,
        ymin: south,
        xmax: east,
        ymax: north,
        spatialReference: { wkid: 4326 },
      });
    }
  }

  try {
    const features = await fetchAllPages(where, geometryFilter);
    const geojson = esriZoningToGeoJSON(features as never[]);

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
