# BGPalerter API Integration

This document describes how to integrate BGPalerter ASN monitoring with the irrexplorer UI.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│  UI / Web   │────────▶│   Backend    │────────▶│  BGPalerter  │
│  Interface  │         │   FastAPI    │         │  (Native)    │
└─────────────┘         └──────────────┘         └──────────────┘
      │                        │                         │
      │  POST /api/bgp        │  generate -a ASN        │
      │  alerter/asn/         │  merge prefixes.yml     │
      │  {asn}/monitor        │  systemctl restart      │
      │                        │                         │
      └────────────────────────┴─────────────────────────┘
```

## API Endpoints

### 1. Add ASN to Monitoring
```http
POST /api/bgpalerter/asn/{asn}/monitor
```

**Request:**
```bash
curl -X POST http://localhost:8000/api/bgpalerter/asn/8315/monitor
```

**Response:**
```json
{
  "asn": 8315,
  "status": "success",
  "prefixes_count": 65,
  "message": "AS8315 added to monitoring with 65 prefixes. BGPalerter is reloading."
}
```

**What it does:**
1. Runs `bgpalerter-linux-x64 generate -a 8315` to fetch prefixes from live BGP data
2. Merges new prefixes into existing `/opt/bgpalerter/prefixes.yml`
3. Creates backup of old configuration
4. Restarts BGPalerter service to apply changes

### 2. Remove ASN from Monitoring
```http
DELETE /api/bgpalerter/asn/{asn}/monitor
```

**Request:**
```bash
curl -X DELETE http://localhost:8000/api/bgpalerter/asn/8315/monitor
```

**Response:**
```json
{
  "asn": 8315,
  "status": "success",
  "prefixes_removed": 65,
  "message": "AS8315 removed from monitoring. BGPalerter is reloading."
}
```

### 3. Get All Monitored ASNs
```http
GET /api/bgpalerter/monitored-asns
```

**Response:**
```json
[
  {
    "asn": 200132,
    "prefixes": ["195.95.177.0/24", "2001:67c:dec::/48"],
    "upstreams": [12859, 1764, 20485],
    "downstreams": [200232, 201723]
  },
  {
    "asn": 8315,
    "prefixes": ["193.34.150.0/23", "85.92.128.0/20", ...],
    "upstreams": [1031, 1267, 1299],
    "downstreams": [16278, 197302]
  }
]
```

### 4. Check BGPalerter Status
```http
GET /api/bgpalerter/status
```

**Response:**
```json
{
  "status": "running",
  "service": "systemd",
  "message": "BGPalerter is running"
}
```

## UI Integration Example

### React Component for Adding ASN

```javascript
import React, { useState } from 'react';
import axios from 'axios';

function BGPAlerterManager() {
  const [asn, setAsn] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const addASN = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `http://localhost:8000/api/bgpalerter/asn/${asn}/monitor`
      );
      setMessage(
        `Success! Monitoring ${response.data.prefixes_count} prefixes for AS${asn}`
      );
    } catch (error) {
      setMessage(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bgpalerter-manager">
      <h2>Add ASN to BGP Monitoring</h2>
      <input
        type="number"
        placeholder="Enter ASN (e.g., 8315)"
        value={asn}
        onChange={(e) => setAsn(e.target.value)}
        disabled={loading}
      />
      <button onClick={addASN} disabled={loading || !asn}>
        {loading ? 'Adding...' : 'Add ASN'}
      </button>
      {message && <p className="message">{message}</p>}
    </div>
  );
}

export default BGPAlerterManager;
```

### Fetching Monitored ASNs

```javascript
import React, { useEffect, useState } from 'react';
import axios from 'axios';

function MonitoredASNsList() {
  const [asns, setAsns] = useState([]);

  useEffect(() => {
    const fetchASNs = async () => {
      const response = await axios.get(
        'http://localhost:8000/api/bgpalerter/monitored-asns'
      );
      setAsns(response.data);
    };
    fetchASNs();
  }, []);

  return (
    <div>
      <h2>Currently Monitored ASNs</h2>
      <ul>
        {asns.map((asn) => (
          <li key={asn.asn}>
            <strong>AS{asn.asn}</strong> - {asn.prefixes.length} prefixes
            <br />
            Upstreams: {asn.upstreams.length} | Downstreams:{' '}
            {asn.downstreams.length}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Backend Setup

### 1. Install Dependencies

```bash
pip install pyyaml
```

### 2. Register the Router in FastAPI

In your main FastAPI app (e.g., `irrexplorer/api/main.py`):

```python
from fastapi import FastAPI
from irrexplorer.api.bgpalerter_management import router as bgpalerter_router

app = FastAPI()

# Register BGPalerter management routes
app.include_router(bgpalerter_router, prefix="/api", tags=["bgpalerter"])
```

### 3. Ensure Permissions

The backend process needs:
- Read/write access to `/opt/bgpalerter/prefixes.yml`
- Permission to restart BGPalerter service (systemd or container)

For systemd, you might need to allow the backend user to restart without password:

```bash
# Create sudoers file
sudo visudo -f /etc/sudoers.d/bgpalerter

# Add this line (replace 'www-data' with your backend user)
www-data ALL=(ALL) NOPASSWD: /bin/systemctl restart bgpalerter
```

## Container Support

The API also supports containerized BGPalerter. If running in a container, ensure:

1. **Mount the bgpalerter binary in the container:**
   ```yaml
   volumes:
     - /opt/bgpalerter/bgpalerter-linux-x64:/usr/local/bin/bgpalerter:ro
     - bgpalerter_data:/opt/bgpalerter/volume
   ```

2. **The backend container has access to execute commands:**
   ```bash
   podman exec irrexplorer-bgpalerter bgpalerter generate -a 8315
   ```

## Error Handling

The API handles various error scenarios:

1. **Invalid ASN**: Returns 400 Bad Request
2. **BGPalerter not installed**: Returns 503 Service Unavailable  
3. **Generation failure**: Returns 500 with error details from BGPalerter
4. **Configuration file errors**: Returns 500 with YAML parsing errors

## Performance Considerations

- **Generation time**: Fetching prefixes from RIPEstat can take 30-120 seconds for large ASNs
- **Background tasks**: BGPalerter restart happens in the background to avoid blocking the API response
- **Backups**: Each configuration change creates a backup (`prefixes.yml.backup`)

## Testing

```bash
# Test adding an ASN
curl -X POST http://localhost:8000/api/bgpalerter/asn/13335/monitor

# Check status
curl http://localhost:8000/api/bgpalerter/status

# View monitored ASNs
curl http://localhost:8000/api/bgpalerter/monitored-asns

# Remove an ASN
curl -X DELETE http://localhost:8000/api/bgpalerter/asn/13335/monitor
```

## Limitations

1. **RIPEstat dependency**: If RIPEstat API is down, prefix generation will fail
2. **No concurrent updates**: Only one ASN can be added/removed at a time
3. **Restart required**: Each change requires BGPalerter restart (10-30 seconds downtime)
4. **No validation**: The API doesn't validate if the ASN exists or has prefixes before generation

## Future Enhancements

- [ ] Add ASN existence validation before generation
- [ ] Support batch ASN addition/removal
- [ ] Implement hot-reload for BGPalerter (no restart needed)
- [ ] Add prefix-level management (not just ASN-level)
- [ ] Webhook endpoint for BGPalerter alerts
- [ ] Real-time monitoring status via WebSockets
