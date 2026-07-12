"""saas_features: plan fields on users, bid lifecycle fields on tenders

Revision ID: a1b2c3d4e5f6
Revises: 69d3aca0b7fb
Create Date: 2026-06-30 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "69d3aca0b7fb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users — subscription / usage tracking
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("plan", sa.String(20), server_default="free"))
        batch_op.add_column(sa.Column("monthly_tenders_used", sa.Integer, server_default="0"))
        batch_op.add_column(sa.Column("monthly_reset_at", sa.DateTime, nullable=True))

    # Tenders — bid lifecycle + new AI sections
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.add_column(sa.Column("deadline", sa.DateTime, nullable=True))
        batch_op.add_column(sa.Column("bid_status", sa.String(50), server_default="reviewing"))
        batch_op.add_column(sa.Column("bid_score", sa.Integer, nullable=True))
        batch_op.add_column(sa.Column("notes", sa.Text, server_default=""))
        batch_op.add_column(sa.Column("financial_requirements", sa.Text, nullable=True))
        batch_op.add_column(sa.Column("bid_recommendation", sa.Text, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.drop_column("bid_recommendation")
        batch_op.drop_column("financial_requirements")
        batch_op.drop_column("notes")
        batch_op.drop_column("bid_score")
        batch_op.drop_column("bid_status")
        batch_op.drop_column("deadline")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("monthly_reset_at")
        batch_op.drop_column("monthly_tenders_used")
        batch_op.drop_column("plan")
