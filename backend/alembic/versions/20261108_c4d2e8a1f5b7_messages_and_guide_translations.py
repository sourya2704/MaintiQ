"""messages and guide translations

Revision ID: c4d2e8a1f5b7
Revises: b81f3c2d9e44
Create Date: 2026-11-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c4d2e8a1f5b7'
down_revision: Union[str, Sequence[str], None] = 'b81f3c2d9e44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('incidents', sa.Column('guide_translations', postgresql.JSONB(astext_type=sa.Text()),
                                         server_default='{}', nullable=False))
    op.create_table(
        'messages',
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('recipient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('fix', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('language', sa.String(length=5), nullable=False),
        sa.Column('translations', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['incident_id'], ['incidents.id'], name=op.f('fk_messages_incident_id_incidents'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_messages_organization_id_organizations'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], name=op.f('fk_messages_recipient_id_users'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], name=op.f('fk_messages_sender_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_messages')),
    )
    op.create_index(op.f('ix_messages_organization_id'), 'messages', ['organization_id'], unique=False)
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)
    op.create_index(op.f('ix_messages_created_at'), 'messages', ['created_at'], unique=False)
    op.create_index('ix_messages_recipient_unread', 'messages', ['recipient_id', 'read_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_messages_recipient_unread', table_name='messages')
    op.drop_index(op.f('ix_messages_created_at'), table_name='messages')
    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_organization_id'), table_name='messages')
    op.drop_table('messages')
    op.drop_column('incidents', 'guide_translations')
