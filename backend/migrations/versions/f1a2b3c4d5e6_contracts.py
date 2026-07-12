"""contracts: contract tracking

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-07-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "f1a2b3c4d5e6"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contracts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("tender_id", sa.Integer(), nullable=True),
        sa.Column("vendor_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("counterparty_name", sa.String(length=255), nullable=True),
        sa.Column("contract_value", sa.String(length=100), nullable=True),
        sa.Column("currency", sa.String(length=10), server_default="BDT"),
        sa.Column("start_date", sa.DateTime(), nullable=True),
        sa.Column("end_date", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="draft"),
        sa.Column("performance_security", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["tender_id"], ["tenders.id"]),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contracts_id"), "contracts", ["id"], unique=False)
    op.create_index(op.f("ix_contracts_organization_id"), "contracts", ["organization_id"], unique=False)
    op.create_index(op.f("ix_contracts_tender_id"), "contracts", ["tender_id"], unique=False)
    op.create_index(op.f("ix_contracts_vendor_id"), "contracts", ["vendor_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_contracts_vendor_id"), table_name="contracts")
    op.drop_index(op.f("ix_contracts_tender_id"), table_name="contracts")
    op.drop_index(op.f("ix_contracts_organization_id"), table_name="contracts")
    op.drop_index(op.f("ix_contracts_id"), table_name="contracts")
    op.drop_table("contracts")
