from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.responses import HTMLResponse

from api.admin import router as admin_router
from api.admin_auth import admin_auth
from api.webhooks import router as webhooks_router
from config import settings
from database import SessionLocal, engine
from models import Base, Configuration


_SEED_KEYS = [
    "JIRA_URL", "JIRA_USERNAME", "JIRA_API_TOKEN",
    "GITHUB_TOKEN",
    "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "DEFAULT_LLM_PROVIDER",
    "ADMIN_PASSWORD",
]


def _seed_config():
    db = SessionLocal()
    try:
        for key in _SEED_KEYS:
            value = getattr(settings, key, "")
            if not value:
                continue
            exists = db.query(Configuration).filter(Configuration.key == key).first()
            if not exists:
                db.add(Configuration(key=key, value=value))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_config()
    yield


app = FastAPI(title="Agentic Engineer", lifespan=lifespan)

app.include_router(webhooks_router)
app.include_router(admin_router, dependencies=[Depends(admin_auth)])


@app.get("/admin", response_class=HTMLResponse, dependencies=[Depends(admin_auth)])
def serve_admin():
    with open(Path(__file__).parent / "admin_static" / "index.html", "r", encoding="utf-8") as f:
        return f.read()
