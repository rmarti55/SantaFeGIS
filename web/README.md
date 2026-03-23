# Santa Fe Open Data Portal — Web App

Next.js 16 web application powering the Santa Fe Open Data Portal. Serves an interactive map and data table for second-home analysis, a work orders map, and (soon) capital projects tracking.

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# Set DATABASE_URL to your Neon connection string
npm run dev
```

Open http://localhost:3000.

## Directory Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page (section index)
│   ├── layout.tsx                  # Root layout with NavBar
│   ├── second-homes/page.tsx       # Map + stats panel for second-home analysis
│   ├── work-orders/page.tsx        # Work order map + filters + stats
│   ├── capital-projects/page.tsx   # Placeholder (coming soon)
│   └── api/
│       ├── parcels/route.ts        # GeoJSON parcels for the map
│       ├── table/route.ts          # Paginated tabular parcel data
│       ├── stats/route.ts          # Aggregate second-home statistics
│       ├── leaderboard/route.ts    # Top owners by count/value
│       ├── work-orders/route.ts    # CRM work orders (proxied from ArcGIS)
│       ├── work-orders/stats/route.ts  # Work order aggregate stats
│       └── districts/route.ts      # Council district boundaries
├── components/
│   ├── NavBar.tsx                  # Top navigation bar
│   ├── Map.tsx                     # Leaflet parcel map (second homes)
│   ├── DataTable.tsx               # Sortable/filterable data table + leaderboards
│   ├── StatsPanel.tsx              # Slide-out stats panel (second homes)
│   ├── WorkOrderMap.tsx            # Leaflet map for work orders
│   ├── WorkOrderFilters.tsx        # Filter bar for work orders
│   └── WorkOrderStats.tsx          # Slide-out stats panel (work orders)
└── lib/
    ├── db.ts                       # Neon serverless DB helper
    └── arcgis.ts                   # ArcGIS REST client, CRM types, constants
```

## API Routes

All routes run on the Edge runtime.

### Second Home Analysis (DB-backed)

These query the Neon Postgres database populated by the ingest script.

#### `GET /api/parcels`

Returns a GeoJSON `FeatureCollection` of property parcels.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `bbox` | `w,s,e,n` | — | Bounding box filter |
| `minScore` | int | `0` | Minimum second-home score |
| `maxScore` | int | `99` | Maximum second-home score |
| `zoom` | int | `14` | Map zoom level (controls geometry simplification and result limit) |
| `ownerState` | string | — | Two-letter state code filter |
| `propertyClass` | string | — | Property class filter (e.g. `SRES`, `MRES`, `CRES`) |

#### `GET /api/table`

Returns paginated, sortable parcel data for the table view.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | `1` | Page number |
| `pageSize` | int | `50` | Rows per page (max 100) |
| `sortBy` | string | `score` | Sort column: `score`, `address`, `owner`, `owner_state`, `market_value`, `property_class`, `neighborhood` |
| `sortDir` | `asc`/`desc` | `desc` | Sort direction |
| `minScore` | int | `0` | Minimum second-home score |
| `ownerState` | string | — | Two-letter state code filter |
| `propertyClass` | string | — | Property class filter |
| `search` | string | — | Search address or owner name (min 2 chars) |

#### `GET /api/stats`

Returns aggregate statistics: parcel counts, average values, top out-of-state owner states, and neighborhood breakdown by second-home percentage. No parameters.

#### `GET /api/leaderboard`

Returns three ranked lists: top owners by property count, top owners by total portfolio value, and the 25 most expensive individual properties. No parameters.

### Work Orders (live from ArcGIS)

These proxy requests to the City of Santa Fe's Public CRM ArcGIS service. No database required.

#### `GET /api/work-orders`

Returns a GeoJSON `FeatureCollection` of CRM work orders.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `problemtype` | string | — | Filter by problem type (e.g. `graffiti`, `roads`, `trash`) |
| `status` | string | — | Filter by status (e.g. `Submitted`, `closed`) |
| `dateFrom` | `YYYY-MM-DD` | — | Earliest creation date |
| `dateTo` | `YYYY-MM-DD` | — | Latest creation date |
| `bbox` | `w,s,e,n` | — | Bounding box filter |
| `offset` | int | `0` | Pagination offset |
| `limit` | int | `2000` | Max results (capped at 2000) |

#### `GET /api/work-orders/stats`

Returns work order counts grouped by problem type and status, plus total count and average resolution time. No parameters.

#### `GET /api/districts`

Returns a GeoJSON `FeatureCollection` of Santa Fe City Council district boundaries. Cached for 24 hours. No parameters.

## Key Architectural Notes

- **Second-home data** is static — scraped once by the Python ingest script and stored in Postgres. The web app only reads from the DB.
- **Work order data** is live — fetched from the City ArcGIS Portal on every request, with short edge caching (2–5 min).
- All API routes use `@neondatabase/serverless` or direct `fetch` to ArcGIS, compatible with Vercel Edge Functions.
- The map components (`Map.tsx`, `WorkOrderMap.tsx`) use Leaflet directly (not `react-leaflet`) and are loaded with `next/dynamic` to avoid SSR issues.
- Parcel geometry is simplified server-side based on zoom level to keep payloads small at low zoom.
