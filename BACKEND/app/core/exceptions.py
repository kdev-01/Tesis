from __future__ import annotations

from fastapi import HTTPException, status


class ApplicationError(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(status_code=status_code, detail=detail)


class UnauthorizedError(ApplicationError):
    def __init__(self, detail: str = "No autorizado") -> None:
        super().__init__(detail=detail, status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(ApplicationError):
    def __init__(self, detail: str = "No tienes permisos para esta acción") -> None:
        super().__init__(detail=detail, status_code=status.HTTP_403_FORBIDDEN)
