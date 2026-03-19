# IRRExplorer

IRRExplorer is a routing investigation tool for prefixes, ASNs, AS-SETs, and route-sets. It combines local BGP and RIR import data with live IRR, RDAP, RPKI, PeeringDB, and Looking Glass lookups behind a React frontend and API backend.

Version: `2.3.0`

## What It Does

- Query prefixes, ASNs, AS-SETs, and route-sets
- Expand IRR sets recursively with cycle detection
- Compare IRR objects with DFZ (Default-Free Zone) visibility
- Show RPKI validation state and ROA information
- Detect BGP hijacks and routing anomalies
- Expose datasource lookups for RDAP, PeeringDB, and Looking Glass
- Export routing data in multiple formats
- Visualize routing relationships with interactive graphs

## Architecture

Current production stack:

- `frontend/`: React 18 + TypeScript + Vite + Bootstrap 5
- `irrexplorer/`: Python async API (Starlette) and data importers
- `go-backend/`: Go backend for read-heavy API paths (in-progress migration)
- `charts/irrexplorer/`: Helm chart for Rancher/Kubernetes deployment
- PostgreSQL with PostGIS for routing data
- Redis for caching layer

The Go backend is an incremental migration that currently covers a subset of read-only API endpoints, running side-by-side with the Python backend.

## Key Paths

- Main Python app: [irrexplorer/app.py](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/irrexplorer/app.py)
- Frontend entry: [frontend/src/main.tsx](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/frontend/src/main.tsx)
- Go backend entry: [go-backend/cmd/api/main.go](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/go-backend/cmd/api/main.go)
- Helm chart: [charts/irrexplorer](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/charts/irrexplorer)
- Migration doc: [GO_BACKEND_MIGRATION.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/GO_BACKEND_MIGRATION.md)

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js 20 LTS
- PostgreSQL 15+ with PostGIS
- Redis 7+
- Go 1.21+ (optional, for Go backend)

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
gunicorn irrexplorer.app:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Required environment:

```bash
DATABASE_URL=postgresql://irrexplorer:password@localhost:5432/irrexplorer
REDIS_URL=redis://localhost:6379/0
IRRD_ENDPOINT=https://rr.ntt.net/graphql/
JWT_SECRET_KEY=replace-me
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

For production build:

```bash
cd frontend
npm ci
npm run build
```

### Go Backend (Optional)

```bash
cd go-backend
go test ./...
go run ./cmd/api
```

## Deployment

The supported deployment path is the Helm chart in `charts/irrexplorer`.

Important chart features:

- Redundant frontend and Python backend replicas
- Bundled PostgreSQL and Redis for simple installs
- Optional Go backend deployment
- Schema migration job (runs on upgrade)
- Recurring importer CronJob
- Optional importer bootstrap job for empty clusters
- Ingress routing with optional path splitting to the Go backend

Example:

```bash
helm upgrade --install irrexplorer ./charts/irrexplorer -n irrexplorer -f charts/irrexplorer/values.local.yaml
```

Do not commit deployment secrets or local values files.

## Imports and Data Freshness

The Python importer runs via:

```bash
python -m irrexplorer.commands.import_data
```

It imports:

- BGP table data from RouteViews and RIPE RIS
- RIR delegated stats (IANA allocations)
- Registro.br ASN data

The Helm chart includes CronJob scheduling so production imports run automatically.

## Go Migration

The repository includes an in-progress Go backend for incremental migration. Current migrated endpoints include:

- `GET /api/metadata` - System metadata
- `GET /api/clean_query` - Query normalization
- `GET /api/prefixes/prefix/{prefix}` - Prefix lookup
- `GET /api/prefixes/asn/{asn}` - ASN prefix lookup
- `GET /api/sets/member-of` - Set membership queries
- `GET /api/sets/expand` - AS-SET/route-set expansion
- `GET /api/datasources` - Datasource status

See [GO_BACKEND_MIGRATION.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/GO_BACKEND_MIGRATION.md) for the full migration plan.

## Development

### Backend Development

```bash
# Lint and format
ruff check irrexplorer/
ruff format irrexplorer/

# Type checking
mypy irrexplorer/

# Tests
pytest tests/ -v
```

### Frontend Development

```bash
cd frontend

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Test
npm test
```

## Documentation

- [CHANGELOG.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/CHANGELOG.md) - Release notes
- [INSTALLATION.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/INSTALLATION.md) - Detailed installation guide
- [DEVELOPMENT.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/DEVELOPMENT.md) - Development setup and workflows
- [DATA_SOURCES.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/DATA_SOURCES.md) - Data source documentation
- [ROADMAP.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/ROADMAP.md) - Project roadmap
- [AGENTS.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/AGENTS.md) - Multi-agent development configuration

## License

Copyright © Stichting NLNOG. Source available on [GitHub](https://github.com/jskoetsier/irrexplorer).
