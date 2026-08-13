"""company knowledge base: personnel, certifications, project experience

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-08-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "c4d5e6f7a8b9"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "personnel",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=255), nullable=True),
        sa.Column("qualification", sa.String(length=255), nullable=True),
        sa.Column("experience", sa.String(length=100), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_personnel_id"), "personnel", ["id"], unique=False)
    op.create_index(op.f("ix_personnel_organization_id"), "personnel", ["organization_id"], unique=False)

    op.create_table(
        "certifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("number", sa.String(length=255), nullable=True),
        sa.Column("expiry", sa.String(length=50), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_certifications_id"), "certifications", ["id"], unique=False)
    op.create_index(op.f("ix_certifications_organization_id"), "certifications", ["organization_id"], unique=False)

    op.create_table(
        "project_experience",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("client", sa.String(length=255), nullable=True),
        sa.Column("value", sa.String(length=100), nullable=True),
        sa.Column("year", sa.String(length=20), nullable=True),
        sa.Column("duration", sa.String(length=100), nullable=True),
        sa.Column("category", sa.String(length=255), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_experience_id"), "project_experience", ["id"], unique=False)
    op.create_index(op.f("ix_project_experience_organization_id"), "project_experience", ["organization_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_experience_organization_id"), table_name="project_experience")
    op.drop_index(op.f("ix_project_experience_id"), table_name="project_experience")
    op.drop_table("project_experience")

    op.drop_index(op.f("ix_certifications_organization_id"), table_name="certifications")
    op.drop_index(op.f("ix_certifications_id"), table_name="certifications")
    op.drop_table("certifications")

    op.drop_index(op.f("ix_personnel_organization_id"), table_name="personnel")
    op.drop_index(op.f("ix_personnel_id"), table_name="personnel")
    op.drop_table("personnel")
