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
