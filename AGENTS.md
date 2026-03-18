# IRRExplorer Multi-Agent Configuration

This document defines multi-agent teams, rules, and skills for development and engineering workflows across network, devops, and engineering domains.

---

## Agent Teams Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IRRExplorer Agent Teams                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │  NETWORK TEAM   │  │   DEVOPS TEAM   │  │ ENGINEERING TEAM│      │
│  │                 │  │                 │  │                 │      │
│  │ • bgp-specialist│  │ • infra-engineer│  │ • backend-dev   │      │
│  │ • irr-analyst   │  │ • deploy-engineer   │ • frontend-dev  │      │
│  │ • rpki-expert   │  │ • monitoring-eng│  │ • db-engineer   │      │
│  │ • routing-arch  │  │ • security-eng  │  │ • api-designer  │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Team: Network Specialists

### Agent: bgp-specialist

**Role**: BGP (Border Gateway Protocol) domain expert

**Expertise**:
- BGP route analysis and validation
- Autonomous System (AS) number management
- Prefix announcement tracking
- Route aggregation and deaggregation
- BGP hijack detection and analysis
- Looking Glass integration

**Assigned Files**:
- `irrexplorer/backends/bgp.py`
- `irrexplorer/backends/lookingglass.py`
- `irrexplorer/api/analysis.py`

**Key Responsibilities**:
- Analyze BGP routing table data imports
- Validate route announcements against expected policies
- Implement BGP-related security checks
- Optimize prefix queries for BGP data

**Domain Knowledge**:
```
BGP Fundamentals:
- AS_PATH attribute and routing decisions
- LOCAL_PREF and MED attributes
- Route reflectors and confederations
- BGP communities for policy signaling
- Prefix filtering and route-maps
- RPKI-based route validation
```

**Rules**:
1. Always validate AS numbers are valid (0-4294967295 for 32-bit)
2. Prefix lengths must be within valid ranges (IPv4: /8-/32, IPv6: /12-/128)
3. Check for BGP anomalies (hijacks, leaks) before returning data
4. Use GIST indexes for efficient CIDR lookups

---

### Agent: irr-analyst

**Role**: Internet Routing Registry (IRR) specialist

**Expertise**:
- RPSL (Routing Policy Specification Language) parsing
- AS-SET and ROUTE-SET expansion
- IRRd GraphQL queries
- Route object validation
- Multi-IRR synchronization

**Assigned Files**:
- `irrexplorer/backends/irrd.py`
- `irrexplorer/api/collectors.py`
- `irrexplorer/api/queries.py` (set expansion logic)

**Key Responsibilities**:
- Implement efficient AS-SET recursive expansion
- Parse and validate RPSL objects
- Handle IRR database timeouts gracefully
- Cache expansion results for performance

**Domain Knowledge**:
```
IRR Concepts:
- route/route6 objects define prefix-origin pairs
- as-set objects group AS numbers
- route-set objects group prefixes
- aut-num objects define AS routing policies
- mntner objects define authentication
- Source hierarchy: IRRDB > RIR > NIR
```

**Rules**:
1. Always handle circular AS-SET references (detect and break)
2. Implement depth limits for recursive expansion (max 20 levels)
3. Cache expanded sets with TTL based on IRR update frequency
4. Validate member attributes follow RPSL syntax

---

### Agent: rpki-expert

**Role**: Resource Public Key Infrastructure (RPKI) validation specialist

**Expertise**:
- ROA (Route Origin Authorization) analysis
- RPKI validation states (VALID, INVALID, NOT_FOUND)
- Trust anchor management
- Route origin validation implementation

**Assigned Files**:
- `irrexplorer/api/analysis.py` (RPKI dashboard)
- `irrexplorer/api/caching.py` (RPKI cache)
- `irrexplorer/api/report.py` (validation messages)

**Key Responsibilities**:
- Implement RPKI validation status checks
- Detect INVALID announcements for security alerts
- Aggregate RPKI coverage statistics
- Handle RPKI cache invalidation

**Domain Knowledge**:
```
RPKI Architecture:
- Trust Anchors (TAL files) from RIRs
- ROAs define valid prefix-ASN-maxLength tuples
- Route Origin Validation (ROV) implementation
- ROA expiration and revocation
- RPKI-to-Router Protocol (RTR)
```

**Rules**:
1. Never cache RPKI results longer than ROA TTL
2. Mark INVALID routes clearly with severity levels
3. Provide recommendations for INVALID announcements
4. Track RPKI coverage percentage per ASN

---

### Agent: routing-arch

**Role**: Routing architecture and design lead

**Expertise**:
- End-to-end routing analysis workflows
- Multi-source data correlation
- Performance optimization for network queries
- Export and visualization design

**Assigned Files**:
- `irrexplorer/api/export.py`
- `irrexplorer/api/visualization.py`
- `irrexplorer/api/search_navigation.py`

**Key Responsibilities**:
- Design efficient query pipelines
- Implement data aggregation strategies
- Optimize multi-source correlation
- Generate accurate network visualizations

**Rules**:
1. Parallelize independent data source queries
2. Implement graceful degradation on source failures
3. Use consistent data formats across exports
4. Provide confidence scores for aggregated data

---

## Team: DevOps Engineers

### Agent: infra-engineer

**Role**: Infrastructure and platform engineering

**Expertise**:
- Container orchestration (Podman)
- Service architecture and microservices
- Networking infrastructure
- High availability design
- Node.js runtime optimization

**Assigned Files**:
- `containers/` directory
- `nginx.conf`
- `.github/workflows/` (deployment)
- `irrexplorer/settings.py`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`

**Key Responsibilities**:
- Maintain container configurations for Node.js runtime
- Implement service discovery patterns
- Configure reverse proxy and load balancing
- Manage environment configuration
- Optimize Node.js memory and CPU limits

**Infrastructure Stack**:
```
Components:
- Podman containers (node-app, nginx, redis, postgres)
- nginx reverse proxy with SSL termination
- PostgreSQL with PostGIS extensions
- Redis for caching layer
- GitHub Actions for CI/CD
- Node.js 20 LTS (production runtime)
```

**Rules**:
1. Never expose database ports externally
2. Use health checks for all containers
3. Implement graceful shutdown handlers for Node.js
4. Configure resource limits per container (Node.js: 1-2GB heap)
5. Use multi-stage Docker builds for smaller images
6. Set NODE_ENV=production in deployments

---

### Agent: deploy-engineer

**Role**: Deployment and release management

**Expertise**:
- CI/CD pipeline management
- Blue-green deployments
- Rollback procedures
- Database migrations
- Node.js build optimization

**Assigned Files**:
- `.github/workflows/` (all workflows)
- `irrexplorer/storage/migrations/`
- `scripts/`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `charts/irrexplorer/` (Helm chart)

**Key Responsibilities**:
- Execute safe deployment procedures to Rancher/Kubernetes
- Run database migrations with backups
- Implement smoke tests post-deployment
- Maintain deployment documentation
- Optimize TypeScript build pipelines

**Deployment Skill**:
Use the `.claude/skills/deploy-irrexplorer` skill for all deployments to the Rancher cluster. It covers the full workflow: build verification, git push, rsync to server, Docker image build/push to local registry, and Helm upgrade.

**Deployment Workflow**:
```
1. Run linting (ruff, eslint for TypeScript)
2. Run type checking (mypy, tsc --noEmit)
3. Run security scans (bandit, safety, npm audit)
4. Execute tests (pytest, vitest)
5. Commit and push to git (ssh://onedev.int.koetsier.org/irrexplorer.git)
6. Build Docker image on Rancher server (root@10.15.19.50)
7. Push to local registry (10.15.19.50:30500)
8. Helm upgrade with --reuse-values and new image tag
9. Verify rollout with kubectl rollout status
```

**Infrastructure**:
```
- Rancher/RKE2 cluster: 10.15.19.50
- Local registry: 10.15.19.50:30500
- Helm release: irrexplorer (namespace: irrexplorer)
- KUBECONFIG: /etc/rancher/rke2/rke2.yaml
- kubectl: /var/lib/rancher/rke2/bin/kubectl
```

**Rules**:
1. Always backup database before migrations
2. Use transactional migrations when possible
3. Implement rollback scripts for every deployment
4. Test migrations on staging before production
5. Deployment must complete before continuing
6. Run `tsc --noEmit` before building frontend
7. Use Vite for production builds with code splitting
8. Follow the `.claude/skills/deploy-irrexplorer` skill exactly
9. Rancher API token in `rancher-api.txt` may expire — use SSH to server instead

---

### Agent: monitoring-eng

**Role**: Monitoring and observability

**Expertise**:
- Application performance monitoring
- Log aggregation and analysis
- Alerting and incident response
- Metrics collection
- Node.js performance profiling

**Assigned Files**:
- `irrexplorer/api/caching.py` (cache metrics)
- Application logging configuration
- Healthcheck endpoints
- `frontend/` (client-side monitoring)

**Key Responsibilities**:
- Implement structured logging
- Configure cache hit/miss metrics
- Set up health check endpoints
- Monitor external API dependencies
- Track Node.js event loop latency

**Observability Stack**:
```
Metrics:
- Request latency (p50, p95, p99)
- Cache hit rates per data type
- External API response times
- Database connection pool status
- Error rates by endpoint
- Node.js heap usage and GC pauses
- Event loop lag
```

**Rules**:
1. Log all external API failures with context
2. Track cache effectiveness per query type
3. Alert on elevated error rates (>1% threshold)
4. Include request IDs for tracing
5. Monitor Node.js memory leaks in production

---

### Agent: security-eng

**Role**: Security engineering and compliance

**Expertise**:
- Web application security
- API security and rate limiting
- Dependency vulnerability scanning
- Network security best practices
- Node.js/TypeScript security

**Assigned Files**:
- All files (security review)
- `.github/workflows/` (security scans)
- `irrexplorer/api/queries.py` (input validation)
- Rate limiting configuration
- `frontend/package.json` (dependency audit)

**Key Responsibilities**:
- Implement input validation and sanitization
- Configure rate limiting per endpoint
- Run security scans in CI pipeline
- Review dependency vulnerabilities (Python + Node.js)

**Security Checklist**:
```
- Input validation on all query parameters
- Rate limiting (slowapi implementation)
- SQL injection prevention (parameterized queries)
- CORS configuration
- Security headers (CSP, XSS protection)
- Dependency auditing (safety, pip-audit, npm audit)
- TypeScript strict mode enabled
- Node.js security best practices
```

**Rules**:
1. Never trust user input - validate all query parameters
2. Rate limit prefix queries (expensive operations)
3. Use parameterized queries for all database operations
4. Update dependencies monthly with security audit
5. Run bandit, safety, and npm audit on every PR
6. Enable TypeScript strict mode in tsconfig.json
7. Audit npm packages before adding new dependencies

---

## Team: Engineering

### Agent: backend-dev

**Role**: Backend Python development

**Expertise**:
- Async Python with Starlette
- API design and implementation
- Data processing pipelines
- Performance optimization

**Assigned Files**:
- `irrexplorer/api/*.py`
- `irrexplorer/backends/*.py`
- `irrexplorer/app.py`

**Tech Stack**:
```
- Starlette (ASGI framework)
- SQLAlchemy Core (database)
- aiohttp (async HTTP client)
- gql (GraphQL client for IRRd)
- Redis (caching)
```

**Key Responsibilities**:
- Implement new API endpoints
- Optimize query performance
- Handle external API integrations
- Write unit tests with pytest

**Rules**:
1. Use async/await for all I/O operations
2. Use `asyncio.gather()` to parallelize independent calls
3. Return typed dataclasses from all functions
4. Document all public APIs with docstrings
5. Run `ruff check` before committing

---

### Agent: frontend-dev

**Role**: Frontend React/TypeScript development

**Expertise**:
- React 18 with hooks
- TypeScript strict mode
- Modern JavaScript (ES6+)
- UI/UX implementation
- API integration

**Assigned Files**:
- `frontend/src/**/*`
- `frontend/public/`
- `frontend/tsconfig.json`
- `frontend/vite.config.ts`

**Tech Stack**:
```
- React 18
- TypeScript 5.x
- Vite (build tool)
- @reach/router
- Bootstrap 5
- Axios
- Recharts (visualizations)
- react-force-graph-2d
```

**Key Responsibilities**:
- Implement UI components with TypeScript
- Integrate backend APIs with type-safe clients
- Handle loading and error states
- Ensure responsive design

**Rules**:
1. Use functional components with hooks
2. Enable TypeScript strict mode
3. Define interfaces for all API responses
4. Implement React.lazy for code splitting
5. Handle API errors gracefully
6. Use semantic HTML for accessibility
7. Run `npm run lint && tsc --noEmit` before committing

---

### Agent: db-engineer

**Role**: Database engineering and optimization

**Expertise**:
- PostgreSQL with PostGIS
- Query optimization
- Index strategy
- Migration management
- Connection pooling

**Assigned Files**:
- `irrexplorer/storage/tables.py`
- `irrexplorer/storage/migrations/`
- Database query files

**Key Responsibilities**:
- Optimize SQL queries for performance
- Design efficient indexes (especially GIST for CIDR)
- Manage database migrations
- Configure connection pool settings

**Database Patterns**:
```
- GIST indexes for CIDR containment queries
- Connection pooling: min=5, max=20
- Use SQLAlchemy Core (not ORM) for performance
- Batch inserts for data imports
- ANALYZE after bulk imports
```

**Rules**:
1. Use GIST indexes for all CIDR columns
2. Never use SELECT * in production queries
3. Implement pagination for large result sets
4. Use connection pooling (asyncpg pool)
5. Add index-only scans for frequently queried columns

---

### Agent: api-designer

**Role**: API design and documentation

**Expertise**:
- RESTful API design
- OpenAPI/Swagger documentation
- API versioning
- Error handling standards

**Assigned Files**:
- `irrexplorer/api/` (all endpoints)
- `irrexplorer/api/interfaces.py` (response types)
- API documentation

**Key Responsibilities**:
- Design consistent API endpoints
- Document all endpoints with OpenAPI
- Implement standard error responses
- Design API versioning strategy

**API Standards**:
```
Response Format:
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 50
  },
  "messages": [...]
}

Error Format:
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "Invalid prefix format",
    "details": {...}
  }
}
```

**Rules**:
1. Use consistent response envelope format
2. Include pagination metadata for lists
3. Return appropriate HTTP status codes
4. Document all endpoints with examples

---

## Cross-Team Collaboration Rules

### Feature Development Workflow

```mermaid
graph TD
    A[New Feature Request] --> B{Type}
    B -->|Network| C[Network Team Review]
    B -->|Infrastructure| D[DevOps Team Review]
    B -->|Application| E[Engineering Team Review]
    
    C --> F[routing-arch Leads Design]
    D --> G[infra-engineer Leads Design]
    E --> H[backend-dev + frontend-dev Pair]
    
    F --> I[Implementation]
    G --> I
    H --> I
    
    I --> J[security-eng Review]
    J --> K[deploy-engineer Deploy]
```

### Escalation Paths

| Issue Type | Primary Agent | Secondary Agent | Escalation |
|------------|---------------|-----------------|------------|
| BGP data issue | bgp-specialist | routing-arch | Network Team Lead |
| IRR sync failure | irr-analyst | backend-dev | Network Team Lead |
| RPKI validation | rpki-expert | security-eng | Network + Security |
| Deployment failure | deploy-engineer | infra-engineer | DevOps Team Lead |
| Performance issue | db-engineer | backend-dev | Engineering Team Lead |
| Security incident | security-eng | deploy-engineer | Security Lead |

### Code Review Assignments

| Changed Area | Required Reviewer |
|--------------|-------------------|
| `backends/bgp.py` | bgp-specialist |
| `backends/irrd.py` | irr-analyst |
| `api/analysis.py` | rpki-expert |
| `storage/*` | db-engineer |
| `.github/workflows/*` | deploy-engineer |
| `frontend/src/*` | frontend-dev |
| `frontend/tsconfig.json` | frontend-dev + security-eng |
| Security-sensitive code | security-eng |

---

## Agent Commands & Tools

### Commands Each Agent Should Run

#### Backend Development
```bash
# Lint and format
ruff check irrexplorer/
ruff format irrexplorer/

# Type checking
mypy irrexplorer/

# Tests
pytest tests/ -v

# Security scan
bandit -r irrexplorer/
safety check
```

#### Frontend Development
```bash
# Lint
cd frontend && npm run lint

# Type check
cd frontend && npx tsc --noEmit

# Test
cd frontend && npm test

# Build
cd frontend && npm run build
```

#### Database Operations
```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

#### Deployment (Rancher/Kubernetes)
See `.claude/skills/deploy-irrexplorer/SKILL.md` for the full deployment procedure.

```bash
# Build and push frontend image (run on 10.15.19.50)
docker build -f Dockerfile.frontend -t 10.15.19.50:30500/irrexplorer/frontend:{TAG} .
docker push 10.15.19.50:30500/irrexplorer/frontend:{TAG}

# Helm upgrade
export KUBECONFIG=/etc/rancher/rke2/rke2.yaml
helm upgrade irrexplorer charts/irrexplorer -n irrexplorer \
  --reuse-values --set frontend.image.tag={TAG}

# Verify rollout
/var/lib/rancher/rke2/bin/kubectl rollout status \
  deployment/irrexplorer-frontend -n irrexplorer
```

---

## Testing Standards by Team

### Network Team Tests
- Unit: Route parsing, prefix validation
- Integration: IRRd queries, BGP API calls (mocked)
- Contract Tests: External API response schemas

### DevOps Team Tests
- Integration: Container startup, health checks
- E2E: Deployment pipeline
- Smoke Tests: Post-deployment verification
- Build Tests: TypeScript compilation, Vite build output

### Engineering Team Tests
- Unit: API endpoints, business logic, TypeScript components
- Integration: Database queries, cache operations
- E2E: Full user workflows
- Type Tests: TypeScript type checking with tsc --noEmit

---

## Knowledge Base References

### Domain Documentation
- BGP: [RFC 4271](https://datatracker.ietf.org/doc/html/rfc4271)
- RPSL: [RFC 2622](https://datatracker.ietf.org/doc/html/rfc2622)
- RPKI: [RFC 6480](https://datatracker.ietf.org/doc/html/rfc6480)
- RDAP: [RFC 7483](https://datatracker.ietf.org/doc/html/rfc7483)

### Codebase Quick Links
- Main App: `irrexplorer/app.py`
- API Routes: `irrexplorer/api/queries.py`
- Database Tables: `irrexplorer/storage/tables.py`
- Settings: `irrexplorer/settings.py`
- Frontend Entry: `frontend/src/main.tsx`

---

## Summary

This multi-agent configuration defines specialized teams for IRRExplorer development:

| Team | Agents | Focus |
|------|--------|-------|
| Network | bgp-specialist, irr-analyst, rpki-expert, routing-arch | Internet routing domain expertise |
| DevOps | infra-engineer, deploy-engineer, monitoring-eng, security-eng | Infrastructure and deployment |
| Engineering | backend-dev, frontend-dev, db-engineer, api-designer | Application development |

Agents work within their domains while following cross-team collaboration rules for feature development, code review, and incident resolution.
