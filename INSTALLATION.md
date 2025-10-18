# Installation Guide

Complete installation guide for IRRExplorer - Internet Routing Registry Explorer.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Methods](#installation-methods)
3. [Docker Installation (Recommended)](#docker-installation-recommended)
4. [Manual Installation](#manual-installation)
5. [Database Setup](#database-setup)
6. [Initial Data Import](#initial-data-import)
7. [Configuration](#configuration)
8. [Verification](#verification)
9. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 10GB free space
- **OS**: Linux, macOS, or Windows (with WSL2)

### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Disk**: 20GB+ SSD
- **OS**: Ubuntu 20.04+ or similar

### Software Prerequisites

#### For Docker Installation
- Docker Engine 20.10+
- Docker Compose 2.0+

#### For Manual Installation
- Python 3.9+
- PostgreSQL 13+
- Node.js 18+
- Yarn or npm

## Installation Methods

### Quick Decision Guide

**Choose Docker if:**
- You want the fastest setup
- You need isolated environments
- You're deploying to production
- You want easy scaling

**Choose Manual if:**
- You need to customize the stack
- You're actively developing
- You have specific Python/Node versions
- You need fine-grained control

## Docker Installation (Recommended)

### 1. Install Docker

#### Ubuntu/Debian
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

#### macOS
```bash
brew install --cask docker
# Or download from https://www.docker.com/products/docker-desktop
```

#### Windows
Download Docker Desktop from https://www.docker.com/products/docker-desktop

### 2. Clone Repository

```bash
git clone https://github.com/yourusername/irrexplorer.git
cd irrexplorer
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env  # Edit configuration
```

Required settings:
```bash
DATABASE_URL=postgresql://irrexplorer:irrexplorer_password@db:5432/irrexplorer
IRRD_ENDPOINT=https://irrd.nlnog.net/graphql
ALLOWED_ORIGINS=http://localhost,http://localhost:3000
DEBUG=False
```

### 4. Start Services

#### Production
```bash
docker-compose up -d
```

#### Development
```bash
docker-compose -f docker-compose.dev.yml up
```

### 5. Import Initial Data

```bash
# This will take 15-30 minutes depending on your connection
docker-compose exec backend python -m irrexplorer.commands.import_data
```

### 6. Access Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 7. Verify Installation

```bash
# Check all services are running
docker-compose ps

# Check backend health
curl http://localhost:8000/api/metadata/

# Check frontend
curl http://localhost/
```

## Manual Installation

### 1. Install System Dependencies

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y \
    python3.11 \
    python3.11-dev \
    python3-pip \
    postgresql-15 \
    postgresql-contrib \
    postgresql-15-postgis-3 \
    build-essential \
    libpq-dev \
    nodejs \
    npm
```

#### macOS
```bash
brew install python@3.11 postgresql@15 node
brew services start postgresql@15
```

### 2. Install Poetry

```bash
curl -sSL https://install.python-poetry.org | python3 -
export PATH="$HOME/.local/bin:$PATH"
```

### 3. Clone and Setup Backend

```bash
git clone https://github.com/yourusername/irrexplorer.git
cd irrexplorer

# Install Python dependencies
poetry install

# Activate virtual environment
poetry shell
```

### 4. Setup PostgreSQL Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE USER irrexplorer WITH PASSWORD 'your_secure_password';
CREATE DATABASE irrexplorer OWNER irrexplorer;
GRANT ALL PRIVILEGES ON DATABASE irrexplorer TO irrexplorer;

# Enable required extensions
\c irrexplorer
CREATE EXTENSION IF NOT EXISTS btree_gist;
\q
```

### 5. Configure Backend

```bash
# Create .env file
cp .env.example .env

# Edit configuration
nano .env
```

Update these values:
```bash
DATABASE_URL=postgresql://irrexplorer:your_secure_password@localhost:5432/irrexplorer
IRRD_ENDPOINT=https://irrd.nlnog.net/graphql
DEBUG=False
ALLOWED_ORIGINS=http://localhost:3000
```

### 6. Run Database Migrations

```bash
alembic upgrade head
```

### 7. Setup Frontend

```bash
cd frontend

# Install dependencies
yarn install
# or: npm install

# Build for production
yarn build
# or: npm run build

cd ..
```

### 8. Start Backend Server

```bash
# Production (from project root)
uvicorn irrexplorer.app:app --host 0.0.0.0 --port 8000

# Or with gunicorn for production
gunicorn irrexplorer.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 9. Serve Frontend

#### Option A: Use nginx
```bash
sudo apt-get install nginx

# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/irrexplorer
sudo ln -s /etc/nginx/sites-available/irrexplorer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Option B: Simple Python Server (Development only)
```bash
cd frontend/build
python3 -m http.server 3000
```

### 10. Import Initial Data

```bash
# From project root (with poetry shell active)
python -m irrexplorer.commands.import_data
```

## Database Setup

### PostgreSQL Configuration

For production, optimize PostgreSQL settings:

Edit `/etc/postgresql/15/main/postgresql.conf`:

```ini
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 16MB

# Connections
max_connections = 100

# Write Performance
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Query Performance
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200  # For SSD

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%a.log'
log_rotation_age = 1d
log_rotation_size = 0
log_min_duration_statement = 1000  # Log slow queries
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Create Database Indexes

The migrations create these automatically, but verify:

```sql
-- Connect to database
psql -U irrexplorer -d irrexplorer

-- Check indexes
\di

-- Expected indexes:
-- ix_bgp_asn (btree)
-- ix_bgp_prefix (gist)
-- ix_rirstats_prefix (gist)
-- ix_rpki_asn (btree)
-- ix_rpki_prefix (gist)
```

## Initial Data Import

### Understanding the Import Process

The data import consists of three main sources:

1. **BGP Routes** (~1M entries, ~5 minutes)
   - Source: bgp.tools
   - Updates: Real-time routing data

2. **RIR Statistics** (~500K entries, ~5 minutes)
   - Sources: RIPE, ARIN, APNIC, LACNIC, AFRINIC
   - Updates: Daily delegation stats

3. **RPKI** (~500K entries, ~5 minutes)
   - Source: Multiple RPKI validators
   - Updates: ROA data

### Running Full Import

```bash
# Docker
docker-compose exec backend python -m irrexplorer.commands.import_data

# Manual
poetry run python -m irrexplorer.commands.import_data
```

### Partial Imports

```bash
# BGP only
poetry run python -c "from irrexplorer.backends.bgp import BGPImporter; import asyncio; asyncio.run(BGPImporter().run_import())"

# RIR Stats only
poetry run python -c "from irrexplorer.backends.rirstats import import_all; import asyncio; asyncio.run(import_all())"
```

### Scheduling Automatic Updates

#### Using cron (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Add daily update at 2 AM
0 2 * * * cd /path/to/irrexplorer && docker-compose exec -T backend python -m irrexplorer.commands.import_data >> /var/log/irrexplorer-import.log 2>&1
```

#### Using systemd timer (Linux)

Create `/etc/systemd/system/irrexplorer-import.service`:
```ini
[Unit]
Description=IRRExplorer Data Import
After=network.target

[Service]
Type=oneshot
User=irrexplorer
WorkingDirectory=/opt/irrexplorer
ExecStart=/usr/local/bin/docker-compose exec -T backend python -m irrexplorer.commands.import_data
```

Create `/etc/systemd/system/irrexplorer-import.timer`:
```ini
[Unit]
Description=IRRExplorer Daily Import Timer

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

Enable timer:
```bash
sudo systemctl enable irrexplorer-import.timer
sudo systemctl start irrexplorer-import.timer
```

## Configuration

### Environment Variables Reference

```bash
# Database (Required)
DATABASE_URL=postgresql://user:password@host:port/database

# IRRd Endpoint (Required)
IRRD_ENDPOINT=https://irrd.nlnog.net/graphql

# CORS (Required for production)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Debug Mode (Default: False)
DEBUG=False

# BGP Source (Default: https://bgp.tools/table.jsonl)
BGP_SOURCE=https://bgp.tools/table.jsonl
BGP_SOURCE_MINIMUM_HITS=20

# HTTP Server (Defaults shown)
HTTP_PORT=8000
HTTP_WORKERS=4

# Prefix Filters (Defaults shown)
MINIMUM_PREFIX_SIZE_IPV4=9
MINIMUM_PREFIX_SIZE_IPV6=29
BGP_IPV4_LENGTH_CUTOFF=29
BGP_IPV6_LENGTH_CUTOFF=124

# RIR Stats URLs (Optional overrides)
RIRSTATS_URL_RIPENCC=https://ftp.ripe.net/ripe/stats/delegated-ripencc-latest
RIRSTATS_URL_ARIN=https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest
RIRSTATS_URL_AFRINIC=https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-latest
RIRSTATS_URL_LACNIC=https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest
RIRSTATS_URL_APNIC=https://ftp.apnic.net/stats/apnic/delegated-apnic-latest
```

### Frontend Configuration

Edit `frontend/src/config.json`:

```json
{
  "apiEndpoint": "/api",
  "title": "IRR Explorer",
  "refreshInterval": 300000
}
```

## Verification

### 1. Check Services

```bash
# Docker
docker-compose ps

# Expected output: All services "Up" and "healthy"
```

### 2. Test Backend API

```bash
# Metadata endpoint
curl http://localhost:8000/api/metadata/

# Expected: JSON with last_import timestamps

# Search endpoint
curl "http://localhost:8000/api/prefixes/prefix/8.8.8.0/24"

# Expected: JSON with prefix data
```

### 3. Test Frontend

```bash
# Homepage
curl -I http://localhost/

# Expected: HTTP 200 OK

# Check API proxy
curl http://localhost/api/metadata/

# Expected: Same as direct backend call
```

### 4. Verify Database

```bash
# Docker
docker-compose exec db psql -U irrexplorer -c "SELECT COUNT(*) FROM bgp;"

# Manual
psql -U irrexplorer -c "SELECT COUNT(*) FROM bgp;"

# Expected: >0 if import completed
```

### 5. Performance Check

```bash
# Time a query
time curl -s "http://localhost:8000/api/prefixes/prefix/1.1.1.0/24" > /dev/null

# Expected: <1 second for cached queries
```

## Troubleshooting

### Port Already in Use

**Symptom**: `Error: port 80 is already in use`

**Solution**:
```bash
# Find process using port
sudo lsof -i :80

# Kill process or change port in docker-compose.yml
ports:
  - "8080:80"  # Use port 8080 instead
```

### Database Connection Failed

**Symptom**: `could not connect to server`

**Solution**:
```bash
# Docker: Check database is healthy
docker-compose ps db

# Manual: Check PostgreSQL is running
sudo systemctl status postgresql

# Check credentials
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Import Hangs or Fails

**Symptom**: Import process stuck or errors out

**Solutions**:

1. Check network connectivity:
```bash
curl -I https://bgp.tools/table.jsonl
curl -I https://irrd.nlnog.net/graphql
```

2. Check disk space:
```bash
df -h
```

3. Check logs:
```bash
docker-compose logs -f backend
```

4. Increase timeout if needed (edit source):
```python
# irrexplorer/backends/common.py
TIMEOUT = 300  # Increase from default
```

### Frontend Shows Blank Page

**Symptom**: White screen or "Cannot GET /" error

**Solutions**:

1. Check build completed:
```bash
ls -la frontend/build/
```

2. Rebuild frontend:
```bash
cd frontend
yarn build
```

3. Check nginx logs (Docker):
```bash
docker-compose logs frontend
```

4. Verify API endpoint in browser console

### Slow Query Performance

**Symptom**: Queries take >5 seconds

**Solutions**:

1. Rebuild indexes:
```bash
docker-compose exec db psql -U irrexplorer -d irrexplorer -c "REINDEX DATABASE irrexplorer;"
```

2. Update statistics:
```bash
docker-compose exec db psql -U irrexplorer -d irrexplorer -c "ANALYZE;"
```

3. Check query plans:
```sql
EXPLAIN ANALYZE SELECT * FROM bgp WHERE prefix >>= '1.1.1.0/24';
```

4. See `PERFORMANCE_OPTIMIZATIONS.md` for detailed tuning

### Memory Issues

**Symptom**: Services crash with OOM errors

**Solutions**:

1. Reduce workers:
```bash
HTTP_WORKERS=2  # In .env
```

2. Limit Docker memory:
```yaml
# docker-compose.yml
services:
  backend:
    mem_limit: 2g
```

3. Optimize PostgreSQL (reduce shared_buffers)

### SSL/TLS Errors

**Symptom**: `SSL certificate verification failed`

**Solution**:
```bash
# If behind corporate proxy, disable verification (not recommended)
export PYTHONHTTPSVERIFY=0

# Or add corporate CA certificate
export REQUESTS_CA_BUNDLE=/path/to/ca-bundle.crt
```

## Next Steps

After successful installation:

1. **Review Security**: See `SECURITY_CONFIGURATION.md`
2. **Setup Monitoring**: Configure logging and alerting
3. **Enable HTTPS**: Use Let's Encrypt or similar
4. **Configure Backups**: Automate database backups
5. **Performance Tuning**: See `PERFORMANCE_OPTIMIZATIONS.md`
6. **Development Setup**: See `DEVELOPMENT.md`

## Getting Help

- **Documentation**: See `DOCKER.md`, `SECURITY_CONFIGURATION.md`
- **Issues**: https://github.com/yourusername/irrexplorer/issues
- **Logs**: `docker-compose logs -f` or check `/var/log/`

## Uninstallation

### Docker

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: Deletes all data)
docker-compose down -v

# Remove images
docker rmi irrexplorer_backend irrexplorer_frontend
```

### Manual

```bash
# Stop services
sudo systemctl stop irrexplorer

# Remove files
rm -rf /opt/irrexplorer

# Drop database
sudo -u postgres psql -c "DROP DATABASE irrexplorer;"
sudo -u postgres psql -c "DROP USER irrexplorer;"

# Remove nginx config
sudo rm /etc/nginx/sites-enabled/irrexplorer
sudo systemctl reload nginx
```
