# Santa Fe Second Home Map

Interactive map showing likely second/vacation homes in Santa Fe, NM based on public county property records.

Uses heuristic scoring (owner mailing address vs. property address, exemption flags, entity ownership, property values) to estimate which residential parcels are likely not primary residences.

## Data Source

Santa Fe County GIS: `sfcomaps.santafecountynm.gov` — ~90,000 property accounts with parcel geometries, owner info, assessed values, and exemption flags.

## Stack

- **Ingestion**: Python script pulling GeoJSON from ArcGIS REST API
- **Database**: Neon Postgres with PostGIS
- **Frontend**: Next.js + Leaflet + OpenStreetMap, deployed on Vercel

## Setup

### 1. Database

Create a [Neon](https://neon.tech) project and grab the connection string.

### 2. Ingest data

```bash
cd ingest
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."
python scrape_accounts.py
```

This downloads all ~90,000 property records, loads them into Postgres with PostGIS geometries, and runs the second-home scoring heuristics. Takes ~5-10 minutes.

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

| Signal | Points | Logic |
|--------|--------|-------|
| Owner state ≠ NM | +3 | Owner lives out of state |
| Owner city ≠ property city (in NM) | +2 | Owner lives elsewhere in NM |
| No head-of-family exemption | +1 | Primary residents typically claim this |
| Entity ownership (LLC/Trust/Corp) | +2 | Suggests investment or vacation property |
| Top quartile market value | +1 | Second homes skew expensive |
| Owner has multiple properties | +2 | Multiple parcels = likely not all primary |

**Score ≥ 6**: Very likely second home — **4-5**: Likely — **2-3**: Possible — **0-1**: Likely primary
