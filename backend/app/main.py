"""CivicAid FastAPI Backend — Production Entry Point v2.0"""
import logging
import time
import uuid
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import get_settings
from app.routers import chat, document, health, eval, whatsapp, reminders, vault, corruption, generation, escalation, explain

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("civicaid")
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"CivicAid API v{settings.app_version} starting — env={settings.app_env}")
    app.state.rag_ready = False
    # Warm up RAG pipeline on startup
    try:
        from app.services.rag_pipeline import get_rag_pipeline
        rag = get_rag_pipeline()
        app.state.rag_ready = rag._loaded
        logger.info(f"RAG pipeline ready — {len(rag.chunks)} chunks indexed")
    except Exception as e:
        logger.warning(f"RAG pipeline startup warning: {e}")
    yield
    logger.info("CivicAid API shutting down")

app = FastAPI(
    title="CivicAid API",
    description="Free legal and government assistance for Tamil Nadu village residents — RAG-powered",
    version=settings.app_version,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "X-Request-ID",
        "X-Vault-Token",
        "X-Reminder-Token",
        "X-Admin-Token",
    ],
    max_age=86400,
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def request_middleware(request: Request, call_next):
    incoming_req_id = request.headers.get("X-Request-ID", "")
    req_id = incoming_req_id if re.fullmatch(r"[A-Za-z0-9._-]{1,64}", incoming_req_id) else str(uuid.uuid4())
    start = time.time()
    response = await call_next(request)
    elapsed = round((time.time() - start) * 1000)
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Response-Time"] = f"{elapsed}ms"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path not in ("/api/health",):
        logger.info(f"{request.method} {request.url.path} → {response.status_code} [{elapsed}ms]")
    return response

@app.exception_handler(Exception)
async def global_error(request: Request, exc: Exception):
    logger.error(f"Unhandled: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Something went wrong. Please try again.", "helpline": "1516"})

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(document.router)
app.include_router(eval.router)
app.include_router(whatsapp.router)
app.include_router(reminders.router)
app.include_router(vault.router)
app.include_router(corruption.router)
app.include_router(generation.router)
app.include_router(escalation.router)
app.include_router(explain.router)

@app.get("/")
async def root():
    return {"name": "CivicAid API", "version": settings.app_version, "status": "running", "docs": "/docs"}
