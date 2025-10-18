# CI/CD Documentation

## Overview

IRRExplorer uses GitHub Actions for continuous integration, continuous deployment, and security scanning. This document describes the automated workflows and their purposes.

## Workflows

### CI/CD Pipeline (`ci.yml`)

Comprehensive CI/CD pipeline that runs on every push and pull request to `main` and `develop` branches.

#### Jobs

**1. Test (Multi-Python)**
- Tests against Python 3.9, 3.10, 3.11, and 3.12
- Uses PostgreSQL 15 and Redis 7 services
- Runs database migrations
- Executes pytest with coverage reporting
- Uploads coverage to Codecov (Python 3.12 only)

**2. Code Quality**
- Runs ruff linter and formatter
- Checks import sorting with isort
- Performs type checking with mypy
- Ensures code adheres to project standards

**3. Security**
- Bandit security scan for Python code
- Safety check for dependency vulnerabilities
- Generates security reports as artifacts

**4. Frontend**
- Installs dependencies with yarn
- Runs ESLint for code quality
- Builds production frontend bundle
- Reports bundle sizes

**5. Integration**
- Builds Docker images
- Starts full application stack
- Runs health checks on services
- Executes integration tests
- Validates API endpoints

**6. Documentation**
- Validates presence of key documentation files
- Runs markdown linting
- Ensures documentation quality

**7. Build Status Summary**
- Collects results from all jobs
- Provides consolidated build status

#### Required Services

- PostgreSQL 15
- Redis 7

#### Environment Variables

```bash
DATABASE_URL=postgresql://irrexplorer:irrexplorer@localhost:5432/irrexplorer
REDIS_URL=redis://localhost:6379/0
TESTING=true
```

### Security Scanning (`security.yml`)

Comprehensive security scanning workflow that runs:
- On every push and pull request
- Daily at 2 AM UTC (scheduled)
- On manual trigger

#### Jobs

**1. CodeQL Analysis**
- Static code analysis for Python and JavaScript
- Runs security-extended and security-and-quality queries
- Uploads results to GitHub Security tab

**2. Dependency Vulnerability Scan**
- Safety check for Python dependencies
- pip-audit for additional vulnerability detection
- Generates JSON and text reports

**3. Bandit Security Scan**
- Python security linter
- Medium confidence and severity threshold
- Identifies common security issues

**4. TruffleHog Secret Detection**
- Scans repository history for secrets
- Detects API keys, passwords, tokens
- Only reports verified secrets

**5. Semgrep Security Scan**
- Pattern-based security scanning
- Covers Python, Docker, JavaScript
- Uploads SARIF results to GitHub

**6. Trivy Vulnerability Scanner**
- Filesystem vulnerability scanning
- Checks for CRITICAL, HIGH, and MEDIUM severity
- Scans dependencies and configuration

**7. Docker Image Security Scan**
- Builds backend and frontend images
- Scans with Trivy for vulnerabilities
- Reports CRITICAL and HIGH severity issues

**8. NPM Security Audit**
- Audits frontend dependencies
- Checks for known vulnerabilities
- Generates audit reports

**9. Security Summary**
- Collects all scan results
- Generates comprehensive report
- Comments on pull requests with findings

## Artifacts

The workflows generate several artifacts:

### Security Reports
- `security-reports/` - Bandit and safety reports
- `bandit-report/` - Detailed Bandit findings
- `dependency-scan-reports/` - Safety and pip-audit results
- `npm-audit-report/` - Frontend vulnerability report
- `security-summary/` - Consolidated security report

### Coverage Reports
- Uploaded to Codecov for Python 3.12 tests
- Available in job logs for other versions

## Branch Protection

Recommended branch protection rules for `main`:

1. Require status checks to pass:
   - Test (all Python versions)
   - Code Quality
   - Security
   - Frontend
   - Integration

2. Require pull request reviews

3. Require conversation resolution before merging

4. Require linear history

## Local Testing

### Run Tests Locally

```bash
# Backend tests
pytest --cov=irrexplorer --cov-report=term-missing

# Frontend tests
cd frontend && yarn test

# Integration tests
docker-compose up -d
pytest tests/integration/
docker-compose down -v
```

### Code Quality Checks

```bash
# Linting
ruff check irrexplorer/

# Formatting
ruff format irrexplorer/

# Type checking
mypy irrexplorer/ --ignore-missing-imports

# Import sorting
isort irrexplorer/
```

### Security Scans

```bash
# Bandit
bandit -r irrexplorer/

# Safety
safety check

# Trivy (requires Docker)
trivy fs .
```

## Continuous Deployment

The CI/CD pipeline validates code but does not automatically deploy. Deployment is manual:

```bash
# Production deployment
ssh root@vuurstorm.nl "cd /opt/irrexplorer && \
  git pull && \
  docker-compose build && \
  docker-compose up -d"
```

## Monitoring Build Status

### GitHub Actions Tab
- View workflow runs in the Actions tab
- Download artifacts for detailed reports
- Check individual job logs

### Security Tab
- View CodeQL findings
- Review dependency alerts
- Check SARIF upload results

### Status Badges

Add to README.md:

```markdown
![CI/CD](https://github.com/username/irrexplorer/actions/workflows/ci.yml/badge.svg)
![Security](https://github.com/username/irrexplorer/actions/workflows/security.yml/badge.svg)
[![codecov](https://codecov.io/gh/username/irrexplorer/branch/main/graph/badge.svg)](https://codecov.io/gh/username/irrexplorer)
```

## Troubleshooting

### Common Issues

**1. Database connection failures**
- Check service health in workflow logs
- Verify DATABASE_URL format
- Ensure migrations run successfully

**2. Frontend build failures**
- Check Node.js version compatibility
- Verify yarn.lock is committed
- Review ESLint errors

**3. Security scan false positives**
- Review Bandit configuration
- Adjust safety ignore list
- Add exceptions for known issues

**4. Docker image build timeout**
- Optimize Dockerfile layers
- Use BuildKit cache
- Reduce image size

### Getting Help

- Check workflow logs for detailed error messages
- Review job artifacts for reports
- Consult GitHub Actions documentation
- Open issue with `ci/cd` label

## Future Enhancements

### Planned Improvements

1. **Automatic Deployment**
   - Deploy to staging on merge to `develop`
   - Deploy to production on release tags
   - Blue-green deployment strategy

2. **Performance Testing**
   - Load testing with Locust
   - Performance benchmarking
   - Response time monitoring

3. **Accessibility Testing**
   - Automated a11y checks
   - WCAG compliance validation
   - Screen reader testing

4. **Visual Regression Testing**
   - Screenshot comparison
   - UI component testing
   - Cross-browser validation

## Configuration Files

### Required Files

- `.github/workflows/ci.yml` - CI/CD pipeline
- `.github/workflows/security.yml` - Security scanning
- `requirements.txt` - Python dependencies
- `requirements-dev.txt` - Development dependencies
- `frontend/package.json` - Frontend dependencies
- `docker-compose.yml` - Service orchestration

### Optional Configuration

- `.ruff.toml` - Ruff configuration
- `mypy.ini` - Type checking configuration
- `.isort.cfg` - Import sorting configuration
- `bandit.yaml` - Bandit security configuration

## Maintenance

### Regular Tasks

- Review security scan results weekly
- Update dependencies monthly
- Monitor build performance
- Archive old artifacts
- Update documentation

### Version Updates

When updating Python, Node.js, or service versions:

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

- PEP 8 compliance (via ruff)
- Type hints coverage
- Test coverage > 80%
- Documentation coverage

## Support

For issues or questions about CI/CD:

1. Check workflow logs
2. Review this documentation
3. Search existing issues
4. Create new issue with details
5. Contact maintainers

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [pytest Documentation](https://docs.pytest.org/)
- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [Codecov Documentation](https://docs.codecov.com/)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Semgrep Documentation](https://semgrep.dev/docs/)
