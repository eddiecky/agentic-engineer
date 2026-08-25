from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.responses import HTMLResponse

from api.admin import router as admin_router
from api.admin_auth import admin_auth
from api.webhooks import router as webhooks_router
from database import engine
from models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown


app = FastAPI(title="Agentic Engineer", lifespan=lifespan)

app.include_router(webhooks_router)
app.include_router(admin_router, dependencies=[Depends(admin_auth)])


@app.get("/admin", response_class=HTMLResponse, dependencies=[Depends(admin_auth)])
def serve_admin():
    with open(Path(__file__).parent / "admin_static" / "index.html", "r", encoding="utf-8") as f:
        return f.read()
