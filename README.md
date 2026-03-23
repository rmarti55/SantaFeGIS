# Santa Fe Open Data Portal

Explore public datasets from the City and County of Santa Fe, New Mexico. Property ownership analysis, city service requests, and infrastructure projects — all on interactive maps.

## Sections

- **Second Home Analysis** (`/second-homes`) — Interactive map estimating which residential parcels are likely second or vacation homes, using public assessor data and a heuristic scoring model. Includes a filterable data table, stats panel, and owner leaderboards.
- **City Work Orders** (`/work-orders`) — 311-style work orders reported by Santa Fe residents (potholes, graffiti, trash, parks maintenance, etc.) with map visualization, category filters, and resolution statistics.
- **Capital Projects** (`/capital-projects`) — Interactive map of Santa Fe County capital improvement projects (transportation, parks, sewer, water, facilities) with polygon boundaries, cost estimates, project phases, and funding sources. Data fetched live from the County ArcGIS Portal.

## Data Sources

| Source | URL | Used By |
|--------|-----|---------|
| Santa Fe County GIS | `sfcomaps.santafecountynm.gov` | Second Home Analysis — ~90,000 property accounts with parcel geometries, owner info, assessed values, and exemption flags |
| City of Santa Fe ArcGIS Portal | `services7.arcgis.com` | Work Orders — Public CRM service requests and Council District boundaries, fetched live |
| Santa Fe County ArcGIS Portal | `services.arcgis.com/pEosvuftL1Kgj1UF` | Capital Projects — Infrastructure/CIP project boundaries, costs, phases, and funding sources, fetched live |

## Stack

- **Ingestion** — Python script pulling GeoJSON from the County ArcGIS REST API into Postgres
- **Database** — Neon Postgres with PostGIS (property/parcel data)
- **Web app** — Next.js 16, React 19, Tailwind CSS v4, Leaflet, deployed on Vercel
- **DB driver** — `@neondatabase/serverless` (edge-compatible, used in API routes)
- **Work orders** — Fetched live from the City ArcGIS Portal at request time (no DB needed)
- **Capital projects** — Fetched live from the County ArcGIS Portal at request time (no DB needed)

## Setup

### 1. Database

Create a [Neon](https://neon.tech) project and grab the connection string.

### 2. Ingest property data

```bash
cd ingest
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."
python scrape_accounts.py
```

This downloads all ~90,000 property records, loads them into Postgres with PostGIS geometries, and runs the second-home scoring heuristics. Takes ~5-10 minutes.

Work orders require no separate ingest — they are fetched live from the City ArcGIS Portal.

### 3. Run the web app

```bash
cd web
npm install
cp .env.local.example .env.local
# Edit .env.local with your DATABASE_URL
npm run dev
```

Open http://localhost:3000.

### 4. Deploy

Push to GitHub and connect to Vercel. Set `DATABASE_URL` as an environment variable in the Vercel dashboard.

## Scoring Heuristics

The ingest script assigns each residential parcel a second-home likelihood score:

| Signal | Points | Logic |
|--------|--------|-------|
| Owner state ≠ NM | +3 | Owner lives out of state |
| Owner city ≠ property city (in NM) | +2 | Owner lives elsewhere in NM |
| Entity ownership (LLC/Trust/Corp) | +2 | Suggests investment or vacation property |
| Top quartile market value | +1 | Second homes skew expensive |
| Owner has multiple properties | +2 | Multiple parcels = likely not all primary |
| Mailing address matches situs | −2 | Owner likely lives at the property |

**Score ≥ 6**: Very likely second home — **4–5**: Likely — **2–3**: Possible — **0–1**: Likely primary

## Project Structure

```
SantaFeGIS/
├── ingest/
│   ├── scrape_accounts.py   # County GIS scraper + scoring
│   └── requirements.txt
├── web/
│   ├── src/
│   │   ├── app/             # Next.js pages and API routes
│   │   ├── components/      # React components (maps, tables, stats)
│   │   └── lib/             # DB helper, ArcGIS client
│   └── package.json
├── .env.example
└── README.md
```
