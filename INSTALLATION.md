# Installation Guide

Complete installation guide for IRRExplorer - Internet Routing Registry Explorer.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Methods](#installation-methods)
3. [Docker/Podman Installation](#dockerpodman-installation)
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

#### For Docker/Podman Installation
- Podman 20.10+ or Docker 20.10+
- docker-compose/podman-compose 2.0+

#### For Manual Installation
- Go 1.25+
- PostgreSQL 15+
- Node.js 18+
- Redis 7+

## Installation Methods

### Quick Decision Guide

**Choose Docker/Podman if:**
- You want the fastest setup
- You need isolated environments
- You're deploying to production
- You want easy scaling

**Choose Manual if:**
- You need to customize the stack
- You're actively developing the Go backend
- You have specific versions of dependencies
- You need fine-grained control

## Docker/Podman Installation

### 1. Install Podman or Docker

#### Ubuntu/Debian
```bash
# Podman (recommended)
curl -fsSL https://podman.io -o get-podman.sh
sudo sh get-podman.sh

# Or Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

#### macOS
```bash
brew install --cask podman
# Or download from https://www.podman.com/products/podman-desktop
```

#### Windows
Download Podman Desktop from https://www.podman.com/products/podman-desktop

### 2. Clone Repository

```bash
git clone https://github.com/jskoetsier/irrexplorer.git
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
REDIS_URL=redis://redis:6379/0
IRRD_ENDPOINT=https://irrd.nlnog.net/graphql
ALLOWED_ORIGINS=http://localhost,http://localhost:8080
DEBUG=False
```

### 4. Start Services

```bash
podman-compose up -d
# or: docker compose up -d
```

### 5. Import Initial Data

```bash
# This will take 15-30 minutes depending on your connection
podman-compose run go-backend go run ./cmd/importer
```

### 6. Access Application

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8080/api

### 7. Verify Installation

```bash
# Check all services are running
podman-compose ps

# Check backend health
curl http://localhost:8080/api/healthz

# Check frontend
curl http://localhost:8080/
```

## Manual Installation

### 1. Install System Dependencies

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y \
    golang-go \
    postgresql-15 \
    postgresql-contrib \
    postgresql-15-postgis-3 \
    nodejs \
    npm \
    redis-server
```

#### macOS
```bash
brew install go postgresql@15 node redis
brew services start postgresql@15
```

### 2. Clone and Setup

```bash
git clone https://github.com/jskoetsier/irrexplorer.git
cd irrexplorer
```

### 3. Setup PostgreSQL Database

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

### 4. Configure Backend

```bash
# Create .env file
cp .env.example .env

# Edit configuration
nano .env
```

Update these values:
```bash
DATABASE_URL=postgresql://irrexplorer:your_secure_password@localhost:5432/irrexplorer
REDIS_URL=redis://localhost:6379/0
IRRD_ENDPOINT=https://irrd.nlnog.net/graphql
DEBUG=False
ALLOWED_ORIGINS=http://localhost:8080
```

### 5. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install
# or: yarn install

# Build for production
npm run build

cd ..
```

### 6. Start Backend (Go)

```bash
cd go-backend

# Run API server
go run ./cmd/api

# Or build and run
go build ./cmd/api
./api
```

### 7. Serve Frontend

#### Option A: Use nginx
```bash
sudo apt-get install nginx

# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/irrexplorer
sudo ln -s /etc/nginx/sites-available/irrexplorer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Option B: Simple HTTP Server (Development only)
```bash
cd frontend/build
npx serve -p 8080
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

Create necessary indexes for performance:

```sql
-- Connect to database
psql -U irrexplorer -d irrexplorer

-- Create indexes for BGP table
CREATE INDEX IF NOT EXISTS idx_bgp_asn ON bgp(asn);
CREATE INDEX IF NOT EXISTS idx_bgp_prefix ON bgp USING gist(prefix);

-- Create indexes for RIR stats table
CREATE INDEX IF NOT EXISTS idx_rirstats_prefix ON rirstats USING gist(prefix);

-- Create indexes for RPKI table
CREATE INDEX IF NOT EXISTS idx_rpki_asn ON rpki(asn);
CREATE INDEX IF NOT EXISTS idx_rpki_prefix ON rpki USING gist(prefix);
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
   - Source: RPKI validators
   - Updates: ROA data

### Running Full Import

```bash
# Docker
podman-compose run go-backend go run ./cmd/importer

# Manual
cd go-backend
go run ./cmd/importer
```

### Scheduling Automatic Updates

The Helm chart includes a CronJob for automatic imports. For manual scheduling using cron:

```bash
# Edit crontab
crontab -e

# Add daily update at 2 AM
0 2 * * * cd /path/to/irrexplorer && docker compose run go-backend go run ./cmd/importer >> /var/log/irrexplorer-import.log 2>&1
```

## Configuration

### Environment Variables Reference

```bash
# Database (Required)
DATABASE_URL=postgresql://user:password@host:port/database

# Redis (Required)
REDIS_URL=redis://host:port/0

# IRRd Endpoint (Required)
IRRD_ENDPOINT=https://irrd.nlnog.net/graphql

# CORS (Required for production)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Debug Mode (Default: False)
DEBUG=False

# Looking Glass URL
LOOKING_GLASS_URL=https://lg.ring.nlnog.net

# Prefix Filters (Defaults shown)
MINIMUM_PREFIX_SIZE_IPV4=9
MINIMUM_PREFIX_SIZE_IPV6=29
```

### Go Backend Configuration

The Go backend accepts these additional options via command line or environment:

- `--port`: Server port (default: 8080)
- `--database-url`: PostgreSQL connection string
- `--redis-url`: Redis connection string
- `--irrd-endpoint`: IRRd GraphQL endpoint
- `--allowed-origins`: CORS allowed origins

## Verification

### 1. Check Services

```bash
# Docker
podman-compose ps

# Expected output: All services "Up" and "healthy"
```

### 2. Test Backend API

```bash
# Health endpoint
curl http://localhost:8080/api/healthz

# Expected: {"status":"ok","service":"irrexplorer-go-backend"}

# Metadata endpoint
curl http://localhost:8080/api/metadata/

# Search endpoint
curl "http://localhost:8080/api/prefixes/prefix/8.8.8.0/24"
```

### 3. Test Frontend

```bash
# Homepage
curl -I http://localhost:8080/

# Expected: HTTP 200 OK
```

### 4. Verify Database

```bash
# Docker
podman-compose exec db psql -U irrexplorer -c "SELECT COUNT(*) FROM bgp;"

# Manual
psql -U irrexplorer -c "SELECT COUNT(*) FROM bgp;"

# Expected: >0 if import completed
```

### 5. Performance Check

```bash
# Time a query
time curl -s "http://localhost:8080/api/prefixes/prefix/1.1.1.0/24" > /dev/null

# Expected: <1 second for cached queries
```

## Troubleshooting

### Port Already in Use

**Symptom**: `Error: port 8080 is already in use`

**Solution**:
```bash
# Find process using port
sudo lsof -i :8080

# Kill process or change port in docker-compose.yml
```

### Database Connection Failed

**Symptom**: `could not connect to server`

**Solution**:
```bash
# Docker: Check database is healthy
podman-compose ps postgres

# Manual: Check PostgreSQL is running
sudo systemctl status postgresql

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
podman-compose logs go-backend
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
npm run build
```

3. Check nginx logs:
```bash
podman-compose logs frontend
```

### Slow Query Performance

**Symptom**: Queries take >5 seconds

**Solutions**:

1. Rebuild indexes:
```bash
podman-compose exec db psql -U irrexplorer -d irrexplorer -c "REINDEX DATABASE irrexplorer;"
```

2. Update statistics:
```bash
podman-compose exec db psql -U irrexplorer -d irrexplorer -c "ANALYZE;"
```

3. Check query plans:
```sql
EXPLAIN ANALYZE SELECT * FROM bgp WHERE prefix >>= '1.1.1.0/24';
```

### Memory Issues

**Symptom**: Services crash with OOM errors

**Solutions**:

1. Limit Docker memory:
```yaml
# docker-compose.yml
services:
  go-backend:
    mem_limit: 2g
```

2. Optimize PostgreSQL (reduce shared_buffers)

## Next Steps

After successful installation:

1. **Review Security**: Ensure ALLOWED_ORIGINS is properly configured
2. **Setup Monitoring**: Configure logging and alerting
3. **Enable HTTPS**: Use Let's Encrypt or similar
4. **Configure Backups**: Automate database backups
5. **Development Setup**: See DEVELOPMENT.md

## Getting Help

- **Documentation**: See DOCKER.md
- **Issues**: https://github.com/jskoetsier/irrexplorer/issues
- **Logs**: `podman-compose logs -f`

## Uninstallation

### Docker/Podman

```bash
# Stop and remove containers
podman-compose down

# Remove volumes (WARNING: Deletes all data)
podman-compose down -v

# Remove images
podman rmi irrexplorer_go-backend irrexplorer_frontend
```

### Manual

```bash
# Stop services
# (Ctrl+C the running go-backend process)

# Remove files
rm -rf /opt/irrexplorer

# Drop database
sudo -u postgres psql -c "DROP DATABASE irrexplorer;"
sudo -u postgres psql -c "DROP USER irrexplorer;"

# Remove nginx config
sudo rm /etc/nginx/sites-enabled/irrexplorer
sudo systemctl reload nginx
```