import { NextRequest, NextResponse } from "next/server";
import { queryCRM, esriToGeoJSON, expandSubProblem } from "@/lib/arcgis";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const problemtype = searchParams.get("problemtype") ?? "";
  const problem = searchParams.get("problem") ?? "";
  const status = searchParams.get("status") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const bbox = searchParams.get("bbox") ?? "";
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(searchParams.get("limit") ?? "2000", 10);

  const conditions: string[] = [];

  if (problemtype) {
    conditions.push(`problemtype = '${problemtype.replace(/'/g, "''")}'`);
  }
  if (problem) {
    const expanded = expandSubProblem(problem);
    if (expanded.length === 1) {
      conditions.push(`Problem = '${expanded[0].replace(/'/g, "''")}'`);
    } else {
      const inList = expanded.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
      conditions.push(`Problem IN (${inList})`);
    }
  }
  if (status) {
    conditions.push(`status = '${status.replace(/'/g, "''")}'`);
  }
  if (dateFrom) {
    conditions.push(
      `CreationDate >= timestamp '${dateFrom.replace(/'/g, "")} 00:00:00'`
    );
  }
  if (dateTo) {
    conditions.push(
      `CreationDate <= timestamp '${dateTo.replace(/'/g, "")} 23:59:59'`
    );
  }

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

  const where = conditions.length > 0 ? conditions.join(" AND ") : "1=1";

  try {
    const url = new URL(
      "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/Public_CRM/FeatureServer/0/query"
    );
    url.searchParams.set("f", "json");
    url.searchParams.set("where", where);
    url.searchParams.set("outFields", "*");
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");
    url.searchParams.set("resultOffset", String(offset));
    url.searchParams.set("resultRecordCount", String(Math.min(limit, 2000)));
    url.searchParams.set("orderByFields", "CreationDate desc");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");

    if (geometryFilter) {
      url.searchParams.set("geometry", geometryFilter);
      url.searchParams.set("geometryType", "esriGeometryEnvelope");
      url.searchParams.set("inSR", "4326");
    }

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`ArcGIS error: ${resp.status}`);
    const data = await resp.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error.message },
        { status: 500 }
      );
    }

    const geojson = esriToGeoJSON(data.features ?? []);

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
