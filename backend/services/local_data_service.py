from typing import Any

from backend.db import (
    create_backup,
    export_snapshot,
    import_snapshot,
    list_backups,
    local_data_summary,
    reset_local_data,
)


def get_summary() -> dict[str, Any]:
    return local_data_summary()


def export_data_snapshot() -> dict[str, Any]:
    return export_snapshot()


def import_data_snapshot(snapshot: dict[str, Any]) -> None:
    import_snapshot(snapshot)


def list_backup_items() -> list[dict[str, Any]]:
    return list_backups()


def create_backup_file() -> str:
    return create_backup()


def reset_data(mode: str) -> None:
    reset_local_data(mode)
