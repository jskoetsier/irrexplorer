# Docker Deployment Guide

This guide explains how to run IRRExplorer using Docker Compose.

## Prerequisites

- Docker Engine 20.10+ or Podman 20.10+
- Docker Compose 2.0+ or podman-compose 2.0+
- 4GB+ RAM available
- 10GB+ disk space

## Quick Start

### Production Deployment

1. **Clone the repository**
   ```bash
   git clone https://github.com/jskoetsier/irrexplorer.git
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
   docker compose up -d
   # or: podman-compose up -d
   ```

5. **Import initial data**
   ```bash
   docker compose run go-backend go run ./cmd/importer
   ```

6. **Access the application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:8080/api
   - Database: localhost:5432

### Development Mode

For development with hot-reload:

```bash
# Start services
docker compose up -d

# The frontend and backend support development workflows
# Frontend: use npm run dev in frontend/ directory
# Backend: use go run ./cmd/api in go-backend/ directory
```

## Architecture

```
┌─────────────────┐
│   Frontend      │  nginx:alpine
│   (React SPA)   │  Port: 80 → mapped to 8080
└────────┬────────┘
         │
         │ /api/* → proxy
         │
┌────────▼────────┐
│   Go Backend    │  golang:alpine
│   Port: 8080    │
└────────┬────────┘
         │
         │ PostgreSQL protocol
         │
┌────────▼────────┐
│   PostgreSQL    │  postgres:15
│   Port: 5432    │
└────────┬────────┘
         │
         │ Redis protocol
         │
┌────────▼────────┐
│   Redis         │  redis:7-alpine
│   Port: 6379    │
└─────────────────┘
```

## Docker Services

### 1. PostgreSQL (`postgres`)
- **Image**: postgres:15-alpine
- **Purpose**: Store BGP routes, IRR data, RIR stats
- **Volume**: `postgres_data` (persistent)
- **Health check**: pg_isready

### 2. Redis (`redis`)
- **Image**: redis:7-alpine
- **Purpose**: Caching layer for API responses
- **Health check**: redis-cli ping

### 3. Go Backend (`go-backend`)
- **Build**: Dockerfile.go-backend
- **Purpose**: Go API server serving REST endpoints
- **Dependencies**: Requires `postgres` and `redis` to be healthy
- **Features**:
  - Rate limiting
  - CORS handling
  - Redis caching
  - IRRd GraphQL integration

### 4. Frontend (`frontend`)
- **Build**: Dockerfile.frontend (multi-stage)
- **Purpose**: Serve React SPA and proxy API requests to Go backend
- **Features**:
  - Gzip compression
  - Static asset caching
  - Security headers
  - API proxying to go-backend

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
DATABASE_URL=postgresql://irrexplorer:irrexplorer_password@postgres:5432/irrexplorer
REDIS_URL=redis://redis:6379/0
IRRD_ENDPOINT=https://irrd.nlnog.net/graphql
ALLOWED_ORIGINS=https://yourdomain.com

# Optional (with defaults)
DEBUG=False
LOOKING_GLASS_URL=https://lg.ring.nlnog.net
MINIMUM_PREFIX_SIZE_IPV4=9
MINIMUM_PREFIX_SIZE_IPV6=29
```

### Port Mapping

Default ports (configurable in docker-compose.yml):
- **8080**: Frontend (nginx) → mapped to host
- **5432**: PostgreSQL
- **6379**: Redis

## Common Operations

### Start Services
```bash
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f go-backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### Rebuild Services
```bash
# Rebuild all
docker compose up -d --build

# Rebuild specific service
docker compose up -d --build go-backend
```

### Database Operations

#### Access PostgreSQL
```bash
docker compose exec postgres psql -U irrexplorer -d irrexplorer
```

#### Run SQL Migrations
```bash
docker compose exec go-backend sh -c 'go run ./cmd/api -migrate'
# Or manually:
docker compose exec postgres psql -U irrexplorer -d irrexplorer -f /docker-entrypoint-initdb.d/001_init.sql
```

#### Backup Database
```bash
docker compose exec postgres pg_dump -U irrexplorer irrexplorer > backup.sql
```

#### Restore Database
```bash
cat backup.sql | docker compose exec -T postgres psql -U irrexplorer -d irrexplorer
```

### Import Data

```bash
# Full import (BGP + RIR Stats + RPKI)
docker compose run go-backend go run ./cmd/importer
```

### Shell Access

```bash
# Go backend shell
docker compose exec go-backend sh

# Frontend shell (production)
docker compose exec frontend sh

# Database shell
docker compose exec postgres sh
```

### Health Checks

Check service health:
```bash
docker compose ps
```

Test endpoints:
```bash
# Backend health
curl http://localhost:8080/api/healthz

# Frontend health
curl http://localhost:8080/
```

## Volumes and Data Persistence

### Named Volumes
- `postgres_data`: PostgreSQL database files

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
docker compose down -v
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

Ensure you're using `docker-compose.yml`:
```bash
docker compose up -d
```

### 2. Set Production Environment Variables

```bash
# .env file
DEBUG=False
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
```

### 3. Enable HTTPS

Use a reverse proxy like Traefik, nginx, or Caddy with SSL certificates.

#### Traefik Example (docker-compose.prod.yml)
```yaml
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.irrexplorer.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.irrexplorer.tls.certresolver=letsencrypt"
```

### 4. Configure Resource Limits

Add resource constraints:
```yaml
services:
  go-backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 5. Set Up Monitoring

Add monitoring services (Prometheus, Grafana) as needed.

### 6. Configure Log Rotation

```yaml
services:
  go-backend:
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
   docker compose logs go-backend
   ```

2. Verify environment variables:
   ```bash
   docker compose config
   ```

3. Check port conflicts:
   ```bash
   netstat -tuln | grep -E "5432|6379|8080"
   ```

### Database Connection Issues

1. Verify database is healthy:
   ```bash
   docker compose ps postgres
   ```

2. Test connection from backend:
   ```bash
   docker compose exec go-backend sh -c 'echo $DATABASE_URL'
   ```

3. Check network:
   ```bash
   docker compose exec go-backend ping postgres
   ```

### Frontend Can't Reach Backend

1. Check nginx configuration:
   ```bash
   docker compose exec frontend cat /etc/nginx/conf.d/default.conf
   ```

2. Test backend from frontend container:
   ```bash
   docker compose exec frontend wget -O- http://go-backend:8080/api/healthz
   ```

### High Memory Usage

1. Check container stats:
   ```bash
   docker stats
   ```

2. Limit container memory:
   ```yaml
   services:
     go-backend:
       mem_limit: 2g
   ```

### Slow Performance

1. Check resource usage:
   ```bash
   docker stats
   ```

2. Optimize database:
   ```bash
   docker compose exec postgres psql -U irrexplorer -d irrexplorer -c "VACUUM ANALYZE;"
   ```

3. Review database indexes

### Build Failures

1. Clear build cache:
   ```bash
   docker compose build --no-cache
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
   docker compose run go-backend go run ./cmd/importer
   ```

2. **Backup database** (daily):
   ```bash
   docker compose exec postgres pg_dump -U irrexplorer irrexplorer | gzip > backup-$(date +%Y%m%d).sql.gz
   ```

3. **Update images** (monthly):
   ```bash
   docker compose pull
   docker compose up -d
   ```

4. **Clean up** (weekly):
   ```bash
   docker system prune -f
   ```

### Scheduled Data Import

Use cron:

```cron
# /etc/cron.d/irrexplorer-import
0 2 * * * cd /path/to/irrexplorer && docker compose run -T go-backend go run ./cmd/importer >> /var/log/irrexplorer-import.log 2>&1
```

## Security Considerations

1. **Change default passwords**:
   ```yaml
   environment:
     POSTGRES_PASSWORD: use_strong_random_password
   ```

2. **Don't expose PostgreSQL/Redis** in production:
   ```yaml
   # Remove ports section from postgres/redis services
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
   ufw deny 6379/tcp
   ```

5. **Regular updates**:
   ```bash
   docker compose pull
   docker compose up -d
   ```

## Performance Tuning

### PostgreSQL

Add to docker-compose.yml:
```yaml
services:
  postgres:
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

### Go Backend

The Go backend is already optimized with:
- Connection pooling via pgx
- Redis caching for external queries
- Concurrent query processing
- Rate limiting

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
   docker compose up -d --build
   ```

3. Run any database migrations if needed

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
- Redis Docker: https://hub.docker.com/_/redis
- nginx Docker: https://hub.docker.com/_/nginx