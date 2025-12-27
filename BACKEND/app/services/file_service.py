from __future__ import annotations

import os
from pathlib import Path
from typing import Final
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import ApplicationError

_ALLOWED_IMAGE_TYPES: Final[set[str]] = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_ALLOWED_DOCUMENT_TYPES: Final[set[str]] = {
    "application/pdf",
}


def _get_media_root() -> Path:
    media_root = Path(settings.media_root).expanduser().resolve()
    media_root.mkdir(parents=True, exist_ok=True)
    return media_root


def _ensure_subdirectory(media_root: Path, folder: str) -> Path:
    safe_folder = folder.strip().strip("/ ") or "uploads"
    target = media_root / safe_folder
    target.mkdir(parents=True, exist_ok=True)
    return target


def _build_public_path(folder: str, filename: str) -> str:
    base = settings.media_url_path.rstrip("/") or "/media"
    relative = f"{folder.strip('/ ')}/{filename}".strip("/")
    public_path = f"{base}/{relative}".replace("//", "/")
    return public_path if public_path.startswith("/") else f"/{public_path}"


async def save_image(upload: UploadFile, *, folder: str) -> str:
    if not upload or not upload.filename:
        raise ApplicationError("No se recibió ningún archivo para guardar", status_code=400)

    content_type = (upload.content_type or "").lower()
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise ApplicationError("Formato de imagen no soportado", status_code=400)

    suffix = Path(upload.filename).suffix.lower()
    media_root = _get_media_root()
    target_dir = _ensure_subdirectory(media_root, folder)
    filename = f"{uuid4().hex}{suffix}"
    destination = target_dir / filename

    with destination.open("wb") as buffer:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            buffer.write(chunk)

    await upload.close()
    return _build_public_path(folder, filename)


async def save_document(upload: UploadFile, *, folder: str) -> str:
    if not upload or not upload.filename:
        raise ApplicationError("No se recibió ningún archivo para guardar", status_code=400)

    content_type = (upload.content_type or "").lower()
    if content_type not in _ALLOWED_DOCUMENT_TYPES:
        raise ApplicationError("Formato de documento no soportado", status_code=400)

    suffix = Path(upload.filename).suffix.lower() or ".bin"
    media_root = _get_media_root()
    target_dir = _ensure_subdirectory(media_root, folder)
    filename = f"{uuid4().hex}{suffix}"
    destination = target_dir / filename

    with destination.open("wb") as buffer:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            buffer.write(chunk)

    await upload.close()
    return _build_public_path(folder, filename)


def delete_media(public_path: str | None) -> None:
    if not public_path:
        return

    base = settings.media_url_path.rstrip("/") or "/media"
    normalized_base = base if base.startswith("/") else f"/{base}"

    if not public_path.startswith("http") and public_path.startswith(normalized_base):
        relative_path = public_path[len(normalized_base) :].lstrip("/ ")
        media_root = _get_media_root()
        file_path = media_root / Path(relative_path)
        try:
            if file_path.is_file():
                file_path.unlink()
        except OSError:
            pass


def resolve_media_path(path: str | None) -> str | None:
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base = settings.media_url_path.rstrip("/") or "/media"
    normalized = path if path.startswith("/") else f"/{path}"
    return normalized.replace("//", "/") if normalized.startswith(base) else normalized
