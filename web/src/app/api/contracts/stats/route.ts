import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const [totals, byDept, byYear, topVendors] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) AS total_count,
          SUM(amount_cents) AS total_cents,
          COUNT(DISTINCT vendor) AS vendor_count,
          COUNT(DISTINCT department) AS dept_count
        FROM contracts
      `),
      db.query(`
        SELECT department, COUNT(*) AS count, SUM(amount_cents) AS total_cents
        FROM contracts
        WHERE department IS NOT NULL
        GROUP BY department
        ORDER BY total_cents DESC
      `),
      db.query(`
        SELECT EXTRACT(YEAR FROM start_date)::int AS year,
               COUNT(*) AS count,
               SUM(amount_cents) AS total_cents
        FROM contracts
        WHERE start_date IS NOT NULL
        GROUP BY year
        ORDER BY year
      `),
      db.query(`
        SELECT vendor, COUNT(*) AS count, SUM(amount_cents) AS total_cents
        FROM contracts
        WHERE vendor IS NOT NULL
        GROUP BY vendor
        ORDER BY total_cents DESC
        LIMIT 20
      `),
    ]);

    const t = (totals as any[])[0] ?? {};

    return NextResponse.json(
      {
        total: Number(t.total_count ?? 0),
        totalSpend: Number(t.total_cents ?? 0) / 100,
        vendorCount: Number(t.vendor_count ?? 0),
        deptCount: Number(t.dept_count ?? 0),
        byDepartment: (byDept as any[]).map((r) => ({
          department: r.department,
          count: Number(r.count),
          totalSpend: Number(r.total_cents ?? 0) / 100,
        })),
        byYear: (byYear as any[]).map((r) => ({
          year: r.year,
          count: Number(r.count),
          totalSpend: Number(r.total_cents ?? 0) / 100,
        })),
        topVendors: (topVendors as any[]).map((r) => ({
          vendor: r.vendor,
          count: Number(r.count),
          totalSpend: Number(r.total_cents ?? 0) / 100,
        })),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
