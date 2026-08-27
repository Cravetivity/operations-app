from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://ops:ops@localhost:5432/ops"

    bambuddy_url: str = ""
    bambuddy_api_key: str = ""

    spoolman_url: str = ""

    # Marketplace connector credentials (unused until Phase 2)
    etsy_api_key: str = ""
    ebay_client_id: str = ""
    ebay_client_secret: str = ""
    shopify_store: str = ""  # e.g. "cravetivity" for cravetivity.myshopify.com
    shopify_access_token: str = ""

    order_poll_seconds: int = 300
    printer_poll_seconds: float = 3.0
    spool_low_stock_grams: float = 150.0
    display_timezone: str = "America/Chicago"


@lru_cache
def get_settings() -> Settings:
    return Settings()
