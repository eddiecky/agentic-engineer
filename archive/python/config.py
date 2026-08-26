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

    # LLM
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-3.5-sonnet"
    DEFAULT_LLM_PROVIDER: str = "openrouter"

    # App
    DATABASE_URL: str = "sqlite:///./agentic_engineer.db"
    LOG_LEVEL: str = "INFO"
    ADMIN_PASSWORD: str = ""


settings = Settings()
