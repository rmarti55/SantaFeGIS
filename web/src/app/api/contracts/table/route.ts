import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const ALLOWED_SORTS: Record<string, string> = {
  start_date: "start_date",
  amount: "amount_cents",
  vendor: "vendor",
  department: "department",
  contract_number: "contract_number",
  item: "item",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") ?? "50", 10)));
  const sortByParam = searchParams.get("sortBy") ?? "start_date";
  const sortDir = searchParams.get("sortDir") === "asc" ? "ASC" : "DESC";
  const search = searchParams.get("search") ?? "";
  const department = searchParams.get("department") ?? "";
  const yearFrom = searchParams.get("yearFrom") ?? "";
  const yearTo = searchParams.get("yearTo") ?? "";

  const orderField = ALLOWED_SORTS[sortByParam] ?? "start_date";

  const whereClauses: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (department) {
    whereClauses.push(`department = $${paramIndex++}`);
    params.push(department);
  }

  if (yearFrom) {
    whereClauses.push(`EXTRACT(YEAR FROM start_date) >= $${paramIndex++}`);
    params.push(parseInt(yearFrom));
  }

  if (yearTo) {
    whereClauses.push(`EXTRACT(YEAR FROM start_date) <= $${paramIndex++}`);
    params.push(parseInt(yearTo));
  }

  if (search && search.length >= 2) {
    whereClauses.push(
      `(vendor ILIKE $${paramIndex} OR purpose ILIKE $${paramIndex} OR item ILIKE $${paramIndex} OR contract_number ILIKE $${paramIndex})`
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereClauses.length > 0 ? whereClauses.join(" AND ") : "1=1";
  const offset = (page - 1) * pageSize;

  try {
    const db = getDb();
    const query = `
      SELECT
        id, contract_number, item, start_date, department, vendor,
        purpose, amount_cents, pdf_url,
        COUNT(*) OVER() AS total_count
      FROM contracts
      WHERE ${whereClause}
      ORDER BY ${orderField} ${sortDir} NULLS LAST
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const rows = await db.query(query, params) as Array<{
      id: number;
      contract_number: string;
      item: string | null;
      start_date: string | null;
      department: string | null;
      vendor: string | null;
      purpose: string | null;
      amount_cents: number;
      pdf_url: string | null;
      total_count: number;
    }>;

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    return NextResponse.json(
      {
        rows: rows.map((r) => ({
          id: r.id,
          contract_number: r.contract_number,
          item: r.item,
          start_date: r.start_date,
          department: r.department,
          vendor: r.vendor,
          purpose: r.purpose,
          amount_cents: Number(r.amount_cents),
          amount: r.amount_cents != null ? Number(r.amount_cents) / 100 : 0,
          pdf_url: r.pdf_url,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
