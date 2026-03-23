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

// ---------------------------------------------------------------------------
// City Pavement Maintenance & Roads Priority
// ---------------------------------------------------------------------------

const PAVEMENT_MAINTENANCE_BASE =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/ArcGIS/rest/services/PavementMaintenance_1/FeatureServer/0";

const ROADS_PRIORITY_BASE =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/ArcGIS/rest/services/RoadsMaintenanceCrewPriority_1/FeatureServer/0";

export async function queryPavementMaintenance(params: ArcGISQueryParams) {
  return queryFeatureService(PAVEMENT_MAINTENANCE_BASE, params);
}

export async function queryRoadsPriority(params: ArcGISQueryParams) {
  return queryFeatureService(ROADS_PRIORITY_BASE, params);
}

export interface PavementMaintenanceFeature {
  attributes: {
    OBJECTID_1: number;
    STREET: string | null;
    RCLNAME: string | null;
    RCLCOND: string | null;
    RCLTYPE: string | null;
    RCLCLASS: string | null;
    SPEEDLIMIT: number | null;
    MILES: number | null;
    MILE: number | null;
    YearRepave: number | null;
  };
  geometry?: { paths: number[][][] };
}

export interface RoadsPriorityFeature {
  attributes: {
    OBJECTID_1: number;
    ROADNAME: string | null;
    MILES: number | null;
    Priority: number | null;
    SFFRC: number | null;
  };
  geometry?: { paths: number[][][] };
}

export const ROAD_CONDITIONS: Record<string, string> = {
  GOOD: "Good",
  FAIR: "Fair",
  " ": "Not Rated",
};

export const ROAD_CONDITION_COLORS: Record<string, string> = {
  GOOD: "#22c55e",
  FAIR: "#f59e0b",
  " ": "#d1d5db",
};

export const MAINTENANCE_PRIORITY: Record<number, string> = {
  1: "Highest",
  2: "Medium",
  3: "Lower",
  0: "None",
};

export const MAINTENANCE_PRIORITY_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  0: "#9ca3af",
};

const CURRENT_YEAR = new Date().getFullYear();

export function repaveAgeColor(yearRepave: number | null): string {
  if (!yearRepave || yearRepave <= 0) return "#9ca3af";
  const age = CURRENT_YEAR - yearRepave;
  if (age <= 5) return "#22c55e";
  if (age <= 10) return "#84cc16";
  if (age <= 15) return "#eab308";
  if (age <= 20) return "#f97316";
  if (age <= 25) return "#ef4444";
  return "#991b1b";
}

export const REPAVE_AGE_LEGEND: { label: string; color: string }[] = [
  { label: "0–5 years", color: "#22c55e" },
  { label: "6–10 years", color: "#84cc16" },
  { label: "11–15 years", color: "#eab308" },
  { label: "16–20 years", color: "#f97316" },
  { label: "21–25 years", color: "#ef4444" },
  { label: "26+ years", color: "#991b1b" },
  { label: "Unknown", color: "#9ca3af" },
];

export const ROAD_SURFACE_TYPES: Record<string, string> = {
  ASPHALT: "Asphalt",
  DIRT: "Dirt",
  "BASE COURSE": "Base Course",
  "CHIP SEAL": "Chip Seal",
  "COLD MILLINGS": "Cold Millings",
  GRAVEL: "Gravel",
  CONCRETE: "Concrete",
  PAVEMENT: "Pavement",
  "DIRT 2-TRACK": "Dirt 2-Track",
  "DIRT STABLE": "Dirt Stabilized",
  PLANNED: "Planned",
};

export function esriPavementToGeoJSON(
  features: PavementMaintenanceFeature[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features
      .filter((f) => f.geometry?.paths?.length)
      .map((f) => {
        const paths = f.geometry!.paths;
        const geometry: GeoJSON.Geometry =
          paths.length === 1
            ? { type: "LineString", coordinates: paths[0] }
            : { type: "MultiLineString", coordinates: paths };

        const cond = (f.attributes.RCLCOND ?? " ").trim() || " ";
        const yearRepave = f.attributes.YearRepave ?? 0;
        const age = yearRepave > 0 ? CURRENT_YEAR - yearRepave : null;

        return {
          type: "Feature" as const,
          id: f.attributes.OBJECTID_1,
          geometry,
          properties: {
            ...f.attributes,
            condition_label: ROAD_CONDITIONS[cond] ?? cond,
            surface_label:
              ROAD_SURFACE_TYPES[(f.attributes.RCLTYPE ?? "").trim()] ??
              f.attributes.RCLTYPE ??
              "Unknown",
            repave_age: age,
            repave_age_color: repaveAgeColor(yearRepave),
          },
        };
      }),
  };
}

export function esriRoadsPriorityToGeoJSON(
  features: RoadsPriorityFeature[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features
      .filter((f) => f.geometry?.paths?.length)
      .map((f) => {
        const paths = f.geometry!.paths;
        const geometry: GeoJSON.Geometry =
          paths.length === 1
            ? { type: "LineString", coordinates: paths[0] }
            : { type: "MultiLineString", coordinates: paths };

        const pri = f.attributes.Priority ?? 0;
        return {
          type: "Feature" as const,
          id: f.attributes.OBJECTID_1,
          geometry,
          properties: {
            ...f.attributes,
            priority_label: MAINTENANCE_PRIORITY[pri] ?? `Priority ${pri}`,
            priority_color: MAINTENANCE_PRIORITY_COLORS[pri] ?? "#9ca3af",
          },
        };
      }),
  };
}
