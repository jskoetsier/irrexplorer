"""add bgp user system with authentication

Revision ID: add_bgp_user_system
Revises: add_rpki_status
Create Date: 2025-10-19 17:25:00.000000

"""

import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_bgp_user_system"
down_revision = "add_rpki_status"
branch_labels = None
depends_on = None


def upgrade():
    # Create bgp_users table
    op.create_table(
        "bgp_users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_bgp_users_email", "bgp_users", ["email"])

    # Create user_emails table
    op.create_table(
        "user_emails",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column(
            "is_primary",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["bgp_users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_emails_user_id", "user_emails", ["user_id"])
    op.create_index("ix_user_emails_email", "user_emails", ["email"])

    # Create user_monitored_asns table
    op.create_table(
        "user_monitored_asns",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("asn", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["bgp_users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "asn", name="uq_user_monitored_asn"),
    )
    op.create_index(
        "ix_user_monitored_asns_user_id", "user_monitored_asns", ["user_id"]
    )
    op.create_index("ix_user_monitored_asns_asn", "user_monitored_asns", ["asn"])

    # Create alert_configurations table
    op.create_table(
        "alert_configurations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("channel_type", sa.String(length=50), nullable=False),
        sa.Column(
            "is_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("config", pg.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["bgp_users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_alert_configurations_user_id", "alert_configurations", ["user_id"]
    )

    # Create bgp_alert_events table
    op.create_table(
        "bgp_alert_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("asn", sa.BigInteger(), nullable=False),
        sa.Column("prefix", pg.CIDR(), nullable=True),
        sa.Column("alert_type", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("details", pg.JSONB(), nullable=True),
        sa.Column(
            "is_acknowledged",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["bgp_users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bgp_alert_events_user_id", "bgp_alert_events", ["user_id"])
    op.create_index("ix_bgp_alert_events_asn", "bgp_alert_events", ["asn"])
    op.create_index(
        "ix_bgp_alert_events_created_at", "bgp_alert_events", ["created_at"]
    )

    # Create system_config table
    op.create_table(
        "system_config",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("value", pg.JSONB(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["bgp_users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_system_config_key", "system_config", ["key"])


def downgrade():
    op.drop_table("system_config")
    op.drop_table("bgp_alert_events")
    op.drop_table("alert_configurations")
    op.drop_table("user_monitored_asns")
    op.drop_table("user_emails")
    op.drop_table("bgp_users")
