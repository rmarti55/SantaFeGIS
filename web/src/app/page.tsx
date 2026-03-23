import Link from "next/link";

const sections = [
  {
    href: "/second-homes",
    title: "Second Home Analysis",
    description:
      "Interactive map estimating which Santa Fe County residential parcels are likely second or vacation homes, using public assessor data and a heuristic scoring model.",
    color: "bg-red-50 border-red-200",
    iconColor: "text-red-600",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
      </svg>
    ),
  },
  {
    href: "/short-term-rentals",
    title: "Short-Term Rentals",
    description:
      "Map of all registered short-term rental (AirBnB) permits in the City of Santa Fe, sourced from the city's public GIS portal. See addresses, license numbers, business names, and permit status.",
    color: "bg-purple-50 border-purple-200",
    iconColor: "text-purple-600",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
      </svg>
    ),
  },
  {
    href: "/work-orders",
    title: "City Work Orders",
    description:
      "Explore public 311-style work orders reported by Santa Fe residents — potholes, graffiti, trash, parks maintenance, and more. Powered by the city's CRM system.",
    color: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-600",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
      </svg>
    ),
  },
  {
    href: "/road-conditions",
    title: "Road Conditions",
    description:
      "City of Santa Fe pavement maintenance data — see when every city road was last repaved, color-coded by age, with the city's internal maintenance crew priority ratings overlaid.",
    color: "bg-emerald-50 border-emerald-200",
    iconColor: "text-emerald-600",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
  },
  {
    href: "/capital-projects",
    title: "Capital Projects",
    description:
      "Track city infrastructure and capital improvement projects across Santa Fe — construction, planning, and budgets.",
    color: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-600",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Santa Fe Open Data Portal
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Explore public datasets from the City of Santa Fe, New Mexico.
            Property ownership analysis, city service requests, and infrastructure projects.
          </p>
        </div>

        <div className="grid gap-6">
          {sections.map(({ href, title, description, color, iconColor, icon }) => (
            <Link
              key={href}
              href={href}
              className={`block border rounded-xl p-6 ${color} hover:shadow-lg transition-shadow group`}
            >
              <div className="flex items-start gap-4">
                <div className={`${iconColor} mt-0.5 shrink-0 group-hover:scale-110 transition-transform`}>
                  {icon}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1 group-hover:underline">
                    {title}
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-12">
          Data sourced from Santa Fe County GIS and the City of Santa Fe ArcGIS Portal.
        </p>
      </div>
    </div>
  );
}
