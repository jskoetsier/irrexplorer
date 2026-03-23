# CI/CD Documentation

## Overview

IRRExplorer uses GitHub Actions for continuous integration, continuous deployment, and security scanning. This document describes the automated workflows and their purposes.

## Workflows

### CI/CD Pipeline (`ci.yml`)

Comprehensive CI/CD pipeline that runs on every push and pull request to `main` and `develop` branches.

#### Jobs

**1. Test Go Backend**
- Tests against Go 1.25
- Uses PostgreSQL 15 and Redis 7 services
- Runs database integration tests
- Executes `go test ./...`

**2. Code Quality (Go)**
- Runs `go vet` for code analysis
- Ensures code adheres to project standards

**3. Frontend**
- Installs dependencies with npm/yarn
- Runs ESLint for code quality
- Runs TypeScript type checking
- Builds production frontend bundle
- Reports bundle sizes

**4. Integration**
- Builds Docker images
- Starts full application stack
- Runs health checks on services
- Validates API endpoints

**5. Documentation**
- Validates presence of key documentation files
- Runs markdown linting

**6. Build Status Summary**
- Collects results from all jobs
- Provides consolidated build status

#### Environment Variables

```bash
DATABASE_URL=postgresql://irrexplorer:irrexplorer@localhost:5432/irrexplorer
REDIS_URL=redis://localhost:6379/0
```

### Security Scanning (`security.yml`)

Comprehensive security scanning workflow that runs:
- On every push and pull request
- Daily at 2 AM UTC (scheduled)
- On manual trigger

#### Jobs

**1. CodeQL Analysis**
- Static code analysis for Go and JavaScript/TypeScript
- Runs security-extended and security-and-quality queries
- Uploads results to GitHub Security tab

**2. Dependency Vulnerability Scan**
- Go vulnerability checking (go vet, govulncheck)
- npm audit for frontend dependencies
- Generates vulnerability reports

**3. TruffleHog Secret Detection**
- Scans repository history for secrets
- Detects API keys, passwords, tokens
- Only reports verified secrets

**4. Semgrep Security Scan**
- Pattern-based security scanning
- Covers Go, Docker, JavaScript/TypeScript
- Uploads SARIF results to GitHub

**5. Trivy Vulnerability Scanner**
- Filesystem vulnerability scanning
- Checks for CRITICAL, HIGH, and MEDIUM severity
- Scans dependencies and configuration

**6. Docker Image Security Scan**
- Builds backend and frontend images
- Scans with Trivy for vulnerabilities
- Reports CRITICAL and HIGH severity issues

**7. NPM Security Audit**
- Audits frontend dependencies
- Checks for known vulnerabilities

**8. Security Summary**
- Collects all scan results
- Generates comprehensive report
- Comments on pull requests with findings

## Artifacts

The workflows generate several artifacts:

### Security Reports
- `dependency-scan-reports/` - Go and npm audit results
- `npm-audit-report/` - Frontend vulnerability report
- `security-summary/` - Consolidated security report

## Branch Protection

Recommended branch protection rules for `main`:

1. Require status checks to pass:
   - Test Go Backend
   - Code Quality (Go)
   - Frontend
   - Integration

2. Require pull request reviews

3. Require conversation resolution before merging

## Local Testing

### Run Tests Locally

```bash
# Go backend tests
cd go-backend
go test ./...

# Frontend tests
cd frontend
npm test

# Integration tests
docker compose up -d
# ... run tests
docker compose down
```

### Code Quality Checks

```bash
# Go
cd go-backend
go fmt ./...
go vet ./...
go test -race ./...  # Race detector

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
```

### Security Scans

```bash
# Go vulnerability check
cd go-backend
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...

# Trivy (requires Docker)
trivy fs .

# npm audit
cd frontend
npm audit
```

## Continuous Deployment

The CI/CD pipeline validates code but does not automatically deploy. 

For Kubernetes deployment, see the deployment skill:
```bash
# Use the deploy-irrexplorer skill
```

Manual deployment:
```bash
# Production deployment via Helm
helm upgrade --install irrexplorer ./charts/irrexplorer -n irrexplorer
```

## Monitoring Build Status

### GitHub Actions Tab
- View workflow runs in the Actions tab
- Download artifacts for detailed reports
- Check individual job logs

### Security Tab
- View CodeQL findings
- Review dependency alerts

### Status Badges

Add to README.md:

```markdown
![CI/CD](https://github.com/username/irrexplorer/actions/workflows/ci.yml/badge.svg)
![Security](https://github.com/username/irrexplorer/actions/workflows/security.yml/badge.svg)
```

## Troubleshooting

### Common Issues

**1. Database connection failures**
- Check service health in workflow logs
- Verify DATABASE_URL format
- Ensure migrations run successfully

**2. Frontend build failures**
- Check Node.js version compatibility
- Verify package-lock.json is committed
- Review ESLint errors

**3. Go build failures**
- Verify Go version matches go.mod
- Check for dependency issues: `go mod tidy`

**4. Security scan false positives**
- Review Trivy ignore configuration
- Add exceptions for known issues

### Getting Help

- Check workflow logs for detailed error messages
- Review job artifacts for reports
- Consult GitHub Actions documentation
- Open issue with `ci/cd` label

## Maintenance

### Regular Tasks

- Review security scan results weekly
- Update dependencies monthly
- Monitor build performance
- Update documentation

### Version Updates

When updating Go, Node.js, or service versions:

1. Update workflow matrix
2. Test locally with new versions
3. Update documentation
4. Update Docker base images
5. Verify all checks pass

## Compliance

### Security Standards

- OWASP Top 10 coverage
- CWE (Common Weakness Enumeration) checks
- CVE (Common Vulnerabilities and Exposures) scanning
- Secret detection and prevention

### Code Quality Standards

- Go best practices (via go vet, staticcheck)
- TypeScript strict mode
- Test coverage goals
- Documentation coverage

## Support

For issues or questions about CI/CD:

1. Check workflow logs
2. Review this documentation
3. Search existing issues
4. Create new issue with details

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Go Testing Documentation](https://go.dev/doc/testing)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Semgrep Documentation](https://semgrep.dev/docs/)
- [npm Security](https://docs.npmjs.com/about-audit-reports)