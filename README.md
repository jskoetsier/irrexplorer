# IRRExplorer

IRRExplorer is a routing investigation tool for prefixes, ASNs, AS-SETs, and route-sets. It combines local BGP and RIR import data with live IRR, RDAP, RPKI, PeeringDB, and Looking Glass lookups behind a React frontend and Go API backend.

Version: `2.4.0`

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

Production stack:

- `frontend/`: React 18 + TypeScript + Vite + Bootstrap 5
- `go-backend/`: Go backend for API (Starlette-based Python backend removed)
- `charts/irrexplorer/`: Helm chart for Kubernetes deployment
- PostgreSQL 15 with PostGIS for routing data
- Redis 7 for caching layer

## Key Paths

- Frontend entry: [frontend/src/main.tsx](frontend/src/main.tsx)
- Go backend entry: [go-backend/cmd/api/main.go](go-backend/cmd/api/main.go)
- Helm chart: [charts/irrexplorer](charts/irrexplorer)

## Running Locally

### Prerequisites

- Go 1.25+
- Node.js 20 LTS
- PostgreSQL 15+ with PostGIS
- Redis 7+

### Go Backend

```bash
cd go-backend
go test ./...
go run ./cmd/api
```

Required environment:

```bash
DATABASE_URL=postgresql://irrexplorer:password@localhost:5432/irrexplorer
REDIS_URL=redis://localhost:6379/0
IRRD_ENDPOINT=https://rr.rxtx.nl/graphql/
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

For production build:

```bash
cd frontend
npm install
npm run build
```

### Docker Compose (Recommended)

```bash
docker compose up -d
```

Access:
- Frontend: http://localhost:8080
- Backend API: http://localhost:8080/api

## Deployment

The supported deployment path is the Helm chart in `charts/irrexplorer`.

Important chart features:

- Redundant frontend and Go backend replicas
- Bundled PostgreSQL and Redis for simple installs
- Schema migration job (runs on upgrade)
- Recurring importer CronJob
- Optional importer bootstrap job for empty clusters
- Ingress routing

Example:

```bash
helm upgrade --install irrexplorer ./charts/irrexplorer -n irrexplorer -f charts/irrexplorer/values.local.yaml
```

Do not commit deployment secrets or local values files.

## Data Import

The Go importer runs via:

```bash
cd go-backend
go run ./cmd/importer
```

It imports:

- BGP table data from RouteViews and RIPE RIS
- RIR delegated stats (IANA allocations)
- Registro.br ASN data

The Helm chart includes CronJob scheduling so production imports run automatically.

## Development

### Backend Development (Go)

```bash
cd go-backend

# Test
go test ./...

# Build
go build ./cmd/...

# Vet
go vet ./...
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

- [CHANGELOG.md](CHANGELOG.md) - Release notes
- [INSTALLATION.md](INSTALLATION.md) - Detailed installation guide
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development setup and workflows
- [DATA_SOURCES.md](DATA_SOURCES.md) - Data source documentation
- [ROADMAP.md](ROADMAP.md) - Project roadmap
- [AGENTS.md](AGENTS.md) - Multi-agent development configuration

## License

Copyright © Stichting NLNOG. Source available on [GitHub](https://github.com/jskoetsier/irrexplorer).