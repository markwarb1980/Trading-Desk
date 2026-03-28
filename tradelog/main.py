from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from tradelog.database import Base, engine

# Import all models so they are registered with Base.metadata
from tradelog.models import trade, journal, playbook, tag  # noqa: F401

from tradelog.routers import (
    trades,
    journal as journal_router,
    analytics,
    playbooks,
    import_trades,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all database tables on startup
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="TradeLog", lifespan=lifespan)

# CORS — allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(trades.router)
app.include_router(journal_router.router)
app.include_router(analytics.router)
app.include_router(playbooks.router)
app.include_router(import_trades.router)

# Mount static files (frontend)
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")


@app.get("/", include_in_schema=False)
async def serve_index():
    return FileResponse(os.path.join(frontend_dir, "index.html"))


@app.get("/{path:path}", include_in_schema=False)
async def serve_spa(path: str, request: Request):
    # Serve index.html for all non-API, non-static routes (SPA catch-all)
    if path.startswith("api/") or path.startswith("static/"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    from fastapi import HTTPException
    raise HTTPException(status_code=404)
