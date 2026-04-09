"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/second-homes", label: "Second Homes" },
  { href: "/short-term-rentals", label: "Short-Term Rentals" },
  { href: "/work-orders", label: "Work Orders" },
  { href: "/road-conditions", label: "Road Conditions" },
  { href: "/capital-projects", label: "Capital Projects" },
  { href: "/zoning", label: "Zoning" },
  { href: "/budget", label: "Budget" },
  { href: "/kpis", label: "KPIs" },
  { href: "/salaries", label: "Salaries" },
  { href: "/org-tree", label: "City Org Tree" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="bg-gray-900 text-white px-5 py-3 flex items-center gap-8 z-[1001] relative">
      <Link href="/" className="shrink-0">
        <h1 className="text-lg font-bold tracking-tight hover:text-gray-200 transition-colors">
          Santa Fe Open Data
        </h1>
      </Link>

      <nav className="flex items-center gap-1">
        {tabs.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                active
                  ? "bg-white/20 text-white font-medium"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
