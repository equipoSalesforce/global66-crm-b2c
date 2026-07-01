from typing import Optional

import psycopg
from psycopg import Connection

from app.core.config import Settings, get_settings


class RedshiftRepository:
    """Future Redshift data access without an eager connection."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self._settings = settings or get_settings()

    @property
    def is_configured(self) -> bool:
        return all(
            (
                self._settings.redshift_host,
                self._settings.redshift_database,
                self._settings.redshift_user,
                self._settings.redshift_password,
            )
        )

    def connect(self) -> Connection:
        """Open a connection only when future data access explicitly requests it."""
        if not self.is_configured:
            raise RuntimeError("Redshift connection is not configured")

        return psycopg.connect(
            host=self._settings.redshift_host,
            port=self._settings.redshift_port,
            dbname=self._settings.redshift_database,
            user=self._settings.redshift_user,
            password=self._settings.redshift_password,
        )
