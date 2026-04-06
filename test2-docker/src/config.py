"""
System configuration
"""
import os
from pydantic_settings import BaseSettings
from typing import Literal

class Settings(BaseSettings):
    # Database
    DB_HOST: str = "timescaledb"
    DB_PORT: int = 5432
    DB_USER: str = "algo_trader"
    DB_PASSWORD: str = "secure_password_change"
    DB_NAME: str = "trading_db"
    
    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    
    # Trading Mode
    MODE: Literal["paper", "live"] = "paper"
    
    # Data Provider
    DATA_PROVIDER: str = "polygon"
    
    # API Keys
    POLYGON_API_KEY: str = ""
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"
    
    # Risk Limits
    MAX_DAILY_LOSS: float = 0.02  # 2%
    MAX_WEEKLY_LOSS: float = 0.05  # 5%
    MAX_POSITION_SIZE: float = 10000  # USD
    MAX_ORDERS_PER_MINUTE: int = 10
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
