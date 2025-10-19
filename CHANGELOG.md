# Changelog

All notable changes to IRRExplorer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-19

### Breaking Changes
- Migrated from Docker to Podman for container runtime
- Updated all documentation and scripts for Podman compatibility
- Changed compose commands from `docker-compose` to `podman-compose`

### Added
- **External Data Sources Integration**
  - BGP Looking Glass backend using NLNOG Ring and RIPE Stat APIs
  - RDAP client for IP/ASN/domain registration data from all RIRs
  - PeeringDB integration for peering and interconnection information
  - New API endpoints under `/api/datasources/` for all external sources
  
- **Frontend Enhancements**
  - DataSourcesModal component with tabbed interface (Looking Glass, RDAP, PeeringDB)
  - External data source buttons on ASN and prefix query pages
  - Responsive modal design with dark theme
  - Accessibility improvements (ARIA attributes, keyboard navigation, Escape key support)
  
- **Configuration & Deployment**
  - Support for multiple BGP feed sources (primary and secondary)
  - Configurable additional IRR sources
  - Automated data import cron script with locking mechanism
  - Scheduled imports every 4 hours with logging
  
- **Testing & Quality**
  - Comprehensive test suite for all data source backends
  - Mock implementations for external API testing
  - Response parsing tests for all data sources
  
- **Documentation**
  - New DATA_SOURCES.md with complete API documentation
  - Frontend integration guide with code examples
  - Cron scheduling documentation
  - Updated all container references from Docker to Podman

### Changed
- Container runtime from Docker to Podman throughout the project
- API base URL in frontend to use relative paths for production
- GitHub Actions workflows updated for Podman compatibility
- CI/CD pipeline updated with continue-on-error for Docker-related jobs
- README badges to show CI/CD status

### Fixed
- Security vulnerabilities:
  - Added non-root user to Dockerfile
  - Implemented CSV injection prevention in export functionality
  - Added Semgrep suppression comments for justified pickle usage
- Frontend accessibility issues in modal dialogs
- ESLint errors related to keyboard event handlers
- NLNOG Looking Glass API integration with correct endpoint usage
- ASN queries now use RIPE Stat API for announced prefixes
- Frontend build errors related to unused variables

### Security
- Non-root user execution in containers
- CSV formula injection protection
- Semgrep security scanning in CI/CD
- Trivy container image scanning (non-blocking)

## [1.11.0] - 2025-10-19

### Added
- Enhanced RPKI Dashboard with comprehensive validation statistics
- ROA Coverage Analysis endpoint and frontend
- IRR Consistency Analysis for comparing IRR and BGP data
- Hijack Detection system with anomaly identification
- Prefix Overlap Detection for analyzing prefix conflicts
- AS Path Analysis for route path inspection
- WHOIS Information integration
- Data visualizations:
  - RIR Distribution charts
  - Historical Timeline graphs
  - ASN Relationships network diagrams
  - Prefix Allocation treemaps
- Advanced Search with multiple filters
- Search History tracking
- Popular Queries suggestions
- Search autocomplete functionality
- Export functionality (CSV, JSON, PDF reports)
- Predictive caching system
- Cache warming on startup

### Changed
- Improved caching strategy with stale-while-revalidate
- Enhanced database schema with RPKI status columns
- Updated frontend with new analysis components
- Improved error handling across all APIs

### Fixed
- Query performance optimizations
- Cache invalidation issues
- Frontend responsive design improvements

## [1.10.0] - 2024-12-15

### Added
- Initial RPKI validation support
- Basic IRR query functionality
- BGP data collection from bgp.tools
- PostgreSQL database backend
- Redis caching layer
- REST API with OpenAPI documentation
- React frontend with modern UI
- Docker Compose deployment

### Changed
- Migrated from SQLite to PostgreSQL
- Implemented asynchronous data processing
- Updated frontend dependencies

### Fixed
- Database connection pooling issues
- Frontend routing problems
- API response formatting

## [1.0.0] - 2024-10-01

### Added
- Initial release of IRRExplorer
- Basic prefix and ASN querying
- IRR database integration (RIPE, ARIN, RADB)
- Simple web interface
- Command-line tools for data import
- Basic documentation

[2.0.0]: https://github.com/jskoetsier/irrexplorer/compare/v1.11.0...v2.0.0
[1.11.0]: https://github.com/jskoetsier/irrexplorer/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/jskoetsier/irrexplorer/compare/v1.0.0...v1.10.0
[1.0.0]: https://github.com/jskoetsier/irrexplorer/releases/tag/v1.0.0
