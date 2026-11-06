"""user preferred language

Revision ID: a3c51e9d0f21
Revises: e00a1f2c13b7
Create Date: 2026-11-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a3c51e9d0f21'
down_revision: Union[str, Sequence[str], None] = 'e00a1f2c13b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # NULL means the user has not chosen yet; the app then asks once after sign-in.
    op.add_column('users', sa.Column('preferred_language', sa.String(length=5), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'preferred_language')
