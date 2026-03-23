const CRM_BASE =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/Public_CRM/FeatureServer/0";

const DISTRICTS_BASE =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/Council_Districts/FeatureServer/0";

const CAPITAL_PROJECTS_BASE =
  "https://services.arcgis.com/pEosvuftL1Kgj1UF/arcgis/rest/services/InfrastructureProjects_capitalimprovementplan_e8acc338ce634d5f9720588a9881f356/FeatureServer/0";

export interface ArcGISQueryParams {
  where?: string;
  outFields?: string;
  returnGeometry?: boolean;
  outSR?: number;
  resultOffset?: number;
  resultRecordCount?: number;
  orderByFields?: string;
  outStatistics?: object[];
  groupByFieldsForStatistics?: string;
  returnCountOnly?: boolean;
  f?: string;
}

export async function queryCRM(params: ArcGISQueryParams) {
  return queryFeatureService(CRM_BASE, params);
}

export async function queryDistricts(params: ArcGISQueryParams) {
  return queryFeatureService(DISTRICTS_BASE, params);
}

export async function queryCapitalProjects(params: ArcGISQueryParams) {
  return queryFeatureService(CAPITAL_PROJECTS_BASE, params);
}

async function queryFeatureService(
  baseUrl: string,
  params: ArcGISQueryParams
) {
  const url = new URL(`${baseUrl}/query`);

  url.searchParams.set("f", params.f ?? "json");
  url.searchParams.set("where", params.where ?? "1=1");
  url.searchParams.set("outFields", params.outFields ?? "*");
  url.searchParams.set(
    "returnGeometry",
    String(params.returnGeometry ?? true)
  );
  url.searchParams.set("outSR", String(params.outSR ?? 4326));

  if (params.resultOffset != null)
    url.searchParams.set("resultOffset", String(params.resultOffset));
  if (params.resultRecordCount != null)
    url.searchParams.set("resultRecordCount", String(params.resultRecordCount));
  if (params.orderByFields)
    url.searchParams.set("orderByFields", params.orderByFields);
  if (params.returnCountOnly)
    url.searchParams.set("returnCountOnly", "true");
  if (params.outStatistics)
    url.searchParams.set("outStatistics", JSON.stringify(params.outStatistics));
  if (params.groupByFieldsForStatistics)
    url.searchParams.set(
      "groupByFieldsForStatistics",
      params.groupByFieldsForStatistics
    );

  const resp = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!resp.ok) throw new Error(`ArcGIS query failed: ${resp.status}`);
  return resp.json();
}

export interface CRMFeature {
  attributes: {
    objectid: number;
    globalid: string;
    problemtype: string;
    Problem: string;
    status: string;
    resolved_on: number | null;
    CreationDate: number;
    time_to_resolve: number | null;
  };
  geometry?: { x: number; y: number };
}

export const PROBLEM_TYPES: Record<string, string> = {
  abandonedvehicle: "Abandoned Vehicle",
  arroyoriver: "Arroyos/River Maintenance",
  transit: "City Buses",
  encampments: "Encampments",
  graffiti: "Graffiti",
  dumping: "Illegal Dumping",
  parking: "Illegal Parking",
  parks: "Parks / Trails Maintenance",
  property: "Property Maintenance / Code Violations",
  roads: "Road Maintenance",
  streetlights: "Streetlights",
  trash: "Trash and Recycling Services",
  utilities: "Utilities",
  weeds: "Weeds",
  other: "Other",
};

export const PROBLEM_TYPE_COLORS: Record<string, string> = {
  graffiti: "#ed5151",
  trash: "#149ece",
  property: "#a7c636",
  roads: "#9e559c",
  parks: "#f789d8",
  weeds: "#b7814a",
  dumping: "#3caf99",
  other: "#ffde3e",
  abandonedvehicle: "#fc921f",
  arroyoriver: "#4ea7dc",
  transit: "#7b7b7b",
  encampments: "#d94d4d",
  parking: "#8c6bb1",
  streetlights: "#f0c800",
  utilities: "#6baed6",
};

export const STATUS_VALUES = [
  "Submitted",
  "Received",
  "In progress",
  "closed",
  "cs_only_resolved",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  Submitted: "Submitted",
  Received: "Received",
  "In progress": "In Progress",
  closed: "Closed",
  cs_only_resolved: "Resolved",
};

export function esriToGeoJSON(
  features: CRMFeature[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features
      .filter((f) => f.geometry)
      .map((f) => ({
        type: "Feature" as const,
        id: f.attributes.objectid,
        geometry: {
          type: "Point" as const,
          coordinates: [f.geometry!.x, f.geometry!.y],
        },
        properties: {
          ...f.attributes,
          problemtype_label:
            PROBLEM_TYPES[f.attributes.problemtype] ??
            f.attributes.problemtype,
          status_label:
            STATUS_LABELS[f.attributes.status] ?? f.attributes.status,
        },
      })),
  };
}

// ---------------------------------------------------------------------------
// Capital Projects
// ---------------------------------------------------------------------------

export interface CapitalProjectFeature {
  attributes: {
    OBJECTID: number;
    GlobalID: string;
    projid: string | null;
    projname: string | null;
    projdesc: string | null;
    rationale: string | null;
    projtype: string;
    safety: string | null;
    mandate: string | null;
    repair: string | null;
    replace: string | null;
    expand: string | null;
    efficient: string | null;
    fiscalyr: string | null;
    fundsource: string | null;
    planstart: number | null;
    planend: number | null;
    estcost: number | null;
    pocname: string | null;
    pocphone: string | null;
    pocemail: string | null;
    projstatus: string | null;
    projphase: string | null;
  };
  geometry?: { rings: number[][][] };
}

export const PROJECT_TYPES: Record<string, string> = {
  Facilities: "Facilities",
  Parks: "Parks",
  "Sewer Collection": "Sewer Collection",
  "Stormwater Drainage": "Stormwater Drainage",
  Transportation: "Transportation",
  "Water Distribution": "Water Distribution",
  Other: "Other",
};

export const PROJECT_TYPE_COLORS: Record<string, string> = {
  Facilities: "#6366f1",
  Parks: "#22c55e",
  "Sewer Collection": "#a855f7",
  "Stormwater Drainage": "#06b6d4",
  Transportation: "#f59e0b",
  "Water Distribution": "#3b82f6",
  Other: "#94a3b8",
};

export const PROJECT_PHASES: Record<string, string> = {
  PreDesign: "Pre-Design",
  Design: "Design",
  Construction: "Construction",
  Closeout: "Closeout",
  Complete: "Complete",
};

export const FUND_SOURCES: Record<string, string> = {
  "Capital Fund": "Capital Fund",
  "Connection Fee": "Connection Fee",
  "General Fund": "General Fund",
  Grant: "Grant",
  "Impact Fee": "Impact Fee",
  "Revenue Bond": "Revenue Bond",
  "Special Fund": "Special Fund",
  "Special Tax": "Special Tax",
  "System Revenue": "System Revenue",
  Other: "Other",
};

export function esriCapitalProjectsToGeoJSON(
  features: CapitalProjectFeature[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features
      .filter((f) => f.geometry?.rings)
      .map((f) => ({
        type: "Feature" as const,
        id: f.attributes.OBJECTID,
        geometry: {
          type: "Polygon" as const,
          coordinates: f.geometry!.rings,
        },
        properties: {
          ...f.attributes,
          projtype_label:
            PROJECT_TYPES[f.attributes.projtype] ?? f.attributes.projtype,
          projphase_label:
            PROJECT_PHASES[f.attributes.projphase ?? ""] ??
            f.attributes.projphase,
          fundsource_label:
            FUND_SOURCES[f.attributes.fundsource ?? ""] ??
            f.attributes.fundsource,
        },
      })),
  };
}
