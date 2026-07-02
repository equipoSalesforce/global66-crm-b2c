from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_env: str = "local"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    supabase_url: Optional[str] = None
    supabase_service_role_key: Optional[SecretStr] = None
    cases_use_mock_data: bool = True
    aws_region: Optional[str] = None
    redshift_access_mode: str = "data_api"
    redshift_cluster_identifier: Optional[str] = None
    redshift_secret_arn: Optional[SecretStr] = None
    account_360_use_mock_data: bool = True
    redshift_data_api_poll_interval_seconds: float = Field(default=0.5, gt=0)
    redshift_data_api_timeout_seconds: float = Field(default=30.0, gt=0)
    redshift_host: Optional[str] = None
    redshift_port: int = 5439
    redshift_database: Optional[str] = None
    redshift_user: Optional[str] = None
    redshift_password: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def has_supabase_credentials(self) -> bool:
        return bool(
            self.supabase_url
            and self.supabase_service_role_key
            and self.supabase_service_role_key.get_secret_value()
        )

    @property
    def has_redshift_data_api_config(self) -> bool:
        return bool(
            self.redshift_access_mode == "data_api"
            and self.aws_region
            and self.redshift_cluster_identifier
            and self.redshift_database
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
