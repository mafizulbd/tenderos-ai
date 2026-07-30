"""email_auth: email verification and password reset fields on users

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-07-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "b3c4d5e6f7a8"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("email_verified", sa.Boolean(), server_default=sa.false()))
        batch_op.add_column(sa.Column("email_verification_token", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("email_verification_expires_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("password_reset_token", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("password_reset_expires_at", sa.DateTime(), nullable=True))
        batch_op.create_index(
            op.f("ix_users_email_verification_token"), ["email_verification_token"], unique=False
        )
        batch_op.create_index(
            op.f("ix_users_password_reset_token"), ["password_reset_token"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index(op.f("ix_users_password_reset_token"))
        batch_op.drop_index(op.f("ix_users_email_verification_token"))
        batch_op.drop_column("password_reset_expires_at")
        batch_op.drop_column("password_reset_token")
        batch_op.drop_column("email_verification_expires_at")
        batch_op.drop_column("email_verification_token")
        batch_op.drop_column("email_verified")
