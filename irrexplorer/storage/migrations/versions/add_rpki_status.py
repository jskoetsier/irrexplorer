"""add rpki_status to bgp table

Revision ID: add_rpki_status
Revises: 6c73e25499d1
Create Date: 2025-10-19

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_rpki_status'
down_revision = '6c73e25499d1'
branch_labels = None
depends_on = None


def upgrade():
    # Add rpki_status column to bgp table
    op.add_column('bgp', sa.Column('rpki_status', sa.String(20), nullable=True))
    op.create_index('ix_bgp_rpki_status', 'bgp', ['rpki_status'])
    
    # Set default value to 'unknown' for existing rows
    op.execute("UPDATE bgp SET rpki_status = 'unknown' WHERE rpki_status IS NULL")


def downgrade():
    op.drop_index('ix_bgp_rpki_status', table_name='bgp')
    op.drop_column('bgp', 'rpki_status')
