import { NextRequest, NextResponse } from "next/server";
import {
  esriPavementToGeoJSON,
  esriRoadsPriorityToGeoJSON,
} from "@/lib/arcgis";

export const runtime = "edge";

const PAVEMENT_URL =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/ArcGIS/rest/services/PavementMaintenance_1/FeatureServer/0/query";

const PRIORITY_URL =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/ArcGIS/rest/services/RoadsMaintenanceCrewPriority_1/FeatureServer/0/query";

const PAGE_SIZE = 2000;

async function fetchAllPages(baseUrl: string, where: string, outFields: string, geometryFilter: string) {
  const allFeatures: unknown[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(baseUrl);
    url.searchParams.set("f", "json");
    url.searchParams.set("where", where);
    url.searchParams.set("outFields", outFields);
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

  const condition = searchParams.get("condition") ?? "";
  const decade = searchParams.get("decade") ?? "";
  const priorityOnly = searchParams.get("priorityOnly") === "1";
  const layer = searchParams.get("layer") ?? "pavement";
  const bbox = searchParams.get("bbox") ?? "";

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
    if (layer === "priority") {
      const conditions: string[] = [];
      if (priorityOnly) conditions.push("Priority >= 1");

      const where = conditions.length > 0 ? conditions.join(" AND ") : "1=1";
      const features = await fetchAllPages(
        PRIORITY_URL,
        where,
        "OBJECTID_1,ROADNAME,MILES,Priority,SFFRC",
        geometryFilter
      );
      const geojson = esriRoadsPriorityToGeoJSON(features as never[]);
      return NextResponse.json(geojson, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    const conditions: string[] = [];
    if (condition) {
      conditions.push(`RCLCOND = '${condition.replace(/'/g, "''")}'`);
    }
    if (decade) {
      const start = parseInt(decade, 10);
      if (!isNaN(start)) {
        conditions.push(`YearRepave >= ${start} AND YearRepave <= ${start + 9}`);
      }
    }

    const where = conditions.length > 0 ? conditions.join(" AND ") : "1=1";
    const features = await fetchAllPages(
      PAVEMENT_URL,
      where,
      "OBJECTID_1,STREET,RCLNAME,RCLCOND,RCLTYPE,RCLCLASS,SPEEDLIMIT,MILES,MILE,YearRepave",
      geometryFilter
    );
    const geojson = esriPavementToGeoJSON(features as never[]);

    return NextResponse.json(geojson, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
