# IRRExplorer

IRRExplorer is a routing investigation tool for prefixes, ASNs, AS-SETs, and route-sets. It combines local BGP and RIR import data with live IRR, RDAP, PeeringDB, and Looking Glass lookups behind a React frontend and API backend.

Version: `2.3.0`

## What It Does

- Query prefixes and ASNs
- Expand IRR sets
- Compare IRR objects with DFZ visibility
- Show RPKI validation state
- Expose datasource lookups for RDAP, PeeringDB, and Looking Glass
- Export and analyze routing data

## Architecture

Current production stack:

- `frontend/`: React + TypeScript + Vite
- `irrexplorer/`: Python API and importers
- `go-backend/`: side-by-side Go migration for read paths
- `charts/irrexplorer/`: Helm chart for Rancher/Kubernetes deployment
- PostgreSQL for routing data
- Redis for caching

The Go backend is not a full replacement yet. It currently covers a subset of the read API and is intended for incremental migration and side-by-side rollout.

## Key Paths

- Main Python app: [irrexplorer/app.py](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/irrexplorer/app.py)
- Frontend entry: [frontend/src/main.tsx](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/frontend/src/main.tsx)
- Go backend entry: [go-backend/cmd/api/main.go](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/go-backend/cmd/api/main.go)
- Helm chart: [charts/irrexplorer](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/charts/irrexplorer)
- Migration doc: [GO_BACKEND_MIGRATION.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/GO_BACKEND_MIGRATION.md)

## Running Locally

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
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend

```bash
cd frontend
npm ci
npm run build
```

### Go Backend

```bash
cd go-backend
go test ./...
go run ./cmd/api
```

## Deployment

The supported deployment path is the Helm chart in `charts/irrexplorer`.

Important chart features:

- redundant frontend and Python backend replicas
- bundled PostgreSQL and Redis for simple installs
- optional Go backend deployment
- schema migration job
- recurring importer `CronJob`
- optional importer bootstrap job for empty clusters
- ingress routing with optional path splitting to the Go backend

Example:

```bash
helm upgrade --install irrexplorer ./charts/irrexplorer -n irrexplorer -f charts/irrexplorer/values.local.yaml
```

Do not commit deployment secrets or local values files.

## Imports and Data Freshness

The Python importer is:

```bash
python -m irrexplorer.commands.import_data
```

It imports:

- BGP table data
- RIR delegated stats
- Registro.br ASN data

The Helm chart now includes importer scheduling so production does not depend on manual imports.

## Go Migration

The repository includes an in-progress Go backend for incremental migration. Current migrated areas include:

- `metadata`
- `clean_query`
- `prefixes/prefix`
- `prefixes/asn`
- `sets/member-of`
- `sets/expand`
- `datasources`

See [GO_BACKEND_MIGRATION.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/GO_BACKEND_MIGRATION.md) for the migration plan and constraints.

## Documentation

- [CHANGELOG.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/CHANGELOG.md)
- [INSTALLATION.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/INSTALLATION.md)
- [DEVELOPMENT.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/DEVELOPMENT.md)
- [DATA_SOURCES.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/DATA_SOURCES.md)
- [ROADMAP.md](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/ROADMAP.md)

## Current Notes

- The frontend branding was updated to the new IRRExplorer logo with consistent sizing across home, query, and status pages.
- Production IRRD access is configured against `https://rr.ntt.net/graphql/`.
- The Go backend is additive at this stage, not the default production API.
