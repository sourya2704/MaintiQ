"""incident photos

Revision ID: b81f3c2d9e44
Revises: a3c51e9d0f21
Create Date: 2026-11-07 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b81f3c2d9e44'
down_revision: Union[str, Sequence[str], None] = 'a3c51e9d0f21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'incident_photos',
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storage_key', sa.String(length=500), nullable=False),
        sa.Column('mime_type', sa.String(length=50), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('uploaded_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['incident_id'], ['incidents.id'], name=op.f('fk_incident_photos_incident_id_incidents'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], name=op.f('fk_incident_photos_uploaded_by_id_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_incident_photos')),
    )
    op.create_index(op.f('ix_incident_photos_incident_id'), 'incident_photos', ['incident_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_incident_photos_incident_id'), table_name='incident_photos')
    op.drop_table('incident_photos')
