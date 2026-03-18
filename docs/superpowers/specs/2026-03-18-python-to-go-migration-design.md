# IRRExplorer: Python to Go Full Migration Design

**Date:** 2026-03-18
**Status:** Approved
**Goal:** Fully decommission the Python backend and run the entire IRRExplorer application in Go.

---

## Context

The Go backend (`go-backend/`) already exists and implements:
- Core read endpoints: `metadata`, `clean_query`, `prefixes/prefix`, `prefixes/asn`, `sets/member-of`, `sets/expand`
- Datasource endpoints: Looking Glass, RDAP, PeeringDB

Remaining Python-only territory:
- Redis caching
- Search/navigation (history, bookmarks, popular, trending, autocomplete)
- Analysis endpoints (RPKI dashboard, hijack detection, ROA coverage, etc.)
- Visualization endpoints (treemap, ASN graph, timeline, RIR distribution)
- Export/bulk query
- Importer (BGP + RIR stats)
- User/alerting system — **dropped entirely** (scaffolding only, never fully implemented)

---

## Approach: Incremental Migration (Strangler Pattern)

Both services run in Kubernetes simultaneously. The nginx ingress routes by path — Go handles endpoints it owns, Python handles the rest. Each phase extends the Go path list in the Helm chart (`goBackendPaths`). No frontend changes are needed at any point.

**Parity gate:** Before routing each phase's endpoints to Go, responses are verified against Python for identical JSON structure, status codes, and cache headers.

---

## Phase Plan

| Phase | Work | Python still handles |
|-------|------|----------------------|
| **1** | Redis caching on existing Go endpoints | Everything except core queries + datasources |
| **2** | Search/navigation (autocomplete, history, bookmarks, popular, trending) | Analysis, viz, export, importer |
| **3** | Analysis endpoints | Viz, export, importer |
| **4** | Visualization endpoints | Export, importer |
| **5** | Export + bulk query | Importer only |
| **6** | Importer rewrite in Go → decommission Python | Nothing |

---

## Phase 1: Redis Caching

**Library:** `redis/go-redis/v9`

**Cache key strategy:**

| Endpoint | TTL | Key format |
|----------|-----|------------|
| `/api/prefixes/prefix/{prefix}` | 5 min | `prefix:{normalized_prefix}` |
| `/api/prefixes/asn/{asn}` | 5 min | `asn:{asn_number}` |
| `/api/sets/expand/{target}` | 5 min | `set_expand:{target}` |
| `/api/sets/member-of/{class}/{target}` | 5 min | `member_of:{class}:{target}` |
| `/api/metadata/` | 1 min | `metadata` |
| `/api/autocomplete/{query}` | 1 min | `autocomplete:{query}` |
| Analysis endpoints | 5 min | `analysis:{endpoint}:{params}` |

**Design decisions:**
- Cache middleware wraps handlers: check Redis → on miss call handler → store result
- Values stored as gzipped JSON (memory efficient, consistent with Python)
- Cache-Control response headers preserved (`max-age=300` etc.)
- On Redis failure: log warning, serve uncached — never fail the request
- Multi-instance safe: Redis is the shared cache, no local in-memory state

**Code location:** `internal/cache/redis.go` — thin wrapper with `Get(ctx, key)` and `Set(ctx, key, value, ttl)`, injected into handlers via the existing interface pattern.

---

## Phase 2: Search & Navigation

Session-based using a `session_id` cookie. Direct PostgreSQL reads/writes, no external dependencies.

| Endpoint | Method | Table |
|----------|--------|-------|
| `/api/autocomplete/{query}` | GET | `query_stats` (fuzzy match) |
| `/api/search-history` | GET | `search_history` |
| `/api/search-history` | POST | `search_history` |
| `/api/search-history/clear` | DELETE | `search_history` |
| `/api/bookmarks` | GET | `bookmarks` |
| `/api/bookmarks` | POST | `bookmarks` |
| `/api/bookmarks/{id}` | DELETE | `bookmarks` |
| `/api/popular` | GET | `query_stats` |
| `/api/trending` | GET | `query_stats` (last 24h) |

**Code location:** `internal/navigation/`

---

## Phase 3: Analysis Endpoints

All aggregate data from the database or existing external clients (IRRd, RDAP). No new dependencies.

| Endpoint | Data source |
|----------|-------------|
| `/api/analysis/rpki-dashboard` | `bgp` table grouped by rpki_status |
| `/api/analysis/hijack-detection` | `bgp` where rpki_status = INVALID |
| `/api/analysis/roa-coverage` | `bgp` + IRRd GraphQL |
| `/api/analysis/irr-consistency` | `bgp` + IRRd GraphQL |
| `/api/analysis/prefix-overlap` | `bgp` CIDR containment query |
| `/api/analysis/as-path` | IRRd GraphQL |
| `/api/analysis/whois` | Delegates to existing RDAP datasource |

**Code location:** `internal/analysis/`

---

## Phase 4: Visualization Endpoints

Pure database aggregation queries, feeding JSON to frontend charts.

| Endpoint | Query |
|----------|-------|
| `/api/viz/prefix-allocation` | `rirstats` grouped by RIR |
| `/api/viz/asn-relationships/{asn}` | `bgp` join, limited depth traversal |
| `/api/viz/timeline` | `query_stats` time series |
| `/api/viz/rir-distribution` | `rirstats` counts |
| `/api/viz/prefix-distribution` | `bgp` grouped by prefix length |

**Code location:** `internal/visualization/`

---

## Phase 5: Export & Bulk Query

- **CSV/JSON export:** Marshal existing query results into alternate formats
- **Bulk query:** Fan-out up to 100 parallel prefix/ASN queries using `errgroup`
- **PDF export:** Placeholder returning 501 (matches current Python behaviour)

**Code location:** `internal/export/`

---

## Phase 6: Importer Rewrite

The importer runs as a Kubernetes CronJob, populating `bgp_staging` → `bgp` and `rirstats`.

**What it does:**
1. Downloads `bgp.tools/table.jsonl` — one JSON line per BGP route with RPKI status
2. Bulk-inserts into `bgp_staging`, then atomic swap into `bgp` (truncate + copy)
3. Downloads RIR delegation files from 6 endpoints (APNIC, ARIN, RIPE, LACNIC, AFRINIC, Registro.br)
4. Parses each file's format, inserts into `rirstats`
5. Updates `last_data_import` timestamp

**Code structure:**
```
internal/importer/
  bgp.go        # Download + parse bgp.tools JSONL, bulk insert via COPY protocol
  rirstats.go   # Download + parse RIR delegation files
  runner.go     # Orchestration: run both, update timestamp, handle errors
cmd/importer/
  main.go       # Entrypoint — runs once and exits (CronJob pattern)
```

**Key design decisions:**
- `pgx` `COPY FROM` for bulk inserts — handles millions of BGP routes efficiently
- Streaming JSONL parse — line-by-line, no full file in memory
- Staging swap is a single transaction: `TRUNCATE bgp; INSERT INTO bgp SELECT * FROM bgp_staging`
- RIR files downloaded concurrently with `errgroup`, parsed sequentially per file
- On partial failure: log error, continue with other sources, still update timestamp
- Same Docker image as the API server, different entrypoint

**Helm change:** `importer` CronJob and `importer-bootstrap-job` switch from Python container to Go binary.

---

## Decommission (End of Phase 6)

**Removed from repo:**
- `irrexplorer/` Python package
- `Dockerfile` (Python backend)
- `requirements.txt`, `requirements-dev.txt`, `pyproject.toml`
- `alembic.ini` + `irrexplorer/storage/migrations/`
- `scripts/import_data_cron.sh`
- `pytest.ini`, `tests/` (Python)
- Python CI jobs from `.github/workflows/ci.yml`
- `backend` section from Helm chart (values, deployment, service templates)

**Database cleanup** — final Go migration drops the user/alerting tables:
- `bgp_users`, `user_emails`, `user_monitored_asns`
- `alert_configurations`, `bgp_alert_events`, `system_config`

**Migration tooling:** `golang-migrate` with file-based SQL migrations in `db/migrations/`, replacing Alembic.

**What remains:** Go service, frontend, Helm chart (`goBackend` becomes the primary backend), PostgreSQL schema (minus dropped tables).

---

## Go Code Structure (Final State)

```
go-backend/
  cmd/
    api/main.go           # HTTP server entrypoint
    importer/main.go      # Importer entrypoint
  internal/
    cache/                # Redis caching middleware
    config/               # Env var loading
    httpapi/              # HTTP router + handlers
    domain/               # Shared types and report logic
    irrd/                 # IRRd GraphQL client
    store/                # PostgreSQL queries
    datasources/          # RDAP, PeeringDB, Looking Glass
    navigation/           # Search/nav handlers + DB queries
    analysis/             # Analysis handlers
    visualization/        # Viz handlers
    export/               # Export + bulk query
    importer/             # BGP + RIR stats import
  db/
    migrations/           # SQL migration files (golang-migrate)
```

---

## Non-Goals

- User authentication and alerting system (dropped)
- Any changes to the frontend
- Schema changes during Phases 1–5
- Replacing PostgreSQL or Redis

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Behaviour drift in prefix normalization | Parity tests against live Python before each phase cutover |
| CIDR query semantics mismatch | Integration tests with real PostgreSQL |
| BGP importer memory usage on large files | Streaming parse, never load full file |
| Partial RIR source failure corrupting data | Per-source error isolation, staging swap only after all sources succeed |
| Redis unavailability | Graceful degradation — serve uncached, never return 5xx |
