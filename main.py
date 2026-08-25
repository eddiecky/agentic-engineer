from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from api.admin import router as admin_router
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
app.include_router(admin_router)

app.mount("/admin", StaticFiles(directory="admin_static", html=True), name="admin")
