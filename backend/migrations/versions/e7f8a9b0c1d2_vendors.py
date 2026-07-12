"""vendors: vendor management, tender-vendor links

Revision ID: e7f8a9b0c1d2
Revises: d5e6f7a8b9c0
Create Date: 2026-07-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "e7f8a9b0c1d2"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_name", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=100), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=255), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vendors_id"), "vendors", ["id"], unique=False)
    op.create_index(op.f("ix_vendors_organization_id"), "vendors", ["organization_id"], unique=False)

    op.create_table(
        "tender_vendor_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tender_id", sa.Integer(), nullable=False),
        sa.Column("vendor_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["tender_id"], ["tenders.id"]),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tender_id", "vendor_id", name="uq_tender_vendor_link"),
    )
    op.create_index(op.f("ix_tender_vendor_links_id"), "tender_vendor_links", ["id"], unique=False)
    op.create_index(op.f("ix_tender_vendor_links_tender_id"), "tender_vendor_links", ["tender_id"], unique=False)
    op.create_index(op.f("ix_tender_vendor_links_vendor_id"), "tender_vendor_links", ["vendor_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tender_vendor_links_vendor_id"), table_name="tender_vendor_links")
    op.drop_index(op.f("ix_tender_vendor_links_tender_id"), table_name="tender_vendor_links")
    op.drop_index(op.f("ix_tender_vendor_links_id"), table_name="tender_vendor_links")
    op.drop_table("tender_vendor_links")

    op.drop_index(op.f("ix_vendors_organization_id"), table_name="vendors")
    op.drop_index(op.f("ix_vendors_id"), table_name="vendors")
    op.drop_table("vendors")
