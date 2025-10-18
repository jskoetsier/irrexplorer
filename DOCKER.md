# Docker Deployment Guide

This guide explains how to run IRRExplorer using Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 10GB+ disk space

## Quick Start

### Production Deployment

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd irrexplorer
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your production settings
   nano .env
   ```

3. **Update ALLOWED_ORIGINS** (CRITICAL for production)
   ```bash
   # In .env file:
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   DEBUG=False
   ```

4. **Build and start services**
   ```bash
   docker-compose up -d
   ```

5. **Import initial data**
   ```bash
   docker-compose exec backend python -m irrexplorer.commands.import_data
   ```

6. **Access the application**
   - Frontend: http://localhost
   - Backend API: http://localhost:8000
   - Database: localhost:5432

### Development Mode

For development with hot-reload:

```bash
docker-compose -f docker-compose.dev.yml up
```

This will:
- Enable hot-reload for backend (uvicorn --reload)
- Enable hot-reload for frontend (yarn start)
- Set DEBUG=True
- Allow all CORS origins

Access:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## Architecture

```
┌─────────────────┐
│   Frontend      │  nginx:alpine (production)
│   (React SPA)   │  node:18 (development)
│   Port: 80/3000 │
└────────┬────────┘
         │
         │ /api/* → proxy
         │
┌────────▼────────┐
│   Backend       │  Python 3.11
│   (FastAPI)     │  uvicorn
│   Port: 8000    │
└────────┬────────┘
         │
         │ PostgreSQL protocol
         │
┌────────▼────────┐
│   Database      │  PostgreSQL 15
│   Port: 5432    │
└─────────────────┘
```

## Docker Services

### 1. Database (`db`)
- **Image**: postgres:15-alpine
- **Purpose**: Store BGP routes, IRR data, RIR stats
- **Volume**: `postgres_data` (persistent)
- **Health check**: pg_isready

### 2. Backend (`backend`)
- **Build**: Dockerfile
- **Purpose**: FastAPI application serving GraphQL and REST APIs
- **Dependencies**: Requires `db` to be healthy
- **Auto-migration**: Runs `alembic upgrade head` on startup

### 3. Frontend (`frontend`)
- **Build**: Dockerfile.frontend (multi-stage)
- **Purpose**: Serve React SPA and proxy API requests
- **Features**:
  - Gzip compression
  - Static asset caching
  - Security headers
  - API proxying to backend

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
DATABASE_URL=postgresql://irrexplorer:irrexplorer_password@db:5432/irrexplorer
IRRD_ENDPOINT=https://irrd.nlnog.net/graphql
ALLOWED_ORIGINS=https://yourdomain.com

# Optional (with defaults)
DEBUG=False
BGP_SOURCE=https://bgp.tools/table.jsonl
BGP_SOURCE_MINIMUM_HITS=20
HTTP_WORKERS=4
```

### Port Mapping

Default ports (configurable in docker-compose.yml):
- **80**: Frontend (nginx)
- **8000**: Backend API
- **5432**: PostgreSQL

To change ports, edit `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # Frontend on port 8080
  - "9000:8000"  # Backend on port 9000
```

## Common Operations

### Start Services
```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Rebuild Services
```bash
# Rebuild all
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

### Database Operations

#### Access PostgreSQL
```bash
docker-compose exec db psql -U irrexplorer -d irrexplorer
```

#### Run Migrations
```bash
docker-compose exec backend alembic upgrade head
```

#### Create Migration
```bash
docker-compose exec backend alembic revision --autogenerate -m "description"
```

#### Backup Database
```bash
docker-compose exec db pg_dump -U irrexplorer irrexplorer > backup.sql
```

#### Restore Database
```bash
cat backup.sql | docker-compose exec -T db psql -U irrexplorer -d irrexplorer
```

### Import Data

#### Full Import (BGP + RIR Stats)
```bash
docker-compose exec backend python -m irrexplorer.commands.import_data
```

#### BGP Only
```bash
docker-compose exec backend python -c "from irrexplorer.backends.bgp import BGPImporter; import asyncio; asyncio.run(BGPImporter().run_import())"
```

#### RIR Stats Only
```bash
docker-compose exec backend python -c "from irrexplorer.backends.rirstats import import_all; import asyncio; asyncio.run(import_all())"
```

### Shell Access

```bash
# Backend shell
docker-compose exec backend bash

# Frontend shell (production)
docker-compose exec frontend sh

# Database shell
docker-compose exec db sh
```

### Health Checks

Check service health:
```bash
docker-compose ps
```

Test endpoints:
```bash
# Backend health
curl http://localhost:8000/api/metadata/

# Frontend health
curl http://localhost/
```

## Volumes and Data Persistence

### Named Volumes
- `postgres_data`: PostgreSQL database files
- `postgres_data_dev`: Development database (separate)

### Volume Management

List volumes:
```bash
docker volume ls
```

Inspect volume:
```bash
docker volume inspect irrexplorer_postgres_data
```

Remove volumes (CAUTION: Data loss):
```bash
docker-compose down -v
```

Backup volume:
```bash
docker run --rm -v irrexplorer_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

Restore volume:
```bash
docker run --rm -v irrexplorer_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /data
```

## Production Deployment

### 1. Use Production Compose File

Ensure you're using `docker-compose.yml` (not dev):
```bash
docker-compose -f docker-compose.yml up -d
```

### 2. Set Production Environment Variables

```bash
# .env file
DEBUG=False
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
```

### 3. Enable HTTPS

Use a reverse proxy like Traefik, nginx, or Caddy:

#### Option A: Traefik (Recommended)
```yaml
# docker-compose.prod.yml
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.irrexplorer.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.irrexplorer.tls.certresolver=letsencrypt"
```

#### Option B: nginx Reverse Proxy
See `SECURITY_CONFIGURATION.md` for nginx SSL setup.

### 4. Configure Resource Limits

Add resource constraints:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### 5. Set Up Monitoring

Add monitoring services:
```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
```

### 6. Configure Log Rotation

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Troubleshooting

### Service Won't Start

1. Check logs:
   ```bash
   docker-compose logs backend
   ```

2. Verify environment variables:
   ```bash
   docker-compose config
   ```

3. Check port conflicts:
   ```bash
   netstat -tuln | grep -E "80|8000|5432"
   ```

### Database Connection Issues

1. Verify database is healthy:
   ```bash
   docker-compose ps db
   ```

2. Test connection:
   ```bash
   docker-compose exec backend python -c "from irrexplorer.settings import DATABASE_URL; print(DATABASE_URL)"
   ```

3. Check network:
   ```bash
   docker-compose exec backend ping db
   ```

### Frontend Can't Reach Backend

1. Check nginx configuration:
   ```bash
   docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
   ```

2. Test backend from frontend container:
   ```bash
   docker-compose exec frontend wget -O- http://backend:8000/api/metadata/
   ```

3. Verify CORS settings in backend logs

### High Memory Usage

1. Check container stats:
   ```bash
   docker stats
   ```

2. Reduce workers:
   ```bash
   HTTP_WORKERS=2
   ```

3. Limit container memory:
   ```yaml
   services:
     backend:
       mem_limit: 2g
   ```

### Slow Performance

1. Check resource usage:
   ```bash
   docker stats
   ```

2. Optimize database:
   ```bash
   docker-compose exec db psql -U irrexplorer -c "VACUUM ANALYZE;"
   ```

3. Review database indexes (see `PERFORMANCE_OPTIMIZATIONS.md`)

### Build Failures

1. Clear build cache:
   ```bash
   docker-compose build --no-cache
   ```

2. Remove old images:
   ```bash
   docker image prune -a
   ```

3. Check disk space:
   ```bash
   docker system df
   ```

## Maintenance

### Regular Tasks

1. **Update data** (daily/weekly):
   ```bash
   docker-compose exec backend python -m irrexplorer.commands.import_data
   ```

2. **Backup database** (daily):
   ```bash
   docker-compose exec db pg_dump -U irrexplorer irrexplorer | gzip > backup-$(date +%Y%m%d).sql.gz
   ```

3. **Update images** (monthly):
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

4. **Clean up** (weekly):
   ```bash
   docker system prune -f
   ```

### Scheduled Data Import

Use cron or systemd timer:

```cron
# /etc/cron.d/irrexplorer-import
0 2 * * * cd /path/to/irrexplorer && docker-compose exec -T backend python -m irrexplorer.commands.import_data >> /var/log/irrexplorer-import.log 2>&1
```

## Security Considerations

1. **Change default passwords**:
   ```yaml
   environment:
     POSTGRES_PASSWORD: use_strong_random_password
   ```

2. **Don't expose PostgreSQL** in production:
   ```yaml
   # Remove ports section from db service
   ```

3. **Use secrets** for sensitive data:
   ```yaml
   secrets:
     db_password:
       file: ./secrets/db_password.txt
   ```

4. **Enable firewall rules**:
   ```bash
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw deny 5432/tcp
   ```

5. **Regular updates**:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

## Performance Tuning

### PostgreSQL

Add to docker-compose.yml:
```yaml
services:
  db:
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "effective_cache_size=1GB"
      - "-c"
      - "maintenance_work_mem=64MB"
      - "-c"
      - "max_connections=100"
```

### Backend

Adjust workers based on available CPU:
```yaml
environment:
  HTTP_WORKERS: 4  # num_cores * 2
```

### Frontend (nginx)

Already optimized with:
- Gzip compression
- Static asset caching
- Connection pooling

## Upgrading

### Application Updates

1. Pull latest code:
   ```bash
   git pull origin main
   ```

2. Rebuild and restart:
   ```bash
   docker-compose up -d --build
   ```

3. Run migrations:
   ```bash
   docker-compose exec backend alembic upgrade head
   ```

### Database Migration

For major version upgrades:
1. Backup database
2. Stop services
3. Update PostgreSQL image version
4. Start services
5. Verify data integrity

## Additional Resources

- Docker Compose docs: https://docs.docker.com/compose/
- PostgreSQL Docker: https://hub.docker.com/_/postgres
- nginx Docker: https://hub.docker.com/_/nginx
- Performance guide: `PERFORMANCE_OPTIMIZATIONS.md`
- Security guide: `SECURITY_CONFIGURATION.md`
