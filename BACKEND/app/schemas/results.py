from typing import List, Optional
from pydantic import BaseModel

class PlayerResultUpdate(BaseModel):
    estudiante_id: int
    goles: int = 0
    puntos: int = 0
    faltas: int = 0
    tarjetas_amarillas: int = 0
    tarjetas_rojas: int = 0

class PlayerResultResponse(BaseModel):
    id: int
    evento_partido_id: int
    estudiante_id: int
    goles: int
    puntos: int
    faltas: int
    tarjetas_amarillas: int
    tarjetas_rojas: int
    estudiante_nombre: Optional[str] = None
    estudiante_apellido: Optional[str] = None

    class Config:
        from_attributes = True

class MatchPlayerResponse(BaseModel):
    id: int # Student ID
    nombres: str
    apellidos: str
    equipo_id: int
    equipo_nombre: str
    numero_camiseta: Optional[int] = None
    foto_url: Optional[str] = None
    
    # Previous stats if any
    goles: int = 0
    puntos: int = 0
    faltas: int = 0
    tarjetas_amarillas: int = 0
    tarjetas_rojas: int = 0

class MatchResultConfig(BaseModel):
    match_id: int
    deporte_nombre: str
    local_team_id: Optional[int]
    visitor_team_id: Optional[int]
    players: List[MatchPlayerResponse]

class RegisterResultRequest(BaseModel):
    results: List[PlayerResultUpdate]
    publish_news: bool = False
    criterio: Optional[str] = None
