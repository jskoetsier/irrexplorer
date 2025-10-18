"""add_search_navigation

Revision ID: 6c73e25499d1
Revises: 1a8103c368a2
Create Date: 2025-10-18 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "6c73e25499d1"
down_revision = "1a8103c368a2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "search_history",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(255), nullable=False),
        sa.Column("query", sa.String(500), nullable=False),
        sa.Column("query_type", sa.String(50), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_search_history_session_id", "search_history", ["session_id"])
    op.create_index("ix_search_history_timestamp", "search_history", ["timestamp"])

    op.create_table(
        "bookmarks",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.String(255), nullable=False),
        sa.Column("query", sa.String(500), nullable=False),
        sa.Column("query_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255)),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_bookmarks_session_id", "bookmarks", ["session_id"])
    op.create_unique_constraint(
        "uq_bookmark", "bookmarks", ["session_id", "query", "query_type"]
    )

    op.create_table(
        "query_stats",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("query", sa.String(500), nullable=False),
        sa.Column("query_type", sa.String(50), nullable=False),
        sa.Column("count", sa.Integer, nullable=False, server_default="1"),
        sa.Column(
            "last_accessed",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_unique_constraint(
        "uq_query_stats", "query_stats", ["query", "query_type"]
    )
    op.create_index("ix_query_stats_count", "query_stats", ["count"])


def downgrade():
    op.drop_table("query_stats")
    op.drop_table("bookmarks")
    op.drop_table("search_history")
