import { NextResponse } from "next/server";

export const runtime = "edge";

const BASE =
  "https://santafenm.gov/human-resources/employee-salaries-positions/hourly_rate/desc";
const PAGES = 15;
const PER_PAGE = 100;

interface Employee {
  department: string;
  division: string;
  position: string;
  hourlyRate: number;
  annualSalary: number;
  lastName: string;
  firstName: string;
}

function parseRows(html: string): Employee[] {
  const employees: Employee[] = [];

  const tbodyStart = html.indexOf("<tbody>");
  const tbodyEnd = html.indexOf("</tbody>");
  if (tbodyStart === -1 || tbodyEnd === -1) return employees;

  const tbody = html.slice(tbodyStart, tbodyEnd);
  const rowRegex = /<tr>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gs;

  let match;
  while ((match = rowRegex.exec(tbody)) !== null) {
    const rawRate = match[4].replace(/[$,\s]/g, "");
    const hourlyRate = parseFloat(rawRate);
    if (isNaN(hourlyRate)) continue;

    employees.push({
      department: match[1].trim(),
      division: match[2].trim(),
      position: match[3].trim(),
      hourlyRate,
      annualSalary: Math.round(hourlyRate * 2080),
      lastName: match[5].trim(),
      firstName: match[6].trim(),
    });
  }

  return employees;
}

let cached: { data: Employee[]; ts: number } | null = null;
const CACHE_TTL = 3600_000;

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(
      { employees: cached.data, total: cached.data.length, updatedAt: "March 30, 2026" },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
    );
  }

  try {
    const urls = Array.from({ length: PAGES }, (_, i) => {
      const offset = i * PER_PAGE;
      return offset === 0 ? BASE : `${BASE}/P${offset}`;
    });

    const responses = await Promise.all(
      urls.map((url) =>
        fetch(url, { redirect: "follow" }).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
          return r.text();
        })
      )
    );

    const allEmployees: Employee[] = [];
    for (const html of responses) {
      allEmployees.push(...parseRows(html));
    }

    allEmployees.sort((a, b) => b.hourlyRate - a.hourlyRate);

    cached = { data: allEmployees, ts: Date.now() };

    return NextResponse.json(
      { employees: allEmployees, total: allEmployees.length, updatedAt: "March 30, 2026" },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
