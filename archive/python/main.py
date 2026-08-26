from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.webhooks import router as webhooks_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Agentic Engineer", lifespan=lifespan)
app.include_router(webhooks_router)
