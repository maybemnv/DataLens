from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import ClassVar, Literal
from urllib.parse import quote_plus


class Settings(BaseSettings):
    groq_api_key: str = Field(validation_alias="GROQ_API_KEY")
    model_name: str = Field(default="qwen/qwen3-32b")

    # Database Configuration
    # Use DATABASE_URL for full connection string override (e.g., Supabase). SSL is configured in database.py via connect_args.
    database_url_override: str = Field(default="", validation_alias="DATABASE_URL")
    db_host: str = Field(default="127.0.0.1", validation_alias="DB_HOST")
    db_port: int = Field(default=5432, validation_alias="DB_PORT")
    db_user: str = Field(validation_alias="DB_USER")
    db_password: str = Field(validation_alias="DB_PASSWORD")
    db_name: str = Field(default="datalens", validation_alias="DB_NAME")
    db_driver: str = Field(default="postgresql+asyncpg")

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        encoded_password = quote_plus(self.db_password)
        return f"{self.db_driver}://{self.db_user}:{encoded_password}@{self.db_host}:{self.db_port}/{self.db_name}"
    
    # Redis Configuration
    upstash_redis_rest_url: str = Field(default="", validation_alias="UPSTASH_REDIS_REST_URL")
    upstash_redis_rest_token: str = Field(default="", validation_alias="UPSTASH_REDIS_REST_TOKEN")
    redis_url: str = Field(default="redis://127.0.0.1:6379/0", validation_alias="REDIS_URL")

    # R2 / S3-compatible Storage Configuration
    r2_account_id: str = Field(default="", validation_alias="R2_ACCOUNT_ID")
    r2_access_key: str = Field(default="", validation_alias="R2_ACCESS_KEY")
    r2_secret_key: str = Field(default="", validation_alias="R2_SECRET_KEY")
    r2_bucket: str = Field(default="datalens", validation_alias="R2_BUCKET")

    @property
    def r2_endpoint(self) -> str | None:
        if self.r2_account_id:
            return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"
        return None

    @property
    def has_r2(self) -> bool:
        return bool(self.r2_account_id and self.r2_access_key and self.r2_secret_key)
    
    @property
    def is_upstash_redis(self) -> bool:
        return bool(self.upstash_redis_rest_url and self.upstash_redis_rest_token)
    
    @property
    def active_redis_config(self) -> dict:
        """Get the active Redis configuration.
        
        Note: Returns config references only, not actual credentials.
        Use settings directly when initializing Redis client.
        """
        if self.is_upstash_redis:
            return {
                "type": "upstash",
                "configured": True
            }
        return {
            "type": "standard",
            "url": self.redis_url,
            "configured": bool(self.redis_url and self.redis_url != "redis://127.0.0.1:6379/0")
        }
    
    # Application Configuration
    max_upload_mb: int = Field(default=100, validation_alias="MAX_UPLOAD_MB")
    session_ttl_seconds: int = Field(default=3600, validation_alias="SESSION_TTL_SECONDS")
    debug: bool = Field(default=False, validation_alias="DEBUG")
    environment: Literal["development", "staging", "production"] = Field(default="development", validation_alias="ENVIRONMENT")
    
    # ========================================
    # CORS Configuration
    cors_origins: list[str] = Field(default=["http://localhost:3000", "http://127.0.0.1:3000"], validation_alias="CORS_ORIGINS")
    cors_allow_credentials: bool = Field(default=True, validation_alias="CORS_ALLOW_CREDENTIALS")

    # Authentication
    jwt_secret_key: str = Field(default="change-me-in-production", validation_alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=1440, validation_alias="JWT_EXPIRE_MINUTES")
    
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(default="INFO", validation_alias="LOG_LEVEL")
    
    _root_dir: ClassVar[Path] = Path(__file__).parent.parent
    
    model_config = SettingsConfigDict(
        env_file=str(_root_dir / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        validate_assignment=True
    )
    
    @field_validator("groq_api_key")
    @classmethod
    def validate_groq_api_key(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError("GROQ_API_KEY must be set in environment variables")
        return v.strip()
    @field_validator("db_user", "db_password")
    @classmethod
    def validate_db_credentials(cls, v: str, info) -> str:
        if not v or v.strip() == "":
            # Allow empty when DATABASE_URL override is provided
            if info.data.get("database_url_override"):
                return v
            raise ValueError("Database credentials (DB_USER, DB_PASSWORD) must be set in environment variables")
        return v.strip()

    @field_validator("upstash_redis_rest_url", "upstash_redis_rest_token", mode="before")
    @classmethod
    def validate_redis_credentials(cls, v: str) -> str:
        """Validate Redis credentials are not placeholder values."""
        if v and isinstance(v, str):
            v = v.strip()
            # Check for placeholder values
            if v in ["your_upstash_token_here", "your_upstash_url_here", ""]:
                return ""  # Return empty to allow fallback to standard Redis
        return v
    
    @field_validator("max_upload_mb")
    @classmethod
    def validate_upload_size(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("MAX_UPLOAD_MB must be greater than 0")
        if v > 1000:  # 1GB limit
            raise ValueError("MAX_UPLOAD_MB should not exceed 1000MB (1GB)")
        return v
    
    @field_validator("session_ttl_seconds")
    @classmethod
    def validate_session_ttl(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("SESSION_TTL_SECONDS must be greater than 0")
        if v > 86400:  # 24 hours
            raise ValueError("SESSION_TTL_SECONDS should not exceed 24 hours (86400 seconds)")
        return v
    
    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    # Helper Methods
    def get_database_info(self) -> dict:
        return {
            "host": self.db_host,
            "port": self.db_port,
            "user": self.db_user,
            "database": self.db_name,
            "driver": self.db_driver
        }
    
    def get_redis_info(self) -> dict:
        """Get Redis configuration info (without exposing credentials)."""
        if self.is_upstash_redis:
            # Mask the URL to avoid exposing the token
            masked_url = self._mask_url(self.upstash_redis_rest_url)
            return {
                "type": "upstash",
                "url": masked_url,
                "configured": True
            }
        return {
            "type": "standard",
            "url": self._mask_url(self.redis_url),
            "configured": bool(self.redis_url and self.redis_url != "redis://127.0.0.1:6379/0")
        }

    @staticmethod
    def _mask_url(url: str) -> str:
        """Mask sensitive parts of URL (passwords, tokens)."""
        if not url:
            return "not configured"
        try:
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(url)
            # Mask password/token if present
            if parsed.password:
                parsed = parsed._replace(
                    netloc=f"{parsed.username}:****@{parsed.hostname}:{parsed.port}"
                )
            return urlunparse(parsed)
        except Exception:
            # If parsing fails, just return first 30 chars
            return url[:30] + "..." if len(url) > 30 else url
    
    def is_production(self) -> bool:
        return self.environment == "production"

    def is_development(self) -> bool:
        return self.environment == "development"

    def get_safe_config_summary(self) -> dict:
        """Get a summary of configuration without exposing secrets."""
        return {
            "environment": self.environment,
            "debug": self.debug,
            "model": self.model_name,
            "database": {
                "host": self.db_host,
                "port": self.db_port,
                "user": self.db_user[:3] + "***" if len(self.db_user) > 3 else "***",
                "database": self.db_name,
                "driver": self.db_driver,
                "url_override": bool(self.database_url_override),
            },
            "redis": self.get_redis_info(),
            "r2": {
                "configured": self.has_r2,
                "bucket": self.r2_bucket,
            },
            "cors_origins": self.cors_origins,
            "max_upload_mb": self.max_upload_mb,
            "session_ttl_seconds": self.session_ttl_seconds
        }


settings = Settings()
