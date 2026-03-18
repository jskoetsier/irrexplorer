# Changelog

All notable changes to IRRExplorer are documented here.

The format follows Keep a Changelog and the project uses Semantic Versioning.

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
