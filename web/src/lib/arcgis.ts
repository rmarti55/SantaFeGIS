const CRM_BASE =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/Public_CRM/FeatureServer/0";

const DISTRICTS_BASE =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/Council_Districts/FeatureServer/0";

const CAPITAL_PROJECTS_BASE =
  "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/test_public_view_SantaFe_CP_gdb_20220906/FeatureServer/0";

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

export const FLAT_PROBLEM_TYPES = new Set([
  "abandonedvehicle",
  "encampments",
  "parking",
  "streetlights",
  "transit",
]);

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

// Reclassify sub-problems that the city CRM filed under the wrong top-level
// problemtype (mostly dumped into "other"). Maps Problem text -> correct type code.
export const PROBLEM_RECLASSIFY: Record<string, string> = {
  "Encampment": "encampments",
  "Homeless complaint": "encampments",
  "Homeless Camp / Nuisance List": "encampments",
  "Homeless Camp in Culvert": "encampments",
  "Illegal Dumping": "dumping",
  "Litter": "dumping",
  "Litter and Debris": "dumping",
  "Shopping Cart": "dumping",
  "Shopping Carts": "dumping",
  "Abandoned vehicle": "abandonedvehicle",
  "Abandoned vehicle on street": "abandonedvehicle",
  "Abandoned Vehicle - Assigned to parking": "abandonedvehicle",
  "City Buses": "transit",
  "Transit": "transit",
  "RTD Bus Complaint": "transit",
  "Street lights": "streetlights",
  "LED Street Light": "streetlights",
  "Overhead Street Light - PNM": "streetlights",
  "Lighting": "streetlights",
  "Illegal Parking": "parking",
  "Parking": "parking",
  "Parking Ticket": "parking",
  "Parking Appeal": "parking",
  "Parking Garage": "parking",
  "Parking Spaces": "parking",
  "No Parking Signage": "parking",
  "Drag Racing / Mufflers": "roads",
  "Drag Racing": "roads",
  "Loud Mufflers or Street Racing": "roads",
  "Mufflers/Speeding": "roads",
  "Speeding Issue": "roads",
  "Speeding Vehicles": "roads",
  "Speed Bumps": "roads",
  "Traffic Light": "roads",
  "Traffic Hazard": "roads",
  "Traffic Violations": "roads",
  "Traffic Engineer Study": "roads",
  "Pothole / Cracks": "roads",
  "Sidewalk Damage": "roads",
  "Sidewalk Violation": "roads",
  "Stop sign blocked by weeds": "roads",
  "Stop Sign knocked down": "roads",
  "Grading": "roads",
  "Broken Bridge": "roads",
  "Orange Barrel": "roads",
  "No Signage": "roads",
  "Trailhead Signage": "roads",
  "Fire Hydrant": "utilities",
  "Leaking Fire Hydrant": "utilities",
  "Blocked Fire Hydrant": "utilities",
  "Water Department": "utilities",
  "Water Department / T&D": "utilities",
  "Water Shut Off": "utilities",
  "Dirty Water": "utilities",
  "Wastewater Complaint": "utilities",
  "PNM - Powerlines": "utilities",
  "PNM / Electrical Inspection": "utilities",
  "PNM Outage": "utilities",
  "Cable Wires": "utilities",
  "Meter Issue": "utilities",
  "Irrigation": "utilities",
  "Drainage": "utilities",
  "Stormwater Drain": "utilities",
  "Clogged Culvert": "utilities",
  "Short Term Rental": "property",
  "Short-term rental property complaints": "property",
  "Short Term Rental / COVID Issue": "property",
  "STR": "property",
  "Councilor Lindell email - STR Complaint": "property",
  "PODS unit in front yard": "property",
  "Noise": "property",
  "Firework complaint": "property",
  "Fireworks": "property",
  "Air Quality": "property",
  "Marijuana Complaint": "property",
  "Covid-19 Violations": "property",
  "COVID Signage": "property",
  "COVID Issue": "property",
  "Mask Violations - COVID": "property",
  "City Staff / Mask Violation / COVID": "property",
  "ATVs": "roads",
  "RV": "parking",
  "vehicle in an Emergency Exit": "parking",
  "Weeds and Litter": "weeds",
  "Tree Limbs/Weeds": "weeds",
  "Tree Removal": "weeds",
  "Overgrown Weeds": "weeds",
  "Dead Animal": "property",
  "Dog Feces": "property",
  "Barking dog": "property",
  "Loose or unrestrained animal": "property",
  "Animal welfare check": "property",
  "Colonia Prisma Park": "parks",
  "City Park": "parks",
  "City trail": "parks",
  "Airport Complaint": "other",
  "Airport Noise": "other",
  "Graffiti in park or playground": "graffiti",
  "Graffiti on public property": "graffiti",
  "Graffiti on private property": "graffiti",
  "Graffiti on sign (stop sign, speed limit sign, etc.)": "graffiti",
  "Graffiti in park, playground, trail, or open space": "graffiti",
  "Needles": "encampments",
  "Needles or sharps": "encampments",
  "Obelisk Damage": "property",
};

export function reclassifyProblemType(
  problemtype: string,
  problem: string | null
): string {
  if (!problem) return problemtype;
  return PROBLEM_RECLASSIFY[problem] ?? problemtype;
}

// Merge duplicate / near-duplicate sub-problem names into canonical labels.
// Raw Problem values not listed here pass through unchanged.
export const SUB_PROBLEM_CONSOLIDATE: Record<string, string> = {
  // --- "Other" catch-all variants (appear across many categories) ---
  "Other (city easements, alley clean ups, etc.)": "Other",
  "Other (stormwater drains and culvert cleanouts, etc.)": "Other",
  "Other (damaged street signs, sidewalk/curb repair, stormwater drains, etc.)": "Other",
  "Other (historic district concerns, murals, illegal signs, etc.)": "Other",
  "Other (historic district concerns, murals, outdoor lighting, illegal signs, etc.)": "Other",
  "Other (special collections route/refuse bag delivery, new service, property damage assessment, etc.)": "Other",
  "Other Illegal Dumping Material": "Other",
  "Other weeds issue": "Other",
  "Other utilities issue": "Other",
  "Orange Barrel EMCO Complaint": "Other",
  "Right of Way Violation": "Other",
  "Missing Sign": "Other",
  "Permits for Signage": "Other",
  "Professional dog trainer": "Other",
  "Special Service / Commercial Pickup": "Other",
  "Residential (house)": "Other",

  // --- Roads: Pothole ---
  "Pothole / Cracks": "Pothole",

  // --- Roads: Signage (5 variants -> 1) ---
  "Signage (stop signs, speed limit signs, road signs, etc.)": "Signage",
  "Signage (stop signs, speed limit signs, street signs, etc.)": "Signage",
  "Signage (new, replacment, etc.)": "Signage",
  "Yellow Curb / Signage": "Signage",

  // --- Roads: Grading ---
  "Grading": "Street grading",

  // --- Roads: Sidewalk ---
  "Sidewalk Damage": "Sidewalk or curb repair",

  // --- Roads: Drainage (5 variants -> 1) ---
  "Stormwater Drain": "Drainage / Culvert",
  "Clogged Culvert": "Drainage / Culvert",
  "Culvert/Stormwater Drainage Cleanout": "Drainage / Culvert",
  "Drainage": "Drainage / Culvert",
  "Gutter": "Drainage / Culvert",

  // --- Trash ---
  "Missed trash pickup": "Missed trash or recycling pickup",
  "Missed recycling pickup": "Missed trash or recycling pickup",
  "Missing Trash Bin": "Trash or recycling receptacle repair or replacement",
  "Overflowing trash": "Trash or recycling receptacle repair or replacement",

  // --- Property ---
  "Building without a permit": "Construction/building without a permit",
  "Junk Vehicle": "Nuisance or blighted property",
  "Junk Trailer": "Nuisance or blighted property",
  "Trailer parked on sidewalk": "Nuisance or blighted property",
  "Possible Litter and Debris from construction": "Nuisance or blighted property",
  "litter and debris": "Nuisance or blighted property",
  "Short Term Rental  / COVID Issue": "Short-term rental property complaints",
  "STR": "Short-term rental property complaints",
  "Lighting": "Outdoor Lighting",
  "Noise": "Loud Noise",
  "Loose or unrestrained animal": "Animal welfare check",

  // --- Parks ---
  "Broken equipment": "Broken equipment (playground, bench, etc.)",
  "Graffiti in park or playground": "Graffiti in park, playground, trail, or open space",
  "Refill dog bags": "Refill dog bags / request dog receptacle station",

  // --- Dumping ---
  "Shopping Cart": "Shopping Carts",
  "Furniture": "Furniture (couch, mattress, box springs, etc.)",

  // --- Weeds ---
  "On a sidewalk": "Weeds on the sidewalk - obstructing the walkway",
  "Overgrown weeds on the sidewalk": "Weeds on the sidewalk - obstructing the walkway",
  "Overgrown weeds": "Weeds on private property",
  "Overgrown Weeds": "Weeds on private property",
  "On a medians": "Weeds on medians",
  "On private property": "Weeds on private property",
  "In a park, trail or openspace": "Weeds in park or playground",
  "Weeds on private property / Signage": "Weeds on private property",
};

export function consolidateSubProblem(raw: string): string {
  return SUB_PROBLEM_CONSOLIDATE[raw] ?? raw;
}

// Reverse lookup: given a (possibly consolidated) name, return all raw Problem
// values that map to it, so ArcGIS queries can use an IN clause.
const _reverseMap = new Map<string, string[]>();
for (const [raw, canonical] of Object.entries(SUB_PROBLEM_CONSOLIDATE)) {
  const arr = _reverseMap.get(canonical) ?? [];
  arr.push(raw);
  _reverseMap.set(canonical, arr);
}

export function expandSubProblem(name: string): string[] {
  const rawValues = _reverseMap.get(name);
  if (!rawValues) return [name];
  return [name, ...rawValues];
}

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
      .map((f) => {
        const effectiveType = reclassifyProblemType(
          f.attributes.problemtype,
          f.attributes.Problem
        );
        return {
          type: "Feature" as const,
          id: f.attributes.objectid,
          geometry: {
            type: "Point" as const,
            coordinates: [f.geometry!.x, f.geometry!.y],
          },
          properties: {
            ...f.attributes,
            problemtype: effectiveType,
            problemtype_original: f.attributes.problemtype,
            problemtype_label:
              PROBLEM_TYPES[effectiveType] ?? effectiveType,
            status_label:
              STATUS_LABELS[f.attributes.status] ?? f.attributes.status,
          },
        };
      }),
  };
}

// ---------------------------------------------------------------------------
// Capital Projects
// ---------------------------------------------------------------------------

export interface CapitalProjectFeature {
  attributes: {
    OBJECTID: number;
    GlobalID: string;
    MasterID: string | null;
    Project_Title: string | null;
    Division: string;
    ProjectType: string | null;
    Facility: string | null;
    CityGoal: string | null;
    Description: string | null;
    Scope: string | null;
    TotalCostQuality: string | null;
    DesignCost: number | null;
    ConstructionCost: number | null;
    TotalCost: number | null;
    Funded: string | null;
    Phase: string | null;
    PM: string | null;
    EstConstructionStart: number | null;
    OperationalDate: number | null;
    UsefulLife: string | null;
    Urgency: string | null;
    FundedtoDate2: number | null;
    MasterLedgerID: string | null;
    ProjectSummaryLink: string | null;
  };
  geometry?: { rings: number[][][] };
}

export const PROJECT_TYPES: Record<string, string> = {
  Airport: "Airport",
  "Community Services": "Community Services",
  Facilities: "Facilities",
  Fire: "Fire",
  ITT: "ITT",
  Parks: "Parks",
  Railyard: "Railyard",
  Stormwater: "Stormwater",
  Streets: "Streets",
};

export const PROJECT_TYPE_COLORS: Record<string, string> = {
  Airport: "#f59e0b",
  "Community Services": "#ec4899",
  Facilities: "#6366f1",
  Fire: "#ef4444",
  ITT: "#8b5cf6",
  Parks: "#22c55e",
  Railyard: "#a855f7",
  Stormwater: "#06b6d4",
  Streets: "#f97316",
};

export const PROJECT_PHASES: Record<string, string> = {
  Planning: "Planning",
  Design: "Design",
  Construction: "Construction",
  Complete: "Complete",
};

export const FUNDED_STATUS: Record<string, string> = {
  "Fully Funded": "Fully Funded",
  "Partial Funding": "Partial Funding",
  Unfunded: "Unfunded",
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
          division_label:
            PROJECT_TYPES[f.attributes.Division] ?? f.attributes.Division,
          phase_label:
            PROJECT_PHASES[f.attributes.Phase ?? ""] ?? f.attributes.Phase,
          funded_label:
            FUNDED_STATUS[f.attributes.Funded ?? ""] ?? f.attributes.Funded,
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

// ---------------------------------------------------------------------------
// City Zoning (Zoning_MIL1 MapServer layer 6)
// ---------------------------------------------------------------------------

const ZONING_BASE =
  "https://gis.santafenm.gov/server/rest/services/Zoning_MIL1/MapServer/6";

export async function queryZoning(params: ArcGISQueryParams) {
  return queryFeatureService(ZONING_BASE, params);
}

export interface ZoningFeature {
  attributes: {
    OBJECTID: number;
    OBJECTID_1: number;
    ZDESC: string;
    ZORDNO: string | null;
    ZCASNO: string | null;
    DESC_: string | null;
    ZAHyperlin: string | null;
    COMMENTS: string | null;
  };
  geometry?: { rings: number[][][] };
}

export type ZoningCategory =
  | "Single-Family Residential"
  | "Multi-Family Residential"
  | "Specialty Residential"
  | "Commercial"
  | "Industrial"
  | "Mixed Use / Planned"
  | "Other";

const SF_RES_CODES = [
  "RR", "R1", "R1PUD", "R2", "R2DT", "R2PUD", "R2AC",
  "R3", "R3PUD", "R4", "R5", "R5PUD", "R5AC", "R5DT",
  "R6", "R6PUD", "R7", "R7I", "R7PUD", "R8", "R8 ",
];
const MF_RES_CODES = [
  "R10", "R10PUD", "R12", "R12PUD", "R21", "R21PUD",
  "R29", "R29PUD", "R29AC",
  "RC5", "RC5AC", "ACRC5", "AC/R2",
  "RC8", "RC8AC", "ACRC8",
];
const SPECIALTY_RES_CODES = ["RAC", "MHP"];
const COMMERCIAL_CODES = [
  "C1", "C1PUD", "C2", "C2PUD", "C4",
  "SC1", "SC2", "SC3",
];
const INDUSTRIAL_CODES = ["I1", "I1PUD", "I2", "BIP*"];
const MIXED_CODES = [
  "MU", "HZ", "PRC", "PRRC",
  "BCD", "BCDBAR", "BCDLEN", "BCDRED", "BCDSTA", "BCDCER",
  "BCDLOR", "BCDSAN", "BCDMAR", "BCDALA", "BCDOLD", "BCDEAS",
  "BCDPLA", "BCDROS", "BCDMCK", "BCDDON", "BCDWES",
];

const categoryLookup = new Map<string, ZoningCategory>();
SF_RES_CODES.forEach((c) => categoryLookup.set(c, "Single-Family Residential"));
MF_RES_CODES.forEach((c) => categoryLookup.set(c, "Multi-Family Residential"));
SPECIALTY_RES_CODES.forEach((c) => categoryLookup.set(c, "Specialty Residential"));
COMMERCIAL_CODES.forEach((c) => categoryLookup.set(c, "Commercial"));
INDUSTRIAL_CODES.forEach((c) => categoryLookup.set(c, "Industrial"));
MIXED_CODES.forEach((c) => categoryLookup.set(c, "Mixed Use / Planned"));

export function getZoningCategory(zdesc: string): ZoningCategory {
  return categoryLookup.get(zdesc) ?? "Other";
}

export const ZONING_CATEGORY_COLORS: Record<ZoningCategory, string> = {
  "Single-Family Residential": "#facc15",
  "Multi-Family Residential": "#a0602c",
  "Specialty Residential": "#fd8025",
  "Commercial": "#ef4444",
  "Industrial": "#a5a5a5",
  "Mixed Use / Planned": "#a900e6",
  "Other": "#6b7280",
};

export const ZONING_CATEGORY_LIST: ZoningCategory[] = [
  "Single-Family Residential",
  "Multi-Family Residential",
  "Specialty Residential",
  "Commercial",
  "Industrial",
  "Mixed Use / Planned",
];

export const ZONING_DETAILED_GROUPS: {
  heading: string;
  entries: { label: string; codes: string[]; color: string }[];
}[] = [
  {
    heading: "Residential Districts",
    entries: [
      { label: "RR Rural Residential", codes: ["RR"], color: "#ffebaf" },
      { label: "R1 Single-Family 1du/ac", codes: ["R1", "R1PUD"], color: "#fef9cc" },
      { label: "R2 Single-Family 2du/ac", codes: ["R2", "R2DT", "R2PUD", "R2AC"], color: "#fdfbad" },
      { label: "R3 Single-Family 3du/ac", codes: ["R3", "R3PUD"], color: "#ebfe90" },
      { label: "R4 Single-Family 4du/ac", codes: ["R4"], color: "#dcf35b" },
      { label: "R5/R6 Single-Family 5-6du/ac", codes: ["R5", "R5PUD", "R5AC", "R5DT", "R6", "R6PUD"], color: "#fdfa7c" },
      { label: "R7/R8 Single-Family 7-8du/ac", codes: ["R7", "R7I", "R7PUD", "R8", "R8 "], color: "#b8fe00" },
      { label: "RC5 Compound 5du/ac", codes: ["RC5", "RC5AC", "ACRC5", "AC/R2"], color: "#fcdec9" },
      { label: "RC8 Compound 8du/ac", codes: ["RC8", "RC8AC", "ACRC8"], color: "#eb98cc" },
      { label: "R10 Multi-Family 10du/ac", codes: ["R10", "R10PUD"], color: "#a0602c" },
      { label: "R12 Multi-Family 12du/ac", codes: ["R12", "R12PUD"], color: "#aa6057" },
      { label: "R21 Multi-Family 21du/ac", codes: ["R21", "R21PUD"], color: "#a0783b" },
      { label: "R29 Multi-Family 29du/ac", codes: ["R29", "R29PUD", "R29AC"], color: "#a06632" },
      { label: "RAC Residential Arts & Crafts", codes: ["RAC"], color: "#feac0f" },
      { label: "MHP Mobile Home Park", codes: ["MHP"], color: "#fd8025" },
    ],
  },
  {
    heading: "Non-Residential & Mixed Use",
    entries: [
      { label: "C1 Office Commercial", codes: ["C1", "C1PUD"], color: "#b3aafd" },
      { label: "C2 General Commercial", codes: ["C2", "C2PUD"], color: "#ff0000" },
      { label: "C4 Limited Office/Retail", codes: ["C4"], color: "#a17adb" },
      { label: "HZ Hospital Zone", codes: ["HZ"], color: "#91e2fe" },
      { label: "BCD Business Capital District", codes: ["BCD", "BCDBAR", "BCDLEN", "BCDRED", "BCDSTA", "BCDCER", "BCDLOR", "BCDSAN", "BCDMAR", "BCDALA", "BCDOLD", "BCDEAS", "BCDPLA", "BCDROS", "BCDMCK", "BCDDON", "BCDWES"], color: "#966c6e" },
      { label: "I1 Light Industrial", codes: ["I1", "I1PUD"], color: "#c8c2fe" },
      { label: "I2 General Industrial", codes: ["I2"], color: "#a5a5a5" },
      { label: "BIP Business Industrial Park", codes: ["BIP*"], color: "#770081" },
      { label: "PRC/PRRC Planned Community", codes: ["PRC", "PRRC"], color: "#ada4fe" },
      { label: "SC1-SC3 Shopping Center", codes: ["SC1", "SC2", "SC3"], color: "#f6a4fe" },
      { label: "MU Mixed Use", codes: ["MU"], color: "#a900e6" },
    ],
  },
];

const detailedColorLookup = new Map<string, string>();
for (const group of ZONING_DETAILED_GROUPS) {
  for (const entry of group.entries) {
    for (const code of entry.codes) {
      detailedColorLookup.set(code, entry.color);
    }
  }
}

export function getZoningDetailedColor(zdesc: string): string {
  return detailedColorLookup.get(zdesc) ?? "#6b7280";
}

export function esriZoningToGeoJSON(
  features: ZoningFeature[]
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
          category: getZoningCategory(f.attributes.ZDESC),
          detailed_color: getZoningDetailedColor(f.attributes.ZDESC),
          category_color: ZONING_CATEGORY_COLORS[getZoningCategory(f.attributes.ZDESC)],
        },
      })),
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
