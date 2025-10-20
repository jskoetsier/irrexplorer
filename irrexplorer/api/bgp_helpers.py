"""
Helper functions for BGP API endpoints.
"""

from datetime import datetime
from typing import Any, Dict


def serialize_datetime(obj: Any) -> Any:
    """Convert datetime objects to ISO format strings for JSON serialization."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


def serialize_row(row: Dict) -> Dict:
    """Serialize a database row for JSON response, handling datetime fields."""
    return {key: serialize_datetime(value) for key, value in row.items()}


def serialize_rows(rows: list) -> list:
    """Serialize a list of database rows for JSON response."""
    return [serialize_row(dict(row)) for row in rows]
