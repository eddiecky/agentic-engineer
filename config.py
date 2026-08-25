from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # JIRA
    JIRA_URL: str = ""
    JIRA_USERNAME: str = ""
    JIRA_API_TOKEN: str = ""

    # GitHub
    GITHUB_TOKEN: str = ""
    GITHUB_DEFAULT_ORG: str = ""

    # LLM
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-3.5-sonnet"
    DEFAULT_LLM_PROVIDER: str = "openrouter"  # or "copilot"

    # App
    DATABASE_URL: str = "sqlite:///./agentic_engineer.db"
    LOG_LEVEL: str = "INFO"


settings = Settings()


def resolve_config(key: str, default=None):
    """Read configuration value from DB first, then fall back to .env/settings."""
    try:
        from database import SessionLocal
        from models import Configuration

        db = SessionLocal()
        row = db.query(Configuration).filter(Configuration.key == key).first()
        db.close()
        if row and row.value:
            return row.value
    except Exception:
        pass
    return getattr(settings, key, default)
