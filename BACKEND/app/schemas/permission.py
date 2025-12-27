from __future__ import annotations

from pydantic import BaseModel, Field


class PermissionsUpdate(BaseModel):
    permisos: list[str] = Field(default_factory=list)
