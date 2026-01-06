from __future__ import annotations

import time
from typing import Callable

from pathlib import Path

from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import ApplicationError
from app.core.logging import get_logger, setup_logging
from app.middlewareMonitor import ResourceMonitorMiddleware

setup_logging()
logger = get_logger(__name__)

app = FastAPI(title=settings.app_name, version="0.1.0")

@app.get("/")
def root():
    return {"message": "Hola Mundo :)"}

media_directory = Path(settings.media_root).expanduser().resolve()
media_directory.mkdir(parents=True, exist_ok=True)
app.mount(settings.media_url_path, StaticFiles(directory=media_directory), name="media")

app.add_middleware(ResourceMonitorMiddleware)

if settings.cors_allow_origins:
    allow_origins = settings.cors_allow_origins
else:
    allow_origins = ["*"] if settings.debug else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next: Callable[[Request], Response]) -> Response:
    start = time.monotonic()
    response: Response | None = None
    try:
        response = await call_next(request)
        return response
    finally:
        process_time = time.monotonic() - start
        status_code = response.status_code if response else 500
        logger.info(
            "http.request",
            method=request.method,
            path=request.url.path,
            status_code=status_code,
            duration_ms=round(process_time * 1000, 2),
        )


@app.exception_handler(ApplicationError)
async def handle_application_error(request: Request, exc: ApplicationError) -> JSONResponse:
    logger.warning("http.application_error", detail=exc.detail, status_code=exc.status_code)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    logger.warning("http.validation_error", errors=errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Los datos enviados no son válidos. Revisa la información e inténtalo nuevamente.",
            "errors": errors,
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.error("http.unexpected_error", error=str(exc))
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


app.include_router(api_router)
