import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });

  const sql = neon(url, { fullResults: false });
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") ?? "50", 10)));
  const sortBy = searchParams.get("sortBy") ?? "score";
  const sortDir = searchParams.get("sortDir") === "asc" ? "ASC" : "DESC";
  const secondHomesOnly = searchParams.get("secondHomesOnly") === "true";
  const ownerState = searchParams.get("ownerState") ?? "";
  const propertyClass = searchParams.get("propertyClass") ?? "";
  const search = searchParams.get("search") ?? "";

  const allowedSorts: Record<string, string> = {
    score: "second_home_score",
    address: "situs_line_1",
    owner: "owner_name",
    owner_state: "owner_state",
    market_value: "(COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0))",
    property_class: "property_class",
    neighborhood: "neighborhood_name",
  };
  const orderCol = allowedSorts[sortBy] ?? "second_home_score";

  const conditions: string[] = [
    "TRIM(tax_district) LIKE 'CI%'",
    "COALESCE(is_exempt_gov, 0) != 1",
    ...(secondHomesOnly ? ["is_second_home = TRUE"] : []),
  ];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (ownerState && /^[A-Z]{2}$/.test(ownerState.toUpperCase())) {
    conditions.push(`TRIM(owner_state) = $${paramIdx}`);
    params.push(ownerState.toUpperCase());
    paramIdx++;
  }

  if (propertyClass && /^[A-Z]{2,5}$/.test(propertyClass.toUpperCase())) {
    conditions.push(`property_class = $${paramIdx}`);
    params.push(propertyClass.toUpperCase());
    paramIdx++;
  } else {
    conditions.push("property_class IN ('SRES', 'MRES', 'CRES')");
  }

  if (search && search.length >= 2) {
    conditions.push(`(situs_line_1 ILIKE $${paramIdx} OR owner_name ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.join(" AND ");
  const offset = (page - 1) * pageSize;

  const countQuery = `SELECT COUNT(*) AS total FROM accounts WHERE ${where}`;
  const dataQuery = `
    SELECT
      objectid,
      situs_line_1 AS address,
      situs_city AS city,
      situs_zip AS zip,
      owner_name,
      owner_city,
      owner_state,
      owner_zip,
      property_class,
      acreage,
      COALESCE(current_market_land_res,0) + COALESCE(current_market_imp_res,0) AS market_value,
      COALESCE(current_assessed_land,0) + COALESCE(current_assessed_imp,0) AS assessed_value,
      is_head_of_family,
      is_senior_freeze,
      neighborhood_name AS neighborhood,
      second_home_score AS score,
      is_second_home
    FROM accounts
    WHERE ${where}
    ORDER BY ${orderCol} ${sortDir}
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  try {
    const [countRows, dataRows] = await Promise.all([
      sql.query(countQuery, params) as Promise<Record<string, unknown>[]>,
      sql.query(dataQuery, params) as Promise<Record<string, unknown>[]>,
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    return NextResponse.json({
      rows: dataRows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
