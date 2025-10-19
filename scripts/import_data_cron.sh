#!/bin/bash
#
# Cron script for importing BGP and IRR data
#
# Add to crontab to run every 4 hours:
# 0 */4 * * * /opt/irrexplorer/scripts/import_data_cron.sh >> /var/log/irrexplorer/data_import.log 2>&1
#

set -e

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/opt/irrexplorer}"
LOG_DIR="${LOG_DIR:-/var/log/irrexplorer}"
LOCK_FILE="${LOCK_FILE:-/tmp/irrexplorer_import.lock}"
PODMAN_CONTAINER="${PODMAN_CONTAINER:-irrexplorer-backend}"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if another import is running
if [ -f "$LOCK_FILE" ]; then
    log "ERROR: Another import process is already running (lock file exists: $LOCK_FILE)"
    exit 1
fi

# Create lock file
touch "$LOCK_FILE"

# Cleanup on exit
cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

log "Starting data import..."

# Change to project directory
cd "$PROJECT_DIR"

# Run data import using podman
if command -v podman &> /dev/null; then
    log "Using podman to run import..."
    podman exec "$PODMAN_CONTAINER" python -m irrexplorer.commands.import_data
    exit_code=$?
elif command -v docker &> /dev/null; then
    log "Using docker to run import..."
    docker exec "$PODMAN_CONTAINER" python -m irrexplorer.commands.import_data
    exit_code=$?
else
    log "ERROR: Neither podman nor docker found"
    exit 1
fi

if [ $exit_code -eq 0 ]; then
    log "Data import completed successfully"

    # Clear Redis cache to force visualizations to reload
    log "Clearing Redis cache..."
    if command -v podman &> /dev/null; then
        podman exec irrexplorer-redis redis-cli FLUSHALL
    elif command -v docker &> /dev/null; then
        docker exec irrexplorer-redis redis-cli FLUSHALL
    fi

    log "Cache cleared successfully"
else
    log "ERROR: Data import failed with exit code $exit_code"
    exit $exit_code
fi

log "Process completed"
