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
        import httpx

        # Try to reach BGPalerter REST API
        bgpalerter_url = os.getenv("BGPALERTER_URL", "http://bgpalerter:8011")
        is_running = False

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(f"{bgpalerter_url}/status")
                is_running = response.status_code == 200
        except Exception:
            is_running = False

        config = load_bgpalerter_config()
        prefixes = load_monitored_prefixes()
        monitored_count = len(prefixes.get("monitorASns", {}).keys())

        return JSONResponse(
            {
                "status": "running" if is_running else "down",
                "is_running": is_running,
                "monitored_asns_count": monitored_count,
                "config": {
                    "environment": config.get("environment", "production"),
                    "rpki_enabled": "rpki" in str(config.get("monitors", [])),
                    "notification_interval": config.get("notification", {}).get(
                        "notificationIntervalSeconds", 7200
                    ),
                },
                "api_url": bgpalerter_url,
            }
        )
    except Exception as e:
        return JSONResponse(
            {"error": str(e), "status": "unknown", "is_running": False}, status_code=500
        )


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
    """Receive alerts from BGPalerter webhooks and create database records."""
    try:
        alert_type = request.path_params["alert_type"]
        data = await request.json()

        # Log the alert for debugging
        print(f"BGPalerter Alert [{alert_type}]: {json.dumps(data, indent=2)}")

        db: Database = request.app.state.database

        # Parse alert data based on type
        asn = data.get("data", {}).get("asn")
        prefix = data.get("data", {}).get("prefix")
        message = data.get("message", f"BGP {alert_type} alert")

        # Determine severity based on alert type
        severity_map = {
            "hijack": "critical",
            "newprefix": "medium",
            "visibility": "high",
            "path": "medium",
            "rpki": "high",
        }
        severity = severity_map.get(alert_type, "medium")

        if not asn:
            return JSONResponse(
                {"error": "ASN not found in alert data"}, status_code=400
            )

        # Find all users monitoring this ASN
        from irrexplorer.storage.tables import bgp_alert_events, user_monitored_asns

        monitored_query = user_monitored_asns.select().where(
            (user_monitored_asns.c.asn == asn)
            & (user_monitored_asns.c.is_active == True)  # noqa: E712
        )
        monitored_records = await db.fetch_all(monitored_query)

        # Create alert for each user monitoring this ASN
        created_alerts = []
        for record in monitored_records:
            alert_insert = bgp_alert_events.insert().values(
                user_id=record["user_id"],
                asn=asn,
                prefix=prefix,
                alert_type=alert_type,
                severity=severity,
                message=message,
                details=data,
                is_acknowledged=False,
            )
            alert_id = await db.execute(alert_insert)
            created_alerts.append(alert_id)

            # TODO: Send notifications based on user's alert configurations
            # - Check user's alert_configurations table
            # - Send email/slack/telegram/webhook notifications

        return JSONResponse(
            {
                "status": "received",
                "alert_type": alert_type,
                "alerts_created": len(created_alerts),
            }
        )

    except Exception as e:
        import traceback

        print(f"Error processing webhook: {traceback.format_exc()}")
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
