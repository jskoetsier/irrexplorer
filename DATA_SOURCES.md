# Data Source Integrations

This document describes the new data source integrations added to IRRExplorer.

## Overview

IRRExplorer now integrates with multiple external data sources to provide comprehensive routing and interconnection information:

1. **BGP Looking Glass** - Real-time BGP routing table information
2. **RDAP** - Registration data for IP addresses, ASNs, and domains
3. **PeeringDB** - Peering and interconnection data

## API Endpoints

### BGP Looking Glass (lg.ring.nlnog.net)

Query real-time BGP routing information from the NLNOG RING looking glass.

#### Endpoints

- `GET /api/datasources/lg/prefix/{prefix}` - Query BGP routes for a specific prefix
  - Example: `/api/datasources/lg/prefix/192.0.2.0/24`
  - Returns: Route information including AS path, origin, communities, peers

- `GET /api/datasources/lg/asn/{asn}` - Query prefixes announced by an ASN
  - Example: `/api/datasources/lg/asn/AS13335`
  - Returns: List of prefixes, AS name, total count

- `GET /api/datasources/lg/route/{prefix}?peer={peer_id}` - Detailed route information
  - Example: `/api/datasources/lg/route/192.0.2.0/24?peer=1`
  - Returns: Detailed BGP attributes (LOCAL_PREF, MED, atomic aggregate, etc.)

- `GET /api/datasources/lg/peers` - List available BGP peers
  - Returns: Array of available peer information

### RDAP (Registration Data Access Protocol)

Query registration data from Regional Internet Registries (RIRs).

#### Endpoints

- `GET /api/datasources/rdap/ip/{ip}?rir={rir}` - IP address registration data
  - Example: `/api/datasources/rdap/ip/8.8.8.8`
  - Optional `rir` parameter: `arin`, `ripe`, `apnic`, `lacnic`, `afrinic`
  - Returns: Allocation info, entities, status, registration dates

- `GET /api/datasources/rdap/asn/{asn}?rir={rir}` - ASN registration data
  - Example: `/api/datasources/rdap/asn/AS13335`
  - Returns: ASN name, type, country, entities, registration info

- `GET /api/datasources/rdap/domain/{domain}` - Domain registration data
  - Example: `/api/datasources/rdap/domain/example.com`
  - Returns: Nameservers, entities, status, registration/expiration dates

### PeeringDB

Query peering and interconnection information from PeeringDB.

#### Endpoints

- `GET /api/datasources/peeringdb/asn/{asn}` - Network peering information
  - Example: `/api/datasources/peeringdb/asn/AS13335`
  - Returns: Network details, facilities, IX connections, peering policy

- `GET /api/datasources/peeringdb/facility/{facility_id}` - Data center information
  - Example: `/api/datasources/peeringdb/facility/1`
  - Returns: Facility details, location, services

- `GET /api/datasources/peeringdb/ix/{ix_id}` - Internet Exchange information
  - Example: `/api/datasources/peeringdb/ix/1`
  - Returns: IX details, protocols, contact information

- `GET /api/datasources/peeringdb/search?q={query}` - Search networks
  - Example: `/api/datasources/peeringdb/search?q=cloudflare`
  - Returns: Array of matching networks

## Configuration

The data sources can be configured via environment variables:

```bash
# BGP Looking Glass
LOOKING_GLASS_URL=https://lg.ring.nlnog.net

# RDAP timeout (seconds)
RDAP_TIMEOUT=30

# PeeringDB timeout (seconds)
PEERINGDB_TIMEOUT=30

# Multiple BGP Sources
BGP_SOURCE=https://bgp.tools/table.jsonl
BGP_SOURCE_SECONDARY=https://stat.ripe.net/data/bgp-state/data.json

# Additional IRR Sources
ADDITIONAL_IRR_SOURCES=RADB,ALTDB,BELL,LEVEL3,RGNET,APNIC,JPIRR,ARIN,BBOI,NTTCOM
```

## Usage Examples

### Example 1: Get BGP routes for a prefix

```bash
curl http://localhost:8000/api/datasources/lg/prefix/1.1.1.0/24
```

Response:
```json
{
  "prefix": "1.1.1.0/24",
  "routes": [
    {
      "prefix": "1.1.1.0/24",
      "as_path": [174, 13335],
      "origin_asn": 13335,
      "next_hop": "198.32.160.94",
      "peer": "peer1",
      "communities": ["174:21101", "174:22013"],
      "local_pref": 100,
      "med": null
    }
  ],
  "total_routes": 1
}
```

### Example 2: Get RDAP information for an IP

```bash
curl http://localhost:8000/api/datasources/rdap/ip/8.8.8.8
```

Response:
```json
{
  "start_address": "8.8.8.0",
  "end_address": "8.8.8.255",
  "ip_version": "v4",
  "name": "GOOGLE",
  "type": "DIRECT ALLOCATION",
  "country": "US",
  "entities": [...],
  "status": ["active"],
  "rir": "arin",
  "handle": "NET-8-8-8-0-1",
  "registration_date": "2014-03-14",
  "last_changed_date": "2014-03-14"
}
```

### Example 3: Get PeeringDB info for an ASN

```bash
curl http://localhost:8000/api/datasources/peeringdb/asn/13335
```

Response:
```json
{
  "asn": 13335,
  "name": "Cloudflare, Inc.",
  "website": "https://www.cloudflare.com",
  "looking_glass": "https://www.cloudflare.com/network/",
  "irr_as_set": "AS-CLOUDFLARE",
  "policy_general": "Open",
  "facilities": [...],
  "ix_connections": [...]
}
```

## Frontend Integration

The frontend now includes a modal component for viewing external data sources.

### Using the Data Sources Modal

On ASN and Prefix query result pages, you'll find an "External Data Sources" button that opens a modal with three tabs:

1. **BGP Looking Glass** - Real-time routing information
2. **RDAP** - Registration and allocation data
3. **PeeringDB** - Peering and interconnection details (ASN queries only)

### Implementation Details

**Service Layer** (`frontend/src/services/dataSourceService.js`):
- API calls for all data sources
- Automatic ASN format handling (removes "AS" prefix)
- Proper URL encoding for prefixes and domains

**Modal Component** (`frontend/src/components/dataSources/DataSourcesModal.jsx`):
- Tab-based interface for different data sources
- Responsive design with dark theme
- Loading states and error handling
- Formatted data display with tables and info grids

**Integration Points**:
- `frontend/src/components/asnQuery.jsx` - ASN result pages
- `frontend/src/components/prefixQuery.jsx` - Prefix result pages

### Adding to Other Pages

To add the data sources modal to other components:

```jsx
import DataSourcesModal from "./dataSources/DataSourcesModal";

// In your component state
state = {
  showDataSources: false,
  // ...
};

// Add button
<button onClick={() => this.setState({showDataSources: true})}>
  External Data Sources
</button>

// Add modal
{this.state.showDataSources && (
  <DataSourcesModal
    query={yourQuery}
    type="asn" // or "prefix"
    onClose={() => this.setState({showDataSources: false})}
  />
)}
```

## Data Collection and Scheduling

The primary BGP and IRR data needs to be collected regularly to keep the application data fresh.

### Manual Import

Run the data import manually:

```bash
# Inside the backend container
python -m irrexplorer.commands.import_data

# Or from host with Docker/Podman
podman exec irrexplorer-backend python -m irrexplorer.commands.import_data
# or
docker exec irrexplorer-backend python -m irrexplorer.commands.import_data
```

### Automated Import with Cron

Use the provided cron script (`scripts/import_data_cron.sh`) to schedule regular imports:

1. **Setup the cron script**:
   ```bash
   # Make script executable (if not already)
   chmod +x /opt/irrexplorer/scripts/import_data_cron.sh

   # Create log directory
   sudo mkdir -p /var/log/irrexplorer
   sudo chown phreak:phreak /var/log/irrexplorer
   ```

2. **Add to crontab**:
   ```bash
   crontab -e
   ```

   Add this line to run every 4 hours:
   ```
   0 */4 * * * /opt/irrexplorer/scripts/import_data_cron.sh >> /var/log/irrexplorer/data_import.log 2>&1
   ```

3. **Alternative schedules**:
   ```bash
   # Every 6 hours
   0 */6 * * * /opt/irrexplorer/scripts/import_data_cron.sh >> /var/log/irrexplorer/data_import.log 2>&1

   # Daily at 2 AM
   0 2 * * * /opt/irrexplorer/scripts/import_data_cron.sh >> /var/log/irrexplorer/data_import.log 2>&1

   # Twice daily (2 AM and 2 PM)
   0 2,14 * * * /opt/irrexplorer/scripts/import_data_cron.sh >> /var/log/irrexplorer/data_import.log 2>&1
   ```

4. **Monitor logs**:
   ```bash
   # View recent import logs
   tail -f /var/log/irrexplorer/data_import.log

   # Check last import status
   tail -20 /var/log/irrexplorer/data_import.log
   ```

### What the Cron Script Does

The `import_data_cron.sh` script:
- Creates a lock file to prevent concurrent imports
- Runs the data import using podman/docker
- Clears Redis cache on success to refresh visualizations
- Logs all operations with timestamps
- Handles cleanup on exit

### Configuration

Customize the script via environment variables:
```bash
PROJECT_DIR=/opt/irrexplorer
LOG_DIR=/var/log/irrexplorer
LOCK_FILE=/tmp/irrexplorer_import.lock
PODMAN_CONTAINER=irrexplorer-backend
```

## Troubleshooting

### Visualizations showing empty data

1. Ensure data has been imported: `python -m irrexplorer.commands.import_data`
2. Check database contains data: `SELECT COUNT(*) FROM bgp;`
3. Clear Redis cache: `redis-cli FLUSHALL`
4. Restart backend: `docker-compose restart backend`

### External data source timeouts

- Increase timeout values in environment variables
- Check network connectivity to external services
- Review backend logs for specific error messages

### Rate limiting

External APIs may have rate limits. Implement caching strategies:
- Use longer TTL for RDAP/PeeringDB queries (1 hour+)
- Cache Looking Glass queries for 5-15 minutes
- Consider implementing request throttling
