# Backend Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Poetry
RUN pip install --no-cache-dir poetry==1.7.1

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install Python dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root --only main

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

# Run migrations and start server
CMD ["sh", "-c", "alembic upgrade head && uvicorn irrexplorer.app:app --host 0.0.0.0 --port 8000"]
