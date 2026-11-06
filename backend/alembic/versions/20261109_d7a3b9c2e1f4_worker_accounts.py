"""worker accounts: organization slug, last login, forced password change; contact requests

Revision ID: d7a3b9c2e1f4
Revises: c4d2e8a1f5b7
Create Date: 2026-11-09 10:00:00.000000

"""
import re
import unicodedata
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd7a3b9c2e1f4'
down_revision: Union[str, Sequence[str], None] = 'c4d2e8a1f5b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:30].strip("-") or "plant"


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('organizations', sa.Column('slug', sa.String(length=40), nullable=True))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('must_change_password', sa.Boolean(), server_default='false', nullable=False))
    conn = op.get_bind()
    taken: set[str] = set()
    for org_id, name in conn.execute(sa.text("SELECT id, name FROM organizations ORDER BY created_at")):
        base = slug = _slug(name)
        n = 2
        while slug in taken:
            slug, n = f"{base}-{n}", n + 1
        taken.add(slug)
        conn.execute(sa.text("UPDATE organizations SET slug = :s WHERE id = :i"), {"s": slug, "i": org_id})
    op.create_unique_constraint(op.f('uq_organizations_slug'), 'organizations', ['slug'])
    op.create_table(
        'contact_requests',
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('company', sa.String(length=200), nullable=True),
        sa.Column('contact', sa.String(length=320), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_contact_requests')),
    )
    op.create_index(op.f('ix_contact_requests_created_at'), 'contact_requests', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_contact_requests_created_at'), table_name='contact_requests')
    op.drop_table('contact_requests')
    op.drop_constraint(op.f('uq_organizations_slug'), 'organizations', type_='unique')
    op.drop_column('users', 'must_change_password')
    op.drop_column('users', 'last_login_at')
    op.drop_column('organizations', 'slug')
