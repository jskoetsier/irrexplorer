# Security Configuration Guide

This guide covers optional security enhancements that can be implemented for IRRExplorer.

## Rate Limiting

### Option 1: slowapi (Application-Level)

Install the dependency:
```bash
pip install slowapi
```

Update `irrexplorer/app.py`:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Add after imports
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

# In the app initialization
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add decorator to specific endpoints
@limiter.limit("10/minute")
async def prefixes_prefix(request):
    # ... existing code
```

### Option 2: nginx (Reverse Proxy Level)

Add to nginx configuration:
```nginx
http {
    # Define rate limit zone: 10MB can hold ~160k IP addresses
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;

    server {
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            limit_req_status 429;

            # Your proxy_pass configuration
            proxy_pass http://backend;
        }
    }
}
```

### Option 3: Cloudflare (CDN Level)

Configure via Cloudflare Dashboard:
1. Go to Security → WAF → Rate Limiting Rules
2. Create new rule:
   - **Path:** `/api/*`
   - **Requests:** 100 per minute
   - **Action:** Block
   - **Duration:** 1 minute

## Content Security Policy (CSP)

### Implementation via Starlette Middleware

Create a new file `irrexplorer/middleware/security.py`:
```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "  # React inline scripts
            "style-src 'self' 'unsafe-inline'; "   # Bootstrap inline styles
            "img-src 'self' data:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

        # Additional security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # HSTS (only in production with HTTPS)
        if not request.app.debug:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        return response
```

Update `irrexplorer/app.py`:
```python
from irrexplorer.middleware.security import SecurityHeadersMiddleware

middleware = [
    Middleware(SecurityHeadersMiddleware),  # Add first
    Middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        # ... existing config
    )
]
```

### Testing CSP

Use browser developer tools to verify CSP:
1. Open the application in Chrome/Firefox
2. Open DevTools (F12)
3. Go to Console tab
4. Look for CSP violation warnings
5. Adjust policy as needed

## API Key Authentication (Optional)

For internal deployments, consider adding API key authentication:

Create `irrexplorer/middleware/auth.py`:
```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from irrexplorer.settings import config


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Skip authentication for static files
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        # Get API key from header or query param
        api_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
        expected_key = config("API_KEY", default=None)

        # If API_KEY is configured, enforce it
        if expected_key and api_key != expected_key:
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid or missing API key"}
            )

        return await call_next(request)
```

Add to `.env`:
```bash
API_KEY=your-secret-key-here
```

## IP Whitelisting (Production)

### nginx Configuration
```nginx
location /api/ {
    # Allow specific IPs
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;

    proxy_pass http://backend;
}
```

### Cloudflare Configuration
1. Go to Security → WAF → Firewall Rules
2. Create rule:
   - **Field:** IP Address
   - **Operator:** is not in list
   - **Value:** [your allowed IPs]
   - **Action:** Block

## HTTPS Configuration

### Let's Encrypt with nginx

Install certbot:
```bash
sudo apt-get install certbot python3-certbot-nginx
```

Obtain certificate:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Auto-renewal (runs twice daily):
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### nginx HTTPS Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Logging and Monitoring

### Enable Security Event Logging

Create `irrexplorer/middleware/logging.py`:
```python
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("security")


class SecurityLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start_time = time.time()

        # Log request details
        logger.info(
            f"Request: {request.method} {request.url.path} "
            f"from {request.client.host}"
        )

        response = await call_next(request)

        # Log response status and timing
        duration = time.time() - start_time
        logger.info(
            f"Response: {response.status_code} "
            f"in {duration:.3f}s"
        )

        # Log security events
        if response.status_code == 400:
            logger.warning(f"Bad request from {request.client.host}: {request.url}")
        elif response.status_code == 429:
            logger.warning(f"Rate limit exceeded: {request.client.host}")
        elif response.status_code >= 500:
            logger.error(f"Server error {response.status_code}: {request.url}")

        return response
```

### Configure Logging in Production

Update `irrexplorer/app.py`:
```python
import logging.config

# Configure logging
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
        },
        "security": {
            "format": "[%(asctime)s] SECURITY %(levelname)s: %(message)s",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
        "security_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "logs/security.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 10,
            "formatter": "security",
        }
    },
    "loggers": {
        "security": {
            "handlers": ["console", "security_file"],
            "level": "INFO",
        }
    }
}

logging.config.dictConfig(LOGGING_CONFIG)
```

## Security Checklist

Before deploying to production:

- [ ] Configure `ALLOWED_ORIGINS` with production domains
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Implement rate limiting (application or proxy level)
- [ ] Add Content Security Policy headers
- [ ] Enable security logging
- [ ] Set up log monitoring/alerting
- [ ] Configure firewall rules
- [ ] Test all security configurations
- [ ] Document incident response procedures
- [ ] Set up automated security updates
- [ ] Enable database connection encryption
- [ ] Restrict database access by IP
- [ ] Use secrets management for API keys
- [ ] Enable audit logging for data imports
- [ ] Set up intrusion detection (optional)
- [ ] Configure DDoS protection (Cloudflare, AWS Shield)

## Monitoring and Alerts

### Metrics to Monitor

1. **Rate Limiting:**
   - Number of rate limit violations per hour
   - Top IPs hitting rate limits

2. **Input Validation:**
   - Failed query validations
   - Rejected queries (too long)

3. **Circuit Breakers:**
   - Set expansion timeouts
   - Size limit violations

4. **Authentication (if enabled):**
   - Failed authentication attempts
   - Unusual access patterns

### Alert Thresholds

Set up alerts for:
- More than 100 rate limit violations in 5 minutes
- More than 10 set expansion timeouts in 1 hour
- Any 500 errors
- Unusual spike in 400 errors (potential attack)
- Database query time exceeding 10 seconds

## Security Testing

### Automated Security Scanning

Use tools like:
- **OWASP ZAP** - Web application security scanner
- **Bandit** - Python security linter
- **Safety** - Python dependency vulnerability checker
- **npm audit** - JavaScript dependency checker

Run before deployment:
```bash
# Python security
pip install bandit safety
bandit -r irrexplorer/
safety check

# JavaScript security
cd frontend
npm audit
```

### Manual Security Testing

Test these scenarios:
1. SQL injection attempts
2. XSS attempts in query parameters
3. CSRF attacks (should fail - no state-changing operations)
4. Rate limit bypass attempts
5. Large payload attacks
6. Path traversal attempts
7. Header injection attempts

## Incident Response

### If a Security Incident Occurs:

1. **Immediate Actions:**
   - Block offending IPs at firewall level
   - Rotate API keys if compromised
   - Review logs for extent of breach
   - Document timeline of events

2. **Investigation:**
   - Check security logs for patterns
   - Identify attack vector
   - Assess data exposure
   - Review recent code changes

3. **Mitigation:**
   - Deploy security patches
   - Tighten security rules
   - Notify affected parties if needed
   - Document lessons learned

4. **Prevention:**
   - Update security procedures
   - Add new detection rules
   - Schedule security review
   - Train team on new threats

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Starlette Security](https://www.starlette.io/middleware/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Security Headers](https://securityheaders.com/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
