# Backend Dockerfile
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install uv - fast Python package installer
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY requirements.txt ./

# Install Python dependencies with uv (10-100x faster than pip)
RUN uv pip install --system --no-cache -r requirements.txt

# Copy application code
COPY irrexplorer/ ./irrexplorer/
COPY alembic.ini ./
COPY scripts.py ./

# Create directory for frontend build
RUN mkdir -p frontend/build

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/metadata/ || exit 1

# Run migrations and start server with gunicorn and multiple workers
CMD ["sh", "-c", "alembic upgrade head && gunicorn irrexplorer.app:app --workers ${HTTP_WORKERS:-4} --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 120"]
