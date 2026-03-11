from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "DB-Lighthouse AI"
    
    # Database
    DATABASE_URL: Optional[str] = None
    SHADOW_DB_URL: Optional[str] = "postgresql://postgres:postgres@127.0.0.1:5432/shadow_db"
    
    # AI (Jan)
    JAN_API_URL: str = "http://localhost:1337/v1"
    JAN_MODEL_NAME: str = "mistral-ins-7b-q4"
    OPENAI_API_KEY: Optional[str] = None
    
    # Local LLM
    USE_LOCAL_AI: bool = False
    LOCAL_MODEL_PATH: str = "models/Jan-v3-4b-base-instruct-Q4_K_XL.gguf"
    AI_MODE: str = "JAN" # JAN, OLLAMA, or LOCAL_FILE
    
    # PostgreSQL Tools Paths (Optional, for Windows)
    PSQL_PATH: str = "psql"
    PG_DUMP_PATH: str = "pg_dump"
    
    # Env fields that might be present
    ENV: str = "development"
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"  # Ignore other extra env vars to prevent validation errors
    )

settings = Settings()
