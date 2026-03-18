# Go Backend Migration Plan

## Goal

Migrate the IRRExplorer backend from Python to Go without breaking the existing frontend, database schema, or deployed Helm-based runtime.

The migration should:

- preserve the current HTTP API contracts consumed by the React frontend
- preserve PostgreSQL as the system of record
- preserve Redis-backed caching where it adds value
- keep deployment compatible with the current Helm chart
- allow incremental rollout and rollback

The migration should **not** start as a full rewrite. The safest path is a staged replacement of the read API first, followed by optional migration of import/ETL jobs.

## Current Backend Shape

The current Python backend is not just an HTTP wrapper. It combines API routing, data aggregation, background warming, external lookups, and import jobs.

Primary entrypoints and responsibilities:

- [irrexplorer/app.py](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/irrexplorer/app.py)
  Registers all routes, middleware, lifespan hooks, DB connection pool, and startup cache warming.
- [irrexplorer/api/queries.py](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/irrexplorer/api/queries.py)
  Implements core query endpoints like metadata, clean-query, prefix lookup, ASN lookup, and set expansion.
- [irrexplorer/api/collectors.py](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/irrexplorer/api/collectors.py)
  Contains the core business logic that merges IRR, BGP, and RIR data.
- [irrexplorer/backends/irrd.py](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/irrexplorer/backends/irrd.py)
  IRRd GraphQL client and result mapping.
- [irrexplorer/backends/bgp.py](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/irrexplorer/backends/bgp.py)
  BGP importer and local BGP query access.
- [irrexplorer/storage/tables.py](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/irrexplorer/storage/tables.py)
  PostgreSQL schema definitions, including CIDR columns and GIST indexes.
- [irrexplorer/commands/import_data.py](/Users/sebastiaan.koetsier/dev/projects/irrexplorer/irrexplorer/commands/import_data.py)
  Import orchestration for BGP and RIR data.

## Migration Strategy

Use a **strangler** pattern:

1. Keep the Python backend in production.
2. Introduce a Go service that implements a small subset of endpoints.
3. Route selected endpoints to Go while Python continues serving the rest.
4. Compare behavior continuously.
5. Cut over only when parity is proven.

This avoids a high-risk “rewrite and switch” event.

## What Should Move First

Start with the read-only endpoints that have the highest value and clearest contracts:

1. `GET /api/metadata/`
2. `GET /api/clean_query/{query}`
3. `GET /api/prefixes/prefix/{prefix}`
4. `GET /api/prefixes/asn/{asn}`
5. `GET /api/sets/member-of/{...}`
6. `GET /api/sets/expand/{target}`

These endpoints cover the core product behavior and most of the frontend-critical routing flows.

Do **not** start with:

- import jobs
- auth/user management tables
- export/pdf endpoints
- analytics endpoints with unclear correctness value
- background predictive caching

Those can follow once the core query path is stable.

## Proposed Go Architecture

Recommended stack:

- Router: `chi`
- PostgreSQL: `pgxpool`
- Redis: `go-redis`
- External HTTP: standard `net/http` with tuned transport
- GraphQL: direct HTTP client or a small GraphQL helper
- Config: environment variables
- Logging: structured JSON logger
- Metrics: Prometheus-compatible `/metrics`

Suggested package layout:

```text
go-backend/
  cmd/api/
  internal/httpapi/
  internal/config/
  internal/db/
  internal/cache/
  internal/domain/
  internal/collectors/
  internal/irrd/
  internal/bgp/
  internal/rirstats/
  internal/rdap/
  internal/peeringdb/
  internal/lookingglass/
  internal/testing/
```

Suggested ownership:

- `internal/httpapi`: handlers, request validation, response encoding
- `internal/domain`: core types mirroring current response models
- `internal/collectors`: orchestration and merge logic now found in Python collectors
- `internal/db`: SQL access and transaction helpers
- `internal/irrd` and peers: remote source clients

## API Contract Rules

The Go service must preserve:

- route paths
- path parameter formats
- query parameter behavior
- JSON field names
- HTTP status codes
- cache headers where currently present
- case conventions such as uppercase RPKI statuses from the API contract

The frontend should not need changes to consume the Go backend.

Before implementation, extract contract fixtures from the current Python service for:

- successful responses
- empty responses
- invalid input responses
- external dependency failure behavior

## Database Strategy

Keep the existing PostgreSQL schema.

Reasons:

- schema migration is not the main problem
- the code relies on PostgreSQL CIDR behavior
- GIST indexes already exist for prefix lookups
- dual-running Python and Go against one schema is much simpler than dual migration

Rules for the Go implementation:

- do not change table names during phase 1
- preserve CIDR query semantics exactly
- prefer explicit SQL over ORM abstraction
- benchmark prefix containment and overlap queries early

Recommended approach:

- use `pgxpool`
- write SQL directly or use `sqlc`
- add repository tests against a real Postgres instance

## Redis and Caching Strategy

Do not attempt to clone every Python caching behavior on day one.

Phase 1 caching rules:

- implement request-level caching only where it materially reduces remote dependency cost
- preserve externally visible cache headers
- keep cache key structure simple and explicit
- make cache failure non-fatal

Startup cache warming should be postponed unless profiling shows it is necessary.

## External Dependency Migration

### IRRd

This is one of the highest-risk integrations.

Current behavior in Python:

- GraphQL queries for last-update, ASN routes, prefix matches, set members, and member-of
- response translation into internal route types
- graceful degradation on endpoint failure

Go requirements:

- support `IRRD_ENDPOINT`
- implement timeouts and context cancellation
- preserve failure mode of returning empty results instead of cascading 500s where appropriate
- add integration tests against a real IRRd endpoint and recorded fixtures

### BGP / RIRStats

The query side is straightforward. The importer side can stay in Python initially.

Recommendation:

- read from existing `bgp` and `rirstats` tables in Go first
- migrate importers only after the query API is stable

### RDAP / PeeringDB / Looking Glass

These are suitable for a second migration wave.

Recommendation:

- define interface boundaries early
- port one client at a time
- add circuit-breaker-like timeout handling

## Phased Delivery Plan

### Phase 0: Preparation

Deliverables:

- migration decision record
- API contract inventory
- endpoint priority list
- production traffic notes
- fixture set from the live Python service

Exit criteria:

- top 10 endpoints documented
- representative sample payloads captured
- error behavior documented

### Phase 1: Build Go Skeleton

Deliverables:

- Go service with health endpoint
- config loading
- PostgreSQL pool
- Redis client
- structured logging
- Prometheus metrics
- container image and Helm integration

Exit criteria:

- service deploys to existing cluster
- readiness/liveness work
- no production traffic yet

### Phase 2: Port Core Read Endpoints

Deliverables:

- `GET /api/metadata/`
- `GET /api/clean_query/{query}`
- `GET /api/prefixes/prefix/{prefix}`
- `GET /api/prefixes/asn/{asn}`

Exit criteria:

- parity tests green against Python fixtures
- smoke tests pass in Rancher
- response shape approved by frontend

### Phase 3: Port Set Logic

Deliverables:

- `GET /api/sets/member-of/...`
- `GET /api/sets/expand/{target}`
- recursion protection
- timeout protection
- circular reference handling

Exit criteria:

- set expansion parity on representative real-world datasets
- timeouts and empty-result behavior verified

### Phase 4: Partial Traffic Shift

Deployment pattern options:

- separate ingress paths routed to Go
- internal canary service
- endpoint-by-endpoint reverse proxy split

Recommended first cut:

- route only the migrated endpoints to Go
- leave all remaining endpoints on Python

Exit criteria:

- production latency acceptable
- no correctness regressions observed
- rollback verified

### Phase 5: Port Secondary APIs

Candidates:

- analysis endpoints
- datasource endpoints
- export endpoints

This phase should be driven by usage and operational value, not by completeness for its own sake.

### Phase 6: Decide on Importer Migration

Only migrate import jobs after the read API is stable in production.

Possible outcomes:

- keep importers in Python permanently
- migrate importers selectively
- build one Go worker binary for all import tasks

This should be a separate decision, not assumed upfront.

## Testing and Parity Plan

The migration will fail if parity is checked informally. It needs a dedicated comparison harness.

Required test layers:

### 1. Contract Fixtures

Capture Python responses for representative requests:

- normal prefix query
- empty prefix query
- ASN query
- invalid ASN
- invalid prefix
- set expansion with recursion
- metadata response with IRRD available
- metadata response with IRRD unavailable

### 2. Golden Response Tests

Run the same requests against Go and compare:

- status code
- headers that matter
- JSON field set
- data type shapes

For fields like timestamps where exact values may vary, compare structurally.

### 3. Database Integration Tests

Use a real Postgres instance seeded with fixture data to validate:

- CIDR containment
- overlap behavior
- aggregation assumptions
- index-backed query performance

### 4. End-to-End Tests

Run the frontend against both backends and check:

- prefix page renders
- ASN page renders
- modal lookups still work
- no shape mismatch breaks the TypeScript client

## Rollout and Deployment

The current Helm chart already gives a path for side-by-side deployment.

Recommended chart approach:

- keep existing Python deployment
- add a separate Go backend deployment and service
- route only selected paths to the Go service
- keep per-service probes and metrics independent

Traffic shift options:

1. ingress path split
2. nginx backend split
3. frontend-configured alternate API base for testing only

Best option here is ingress or reverse-proxy path split, because the frontend stays unchanged.

## Rollback Plan

Rollback must be trivial:

- revert ingress/path routing to Python only
- keep Go deployment running or scale to zero
- do not run destructive schema changes during early phases

If the Go service introduces schema changes before parity is established, rollback becomes harder than necessary. Avoid that.

## Main Risks

### 1. Behavior Drift

The biggest risk is not syntax. It is subtle behavior drift in:

- prefix normalization
- set expansion semantics
- ordering of aggregated results
- empty-result vs error-result handling
- RPKI status casing and null behavior

### 2. CIDR Query Mismatch

If the Go implementation gets PostgreSQL CIDR querying slightly wrong, results will look plausible but be incorrect.

### 3. External Dependency Failure Modes

The Python service already needed hardening around IRRd availability. The Go service must preserve resilience under:

- DNS failures
- remote timeouts
- partial remote responses

### 4. Over-Migration

Trying to migrate the API, importers, analytics, and deployment model all at once is the highest-probability failure mode.

## Recommended Sequence for This Repo

Concrete order for this codebase:

1. Document current JSON contracts for core query endpoints.
2. Stand up `go-backend` as a second service in the Helm chart.
3. Implement Go versions of:
   - `/api/metadata/`
   - `/api/clean_query/{query}`
   - `/api/prefixes/prefix/{prefix}`
   - `/api/prefixes/asn/{asn}`
4. Add parity tests against captured Python fixtures.
5. Route only those endpoints to Go in a test environment.
6. Run side-by-side validation in Rancher.
7. Port set endpoints.
8. Reassess whether the remaining APIs should move at all.

## Recommendation

Proceed only if the goal is one of these:

- lower memory footprint
- simpler static binaries
- tighter concurrency control
- stronger type discipline around the API layer

Do not proceed if the assumption is that Go will automatically simplify the domain logic. It will not. The collector and routing-analysis behavior is the expensive part, and that complexity survives the language change.

The migration is reasonable if it is scoped as:

- read API first
- importer jobs later or never
- schema unchanged
- frontend unchanged
- parity enforced with tests

## Suggested Immediate Next Steps

1. Create a `go-backend/` skeleton with health, config, logging, and Postgres connectivity.
2. Extract response fixtures from the current Python endpoints.
3. Add the Go service to the Helm chart as a non-routed deployment.
4. Implement the first two endpoints:
   - `/api/metadata/`
   - `/api/clean_query/{query}`
5. Add a parity test harness before implementing the collector-heavy endpoints.

