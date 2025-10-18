# Security Workflow

Comprehensive security practices and incident response procedures for IRRExplorer.

## Table of Contents

1. [Security Philosophy](#security-philosophy)
2. [Pre-Deployment Security](#pre-deployment-security)
3. [Secure Development](#secure-development)
4. [Dependency Management](#dependency-management)
5. [Security Testing](#security-testing)
6. [Incident Response](#incident-response)
7. [Security Monitoring](#security-monitoring)
8. [Vulnerability Disclosure](#vulnerability-disclosure)

## Security Philosophy

### Defense in Depth

IRRExplorer implements multiple layers of security:

1. **Input Validation**: Validate all user inputs
2. **Authentication**: API keys (optional)
3. **Authorization**: CORS controls
4. **Data Protection**: No sensitive data stored
5. **Audit Logging**: Track security events
6. **Rate Limiting**: Prevent abuse
7. **Security Headers**: Browser protection

### Security First Principles

- **Fail Secure**: Default to deny, not allow
- **Least Privilege**: Minimal permissions required
- **Separation of Concerns**: Isolate components
- **Zero Trust**: Verify everything
- **Transparency**: Log security events

## Pre-Deployment Security

### Checklist Before Production

#### Infrastructure

- [ ] HTTPS enabled with valid certificate
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] Database not publicly accessible
- [ ] SSH keys only (no password auth)
- [ ] Regular security updates enabled
- [ ] Log aggregation configured
- [ ] Backup strategy in place
- [ ] Intrusion detection system (optional)

#### Application

- [ ] `DEBUG=False` in production
- [ ] `ALLOWED_ORIGINS` configured
- [ ] Strong database password
- [ ] API key enabled (if required)
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] Error messages don't leak info
- [ ] Dependencies updated
- [ ] Security scanning completed

#### Docker

- [ ] Images built from trusted sources
- [ ] Non-root user in containers
- [ ] Read-only filesystem where possible
- [ ] Resource limits set
- [ ] Secrets not in environment vars
- [ ] Networks properly isolated
- [ ] Volumes encrypted (if sensitive)

### Configuration Review

```bash
# Check environment variables
grep -v "^#" .env | grep -v "^$"

# Verify ALLOWED_ORIGINS is set
echo $ALLOWED_ORIGINS

# Check database password strength
# Should be: min 20 chars, mixed case, numbers, symbols

# Verify DEBUG is False
python -c "from irrexplorer.settings import DEBUG; print(f'DEBUG={DEBUG}')"

# Check file permissions
ls -la .env  # Should be 600 or 400
```

## Secure Development

### Security in Code Review

#### What to Look For

1. **Input Validation**
   ```python
   # Bad
   def query(prefix):
       return f"SELECT * FROM bgp WHERE prefix = '{prefix}'"

   # Good
   def query(prefix: str):
       if len(prefix) > MAX_QUERY_LENGTH:
           raise ValueError("Query too long")
       if not RE_PREFIX.match(prefix):
           raise ValueError("Invalid prefix format")
       return db.query(bgp).filter(bgp.c.prefix == prefix)
   ```

2. **Authentication**
   ```python
   # Bad
   if api_key == "hardcoded-key":
       pass

   # Good
   from irrexplorer.settings import config
   API_KEY = config("API_KEY", default=None)
   if API_KEY and request.headers.get("X-API-Key") != API_KEY:
       raise HTTPException(403)
   ```

3. **Error Handling**
   ```python
   # Bad
   except Exception as e:
       return {"error": str(e)}  # May leak stack trace

   # Good
   except Exception as e:
       logger.error(f"Query failed: {e}", extra={"query": query})
       return {"error": "Query failed"}
   ```

4. **Rate Limiting**
   ```python
   # Good
   @limiter.limit("10/minute")
   async def expensive_endpoint():
       pass
   ```

### Secure Coding Patterns

#### SQL Injection Prevention

```python
# Always use parameterized queries
from sqlalchemy import text

# Bad
query = f"SELECT * FROM bgp WHERE asn = {asn}"

# Good
query = text("SELECT * FROM bgp WHERE asn = :asn")
result = await db.execute(query, {"asn": asn})
```

#### XSS Prevention

```python
# Sanitize output (FastAPI does this automatically for JSON)
# For HTML output, use proper escaping:
from markupsafe import escape

html = f"<div>{escape(user_input)}</div>"
```

#### CSRF Prevention

```python
# For state-changing operations, require token
# Not applicable to IRRExplorer (read-only API)
```

#### Path Traversal Prevention

```python
# If handling file uploads/downloads
import os
from pathlib import Path

def safe_join(base: Path, user_path: str) -> Path:
    requested = (base / user_path).resolve()
    if not requested.is_relative_to(base):
        raise ValueError("Path traversal attempt")
    return requested
```

## Dependency Management

### Regular Updates

```bash
# Update dependencies monthly
poetry update

# Check for security advisories
poetry audit

# Or use safety
pip install safety
safety check
```

### Dependency Scanning

#### Python (Backend)

```bash
# Install scanners
pip install safety bandit

# Check for known vulnerabilities
safety check --json

# Static analysis
bandit -r irrexplorer/ -f json -o bandit-report.json
```

#### JavaScript (Frontend)

```bash
cd frontend

# Check for vulnerabilities
npm audit

# Or with yarn
yarn audit

# Auto-fix when possible
npm audit fix
```

### Dependency Pinning

```toml
# pyproject.toml - Use specific versions
[tool.poetry.dependencies]
python = "^3.11"
fastapi = "0.104.1"  # Pinned
starlette = "0.27.0"  # Pinned
```

```json
// package.json - Use exact versions
{
  "dependencies": {
    "react": "18.2.0",
    "axios": "1.6.2"
  }
}
```

## Security Testing

### Automated Security Tests

#### Unit Tests

```python
# tests/security/test_input_validation.py
import pytest
from irrexplorer.api.queries import Query, InvalidQueryError


def test_query_length_limit():
    """Test that overly long queries are rejected."""
    long_query = "A" * 1000
    with pytest.raises(InvalidQueryError, match="Query too long"):
        Query(long_query)


def test_sql_injection_attempt():
    """Test that SQL injection is prevented."""
    malicious = "192.0.2.0/24'; DROP TABLE bgp; --"
    with pytest.raises(InvalidQueryError):
        Query(malicious)


def test_path_traversal_attempt():
    """Test that path traversal is blocked."""
    malicious = "../../../../etc/passwd"
    with pytest.raises(ValueError):
        safe_path(malicious)
```

#### Integration Tests

```python
# tests/security/test_api_security.py
@pytest.mark.asyncio
async def test_cors_headers(test_client):
    """Test CORS headers are properly set."""
    response = await test_client.options(
        "/api/prefixes/prefix/192.0.2.0/24",
        headers={"Origin": "https://evil.com"}
    )
    # Should block unauthorized origin
    assert "Access-Control-Allow-Origin" not in response.headers


@pytest.mark.asyncio
async def test_rate_limiting(test_client):
    """Test rate limiting works."""
    for _ in range(100):
        response = await test_client.get("/api/metadata/")

    # 101st request should be rate limited
    response = await test_client.get("/api/metadata/")
    assert response.status_code == 429


@pytest.mark.asyncio
async def test_error_message_sanitization(test_client):
    """Test errors don't leak sensitive info."""
    response = await test_client.get("/api/prefixes/prefix/invalid")
    error_msg = response.json()["error"]

    # Should not contain stack traces or file paths
    assert "Traceback" not in error_msg
    assert "/irrexplorer/" not in error_msg
```

### Manual Security Testing

#### Penetration Testing Checklist

Run these tests in a staging environment:

1. **Authentication Bypass**
   ```bash
   # Try to access API without credentials (if auth enabled)
   curl http://localhost:8000/api/metadata/
   ```

2. **SQL Injection**
   ```bash
   # Try SQL injection in query parameters
   curl "http://localhost:8000/api/prefixes/prefix/1.1.1.0/24';DROP TABLE bgp;--"
   ```

3. **XSS Attempts**
   ```bash
   # Try XSS in query (JSON API shouldn't be vulnerable)
   curl "http://localhost:8000/api/prefixes/prefix/<script>alert(1)</script>"
   ```

4. **CORS Bypass**
   ```bash
   # Try unauthorized origin
   curl -H "Origin: https://evil.com" http://localhost:8000/api/metadata/
   ```

5. **Rate Limit Testing**
   ```bash
   # Bombard endpoint
   for i in {1..200}; do
       curl http://localhost:8000/api/metadata/ &
   done
   wait
   ```

6. **Large Payload Attack**
   ```bash
   # Send huge query
   python -c "print('A' * 1000000)" | curl -X POST -d @- http://localhost:8000/api/query
   ```

### Automated Security Scanning

#### OWASP ZAP

```bash
# Pull ZAP Docker image
docker pull owasp/zap2docker-stable

# Run baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
    -t http://localhost:8000 \
    -r zap-report.html
```

#### Nikto

```bash
# Install Nikto
apt-get install nikto

# Scan application
nikto -h http://localhost:8000 -output nikto-report.html
```

## Incident Response

### Incident Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **Critical** | Data breach, RCE | Immediate | Database exposed, shell access |
| **High** | Service disruption | < 1 hour | DDoS, authentication bypass |
| **Medium** | Partial impact | < 4 hours | XSS, CSRF in non-critical area |
| **Low** | Minimal impact | < 24 hours | Info disclosure, weak config |

### Incident Response Plan

#### 1. Detection Phase

**Indicators of Compromise:**
- Unusual traffic patterns
- High error rates
- Unauthorized database access
- Failed authentication attempts
- Security scanner alerts
- User reports

**Monitoring Points:**
```bash
# Check logs for suspicious activity
tail -f /var/log/irrexplorer/security.log | grep -E "ERROR|WARNING"

# Monitor failed requests
docker-compose logs backend | grep "400\|401\|403"

# Check database connections
docker-compose exec db psql -U irrexplorer -c "SELECT * FROM pg_stat_activity;"
```

#### 2. Containment Phase

**Immediate Actions:**

1. **Block Attack Source**
   ```bash
   # Add firewall rule
   sudo ufw deny from <attacker-ip>

   # Or in nginx
   # Add to nginx.conf:
   deny <attacker-ip>;
   sudo systemctl reload nginx
   ```

2. **Rotate Credentials**
   ```bash
   # Change database password
   docker-compose exec db psql -U postgres -c \
       "ALTER USER irrexplorer WITH PASSWORD 'new-secure-password';"

   # Update .env
   nano .env  # Update DATABASE_URL

   # Restart services
   docker-compose restart
   ```

3. **Enable Additional Logging**
   ```python
   # Temporarily increase log level
   logging.basicConfig(level=logging.DEBUG)
   ```

#### 3. Investigation Phase

**Gather Evidence:**

```bash
# Collect logs
tar czf incident-logs-$(date +%Y%m%d-%H%M%S).tar.gz \
    /var/log/irrexplorer/ \
    /var/log/nginx/ \
    /var/log/postgresql/

# Database dump for forensics
docker-compose exec db pg_dump -U irrexplorer irrexplorer > forensic-dump.sql

# Container logs
docker-compose logs --since 24h > container-logs.txt

# System logs
journalctl --since "2 hours ago" > system-logs.txt
```

**Analyze Attack:**

```bash
# Find attack patterns
grep -E "DROP|DELETE|UPDATE|INSERT" /var/log/irrexplorer/app.log

# Check for suspicious queries
docker-compose exec db psql -U irrexplorer -c \
    "SELECT query FROM pg_stat_statements WHERE query LIKE '%DROP%';"

# Analyze access patterns
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -20
```

#### 4. Eradication Phase

**Remove Threat:**

```bash
# Update to patched version
git pull origin main
docker-compose up -d --build

# Remove malicious data (if any)
docker-compose exec db psql -U irrexplorer -c "DELETE FROM ... WHERE ..."

# Rebuild from clean backup if compromised
docker-compose down -v
# Restore from backup
cat backup.sql | docker-compose exec -T db psql -U irrexplorer
```

#### 5. Recovery Phase

**Restore Normal Operations:**

```bash
# Verify services are healthy
docker-compose ps
curl http://localhost:8000/api/metadata/

# Monitor for 24-48 hours
watch -n 60 'docker stats --no-stream'

# Gradually restore traffic
# Remove IP blocks once confirmed safe
```

#### 6. Lessons Learned

**Post-Incident Report Template:**

```markdown
# Security Incident Report

## Incident Summary
- **Date/Time**: 2024-01-15 14:30 UTC
- **Duration**: 2 hours
- **Severity**: High
- **Impact**: Service disruption

## Timeline
- 14:30 - Detection: Unusual traffic spike
- 14:35 - Containment: Blocked attacker IP
- 15:00 - Investigation: SQL injection attempt identified
- 15:30 - Eradication: Deployed patch
- 16:30 - Recovery: Service restored

## Root Cause
Missing input validation in prefix query endpoint.

## Actions Taken
1. Blocked attacker IP
2. Added input length validation
3. Deployed security patch
4. Enhanced monitoring

## Preventive Measures
1. Add security tests for all endpoints
2. Implement rate limiting
3. Schedule monthly penetration tests
4. Update security documentation

## Lessons Learned
- Input validation must be comprehensive
- Rate limiting needed earlier in pipeline
- Security testing needs improvement
```

### Emergency Contacts

Maintain an incident response contact list:

```yaml
# emergency-contacts.yml
incident_commander:
  name: "John Doe"
  phone: "+1-555-0100"
  email: "john@example.com"

security_team:
  - name: "Jane Smith"
    phone: "+1-555-0101"
    email: "jane@example.com"

infrastructure:
  - name: "Bob Johnson"
    phone: "+1-555-0102"
    email: "bob@example.com"

legal:
  name: "Legal Department"
  email: "legal@example.com"

pr:
  name: "PR Team"
  email: "pr@example.com"
```

## Security Monitoring

### Log Monitoring

#### What to Monitor

1. **Authentication Failures**
   ```bash
   grep "authentication failed" /var/log/irrexplorer/security.log
   ```

2. **Rate Limit Violations**
   ```bash
   grep "429" /var/log/nginx/access.log | wc -l
   ```

3. **Input Validation Failures**
   ```bash
   grep "InvalidQueryError\|ValidationError" /var/log/irrexplorer/app.log
   ```

4. **Database Errors**
   ```bash
   grep "ERROR" /var/log/postgresql/postgresql.log
   ```

5. **Unusual Traffic**
   ```bash
   # Requests per IP
   awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head
   ```

### Alerting Rules

Configure alerts for security events:

```yaml
# alerts.yml
alerts:
  - name: "High Error Rate"
    condition: "error_rate > 10 per minute"
    severity: "warning"
    action: "notify_team"

  - name: "Rate Limit Exceeded"
    condition: "rate_limit_hits > 100 per hour"
    severity: "warning"
    action: "investigate"

  - name: "Authentication Failures"
    condition: "auth_failures > 5 per minute"
    severity: "high"
    action: "block_ip"

  - name: "Database Connection Failure"
    condition: "db_errors > 0"
    severity: "critical"
    action: "page_oncall"
```

### Monitoring Tools

#### Prometheus + Grafana

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'irrexplorer'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
```

#### ELK Stack

```yaml
# filebeat.yml
filebeat.inputs:
  - type: log
    paths:
      - /var/log/irrexplorer/*.log
    fields:
      service: irrexplorer
      environment: production

output.elasticsearch:
  hosts: ["localhost:9200"]
```

## Vulnerability Disclosure

### Responsible Disclosure Policy

**If you discover a security vulnerability:**

1. **DO NOT** disclose publicly
2. Email security@example.com with:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Your contact information

3. We will:
   - Acknowledge within 24 hours
   - Provide updates every 72 hours
   - Credit you in release notes (if desired)
   - Fix within 90 days or explain delay

### Security Advisory Process

When a vulnerability is confirmed:

1. **Assess Severity** using CVSS
2. **Develop Patch** privately
3. **Test Patch** thoroughly
4. **Prepare Advisory** with details
5. **Release Patch** to users
6. **Publish Advisory** after users can update
7. **Credit Reporter** (if permitted)

### Security Advisory Template

```markdown
# Security Advisory: [TITLE]

## Summary
Brief description of the vulnerability.

## Severity
**CVSS Score**: 7.5 (High)
**Vector**: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N

## Affected Versions
- IRRExplorer < 1.2.3

## Impact
What an attacker can do with this vulnerability.

## Mitigation
How to protect your installation immediately.

## Solution
Update to version 1.2.3 or later:
```bash
git pull origin main
docker-compose up -d --build
```

## Credits
Thanks to [Researcher Name] for responsible disclosure.

## Timeline
- 2024-01-01: Vulnerability reported
- 2024-01-02: Vulnerability confirmed
- 2024-01-10: Patch developed
- 2024-01-15: Patch released
- 2024-01-22: Advisory published
```

## Security Checklist

### Daily

- [ ] Review security logs
- [ ] Check for failed authentication attempts
- [ ] Monitor error rates
- [ ] Verify backups completed

### Weekly

- [ ] Review access logs for anomalies
- [ ] Check for new security advisories
- [ ] Update dependencies if needed
- [ ] Review rate limiting effectiveness

### Monthly

- [ ] Run security scans (ZAP, Nikto)
- [ ] Review and update firewall rules
- [ ] Rotate API keys (if applicable)
- [ ] Test backup restoration
- [ ] Review incident response plan
- [ ] Update security documentation

### Quarterly

- [ ] Penetration testing
- [ ] Security audit
- [ ] Review and update policies
- [ ] Security training for team
- [ ] Disaster recovery drill
- [ ] Dependency audit
- [ ] Certificate renewal check

### Annually

- [ ] External security assessment
- [ ] Compliance review
- [ ] Insurance review
- [ ] Update business continuity plan
- [ ] Review all security controls

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SANS Incident Response](https://www.sans.org/incident-response/)
- [Docker Security](https://docs.docker.com/engine/security/)

## Contact

For security concerns:
- **Email**: security@example.com
- **PGP Key**: [Link to public key]
- **Bug Bounty**: [Link if applicable]
