"""kb_gap_questions: tender-triggered knowledge base gap questions

Revision ID: d6e7f8a9b0c1
Revises: c4d5e6f7a8b9
Create Date: 2026-08-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "d6e7f8a9b0c1"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.add_column(sa.Column("kb_gap_questions", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.drop_column("kb_gap_questions")
