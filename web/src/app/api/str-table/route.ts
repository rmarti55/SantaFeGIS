import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = process.env.DATABASE_URL;
  if (!url)
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });

  const sql = neon(url, { fullResults: false });
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") ?? "50", 10)));
  const sortBy = searchParams.get("sortBy") ?? "address";
  const sortDir = searchParams.get("sortDir") === "asc" ? "ASC" : "DESC";
  const status = searchParams.get("status") ?? "";
  const rentalType = searchParams.get("rentalType") ?? "";
  const search = searchParams.get("search") ?? "";

  const allowedSorts: Record<string, string> = {
    address: "COALESCE(address, match_addr)",
    business_name: "business_name",
    business_license: "business_license",
    rental_type: "rental_type",
    status: "status",
    zoning: "zoning",
    issue_date: "issue_date",
    expiration_date: "expiration_date",
  };
  const orderCol = allowedSorts[sortBy] ?? "COALESCE(address, match_addr)";

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`status = $${paramIdx}`);
    params.push(status);
    paramIdx++;
  }

  if (rentalType) {
    conditions.push(`rental_type = $${paramIdx}`);
    params.push(rentalType);
    paramIdx++;
  }

  if (search && search.length >= 2) {
    conditions.push(
      `(address ILIKE $${paramIdx} OR match_addr ILIKE $${paramIdx} OR business_name ILIKE $${paramIdx} OR business_license ILIKE $${paramIdx})`
    );
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.length > 0 ? conditions.join(" AND ") : "TRUE";
  const offset = (page - 1) * pageSize;

  const countQuery = `SELECT COUNT(*) AS total FROM short_term_rentals WHERE ${where}`;
  const dataQuery = `
    SELECT
      id,
      source,
      COALESCE(address, match_addr) AS address,
      match_addr,
      business_license,
      business_name,
      dba,
      status,
      license_type,
      rental_type,
      zoning,
      issue_date,
      expiration_date
    FROM short_term_rentals
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

    return NextResponse.json(
      {
        rows: dataRows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
