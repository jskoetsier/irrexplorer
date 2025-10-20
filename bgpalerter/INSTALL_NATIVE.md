# BGPalerter Native Installation (Without Docker)

## Why Run Natively?
Running BGPalerter directly on the host instead of in a container:
- ✅ Allows interactive auto-configuration without stdin issues
- ✅ Simpler file management (no volume mounting)
- ✅ Easier debugging and logs access
- ✅ Better performance (no container overhead)

## Installation Steps

### 1. Install Node.js (if not already installed)
```bash
# On Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Download and Install BGPalerter
```bash
# Create directory for BGPalerter
sudo mkdir -p /opt/bgpalerter
cd /opt/bgpalerter

# Download the binary
sudo wget https://github.com/nttgin/BGPalerter/releases/latest/download/bgpalerter-linux-x64
sudo chmod +x bgpalerter-linux-x64

# Or clone from source
# git clone https://github.com/nttgin/BGPalerter.git .
# npm install
```

### 3. Run Interactive Configuration
```bash
cd /opt/bgpalerter

# Auto-generate configuration for AS8315
sudo ./bgpalerter-linux-x64 generate -a 8315 -o prefixes.yml -m

# Or run interactively to generate both config and prefixes
sudo ./bgpalerter-linux-x64
# Answer prompts:
# - Auto-configure? Yes
# - ASN to monitor? 8315
# - New prefix alerts? No (optional)
# - Upstream AS monitoring? Yes
# - Downstream AS monitoring? Yes
```

### 4. Copy Custom Config
After auto-generation completes, merge our webhook configuration:
```bash
# Backup auto-generated config
sudo cp /opt/bgpalerter/config.yml /opt/bgpalerter/config.yml.auto

# Copy our custom config from the repo
sudo cp /opt/irrexplorer/bgpalerter/config.yml /opt/bgpalerter/config.yml

# Keep the auto-generated prefixes.yml (it has real AS8315 data)
# The prefixes.yml should already be in /opt/bgpalerter/
```

### 5. Create Systemd Service
```bash
sudo tee /etc/systemd/system/bgpalerter.service > /dev/null <<EOF
[Unit]
Description=BGPalerter - BGP Monitoring and Alerting
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bgpalerter
ExecStart=/opt/bgpalerter/bgpalerter-linux-x64
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable bgpalerter
sudo systemctl start bgpalerter
```

### 6. Verify It's Running
```bash
# Check service status
sudo systemctl status bgpalerter

# View logs
sudo journalctl -u bgpalerter -f

# Check health endpoint
curl http://localhost:8011/status
```

## Configuration Files Location
- **Binary**: `/opt/bgpalerter/bgpalerter-linux-x64`
- **Config**: `/opt/bgpalerter/config.yml`
- **Prefixes**: `/opt/bgpalerter/prefixes.yml`
- **Logs**: `/opt/bgpalerter/logs/`

## Managing the Service
```bash
# Start
sudo systemctl start bgpalerter

# Stop
sudo systemctl stop bgpalerter

# Restart
sudo systemctl restart bgpalerter

# View logs
sudo journalctl -u bgpalerter -n 100 -f

# Disable auto-start
sudo systemctl disable bgpalerter
```

## Updating Configuration
After modifying config files:
```bash
sudo systemctl restart bgpalerter
sudo journalctl -u bgpalerter -f  # Watch logs for errors
```

## Remove Docker Version
Once native version is working, remove the containerized version:
```bash
cd /opt/irrexplorer
podman-compose stop bgpalerter
podman rm -f irrexplorer-bgpalerter

# Comment out bgpalerter service in docker-compose.yml
```

## Advantages Over Container Approach
1. **No stdin issues** - Interactive configuration works perfectly
2. **Direct file access** - Easy to edit and view config files
3. **Better logging** - Logs go directly to systemd journal
4. **Simpler updates** - Just replace the binary and restart
5. **Native performance** - No container overhead

## Webhook Configuration
The config.yml includes webhook URLs pointing to the irrexplorer backend:
- `http://backend:8000/api/bgpalerter/webhook/*`

Since BGPalerter runs natively, change these to:
- `http://localhost:8000/api/bgpalerter/webhook/*` (if backend runs locally)
- Or use the actual backend host/IP if backend is in a container
