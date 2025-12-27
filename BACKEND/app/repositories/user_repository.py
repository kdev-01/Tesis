from __future__ import annotations

from typing import Iterable, List, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import RolSistema, Usuario


async def get_user_by_email(
    session: AsyncSession, email: str, *, include_deleted: bool = False
) -> Usuario | None:
    query = (
        select(Usuario)
        .options(
            selectinload(Usuario.roles).selectinload(RolSistema.permisos),
            selectinload(Usuario.institucion),
            selectinload(Usuario.deporte),
        )
        .where(func.lower(Usuario.email) == func.lower(email))
    )
    if not include_deleted:
        query = query.where(Usuario.eliminado.is_(False))
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_user_by_id(
    session: AsyncSession, user_id: int, *, include_deleted: bool = False
) -> Usuario | None:
    query = (
        select(Usuario)
        .options(
            selectinload(Usuario.roles).selectinload(RolSistema.permisos),
            selectinload(Usuario.institucion),
            selectinload(Usuario.deporte),
        )
        .where(Usuario.id == user_id)
    )
    if not include_deleted:
        query = query.where(Usuario.eliminado.is_(False))
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def list_users(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    include_deleted: bool = False,
    role_names: Iterable[str] | None = None,
    institucion_id: int | None = None,
    unassigned_only: bool = False,
) -> Tuple[List[Usuario], int]:
    base_query = select(Usuario).options(
        selectinload(Usuario.roles).selectinload(RolSistema.permisos),
        selectinload(Usuario.institucion),
        selectinload(Usuario.deporte),
    )
    if not include_deleted:
        base_query = base_query.where(Usuario.eliminado.is_(False))
    if search:
        like_term = f"%{search.lower()}%"
        base_query = base_query.where(
            func.lower(Usuario.nombre_completo).like(like_term)
            | func.lower(Usuario.email).like(like_term)
        )
    if unassigned_only:
        base_query = base_query.where(Usuario.institucion_id.is_(None))
    elif institucion_id is not None:
        base_query = base_query.where(Usuario.institucion_id == institucion_id)
    if role_names:
        normalized = [name.strip().lower() for name in role_names if name]
        if normalized:
            role_filters = [Usuario.roles.any(RolSistema.nombre.ilike(role)) for role in normalized]
            base_query = base_query.where(or_(*role_filters))

    total_result = await session.execute(select(func.count()).select_from(base_query.subquery()))
    total = total_result.scalar_one()

    query = base_query.order_by(Usuario.creado_en.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    users = result.scalars().unique().all()

    return users, total


async def list_commissioners_by_sport(
    session: AsyncSession, *, sport_id: int
) -> List[Usuario]:
    query = (
        select(Usuario)
        .options(
            selectinload(Usuario.roles).selectinload(RolSistema.permisos),
            selectinload(Usuario.institucion),
            selectinload(Usuario.deporte),
        )
        .where(
            Usuario.eliminado.is_(False),
            Usuario.activo.is_(True),
            Usuario.deporte_id == int(sport_id),
            Usuario.roles.any(RolSistema.nombre.ilike("representante de comisión")),
        )
        .order_by(Usuario.nombre_completo.asc())
    )
    result = await session.execute(query)
    users = result.scalars().unique().all()
    return list(users)


async def create_user(
    session: AsyncSession,
    *,
    nombre_completo: str,
    email: str,
    telefono: str | None,
    tipo_sangre: str | None,
    activo: bool,
    hash_password: str | None,
    avatar_url: str | None,
    roles: Iterable[RolSistema],
    institucion_id: int | None,
    deporte_id: int | None,
) -> Usuario:
    user = Usuario(
        nombre_completo=nombre_completo,
        email=email,
        telefono=telefono,
        tipo_sangre=tipo_sangre,
        activo=activo,
        hash_password=hash_password,
        avatar_url=avatar_url,
        institucion_id=institucion_id,
        deporte_id=deporte_id,
    )
    if roles:
        user.roles = list(roles)
    session.add(user)
    await session.flush()
    return user


async def update_user(
    session: AsyncSession,
    user: Usuario,
    *,
    nombre_completo: str | None = None,
    email: str | None = None,
    telefono: str | None = None,
    telefono_set: bool = False,
    tipo_sangre: str | None = None,
    tipo_sangre_set: bool = False,
    activo: bool | None = None,
    hash_password: str | None = None,
    avatar_url: str | None = None,
    roles: Iterable[RolSistema] | None = None,
    institucion_id: int | None = None,
    institucion_id_set: bool = False,
    clear_avatar: bool = False,
    deporte_id: int | None = None,
    deporte_id_set: bool = False,
) -> Usuario:
    if nombre_completo is not None:
        user.nombre_completo = nombre_completo
    if email is not None:
        user.email = email
    if telefono_set:
        user.telefono = telefono
    elif telefono is not None:
        user.telefono = telefono
    if tipo_sangre_set:
        user.tipo_sangre = tipo_sangre
    elif tipo_sangre is not None:
        user.tipo_sangre = tipo_sangre
    if clear_avatar:
        user.avatar_url = None
    elif avatar_url is not None:
        user.avatar_url = avatar_url
    if activo is not None:
        user.activo = activo
    if hash_password is not None:
        user.hash_password = hash_password
    if roles is not None:
        user.roles = list(roles)
    if institucion_id_set:
        user.institucion_id = institucion_id
    if deporte_id_set:
        user.deporte_id = deporte_id
    await session.flush()
    return user


async def soft_delete_user(session: AsyncSession, user: Usuario) -> None:
    user.eliminado = True
    user.activo = False
    await session.flush()


async def restore_user(session: AsyncSession, user: Usuario) -> None:
    user.eliminado = False
    user.activo = True
    await session.flush()


async def hard_delete_user(session: AsyncSession, user: Usuario) -> None:
    await session.delete(user)
