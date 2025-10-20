# BGPalerter Setup

## Solution
According to [BGPalerter official Docker documentation](https://github.com/nttgin/BGPalerter/blob/main/docs/installation.md), config files should be placed inside the volume directory, not mounted separately.

## Setup Instructions

1. **First-time setup on remote server:**
   ```bash
   ssh phreak@195.95.177.11
   cd /opt/irrexplorer
   git pull

   # Stop bgpalerter if running
   podman-compose stop bgpalerter
   podman rm irrexplorer-bgpalerter

   # Start bgpalerter in interactive mode for initial configuration
   podman run -it --rm \
     -v $(pwd)/bgpalerter_data:/opt/bgpalerter/volume \
     nttgin/bgpalerter:latest run serve -- --d /opt/bgpalerter/volume/
   ```

2. **During the interactive setup:**
   - BGPalerter will auto-generate `config.yml` and ask for ASN to monitor
   - Enter `8315` when prompted for ASN
   - It will generate `prefixes.yml` automatically from BGP data
   - Press Ctrl+C when setup is complete

3. **Copy our custom config into the volume:**
   ```bash
   # Backup the auto-generated config
   sudo cp bgpalerter_data/config.yml bgpalerter_data/config.yml.auto

   # Copy our custom config
   sudo cp bgpalerter/config.yml bgpalerter_data/config.yml

   # Optionally update prefixes.yml if needed
   sudo cp bgpalerter/prefixes.yml bgpalerter_data/prefixes.yml
   ```

4. **Start BGPalerter normally:**
   ```bash
   podman-compose up -d bgpalerter
   ```

5. **Verify it's running:**
   ```bash
   podman-compose logs bgpalerter
   curl http://localhost:8011/status
   ```

## Current Configuration

The docker-compose.yml has been fixed to use the correct command:
```yaml
command: run serve -- --d /opt/bgpalerter/volume/
```

All BGPalerter data (config, prefixes, logs) will be stored in the `bgpalerter_data` Docker volume.

## Files
- `config.yml` - Our custom webhook configuration for irrexplorer backend
- `prefixes.yml` - Monitored prefixes (will be auto-generated or manually placed in volume)
- `README.md` - This file

## Monitoring
Once running, BGPalerter will:
- Monitor AS8315 and AS13335
- Send webhook alerts to irrexplorer backend at `http://backend:8000/api/bgpalerter/webhook/*`
- Provide status endpoint at `http://localhost:8011/status`
