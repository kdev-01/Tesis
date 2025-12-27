from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import data_service
from app.schemas.student import Student, StudentCreate, StudentUpdate
from app.schemas.user import UserBase


async def list_students(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    institucion_id: int | None = None,
    unassigned_only: bool = False,
    include_deleted: bool = False,
    actor: UserBase | None = None,
):

    return await data_service.list_students(
        session,
        page=page,
        page_size=page_size,
        search=search,
        institucion_id=institucion_id,
        unassigned_only=unassigned_only,
        include_deleted=include_deleted,
        actor=actor,
    )


async def create_student(
    session: AsyncSession, payload: StudentCreate, *, actor: UserBase | None = None
):
    return await data_service.create_student(session, payload, actor=actor)


async def update_student(
    session: AsyncSession,
    student_id: int,
    payload: StudentUpdate,
    *,
    actor: UserBase | None = None,
):
    return await data_service.update_student(session, student_id, payload, actor=actor)


async def delete_student(
    session: AsyncSession, student_id: int, *, actor: UserBase | None = None
) -> None:
    await data_service.delete_student(session, student_id, actor=actor)


async def restore_student(
    session: AsyncSession, student_id: int, *, actor: UserBase | None = None
) -> Student:
    return await data_service.restore_student(session, student_id, actor=actor)


async def delete_student_permanently(
    session: AsyncSession, student_id: int, *, actor: UserBase | None = None
) -> None:
    await data_service.delete_student_permanently(session, student_id, actor=actor)
