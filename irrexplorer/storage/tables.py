import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg

from irrexplorer.state import RIR

sa_metadata = sa.MetaData()

bgp = sa.Table(
    "bgp",
    sa_metadata,
    sa.Column("asn", sa.BigInteger, index=True, nullable=False),
    sa.Column("prefix", pg.CIDR, nullable=False),
    sa.Column("rpki_status", sa.String(20), index=True, nullable=True),
    sa.Index("ix_bgp_prefix", sa.text("prefix inet_ops"), postgresql_using="gist"),
)

rirstats = sa.Table(
    "rirstats",
    sa_metadata,
    sa.Column("rir", sa.Enum(RIR), nullable=False),
    sa.Column("prefix", pg.CIDR, nullable=False),
    sa.Index("ix_rirstats_prefix", sa.text("prefix inet_ops"), postgresql_using="gist"),
)

last_data_import = sa.Table(
    "last_data_import",
    sa_metadata,
    sa.Column("last_data_import", sa.DateTime(timezone=True), nullable=False),
)

search_history = sa.Table(
    "search_history",
    sa_metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("session_id", sa.String(255), nullable=False, index=True),
    sa.Column("query", sa.String(500), nullable=False),
    sa.Column("query_type", sa.String(50), nullable=False),
    sa.Column(
        "timestamp",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    sa.Index("ix_search_history_timestamp", "timestamp"),
)

bookmarks = sa.Table(
    "bookmarks",
    sa_metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("session_id", sa.String(255), nullable=False, index=True),
    sa.Column("query", sa.String(500), nullable=False),
    sa.Column("query_type", sa.String(50), nullable=False),
    sa.Column("name", sa.String(255)),
    sa.Column(
        "timestamp",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    sa.UniqueConstraint("session_id", "query", "query_type", name="uq_bookmark"),
)

query_stats = sa.Table(
    "query_stats",
    sa_metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("query", sa.String(500), nullable=False),
    sa.Column("query_type", sa.String(50), nullable=False),
    sa.Column("count", sa.Integer, nullable=False, default=1),
    sa.Column(
        "last_accessed",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    sa.UniqueConstraint("query", "query_type", name="uq_query_stats"),
    sa.Index("ix_query_stats_count", "count"),
)

# BGP Monitoring Users and Configuration
bgp_users = sa.Table(
    "bgp_users",
    sa_metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
    sa.Column("password_hash", sa.String(255), nullable=False),
    sa.Column("full_name", sa.String(255)),
    sa.Column("is_active", sa.Boolean, nullable=False, default=True),
    sa.Column("is_admin", sa.Boolean, nullable=False, default=False),
    sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    sa.Column(
        "updated_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
)

user_emails = sa.Table(
    "user_emails",
    sa_metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column(
        "user_id",
        sa.Integer,
        sa.ForeignKey("bgp_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    sa.Column("email", sa.String(255), nullable=False),
    sa.Column("is_primary", sa.Boolean, nullable=False, default=False),
    sa.Column("is_verified", sa.Boolean, nullable=False, default=False),
    sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    sa.Index("ix_user_emails_email", "email"),
)

user_monitored_asns = sa.Table(
    "user_monitored_asns",
    sa_metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column(
        "user_id",
        sa.Integer,
        sa.ForeignKey("bgp_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    sa.Column("asn", sa.BigInteger, nullable=False, index=True),
    sa.Column("description", sa.String(500)),
    sa.Column("is_active", sa.Boolean, nullable=False, default=True),
    sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    sa.UniqueConstraint("user_id", "asn", name="uq_user_monitored_asn"),
)

alert_configurations = sa.Table(
    "alert_configurations",
    sa_metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column(
        "user_id",
        sa.Integer,
        sa.ForeignKey("bgp_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    sa.Column(
        "channel_type", sa.String(50), nullable=False
    ),  # email, slack, telegram, webhook, push
    sa.Column("is_enabled", sa.Boolean, nullable=False, default=True),
    sa.Column("config", pg.JSONB),  # Channel-specific configuration
    sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    sa.Column(
        "updated_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
)

bgp_alert_events = sa.Table(
    "bgp_alert_events",
    sa_metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column(
        "user_id",
        sa.Integer,
        sa.ForeignKey("bgp_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    sa.Column("asn", sa.BigInteger, nullable=False, index=True),
    sa.Column("prefix", pg.CIDR),
    sa.Column(
        "alert_type", sa.String(50), nullable=False
    ),  # hijack, visibility, path, rpki
    sa.Column("severity", sa.String(20), nullable=False),  # critical, high, medium, low
    sa.Column("message", sa.Text, nullable=False),
    sa.Column("details", pg.JSONB),
    sa.Column("is_acknowledged", sa.Boolean, nullable=False, default=False),
    sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
    sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
        index=True,
    ),
)

system_config = sa.Table(
    "system_config",
    sa_metadata,
    sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
    sa.Column("key", sa.String(255), nullable=False, unique=True, index=True),
    sa.Column("value", pg.JSONB, nullable=False),
    sa.Column("description", sa.Text),
    sa.Column(
        "updated_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    ),
    sa.Column("updated_by", sa.Integer, sa.ForeignKey("bgp_users.id")),
)
