# Changelog

All notable changes to IRRExplorer are documented here.

The format follows Keep a Changelog and the project uses Semantic Versioning.

## [Unreleased]

## [2.5.0] - 2026-05-12

### Changed

- Single database pool shared across all subsystems instead of three independent connections
- `NewServer` now returns error on failure instead of silently starting in degraded state
- Replaced per-prefix goroutine farm in `QueryPrefixesAny` with single `unnest()` CTE query per table
- Split monolithic `router.go` into per-feature files (`prefix.go`, `asn.go`, `sets.go`, `datasources_*.go`, `caching.go`)
- Extracted shared `writeJSON` into `internal/httputil` package, deleted three copies
- ASN fields widened to `int64` across all domain types, stores, IRRd client, and datasources to support 4-byte ASNs
- Replaced hand-rolled `containsInt`/`containsString` helpers with `slices.Contains`
- Rate limiter uses `net.SplitHostPort` for correct IPv6 address extraction
- `PrefixSummary` JSON marshaling uses type-alias pattern instead of field-duplicated struct
- Frontend error handling distinguishes 4xx/5xx/network errors; replaced deprecated `CancelToken` with `AbortController`
- Go module path corrected from `github.com/sebastiaan/irrexplorer` to `gitlab.int.koetsier.org/sebas/irrexplorer`

### Fixed

- Cache-hit responses in analysis and visualization handlers were double-encoded (JSON-in-JSON); now write raw bytes directly
- RIR import failures were silently swallowed; now surface as errors and exposed via per-RIR freshness in `/api/metadata/`

### Removed

- Navigation package (`bookmarks`, `history`, `popular`, `trending`) — no database schema or UI wiring existed; handlers always returned 500
- Dead redirect handlers (`asPath`, `whois`, `advancedSearch`) from analysis routes
- `prefixSortKey*` fields from API wire format — sorting is handled server-side
- Stale project files: `GO_BACKEND_MIGRATION.md`, `PHASE_SUMMARY.md`, `TEST_ISSUES.md`, `install.sh`

## [2.4.0] - 2026-03-19

### Added

- Redis caching for IRRd GraphQL queries to dramatically improve performance for large ASNs (e.g., AS 2914)
- Cache individual prefix queries with 5-minute TTL
- Cache ASN queries with 10-minute TTL
- Cache member-of and set member queries
- Graceful fallback to direct IRRd queries when Redis is unavailable
- Database index `ix_bgp_asn` on BGP table ASN column for faster queries
- Pagination support to Go backend ASN queries (limit/offset parameters)
- 5000 result limit for IRRd GraphQL queries to prevent timeouts

### Fixed

- Fixed "No route objects match DFZ origin" error caused by incomplete ASN query optimization
- Fixed frontend table rendering issues with "Show All" button for datasets over 500 rows

## [2.3.1] - 2026-03-19

### Fixed

- white screen on ASN query pages caused by null `bgpOrigins`, `rpkiRoutes`, `irrRoutes`, and `messages` fields in API responses crashing the prefix table renderer
- nginx proxy upstream still pointing to the removed Python backend service (`irrexplorer-backend:8000`), causing new frontend pods to CrashLoopBackOff after the Go migration; updated to `irrexplorer-go-backend:8080`
- Go importer failing to create the BGP staging GIST index when it already existed from a previous import cycle; now drops the index before recreating
- Go importer receiving zero BGP rows because bgp.tools rejects the default Go User-Agent; set a descriptive `User-Agent` header
- Go importer silently discarding every BGP line because the JSON struct tags (`prefix`/`asn`) did not match the bgp.tools field names (`CIDR`/`ASN`)
- RIR stats import failing on PostgreSQL enum mismatch; map keys now use the database enum values (`RIPENCC`, `REGISTROBR`) instead of human-readable names
- `.gitignore` pattern `importer` inadvertently ignoring the `internal/importer` directory; anchored with leading `/`

## [2.3.0] - 2026-03-18

### Added

- Helm chart for redundant Rancher/Kubernetes deployment
- bundled migration job, importer bootstrap job, and recurring importer `CronJob`
- side-by-side Go backend under `go-backend/`
- Go implementations for core read APIs including metadata, clean query, prefix, ASN, sets, and datasource paths
- Go migration design document

### Changed

- normalized project versioning to `2.3.0` across Python package, frontend package, and Helm chart
- switched production IRRD integration away from the dead `irrd.nlnog.net` endpoint to `rr.ntt.net`
- updated frontend metadata handling to match the backend response shape
- updated frontend branding to the new IRRExplorer logo with consistent cross-page sizing
- improved importer observability with explicit import-stage logging

### Fixed

- Bootstrap race between async Bootstrap loading and modal initialization
- frontend RPKI rendering mismatch caused by lowercase status checks against uppercase API values
- broken frontend analyze script
- empty datasource timestamps on the status page caused by frontend field mismatch

### Notes

- The Go backend is not the default production API yet; migration is still incremental.
- Production BGP import scheduling is now represented in the Helm chart instead of relying on manual execution.

## [2.2.0] - 2025-10-21

### Removed

- Routinator RPKI validation service and related deployment plumbing

### Changed

- reduced container footprint
- simplified deployment architecture

## [2.1.0] - 2025-10-21

### Removed

- BGPalerter integration and related authentication, administration, and alerting surface

### Changed

- streamlined the application around routing exploration instead of monitoring workflows

## [2.0.0] - 2025-10-19

### Added

- datasource integrations for Looking Glass, RDAP, and PeeringDB
- richer frontend integrations for datasource exploration
- scheduled import support and supporting documentation

### Changed

- container runtime and operational guidance moved toward Podman-based deployment

### Fixed

- multiple frontend, integration, and security issues around modal behavior, API usage, and deployment hardening

## [1.11.0] - 2025-10-19

### Added

- analysis features, visualizations, export functionality, query history, and caching improvements

## [1.10.0] - 2024-12-15

### Added

- initial RPKI support
- PostgreSQL and Redis-backed application stack
- React frontend and REST API

## [1.0.0] - 2024-10-01

### Added

- initial release
