from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = Field(default="AGXport API")
    app_env: str = Field(default="development")
    debug: bool = Field(default=False)

    database_url: str = Field(alias="DATABASE_URL")

    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_refresh_secret_key: str = Field(alias="JWT_REFRESH_SECRET_KEY")
    access_token_expire_seconds: int = Field(default=900, alias="ACCESS_TOKEN_EXPIRE_SECONDS")
    refresh_token_expire_seconds: int = Field(default=86400, alias="REFRESH_TOKEN_EXPIRE_SECONDS")

    cors_allow_origins: List[str] = Field(default_factory=list, alias="CORS_ALLOW_ORIGINS")

    smtp_host: str = Field(alias="SMTP_HOST")
    smtp_port: int = Field(alias="SMTP_PORT")
    smtp_user: str | None = Field(default=None, alias="SMTP_USER")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    smtp_from: str = Field(alias="SMTP_FROM")

    frontend_base_url: str = Field(default="http://localhost:5173", alias="FRONTEND_BASE_URL")
    media_root: str = Field(default="./media", alias="MEDIA_ROOT")
    media_url_path: str = Field(default="/media", alias="MEDIA_URL_PATH")

    password_hash_scheme: str = Field(default="argon2id", alias="PASSWORD_HASH_SCHEME")
    password_hash_memory_cost: int = Field(default=19456, alias="PASSWORD_HASH_MEMORY_COST")
    password_hash_time_cost: int = Field(default=2, alias="PASSWORD_HASH_TIME_COST")
    password_hash_parallelism: int = Field(default=2, alias="PASSWORD_HASH_PARALLELISM")

    @model_validator(mode="after")
    def _normalize_origins(self) -> "Settings":
        if isinstance(self.cors_allow_origins, str):
            raw_value = self.cors_allow_origins
            if raw_value.strip():
                self.cors_allow_origins = [origin.strip() for origin in raw_value.split(",") if origin.strip()]
            else:
                self.cors_allow_origins = []
        return self

    @model_validator(mode="after")
    def _validate_password_hashing(self) -> "Settings":
        scheme = self.password_hash_scheme.lower()
        if scheme != "argon2id":
            raise ValueError("PASSWORD_HASH_SCHEME debe ser 'argon2id'")
        if self.password_hash_memory_cost <= 0:
            raise ValueError("PASSWORD_HASH_MEMORY_COST debe ser mayor a cero")
        if self.password_hash_time_cost <= 0:
            raise ValueError("PASSWORD_HASH_TIME_COST debe ser mayor a cero")
        if self.password_hash_parallelism <= 0:
            raise ValueError("PASSWORD_HASH_PARALLELISM debe ser mayor a cero")
        return self

    @property
    def sqlalchemy_database_uri(self) -> str:
        return self.database_url

    @property
    def sync_database_uri(self) -> str:
        if "+asyncpg" in self.database_url:
            return self.database_url.replace("+asyncpg", "")
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]


settings = get_settings()
