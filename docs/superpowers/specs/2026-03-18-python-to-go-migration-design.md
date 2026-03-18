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
- Redis caching (Python stores values as pickle; Go will use gzipped JSON — see cache namespace note below)
- Search/navigation (history, bookmarks, popular, trending, autocomplete)
- Advanced search and filter options
- Analysis endpoints (RPKI dashboard, hijack detection, ROA coverage, etc.)
- Visualization endpoints (treemap, ASN graph, timeline, RIR distribution)
- Export/bulk query
- Cache admin endpoints
- OpenAPI/Swagger docs
- Importer (BGP + RIR stats)
- User/alerting system — **dropped entirely** (scaffolding only, never fully implemented)
- `bgpalerter_management.py` — **dropped** (no routes registered, dead code)
- Predictive/background cache prefetching (`predictive_caching.py`) — **dropped** (cold cache warm-up acceptable trade-off)

---

## Approach: Incremental Migration (Strangler Pattern)

Both services run in Kubernetes simultaneously. The nginx ingress routes by path — Go handles endpoints it owns, Python handles the rest. Each phase extends the Go path list in the Helm chart (`goBackendPaths`). No frontend changes are needed at any point.

**Parity gate:** Before routing each phase's endpoints to Go, responses are verified against Python for identical JSON structure, status codes, and cache headers.

**Cache namespace isolation:** Python serialises cache values with pickle; Go uses gzipped JSON. These formats are incompatible. To prevent cross-service cache corruption during the dual-service overlap, all Go cache keys are prefixed with `go:` (e.g. `go:prefix:{normalized_prefix}`). When a phase is fully cut over to Go, a one-time Redis flush of the corresponding Python key pattern is performed. After Phase 6 (full cutover), the `go:` prefix can be dropped in a follow-up cleanup.

---

## Phase Plan

| Phase | Work | Python still handles |
|-------|------|----------------------|
| **1** | Redis caching + CORS middleware + rate limiting on Go service | Everything except core queries + datasources |
| **2** | Search/navigation (autocomplete, history, bookmarks, popular, trending) | Analysis, viz, export, importer |
| **3** | Analysis endpoints + advanced search + filter options | Viz, export, importer |
| **4** | Visualization endpoints | Export, importer |
| **5** | Export + bulk query + OpenAPI docs + cache admin | Importer only |
| **6** | Importer rewrite in Go → decommission Python | Nothing |

---

## Phase 1: Redis Caching, CORS & Rate Limiting

### Redis Caching

**Library:** `redis/go-redis/v9`

**Cache key strategy** (all keys prefixed with `go:` during migration):

| Endpoint | TTL | Key format |
|----------|-----|------------|
| `/api/prefixes/prefix/{prefix}` | 5 min | `go:prefix:{normalized_prefix}` |
| `/api/prefixes/asn/{asn}` | 5 min | `go:asn:{asn_number}` |
| `/api/sets/expand/{target}` | 5 min | `go:set_expand:{target}` |
| `/api/sets/member-of/{class}/{target}` | 5 min | `go:member_of:{class}:{target}` |
| `/api/metadata/` | 1 min | `go:metadata` |
| `/api/autocomplete/{query}` | 1 min | `go:autocomplete:{query}` |
| Analysis endpoints | 5 min | `go:analysis:{endpoint}:{params}` |
| `/api/viz/prefix-allocation` | 60 min | `go:viz:prefix-allocation` |
| `/api/viz/rir-distribution` | 60 min | `go:viz:rir-distribution` |
| `/api/viz/prefix-distribution` | 60 min | `go:viz:prefix-distribution` |
| `/api/viz/asn-relationships/{asn}` | 30 min | `go:viz:asn-relationships:{asn}` |
| `/api/viz/timeline` | 15 min | `go:viz:timeline` |

**Design decisions:**
- Cache middleware wraps handlers: check Redis → on miss call handler → store result
- Values stored as gzipped JSON
- Cache-Control response headers preserved (`max-age=300` etc.)
- On Redis failure: log warning, serve uncached — never fail the request
- Multi-instance safe: Redis is the shared cache, no local in-memory state

**Code location:** `internal/cache/redis.go` — thin wrapper with `Get(ctx, key)` and `Set(ctx, key, value, ttl)`, injected into handlers via the existing interface pattern.

### CORS Middleware

Required pre-condition for Phase 2 which introduces `POST` and `DELETE` endpoints. Go has no CORS middleware today.

The Python config only allows `GET, OPTIONS` and headers `Cache-Control, Pragma, Expires`. The Go config intentionally expands this to support the new write endpoints being added in Phase 2 onwards:

- **Allowed origins:** `allowedOrigins` Helm value (unchanged)
- **Allowed methods:** `GET, POST, DELETE, OPTIONS` — **expanded** from Python's `GET, OPTIONS`
- **Allowed headers:** `Cache-Control, Pragma, Expires, Content-Type` — **`Content-Type` added** for POST request bodies
- **Max age:** 3600 seconds
- Handles preflight `OPTIONS` requests

**Code location:** `internal/middleware/cors.go`

### Rate Limiting

Mirror Python's `slowapi` configuration: 100 requests/minute per IP.

- **Library:** `golang.org/x/time/rate` with a per-IP `sync.Map` of limiters
- Applies to all routes
- Returns `429 Too Many Requests` with `Retry-After` header on breach
- On limiter map size: evict entries older than 5 minutes to prevent unbounded growth

**Code location:** `internal/middleware/ratelimit.go`

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

## Phase 3: Analysis, Advanced Search & Filter Options

### Analysis Endpoints

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

### Advanced Search & Filter Options

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/advanced-search` | GET | Calls `clean_query`, dispatches to prefix/ASN/set handlers, filters by RPKI/IRR status |
| `/api/filter-options` | GET | Returns valid filter vocabulary consumed by frontend |

**Code location:** `internal/analysis/` (alongside analysis handlers, same domain)

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

## Phase 5: Export, Bulk Query, OpenAPI & Cache Admin

### Export & Bulk Query

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/export/csv` | POST | Marshal query results to CSV |
| `/api/export/json` | POST | Marshal query results to JSON |
| `/api/export/pdf` | POST | Returns `501 Not Implemented` (matches Python) |
| `/api/bulk-query` | POST | Fan-out up to 100 parallel prefix/ASN queries |

**Note on bulk-query semantics:** The Python implementation returns stub/placeholder responses. The Go implementation upgrades this to real parallel fan-out using `errgroup`, which is a deliberate behavioural improvement over the Python baseline.

### OpenAPI / Swagger

- `/api/docs/openapi.json` — hand-maintained OpenAPI 3.0 JSON schema describing all Go endpoints
- `/api/docs` — Swagger UI served via embedded `swaggerui` static files

**Library:** `swaggest/rest` or hand-rolled schema; no code generation required.

### Cache Admin

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/cache/stats` | GET | Redis INFO + key count for `go:*` namespace |
| `/api/cache/clear` | GET | Flushes all `go:*` keys (not full FLUSHALL) |

Both endpoints are unauthenticated (matching Python). Restrict via network policy or ingress annotation if needed post-decommission.

**Code location:** `internal/export/`, `internal/cache/admin.go`

---

## Phase 6: Importer Rewrite

The importer runs as a Kubernetes CronJob, populating `bgp_staging` → `bgp` and `rirstats`.

**What it does:**
1. Downloads `bgp.tools/table.jsonl` — one JSON line per BGP route with RPKI status
2. Streams into `bgp_staging` via `COPY FROM`, then atomic swap into `bgp`
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
- **Staging swap** uses table rename for lock-minimal atomicity. The GIST index on `prefix` must be built on `bgp_staging` *before* the rename — this is the long-running operation (minutes for millions of rows), not the rename itself:
  ```sql
  -- After all rows are loaded into bgp_staging:
  CREATE INDEX ix_bgp_staging_prefix ON bgp_staging USING GIST (prefix inet_ops);

  -- Atomic swap (metadata-only lock, microseconds):
  BEGIN;
  ALTER TABLE bgp RENAME TO bgp_old;
  ALTER TABLE bgp_staging RENAME TO bgp;
  CREATE TABLE bgp_staging (LIKE bgp INCLUDING ALL);  -- fresh staging for next run
  COMMIT;

  -- Drop old table outside transaction (non-blocking):
  DROP TABLE bgp_old;
  ```
  The live `bgp` table (formerly `bgp_staging`) enters production with its GIST index already built. Query latency is unaffected during the swap window.
- RIR files downloaded concurrently with `errgroup`, parsed sequentially per file
- On partial failure: log error, continue with other sources, update timestamp only if BGP import succeeded
- Same Docker image as the API server, different entrypoint

**Helm change:** `importer` CronJob and `importer-bootstrap-job` switch from Python container to Go binary.

---

## Decommission (End of Phase 6)

**Removed from repo:**
- `irrexplorer/` Python package (includes `bgpalerter_management.py`, `predictive_caching.py`)
- `Dockerfile` (Python backend)
- `requirements.txt`, `requirements-dev.txt`, `pyproject.toml`
- `alembic.ini` + `irrexplorer/storage/migrations/`
- `scripts/import_data_cron.sh`
- `pytest.ini`, `tests/` (Python)
- Python CI jobs from `.github/workflows/ci.yml`

**Helm chart changes:**
- Remove top-level `backend` key entirely from `values.yaml` (keys: `backend.replicaCount`, `backend.image`, `backend.service`, `backend.resources`, `backend.command`, `backend.extraEnv`)
- Remove `charts/irrexplorer/templates/backend-deployment.yaml`
- Remove `charts/irrexplorer/templates/backend-service.yaml`
- `goBackend.enabled` defaults to `true`; `goBackendPaths` removed (Go is now the only backend, ingress routes everything to it)

**Database cleanup** — final Go migration (`db/migrations/`) drops the user/alerting tables:
- `bgp_users`, `user_emails`, `user_monitored_asns`
- `alert_configurations`, `bgp_alert_events`, `system_config`

**Retained tables** (not dropped):
- `bgp`, `bgp_staging` — core routing data, used by importer and API
- `rirstats` — RIR delegation data, used by importer and viz endpoints
- `last_data_import` — importer timestamp, used by Go metadata endpoint
- `search_history`, `bookmarks`, `query_stats` — navigation/analytics data

**Redis cleanup** — after full cutover, remove `go:` key prefix: flush all keys and restart Go service (keys are regenerated on demand). This can be deferred.

**Migration tooling:** `golang-migrate` with file-based SQL migrations in `db/migrations/`, replacing Alembic.

**What remains:** Go service, frontend, Helm chart (`goBackend` as primary backend), PostgreSQL schema (minus dropped tables).

---

## Go Code Structure (Final State)

```
go-backend/
  cmd/
    api/main.go           # HTTP server entrypoint
    importer/main.go      # Importer entrypoint
  internal/
    cache/                # Redis caching middleware + admin
    config/               # Env var loading
    httpapi/              # HTTP router + handlers
    middleware/           # CORS + rate limiting
    domain/               # Shared types and report logic
    irrd/                 # IRRd GraphQL client
    store/                # PostgreSQL queries
    datasources/          # RDAP, PeeringDB, Looking Glass
    navigation/           # Search/nav handlers + DB queries
    analysis/             # Analysis + advanced search handlers
    visualization/        # Viz handlers
    export/               # Export + bulk query
    importer/             # BGP + RIR stats import
  db/
    migrations/           # SQL migration files (golang-migrate)
```

---

## Non-Goals

- User authentication and alerting system (dropped)
- Predictive/background cache prefetching (dropped)
- Any changes to the frontend
- Schema changes during Phases 1–5
- Replacing PostgreSQL or Redis

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Behaviour drift in prefix normalization | Parity tests against live Python before each phase cutover |
| CIDR query semantics mismatch | Integration tests with real PostgreSQL |
| Cache format incompatibility (pickle vs gzipped JSON) | `go:` key namespace isolation; flush Python keys on cutover per phase |
| BGP importer memory usage on large files | Streaming parse, never load full file |
| Partial RIR source failure corrupting data | Per-source error isolation; staging swap only after BGP import succeeds |
| Redis unavailability | Graceful degradation — serve uncached, never return 5xx |
| CORS misconfiguration breaking POST endpoints in Phase 2 | CORS middleware implemented and tested in Phase 1 before any POST routes are added |
| Rate limiter memory growth under traffic | Per-IP limiter eviction after 5 minutes inactivity |
| Table rename swap holding lock during high traffic | Rename is metadata-only; lock duration is microseconds regardless of table size |
