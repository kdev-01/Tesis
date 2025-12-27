from __future__ import annotations

from typing import Generic, Optional, TypeVar

from pydantic import BaseModel
from pydantic.generics import GenericModel

T = TypeVar("T")


class Meta(BaseModel):
    total: Optional[int] = None
    page: Optional[int] = None
    page_size: Optional[int] = None
    extra: dict | None = None


class ResponseEnvelope(GenericModel, Generic[T]):
    data: T
    meta: Meta | None = None
