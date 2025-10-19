"""
BGPalerter Management API
Provides web interface integration for BGPalerter container.
"""

import json
import os
from typing import Dict

import yaml

from starlette.requests import Request
from starlette.responses import JSONResponse

# BGPalerter configuration file path
BGPALERTER_CONFIG_PATH = os.getenv(
    "BGPALERTER_CONFIG_PATH", "/opt/irrexplorer/bgpalerter/config.yml"
)
BGPALERTER_PREFIXES_PATH = os.getenv(
    "BGPALERTER_PREFIXES_PATH", "/opt/irrexplorer/bgpalerter/prefixes.yml"
)


def load_bgpalerter_config() -> Dict:
    """Load BGPalerter configuration."""
    try:
        with open(BGPALERTER_CONFIG_PATH) as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {}


def save_bgpalerter_config(config: Dict) -> None:
    """Save BGPalerter configuration."""
    with open(BGPALERTER_CONFIG_PATH, "w") as f:
        yaml.dump(config, f, default_flow_style=False)


def load_monitored_prefixes() -> Dict:
    """Load monitored prefixes configuration."""
    try:
        with open(BGPALERTER_PREFIXES_PATH) as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {}


def save_monitored_prefixes(prefixes: Dict) -> None:
    """Save monitored prefixes configuration."""
    os.makedirs(os.path.dirname(BGPALERTER_PREFIXES_PATH), exist_ok=True)
    with open(BGPALERTER_PREFIXES_PATH, "w") as f:
        yaml.dump(prefixes, f, default_flow_style=False)


async def get_bgpalerter_status(request: Request):
    """Get BGPalerter status and configuration."""
    try:
        config = load_bgpalerter_config()
        prefixes = load_monitored_prefixes()

        return JSONResponse(
            {
                "status": "running",
                "monitored_prefixes": len(prefixes.get("monitorASns", {}).keys()),
                "config": {
                    "hijack_detection": config.get("checkForPrefixHijack", False),
                    "visibility_loss": config.get("checkForVisibilityLoss", False),
                    "path_changes": config.get("checkForASPathChanges", False),
                    "rpki_invalid": config.get("checkForRPKIInvalid", False),
                },
            }
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def add_monitored_asn(request: Request):
    """Add an ASN to monitor with BGPalerter."""
    try:
        data = await request.json()
        asn = data.get("asn")
        user_email = data.get("email")
        description = data.get("description", "")

        if not asn or not user_email:
            return JSONResponse(
                {"error": "ASN and email are required"}, status_code=400
            )

        # Load current prefixes
        prefixes = load_monitored_prefixes()
        if "monitorASns" not in prefixes:
            prefixes["monitorASns"] = {}

        # Add ASN monitoring
        asn_str = str(asn)
        if asn_str in prefixes["monitorASns"]:
            return JSONResponse(
                {"error": "ASN is already being monitored"}, status_code=400
            )

        prefixes["monitorASns"][asn_str] = {
            "group": user_email,
            "description": description or f"Monitoring AS{asn}",
            "ignoreMorespecifics": False,
        }

        # Save configuration
        save_monitored_prefixes(prefixes)

        return JSONResponse({"message": f"AS{asn} added to monitoring", "asn": asn_str})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def get_monitored_asns(request: Request):
    """Get all monitored ASNs."""
    try:
        user_email = request.query_params.get("email")
        prefixes = load_monitored_prefixes()
        monitored_asns = prefixes.get("monitorASns", {})

        if user_email:
            # Filter by user email
            filtered = {
                asn: config
                for asn, config in monitored_asns.items()
                if config.get("group") == user_email
            }
            monitored_asns = filtered

        # Format response
        result = []
        for asn, config in monitored_asns.items():
            result.append(
                {
                    "asn": asn,
                    "description": config.get("description", ""),
                    "email": config.get("group", ""),
                    "ignore_more_specifics": config.get("ignoreMorespecifics", False),
                }
            )

        return JSONResponse(result)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def delete_monitored_asn(request: Request):
    """Remove an ASN from monitoring."""
    try:
        asn = request.path_params["asn"]
        user_email = request.query_params.get("email")

        prefixes = load_monitored_prefixes()
        monitored_asns = prefixes.get("monitorASns", {})

        if asn not in monitored_asns:
            return JSONResponse({"error": "ASN not found"}, status_code=404)

        # Verify ownership
        if user_email and monitored_asns[asn].get("group") != user_email:
            return JSONResponse({"error": "Not authorized"}, status_code=403)

        # Remove ASN
        del monitored_asns[asn]
        prefixes["monitorASns"] = monitored_asns
        save_monitored_prefixes(prefixes)

        return JSONResponse({"message": f"AS{asn} removed from monitoring"})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def webhook_receiver(request: Request):
    """Receive alerts from BGPalerter webhooks."""
    try:
        alert_type = request.path_params["alert_type"]
        data = await request.json()

        # Log the alert (in production, store in database)
        print(f"BGPalerter Alert [{alert_type}]: {json.dumps(data, indent=2)}")

        # Here you would:
        # 1. Parse the alert data
        # 2. Store it in the database
        # 3. Send notifications to users (email, webhook, etc.)
        # 4. Update the frontend dashboard

        return JSONResponse({"status": "received", "alert_type": alert_type})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def get_recent_alerts(request: Request):
    """Get recent alerts from BGPalerter."""
    try:
        # user_email = request.query_params.get("email")  # TODO: implement filtering
        # limit = int(request.query_params.get("limit", "50"))  # TODO: implement pagination

        # In production, fetch from database
        # For now, return sample data structure
        alerts = []

        return JSONResponse(
            {
                "alerts": alerts,
                "total": len(alerts),
                "message": "BGPalerter alerts will be available after first detection",
            }
        )

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
