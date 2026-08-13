"""Timezone-safe replacement for the deprecated datetime.utcnow().

Kept as its own tiny module (rather than living in deps.py) so models.py can
import it too without a circular import — deps.py already imports from
models.py, so models.py can't import from deps.py.
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC now — matches this codebase's naive `DateTime` columns.

    Every `DateTime` column here is declared without `timezone=True`, and
    SQLite has no native timezone-aware storage anyway, so every datetime
    flowing through this app is naive-but-implicitly-UTC. `datetime.now(UTC)`
    returns a timezone-*aware* value, which would raise `TypeError` the
    moment it's compared against a naive value read back from the DB — so
    this strips the tzinfo back off after computing the correct UTC instant,
    giving the exact same value `datetime.utcnow()` used to, without the
    deprecation warning.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
