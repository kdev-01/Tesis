from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.api.deps import get_current_user
from app.schemas.performance import PerformanceResponse, PerformanceUpdate, MatchPerformanceList
from app.services.performance_service import performance_service
from app.models.user import Usuario

router = APIRouter()

@router.get("/matches/{match_id}/performance", response_model=List[PerformanceResponse])
async def get_match_performance(
    match_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: Usuario = Depends(get_current_user),
) -> Any:
    """
    Get performance stats for a specific match.
    """
    result = await performance_service.get_by_match(db, match_id=match_id)
    return result

@router.post("/matches/{match_id}/performance", response_model=List[PerformanceResponse])
async def save_match_performance(
    match_id: int,
    performance_data: List[PerformanceUpdate],
    db: AsyncSession = Depends(get_session),
    current_user: Usuario = Depends(get_current_user),
) -> Any:
    """
    Save or update performance stats for a match.
    """
    return await performance_service.update_performances(db, match_id=match_id, performances=performance_data)

@router.post("/matches/{match_id}/calculate-mvp", response_model=List[PerformanceResponse])
async def calculate_match_mvp(
    match_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: Usuario = Depends(get_current_user),
) -> Any:
    """
    Calculate ratings and determine MVP using the ML model.
    """
    return await performance_service.calculate_mvp(db, match_id=match_id)
