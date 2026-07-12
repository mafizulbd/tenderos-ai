"""teams_orgs: organizations, org_memberships, org_invites, tenders.organization_id

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2026-07-12 00:00:00.000000
"""
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = "b7c8d9e0f1a2"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("plan", sa.String(length=20), server_default="free"),
        sa.Column("monthly_tenders_used", sa.Integer(), server_default="0"),
        sa.Column("monthly_reset_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_organizations_id"), "organizations", ["id"], unique=False)

    op.create_table(
        "org_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_org_membership_org_user"),
    )
    op.create_index(op.f("ix_org_memberships_id"), "org_memberships", ["id"], unique=False)
    op.create_index(op.f("ix_org_memberships_organization_id"), "org_memberships", ["organization_id"], unique=False)
    op.create_index(op.f("ix_org_memberships_user_id"), "org_memberships", ["user_id"], unique=False)

    op.create_table(
        "org_invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_org_invites_id"), "org_invites", ["id"], unique=False)
    op.create_index(op.f("ix_org_invites_organization_id"), "org_invites", ["organization_id"], unique=False)
    op.create_index(op.f("ix_org_invites_token"), "org_invites", ["token"], unique=True)

    with op.batch_alter_table("tenders") as batch_op:
        batch_op.add_column(sa.Column("organization_id", sa.Integer(), nullable=True))
        batch_op.create_index(op.f("ix_tenders_organization_id"), ["organization_id"], unique=False)

    # --- Data backfill: give every existing user a personal Organization ---
    bind = op.get_bind()
    users_t = sa.table(
        "users",
        sa.column("id", sa.Integer),
        sa.column("email", sa.String),
        sa.column("organization_name", sa.String),
        sa.column("plan", sa.String),
        sa.column("monthly_tenders_used", sa.Integer),
        sa.column("monthly_reset_at", sa.DateTime),
    )
    orgs_t = sa.table(
        "organizations",
        sa.column("id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("plan", sa.String),
        sa.column("monthly_tenders_used", sa.Integer),
        sa.column("monthly_reset_at", sa.DateTime),
        sa.column("created_at", sa.DateTime),
    )
    memberships_t = sa.table(
        "org_memberships",
        sa.column("id", sa.Integer),
        sa.column("organization_id", sa.Integer),
        sa.column("user_id", sa.Integer),
        sa.column("role", sa.String),
        sa.column("status", sa.String),
        sa.column("created_at", sa.DateTime),
    )
    tenders_t = sa.table(
        "tenders",
        sa.column("id", sa.Integer),
        sa.column("user_id", sa.Integer),
        sa.column("organization_id", sa.Integer),
    )

    now = datetime.utcnow()
    for user in bind.execute(sa.select(users_t)).fetchall():
        org_name = user.organization_name or f"{user.email}'s Organization"
        result = bind.execute(
            orgs_t.insert().values(
                name=org_name,
                plan=user.plan or "free",
                monthly_tenders_used=user.monthly_tenders_used or 0,
                monthly_reset_at=user.monthly_reset_at,
                created_at=now,
            )
        )
        org_id = result.lastrowid
        bind.execute(
            memberships_t.insert().values(
                organization_id=org_id, user_id=user.id, role="owner", status="active", created_at=now,
            )
        )
        bind.execute(
            tenders_t.update().where(tenders_t.c.user_id == user.id).values(organization_id=org_id)
        )


def downgrade() -> None:
    with op.batch_alter_table("tenders") as batch_op:
        batch_op.drop_index(op.f("ix_tenders_organization_id"))
        batch_op.drop_column("organization_id")

    op.drop_index(op.f("ix_org_invites_token"), table_name="org_invites")
    op.drop_index(op.f("ix_org_invites_organization_id"), table_name="org_invites")
    op.drop_index(op.f("ix_org_invites_id"), table_name="org_invites")
    op.drop_table("org_invites")

    op.drop_index(op.f("ix_org_memberships_user_id"), table_name="org_memberships")
    op.drop_index(op.f("ix_org_memberships_organization_id"), table_name="org_memberships")
    op.drop_index(op.f("ix_org_memberships_id"), table_name="org_memberships")
    op.drop_table("org_memberships")

    op.drop_index(op.f("ix_organizations_id"), table_name="organizations")
    op.drop_table("organizations")
