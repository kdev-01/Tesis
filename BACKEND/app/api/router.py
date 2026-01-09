from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import (
    auth,
    config,
    events,
    history,
    institutions,
    invitations,
    news,
    notifications,
    performance,
    permissions,
    roles,
    scenarios,
    students,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(events.router)
api_router.include_router(users.router)
api_router.include_router(roles.router)
api_router.include_router(institutions.router)
api_router.include_router(scenarios.router)
api_router.include_router(history.router)
api_router.include_router(students.router)
api_router.include_router(config.router)
api_router.include_router(invitations.router)
api_router.include_router(news.router)
api_router.include_router(notifications.router)
api_router.include_router(performance.router)
api_router.include_router(permissions.router)
api_router.include_router(performance.router)
