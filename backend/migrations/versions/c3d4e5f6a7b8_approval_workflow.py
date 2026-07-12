"""approval_workflow: approval_requests table, tenders.approval_status

Revision ID: c3d4e5f6a7b8
Revises: b7c8d9e0f1a2
Create Date: 2026-07-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "approval_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("tender_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("reviewer_user_id", sa.Integer(), nullable=True),
        sa.Column("reviewer_note", sa.Text(), nullable=True),
        sa.Column("requested_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["tender_id"], ["tenders.id"]),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewer_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_approval_requests_id"), "approval_requests", ["id"], unique=False)
    op.create_index(op.f("ix_approval_requests_organization_id"), "approval_requests", ["organization_id"], unique=False)
    op.create_index(op.f("ix_approval_requests_tender_id"), "approval_requests", ["tender_id"], unique=False)

    with op.batch_alter_table("tenders") as batch_op:
        batch_op.add_column(sa.Column("approval_status", sa.String(length=20), server_default="none"))


def downgrade() -> None:
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.drop_column("approval_status")

    op.drop_index(op.f("ix_approval_requests_tender_id"), table_name="approval_requests")
    op.drop_index(op.f("ix_approval_requests_organization_id"), table_name="approval_requests")
    op.drop_index(op.f("ix_approval_requests_id"), table_name="approval_requests")
    op.drop_table("approval_requests")
