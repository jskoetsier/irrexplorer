"""
User Profile Management API for BGP Monitoring System.
Handles user emails, monitored ASNs, and alert configurations.
"""

from datetime import datetime

from databases import Database
from starlette.requests import Request
from starlette.responses import JSONResponse

from irrexplorer.api.bgp_auth import require_auth
from irrexplorer.storage.tables import (
    alert_configurations,
    bgp_alert_events,
    user_emails,
    user_monitored_asns,
)


# User Email Management
async def get_user_emails(request: Request):
    """Get all emails for current user."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        db: Database = request.app.state.database
        query = user_emails.select().where(user_emails.c.user_id == user["id"])
        results = await db.fetch_all(query)

        return JSONResponse([dict(row) for row in results])

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def add_user_email(request: Request):
    """Add a new email address for current user."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        data = await request.json()
        email = data.get("email")
        is_primary = data.get("is_primary", False)

        if not email:
            return JSONResponse({"error": "Email is required"}, status_code=400)

        db: Database = request.app.state.database

        # Check if email already exists for this user
        check_query = user_emails.select().where(
            (user_emails.c.user_id == user["id"]) & (user_emails.c.email == email)
        )
        existing = await db.fetch_one(check_query)

        if existing:
            return JSONResponse({"error": "Email already added"}, status_code=400)

        # If setting as primary, unset other primary emails
        if is_primary:
            update_query = (
                user_emails.update()
                .where(user_emails.c.user_id == user["id"])
                .values(is_primary=False)
            )
            await db.execute(update_query)

        # Insert new email
        insert_query = user_emails.insert().values(
            user_id=user["id"], email=email, is_primary=is_primary
        )
        email_id = await db.execute(insert_query)

        # Fetch created email
        query = user_emails.select().where(user_emails.c.id == email_id)
        new_email = await db.fetch_one(query)

        return JSONResponse(dict(new_email))

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def delete_user_email(request: Request):
    """Delete an email address."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        email_id = int(request.path_params["email_id"])
        db: Database = request.app.state.database

        # Verify ownership
        check_query = user_emails.select().where(
            (user_emails.c.id == email_id) & (user_emails.c.user_id == user["id"])
        )
        existing = await db.fetch_one(check_query)

        if not existing:
            return JSONResponse({"error": "Email not found"}, status_code=404)

        # Delete email
        delete_query = user_emails.delete().where(user_emails.c.id == email_id)
        await db.execute(delete_query)

        return JSONResponse({"message": "Email deleted successfully"})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# Monitored ASNs Management
async def get_monitored_asns(request: Request):
    """Get all monitored ASNs for current user."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        db: Database = request.app.state.database
        query = user_monitored_asns.select().where(
            user_monitored_asns.c.user_id == user["id"]
        )
        results = await db.fetch_all(query)

        return JSONResponse([dict(row) for row in results])

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def add_monitored_asn(request: Request):
    """Add an ASN to monitor."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        data = await request.json()
        asn = data.get("asn")
        description = data.get("description", "")

        if not asn:
            return JSONResponse({"error": "ASN is required"}, status_code=400)

        db: Database = request.app.state.database

        # Check if already monitored
        check_query = user_monitored_asns.select().where(
            (user_monitored_asns.c.user_id == user["id"])
            & (user_monitored_asns.c.asn == asn)
        )
        existing = await db.fetch_one(check_query)

        if existing:
            return JSONResponse(
                {"error": "ASN is already being monitored"}, status_code=400
            )

        # Insert monitored ASN
        insert_query = user_monitored_asns.insert().values(
            user_id=user["id"], asn=asn, description=description
        )
        asn_id = await db.execute(insert_query)

        # TODO: Update BGPalerter configuration file with new ASN

        # Fetch created ASN
        query = user_monitored_asns.select().where(user_monitored_asns.c.id == asn_id)
        new_asn = await db.fetch_one(query)

        return JSONResponse(dict(new_asn))

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def delete_monitored_asn(request: Request):
    """Delete a monitored ASN."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        asn_id = int(request.path_params["asn_id"])
        db: Database = request.app.state.database

        # Verify ownership
        check_query = user_monitored_asns.select().where(
            (user_monitored_asns.c.id == asn_id)
            & (user_monitored_asns.c.user_id == user["id"])
        )
        existing = await db.fetch_one(check_query)

        if not existing:
            return JSONResponse({"error": "Monitored ASN not found"}, status_code=404)

        # Delete ASN
        delete_query = user_monitored_asns.delete().where(
            user_monitored_asns.c.id == asn_id
        )
        await db.execute(delete_query)

        # TODO: Update BGPalerter configuration file to remove ASN

        return JSONResponse({"message": "Monitored ASN deleted successfully"})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# Alert Configurations Management
async def get_alert_configs(request: Request):
    """Get all alert configurations for current user."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        db: Database = request.app.state.database
        query = alert_configurations.select().where(
            alert_configurations.c.user_id == user["id"]
        )
        results = await db.fetch_all(query)

        return JSONResponse([dict(row) for row in results])

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def add_alert_config(request: Request):
    """Add or update an alert configuration."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        data = await request.json()
        channel_type = data.get("channel_type")  # email, slack, telegram, webhook, push
        is_enabled = data.get("is_enabled", True)
        config = data.get("config", {})

        if not channel_type:
            return JSONResponse({"error": "Channel type is required"}, status_code=400)

        # Validate configuration based on channel type
        if channel_type == "email" and not config.get("email"):
            return JSONResponse(
                {"error": "Email address is required for email channel"},
                status_code=400,
            )
        elif channel_type == "slack" and not config.get("webhook_url"):
            return JSONResponse(
                {"error": "Webhook URL is required for Slack"}, status_code=400
            )
        elif channel_type == "telegram" and not (
            config.get("bot_token") and config.get("chat_id")
        ):
            return JSONResponse(
                {"error": "Bot token and chat ID are required for Telegram"},
                status_code=400,
            )
        elif channel_type == "webhook" and not config.get("url"):
            return JSONResponse(
                {"error": "URL is required for webhook"}, status_code=400
            )

        db: Database = request.app.state.database

        # Check if configuration already exists for this channel type
        check_query = alert_configurations.select().where(
            (alert_configurations.c.user_id == user["id"])
            & (alert_configurations.c.channel_type == channel_type)
        )
        existing = await db.fetch_one(check_query)

        if existing:
            # Update existing configuration
            update_query = (
                alert_configurations.update()
                .where(alert_configurations.c.id == existing["id"])
                .values(
                    is_enabled=is_enabled,
                    config=config,
                    updated_at=datetime.utcnow(),
                )
            )
            await db.execute(update_query)
            config_id = existing["id"]
        else:
            # Insert new configuration
            insert_query = alert_configurations.insert().values(
                user_id=user["id"],
                channel_type=channel_type,
                is_enabled=is_enabled,
                config=config,
            )
            config_id = await db.execute(insert_query)

        # Fetch configuration
        query = alert_configurations.select().where(
            alert_configurations.c.id == config_id
        )
        alert_config = await db.fetch_one(query)

        return JSONResponse(dict(alert_config))

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def delete_alert_config(request: Request):
    """Delete an alert configuration."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        config_id = int(request.path_params["config_id"])
        db: Database = request.app.state.database

        # Verify ownership
        check_query = alert_configurations.select().where(
            (alert_configurations.c.id == config_id)
            & (alert_configurations.c.user_id == user["id"])
        )
        existing = await db.fetch_one(check_query)

        if not existing:
            return JSONResponse(
                {"error": "Alert configuration not found"}, status_code=404
            )

        # Delete configuration
        delete_query = alert_configurations.delete().where(
            alert_configurations.c.id == config_id
        )
        await db.execute(delete_query)

        return JSONResponse({"message": "Alert configuration deleted successfully"})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# Alert Events
async def get_alert_events(request: Request):
    """Get BGP alert events for current user."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        db: Database = request.app.state.database

        # Get query parameters
        asn = request.query_params.get("asn")
        severity = request.query_params.get("severity")
        acknowledged = request.query_params.get("acknowledged")
        limit = int(request.query_params.get("limit", "100"))

        # Build query
        query = bgp_alert_events.select().where(
            bgp_alert_events.c.user_id == user["id"]
        )

        if asn:
            query = query.where(bgp_alert_events.c.asn == int(asn))

        if severity:
            query = query.where(bgp_alert_events.c.severity == severity)

        if acknowledged is not None:
            ack_bool = acknowledged.lower() == "true"
            query = query.where(bgp_alert_events.c.is_acknowledged == ack_bool)

        query = query.order_by(bgp_alert_events.c.created_at.desc()).limit(limit)

        results = await db.fetch_all(query)
        return JSONResponse([dict(row) for row in results])

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def acknowledge_alert_event(request: Request):
    """Acknowledge a BGP alert event."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        alert_id = int(request.path_params["alert_id"])
        db: Database = request.app.state.database

        # Verify ownership
        check_query = bgp_alert_events.select().where(
            (bgp_alert_events.c.id == alert_id)
            & (bgp_alert_events.c.user_id == user["id"])
        )
        existing = await db.fetch_one(check_query)

        if not existing:
            return JSONResponse({"error": "Alert not found"}, status_code=404)

        # Acknowledge alert
        update_query = (
            bgp_alert_events.update()
            .where(bgp_alert_events.c.id == alert_id)
            .values(
                is_acknowledged=True,
                acknowledged_at=datetime.utcnow(),
            )
        )
        await db.execute(update_query)

        return JSONResponse({"message": "Alert acknowledged successfully"})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def get_user_stats(request: Request):
    """Get statistics for current user."""
    user = await require_auth(request)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    try:
        db: Database = request.app.state.database

        # Count monitored ASNs
        asn_query = user_monitored_asns.select().where(
            user_monitored_asns.c.user_id == user["id"]
        )
        monitored_asns = await db.fetch_all(asn_query)
        monitored_asn_count = len(monitored_asns)

        # Count emails
        email_query = user_emails.select().where(user_emails.c.user_id == user["id"])
        emails = await db.fetch_all(email_query)
        email_count = len(emails)

        # Count alerts
        alert_query = bgp_alert_events.select().where(
            bgp_alert_events.c.user_id == user["id"]
        )
        all_alerts = await db.fetch_all(alert_query)
        total_alerts = len(all_alerts)
        unacknowledged_alerts = sum(1 for a in all_alerts if not a["is_acknowledged"])

        # Count by severity
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for alert in all_alerts:
            severity = alert["severity"]
            if severity in severity_counts:
                severity_counts[severity] += 1

        # Count alert configurations
        config_query = alert_configurations.select().where(
            alert_configurations.c.user_id == user["id"]
        )
        configs = await db.fetch_all(config_query)
        active_channels = sum(1 for c in configs if c["is_enabled"])

        return JSONResponse(
            {
                "monitored_asns": monitored_asn_count,
                "notification_emails": email_count,
                "total_alerts": total_alerts,
                "unacknowledged_alerts": unacknowledged_alerts,
                "alerts_by_severity": severity_counts,
                "active_notification_channels": active_channels,
            }
        )

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
