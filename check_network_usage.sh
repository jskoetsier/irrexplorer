#!/bin/bash
#
# Script to identify which process is using high network bandwidth
# Run this on the remote server to identify the 150mbit process
#

echo "=== Network Bandwidth Monitoring Script ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Note: Some tools may require root/sudo privileges for full information"
    echo ""
fi

# Method 1: Using nethogs (most detailed per-process bandwidth)
echo "--- Method 1: nethogs (per-process bandwidth) ---"
if command -v nethogs &> /dev/null; then
    echo "Running nethogs for 10 seconds..."
    timeout 10 nethogs -t || echo "Install nethogs: sudo apt install nethogs (Debian/Ubuntu) or sudo yum install nethogs (RHEL/CentOS)"
else
    echo "nethogs not found. Install with: sudo apt install nethogs (Debian/Ubuntu) or sudo yum install nethogs (RHEL/CentOS)"
fi
echo ""

# Method 2: Using iftop (interface traffic)
echo "--- Method 2: iftop (interface traffic) ---"
if command -v iftop &> /dev/null; then
    echo "Running iftop for 10 seconds (text mode)..."
    timeout 10 iftop -t -s 10 || echo "Install iftop: sudo apt install iftop"
else
    echo "iftop not found. Install with: sudo apt install iftop"
fi
echo ""

# Method 3: Using nload (simple bandwidth monitor)
echo "--- Method 3: nload (bandwidth monitor) ---"
if command -v nload &> /dev/null; then
    echo "Current network load:"
    nload -m
else
    echo "nload not found. Install with: sudo apt install nload"
fi
echo ""

# Method 4: Docker/Podman container stats
echo "--- Method 4: Container Network Stats ---"
if command -v docker &> /dev/null; then
    echo "Docker container stats:"
    docker stats --no-stream --format "table {{.Container}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
fi

if command -v podman &> /dev/null; then
    echo "Podman container stats:"
    podman stats --no-stream --format "table {{.Container}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
fi
echo ""

# Method 5: Check running processes with network connections
echo "--- Method 5: Processes with Network Connections ---"
echo "Top processes by network connections:"
ss -tunap 2>/dev/null | awk '{print $7}' | cut -d',' -f2 | cut -d'=' -f2 | sort | uniq -c | sort -rn | head -10
echo ""

# Method 6: Check IRRExplorer specific processes
echo "--- Method 6: IRRExplorer/BGPalerter Specific Checks ---"
echo "IRRExplorer containers:"
docker ps --filter "name=irrexplorer" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not available or no containers running"
echo ""

echo "BGPalerter container:"
docker ps --filter "name=bgpalerter" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not available or no containers running"
echo ""

# Check Routinator (RPKI validator - downloads RPKI data)
echo "Routinator container (downloads RPKI data):"
docker ps --filter "name=routinator" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not available or no containers running"
echo ""

# Method 7: Check cron jobs that might be running
echo "--- Method 7: Running Cron Jobs ---"
if [ -f /tmp/irrexplorer_import.lock ]; then
    echo "⚠️  Data import is currently running (lock file exists)"
    echo "This process downloads BGP/IRR data and can use significant bandwidth"
fi
echo ""

# Method 8: Check specific processes by name
echo "--- Method 8: Check Specific Process Types ---"
echo "Python processes (may include data import):"
ps aux | grep -E "(python|import_data)" | grep -v grep
echo ""

echo "BGPalerter processes:"
ps aux | grep bgpalerter | grep -v grep
echo ""

echo "Routinator processes (RPKI sync uses bandwidth):"
ps aux | grep routinator | grep -v grep
echo ""

echo "=== Recommendations ==="
echo "1. Most likely high bandwidth processes in IRRExplorer:"
echo "   - routinator: Downloads RPKI data from TALs (periodic sync)"
echo "   - bgpalerter: Monitors BGP feeds (continuous streaming)"
echo "   - import_data_cron.sh: Downloads BGP and IRR data (runs every 4 hours)"
echo ""
echo "2. To stop/restart containers:"
echo "   docker stop <container-name>"
echo "   docker restart <container-name>"
echo ""
echo "3. To check Routinator logs:"
echo "   docker logs irrexplorer-routinator"
echo ""
echo "4. To check BGPalerter logs:"
echo "   docker logs irrexplorer-bgpalerter"
