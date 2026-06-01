# IRRExplorer

IRRExplorer is a premium routing investigation tool for prefixes, ASNs, AS-SETs, and route-sets. It combines local BGP and RIR import data with live IRR, RDAP, RPKI, PeeringDB, and Looking Glass lookups behind a highly responsive, developer-focused React frontend and a robust Go API backend.

Version: `2.5.1`

---

## 🚀 Key Features

- **Global Network Asset Querying**: Instantaneous queries for prefixes, ASNs, AS-SETs, and route-sets.
- **Tailwind-Powered Dashboard Redesign**: Fully responsive premium dark-themed interface built for network systems operators.
- **RPKI Integrity Validation**: Live validation against cryptographic caches with custom status badges (`VALID`, `MISMATCH`, `CONFLICT`).
- **IRR Set Recursion**: Recursive expansion of complex AS-SET and Route-SET hierarchies with cycle detection and breadcrumb resolution paths.
- **Diagnostics Bento Grid**: High-contrast, real-time metrics cards tracking direct overlaps, parent allocations, and registry health.
- **Glassmorphic Command Consoles**: Native React state-managed terminal overlay popups for WHOIS details and dynamic external registry queries.
- **Simulated BGP Updates Ticker**: Auto-scrolling, live-updating BGP announcement telemetry streams.
- **Comprehensive Exporting**: High-performance downloading of validated dataset reports in `CSV` and `JSON`.

---

## 📂 System Architecture

The codebase follows professional engineering division of concerns:

- `frontend/`: React 18 + TypeScript + Vite + Tailwind CSS v3 (Replacing Bootstrap 5). Includes persistent responsive wrapper layouts, dynamic autocompletes, and inline asset filtering.
- `go-backend/`: Ultra-fast Go API backend scaffolding, importing, and caching structures.
- `charts/irrexplorer/`: Standard Helm chart for automated, highly resilient Kubernetes deployments.
- **Database Layer**: PostgreSQL 15+ with PostGIS extensions for routing data and geographic assets.
- **Caching Layer**: Redis 7+ for low-latency endpoint performance.

---

## 🛠️ Key Paths

- **Layout Grid & Theme Rules**: [frontend/src/index.css](frontend/src/index.css)
- **Navigation Layout Wrapper**: [frontend/src/components/common/layout.tsx](frontend/src/components/common/layout.tsx)
- **Vite & Module Scoping**: [frontend/vite.config.ts](frontend/vite.config.ts) & [frontend/tailwind.config.cjs](frontend/tailwind.config.cjs)
- **Go Backend Core**: [go-backend/cmd/api/main.go](go-backend/cmd/api/main.go)
- **Helm Templates**: [charts/irrexplorer](charts/irrexplorer)

---

## 💻 Running Locally

### Prerequisites

- Go `1.25+`
- Node.js `20 LTS`
- PostgreSQL `15+` with PostGIS extension
- Redis `7+`

### 1. Go Backend Scaffolding

```bash
cd go-backend
go test ./...
go run ./cmd/api
```

Required local environment (`.env`):
```env
DATABASE_URL=postgresql://irrexplorer:password@localhost:5432/irrexplorer
REDIS_URL=redis://localhost:6379/0
IRRD_ENDPOINT=https://rr.rxtx.nl/graphql/
ALLOWED_ORIGINS=http://localhost:5173
```

### 2. Redesigned Frontend (Tailwind + Vite)

Install the dependencies and start the local development dev server:
```bash
cd frontend
npm install
npm run dev
```

Build optimized chunk assets for production:
```bash
cd frontend
npm run build
```

### 3. Docker Compose (Recommended Orchestration)

To spin up backend, frontend, PostgreSQL, and Redis in local containers:
```bash
docker compose up -d
```
Access endpoints locally at:
- **Frontend Panel**: `http://localhost:8080`
- **Backend API Scaffolding**: `http://localhost:8080/api`

---

## ☸️ Cluster Deployment

Deployment to Kubernetes/Rancher uses the standard Helm charts defined in `charts/irrexplorer`:
- Redundant, code-split frontend Nginx servers and Go backend pods.
- PostGIS database and Redis configurations.
- Automatic database migration Job execution.
- Automated data import CronJobs.

Upgrade deployment via SSH on the target node:
```bash
export KUBECONFIG=/etc/rancher/rke2/rke2.yaml
helm upgrade irrexplorer /tmp/irrexplorer-deploy-{COMMIT}/charts/irrexplorer \
  -n irrexplorer --reuse-values --set frontend.image.tag={TAG}
```
*Note: Never commit local credentials or cluster values files.*

---

## 🔒 Documentation References

- [CHANGELOG.md](CHANGELOG.md) - Release history.
- [INSTALLATION.md](INSTALLATION.md) - Deep deployment manual.
- [DEVELOPMENT.md](DEVELOPMENT.md) - Custom workflows and mock-testing.
- [DATA_SOURCES.md](DATA_SOURCES.md) - Ingestion registries specifications.
- [ROADMAP.md](ROADMAP.md) - Future releases.

---

## 📄 License

Copyright © Stichting NLNOG. Source available on [GitHub](https://github.com/jskoetsier/irrexplorer).