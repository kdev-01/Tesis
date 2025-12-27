from __future__ import annotations

from datetime import date, datetime, timezone
from typing import List, Tuple

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.student import Estudiante


async def get_student_by_id(
    session: AsyncSession, student_id: int, *, include_deleted: bool = False
) -> Estudiante | None:
    query = (
        select(Estudiante)
        .options(selectinload(Estudiante.institucion))
        .where(Estudiante.id == student_id)
    )
    if not include_deleted:
        query = query.where(Estudiante.eliminado.is_(False))
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_student_by_document(
    session: AsyncSession,
    documento: str,
    *,
    institucion_id: int | None,
    include_deleted: bool = False,
) -> Estudiante | None:
    query = select(Estudiante).where(
        func.lower(Estudiante.documento_identidad) == func.lower(documento)
    )
    if institucion_id is not None:
        query = query.where(Estudiante.institucion_id == institucion_id)
    if not include_deleted:
        query = query.where(Estudiante.eliminado.is_(False))
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_students_by_ids(
    session: AsyncSession, student_ids: Iterable[int]
) -> list[Estudiante]:
    ids = {int(student_id) for student_id in student_ids if student_id is not None}
    if not ids:
        return []
    query = (
        select(Estudiante)
        .options(selectinload(Estudiante.institucion))
        .where(Estudiante.id.in_(ids))
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def list_students(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    institucion_id: int | None = None,
    unassigned_only: bool = False,
    include_deleted: bool = False,
) -> Tuple[List[Estudiante], int]:
    base_query = select(Estudiante).options(selectinload(Estudiante.institucion))
    count_query = select(func.count(Estudiante.id))

    if not include_deleted:
        base_query = base_query.where(Estudiante.eliminado.is_(False))
        count_query = count_query.where(Estudiante.eliminado.is_(False))

    if unassigned_only:
        base_query = base_query.where(Estudiante.institucion_id.is_(None))
        count_query = count_query.where(Estudiante.institucion_id.is_(None))
    elif institucion_id is not None:
        base_query = base_query.where(Estudiante.institucion_id == institucion_id)
        count_query = count_query.where(Estudiante.institucion_id == institucion_id)

    if search:
        like_term = f"%{search.lower()}%"
        search_filter = func.lower(Estudiante.nombres).like(like_term) | func.lower(
            Estudiante.apellidos
        ).like(like_term)
        base_query = base_query.where(search_filter)
        count_query = count_query.where(search_filter)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = (
        base_query.order_by(Estudiante.creado_en.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await session.execute(query)
    students = result.scalars().all()
    return students, total


async def create_student(
    session: AsyncSession,
    *,
    institucion_id: int | None,
    nombres: str,
    apellidos: str,
    documento_identidad: str | None,
    foto_url: str | None,
    fecha_nacimiento: date,
    genero: str | None,
    activo: bool,
) -> Estudiante:
    now = datetime.now(timezone.utc)
    student = Estudiante(
        institucion_id=institucion_id,
        nombres=nombres,
        apellidos=apellidos,
        documento_identidad=documento_identidad,
        fecha_nacimiento=fecha_nacimiento,
        foto_url=foto_url,
        genero=genero,
        activo=activo,
        creado_en=now,
        actualizado_en=now,
        eliminado=False,
        eliminado_en=None,
        eliminado_por=None,
    )
    session.add(student)
    await session.flush()
    return student


async def update_student(
    session: AsyncSession,
    student: Estudiante,
    *,
    institucion_id: int | None = None,
    institucion_id_set: bool = False,
    nombres: str | None = None,
    apellidos: str | None = None,
    documento_identidad: str | None = None,
    foto_url: str | None = None,
    fecha_nacimiento: date | None = None,
    genero: str | None = None,
    activo: bool | None = None,
    clear_foto: bool = False,
) -> Estudiante:
    if institucion_id_set:
        student.institucion_id = institucion_id
    if nombres is not None:
        student.nombres = nombres
    if apellidos is not None:
        student.apellidos = apellidos
    if documento_identidad is not None:
        student.documento_identidad = documento_identidad
    if clear_foto:
        student.foto_url = None
    elif foto_url is not None:
        student.foto_url = foto_url
    if fecha_nacimiento is not None:
        student.fecha_nacimiento = fecha_nacimiento
    if genero is not None:
        student.genero = genero
    if activo is not None:
        student.activo = activo
    student.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
    return student


async def soft_delete_student(
    session: AsyncSession, student: Estudiante, *, actor_id: int | None = None
) -> None:
    now = datetime.now(timezone.utc)
    student.eliminado = True
    student.eliminado_en = now
    student.eliminado_por = actor_id
    student.activo = False
    await session.flush()


async def restore_student(session: AsyncSession, student: Estudiante) -> None:
    student.eliminado = False
    student.eliminado_en = None
    student.eliminado_por = None
    student.activo = True
    await session.flush()


async def hard_delete_student(session: AsyncSession, student: Estudiante) -> None:
    await session.delete(student)
