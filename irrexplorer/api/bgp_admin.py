"""
Admin API for BGP Monitoring System.
Provides user management, system configuration, and metrics for administrators.
"""

from datetime import datetime

from databases import Database
from starlette.requests import Request
from starlette.responses import JSONResponse

from irrexplorer.api.bgp_auth import hash_password, require_admin
from irrexplorer.storage.tables import (
    alert_configurations,
    bgp_alert_events,
    bgp_users,
    system_config,
    user_emails,
    user_monitored_asns,
)


# User Management
async def list_users(request: Request):
    """List all users (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        db: Database = request.app.state.database

        # Get query parameters
        is_active = request.query_params.get("is_active")
        is_admin_filter = request.query_params.get("is_admin")

        query = bgp_users.select()

        if is_active is not None:
            active_bool = is_active.lower() == "true"
            query = query.where(bgp_users.c.is_active == active_bool)

        if is_admin_filter is not None:
            admin_bool = is_admin_filter.lower() == "true"
            query = query.where(bgp_users.c.is_admin == admin_bool)

        results = await db.fetch_all(query)

        # Remove password hashes from response
        users = []
        for user in results:
            user_dict = dict(user)
            user_dict.pop("password_hash", None)
            users.append(user_dict)

        return JSONResponse(users)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def get_user_detail(request: Request):
    """Get detailed information about a user (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        user_id = int(request.path_params["user_id"])
        db: Database = request.app.state.database

        # Get user
        user_query = bgp_users.select().where(bgp_users.c.id == user_id)
        user = await db.fetch_one(user_query)

        if not user:
            return JSONResponse({"error": "User not found"}, status_code=404)

        user_dict = dict(user)
        user_dict.pop("password_hash", None)

        # Get user emails
        emails_query = user_emails.select().where(user_emails.c.user_id == user_id)
        emails = await db.fetch_all(emails_query)

        # Get monitored ASNs
        asns_query = user_monitored_asns.select().where(
            user_monitored_asns.c.user_id == user_id
        )
        asns = await db.fetch_all(asns_query)

        # Get alert configurations
        configs_query = alert_configurations.select().where(
            alert_configurations.c.user_id == user_id
        )
        configs = await db.fetch_all(configs_query)

        # Get alert count
        alerts_query = bgp_alert_events.select().where(
            bgp_alert_events.c.user_id == user_id
        )
        alerts = await db.fetch_all(alerts_query)

        user_dict["emails"] = [dict(e) for e in emails]
        user_dict["monitored_asns"] = [dict(a) for a in asns]
        user_dict["alert_configurations"] = [dict(c) for c in configs]
        user_dict["alert_count"] = len(alerts)
        user_dict["unacknowledged_alert_count"] = sum(
            1 for a in alerts if not a["is_acknowledged"]
        )

        return JSONResponse(user_dict)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def create_user(request: Request):
    """Create a new user (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        data = await request.json()
        email = data.get("email")
        password = data.get("password")
        full_name = data.get("full_name")
        is_admin_user = data.get("is_admin", False)

        if not email or not password:
            return JSONResponse(
                {"error": "Email and password are required"}, status_code=400
            )

        if len(password) < 8:
            return JSONResponse(
                {"error": "Password must be at least 8 characters"}, status_code=400
            )

        db: Database = request.app.state.database

        # Check if user exists
        check_query = bgp_users.select().where(bgp_users.c.email == email)
        existing = await db.fetch_one(check_query)

        if existing:
            return JSONResponse({"error": "Email already exists"}, status_code=400)

        # Create user
        password_hash = hash_password(password)
        insert_query = bgp_users.insert().values(
            email=email,
            password_hash=password_hash,
            full_name=full_name,
            is_admin=is_admin_user,
        )
        user_id = await db.execute(insert_query)

        # Fetch created user
        user_query = bgp_users.select().where(bgp_users.c.id == user_id)
        new_user = await db.fetch_one(user_query)
        user_dict = dict(new_user)
        user_dict.pop("password_hash", None)

        return JSONResponse(user_dict)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def update_user(request: Request):
    """Update user information (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        user_id = int(request.path_params["user_id"])
        data = await request.json()

        db: Database = request.app.state.database

        # Check if user exists
        check_query = bgp_users.select().where(bgp_users.c.id == user_id)
        existing = await db.fetch_one(check_query)

        if not existing:
            return JSONResponse({"error": "User not found"}, status_code=404)

        # Build update values
        update_values = {}

        if "full_name" in data:
            update_values["full_name"] = data["full_name"]
            update_values["updated_at"] = datetime.utcnow()

        if "is_active" in data:
            update_values["is_active"] = data["is_active"]

        if "is_admin" in data:
            update_values["is_admin"] = data["is_admin"]

        if "password" in data:
            if len(data["password"]) < 8:
                return JSONResponse(
                    {"error": "Password must be at least 8 characters"},
                    status_code=400,
                )
            update_values["password_hash"] = hash_password(data["password"])

        # Update user
        update_query = (
            bgp_users.update().where(bgp_users.c.id == user_id).values(**update_values)
        )
        await db.execute(update_query)

        # Fetch updated user
        user_query = bgp_users.select().where(bgp_users.c.id == user_id)
        updated_user = await db.fetch_one(user_query)
        user_dict = dict(updated_user)
        user_dict.pop("password_hash", None)

        return JSONResponse(user_dict)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def delete_user(request: Request):
    """Delete a user (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        user_id = int(request.path_params["user_id"])
        db: Database = request.app.state.database

        # Check if user exists
        check_query = bgp_users.select().where(bgp_users.c.id == user_id)
        existing = await db.fetch_one(check_query)

        if not existing:
            return JSONResponse({"error": "User not found"}, status_code=404)

        # Prevent self-deletion
        if user_id == admin["id"]:
            return JSONResponse(
                {"error": "Cannot delete your own account"}, status_code=400
            )

        # Delete user (cascade will remove related records)
        delete_query = bgp_users.delete().where(bgp_users.c.id == user_id)
        await db.execute(delete_query)

        return JSONResponse({"message": "User deleted successfully"})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# System Configuration
async def get_system_config(request: Request):
    """Get all system configuration (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        db: Database = request.app.state.database
        query = system_config.select()
        results = await db.fetch_all(query)

        return JSONResponse([dict(row) for row in results])

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def update_system_config(request: Request):
    """Update system configuration (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        data = await request.json()
        key = data.get("key")
        value = data.get("value")
        description = data.get("description")

        if not key or value is None:
            return JSONResponse(
                {"error": "Key and value are required"}, status_code=400
            )

        db: Database = request.app.state.database

        # Check if config exists
        check_query = system_config.select().where(system_config.c.key == key)
        existing = await db.fetch_one(check_query)

        if existing:
            # Update existing
            update_query = (
                system_config.update()
                .where(system_config.c.key == key)
                .values(
                    value=value,
                    description=description,
                    updated_at=datetime.utcnow(),
                    updated_by=admin["id"],
                )
            )
            await db.execute(update_query)
        else:
            # Insert new
            insert_query = system_config.insert().values(
                key=key,
                value=value,
                description=description,
                updated_by=admin["id"],
            )
            await db.execute(insert_query)

        # Fetch config
        config_query = system_config.select().where(system_config.c.key == key)
        config = await db.fetch_one(config_query)

        return JSONResponse(dict(config))

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def delete_system_config(request: Request):
    """Delete a system configuration (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        key = request.path_params["key"]
        db: Database = request.app.state.database

        # Check if config exists
        check_query = system_config.select().where(system_config.c.key == key)
        existing = await db.fetch_one(check_query)

        if not existing:
            return JSONResponse({"error": "Configuration not found"}, status_code=404)

        # Delete config
        delete_query = system_config.delete().where(system_config.c.key == key)
        await db.execute(delete_query)

        return JSONResponse({"message": "Configuration deleted successfully"})

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# System Metrics
async def get_system_metrics(request: Request):
    """Get system-wide metrics (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        db: Database = request.app.state.database

        # Count total users
        users_query = bgp_users.select()
        all_users = await db.fetch_all(users_query)
        total_users = len(all_users)
        active_users = sum(1 for u in all_users if u["is_active"])
        admin_users = sum(1 for u in all_users if u["is_admin"])

        # Count monitored ASNs
        asns_query = user_monitored_asns.select()
        all_asns = await db.fetch_all(asns_query)
        total_monitored_asns = len(all_asns)
        unique_asns = len(set(a["asn"] for a in all_asns))

        # Count alerts
        alerts_query = bgp_alert_events.select()
        all_alerts = await db.fetch_all(alerts_query)
        total_alerts = len(all_alerts)
        unacknowledged_alerts = sum(1 for a in all_alerts if not a["is_acknowledged"])

        # Alerts by severity
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for alert in all_alerts:
            severity = alert["severity"]
            if severity in severity_counts:
                severity_counts[severity] += 1

        # Alerts by type
        type_counts = {}
        for alert in all_alerts:
            alert_type = alert["alert_type"]
            type_counts[alert_type] = type_counts.get(alert_type, 0) + 1

        # Count alert configurations
        configs_query = alert_configurations.select()
        all_configs = await db.fetch_all(configs_query)
        total_configs = len(all_configs)
        active_configs = sum(1 for c in all_configs if c["is_enabled"])

        # Configs by channel type
        channel_counts = {}
        for config in all_configs:
            channel_type = config["channel_type"]
            channel_counts[channel_type] = channel_counts.get(channel_type, 0) + 1

        return JSONResponse(
            {
                "users": {
                    "total": total_users,
                    "active": active_users,
                    "admins": admin_users,
                },
                "monitored_asns": {
                    "total_entries": total_monitored_asns,
                    "unique_asns": unique_asns,
                },
                "alerts": {
                    "total": total_alerts,
                    "unacknowledged": unacknowledged_alerts,
                    "by_severity": severity_counts,
                    "by_type": type_counts,
                },
                "alert_configurations": {
                    "total": total_configs,
                    "active": active_configs,
                    "by_channel": channel_counts,
                },
            }
        )

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def get_recent_activity(request: Request):
    """Get recent system activity (admin only)."""
    admin = await require_admin(request)
    if not admin:
        return JSONResponse({"error": "Admin access required"}, status_code=403)

    try:
        db: Database = request.app.state.database
        limit = int(request.query_params.get("limit", "50"))

        # Recent users
        users_query = (
            bgp_users.select().order_by(bgp_users.c.created_at.desc()).limit(10)
        )
        recent_users = await db.fetch_all(users_query)

        # Recent alerts
        alerts_query = (
            bgp_alert_events.select()
            .order_by(bgp_alert_events.c.created_at.desc())
            .limit(limit)
        )
        recent_alerts = await db.fetch_all(alerts_query)

        # Format response
        users_list = []
        for user in recent_users:
            user_dict = dict(user)
            user_dict.pop("password_hash", None)
            users_list.append(user_dict)

        return JSONResponse(
            {
                "recent_users": users_list,
                "recent_alerts": [dict(a) for a in recent_alerts],
            }
        )

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
