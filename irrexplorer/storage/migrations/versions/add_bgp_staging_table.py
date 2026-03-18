"""add bgp staging table

Revision ID: add_bgp_staging_table
Revises: add_bgp_user_system
Create Date: 2026-03-18

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "add_bgp_staging_table"
down_revision = "add_bgp_user_system"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "bgp_staging",
        sa.Column("asn", sa.BigInteger(), nullable=False),
        sa.Column("prefix", postgresql.CIDR(), nullable=False),
        sa.Column("rpki_status", sa.String(length=20), nullable=True),
    )


def downgrade():  # pragma: no cover
    op.drop_table("bgp_staging")
