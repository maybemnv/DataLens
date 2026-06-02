from datetime import datetime, timezone
def utcnow() -> datetime:
    """Return the current UTC time as a timezone-naive datetime.

    Matches the database columns defined as TIMESTAMP WITHOUT TIME ZONE.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
