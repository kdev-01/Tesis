from typing import List, Optional
from pydantic import BaseModel

class PerformanceBase(BaseModel):
    # Roles as integers (0 or 1)
    role_attacker: int = 0
    role_defender: int = 0
    role_keeper: int = 0
    role_midfielder: int = 0
    
    rating: float = 0.0
    minutes_played: int = 0
    goals: int = 0
    assists: int = 0
    was_fouled: int = 0
    
    total_shots: int = 0
    shot_on_target: int = 0
    shot_off_target: int = 0
    blocked_shots: int = 0
    shot_accuracy: float = 0.0
    chances_created: int = 0
    
    touches: int = 0
    pass_success: float = 0.0
    key_passes: int = 0
    crosses: int = 0
    dribbles_succeeded: int = 0
    
    tackles_attempted: int = 0
    tackles_succeeded: int = 0
    interceptions: int = 0
    recoveries: int = 0
    duels_won: int = 0
    aerials_won: int = 0
    
    saves: int = 0
    saves_inside_box: int = 0
    diving_save: int = 0
    punches: int = 0
    throws: int = 0
    goals_conceded: int = 0
    
    mvp: bool = False

class PerformanceUpdate(PerformanceBase):
    id_estudiante: int

class PerformanceResponse(PerformanceBase):
    id: int
    id_evento_partido: int
    id_estudiante: int

    class Config:
        from_attributes = True

class MatchPerformanceList(BaseModel):
    match_id: int
    performances: List[PerformanceResponse]
