from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.event import EventoPartidoEstudianteRendimiento
from app.schemas.performance import PerformanceUpdate
from app.services.ml_service import ml_service

class PerformanceService:
    async def get_by_match(self, db: AsyncSession, match_id: int):
        stmt = select(EventoPartidoEstudianteRendimiento).where(EventoPartidoEstudianteRendimiento.id_evento_partido == match_id)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def update_performances(self, db: AsyncSession, match_id: int, performances: list[PerformanceUpdate]):
        current_records = await self.get_by_match(db, match_id)
        current_map = {r.id_estudiante: r for r in current_records}
        
        updated_instances = []

        for p in performances:
            record_data = p.model_dump(exclude={'id_estudiante', 'mvp'}) 
            student_id = p.id_estudiante
            
            if student_id in current_map:
                # Update
                instance = current_map[student_id]
                for key, value in record_data.items():
                    setattr(instance, key, value)
                updated_instances.append(instance)
            else:
                # Insert
                instance = EventoPartidoEstudianteRendimiento(
                    id_evento_partido=match_id,
                    id_estudiante=student_id,
                    **record_data
                )
                db.add(instance)
                updated_instances.append(instance)
        
        await db.commit()
        for i in updated_instances:
            await db.refresh(i)
            
        return updated_instances

    async def calculate_mvp(self, db: AsyncSession, match_id: int):
        try:
            # 1. Get current data
            performances = await self.get_by_match(db, match_id)
            if not performances:
                print(f"DEBUG: No performances found for match {match_id}")
                return []

            # 2. Prepare data for ML
            data_list = []
            for p in performances:
                d = {
                    'id_estudiante': p.id_estudiante,
                    # Map roles from int to expected format? 
                    # Assuming ML service handles them as 'role_Attacker': 0/1 or bool 
                    'role_Attacker': p.role_attacker,
                    'role_Defender': p.role_defender,
                    'role_Keeper': p.role_keeper,
                    'role_Midfielder': p.role_midfielder,
                    
                    'diving_save': p.diving_save,
                    'goals_conceded': p.goals_conceded,
                    'minutes_played': p.minutes_played,
                    'punches': p.punches,
                    'saves': p.saves,
                    'saves_inside_box': p.saves_inside_box,
                    'throws': p.throws,
                    'assists': p.assists,
                    'chances_created': p.chances_created,
                    'goals': p.goals,
                    'pass_success': p.pass_success,
                    'total_shots': p.total_shots,
                    'blocked_shots': p.blocked_shots,
                    'shot_accuracy': p.shot_accuracy,
                    'shot_off_target': p.shot_off_target,
                    'shot_on_target': p.shot_on_target,
                    'crosses': p.crosses,
                    'key_passes': p.key_passes,
                    'touches': p.touches,
                    'aerials_won': p.aerials_won,
                    'dribbles_succeeded': p.dribbles_succeeded,
                    'duels_won': p.duels_won,
                    'interceptions': p.interceptions,
                    'recoveries': p.recoveries,
                    'tackles_attempted': p.tackles_attempted,
                    'tackles_succeeded': p.tackles_succeeded,
                    'was_fouled': p.was_fouled,
                }
                data_list.append(d)
                
            print(f"DEBUG: Calling ML Service with {len(data_list)} records")

            # 3. Call ML Service
            ratings_map = ml_service.calculate_ratings(data_list)
            
            print(f"DEBUG: ML Service returned ratings: {ratings_map}")
            
            # 4. Update Ratings and Determine MVP
            max_rating = -1.0
            mvp_student_id = None
            
            for p in performances:
                r = ratings_map.get(p.id_estudiante, 0.0)
                p.rating = r
                p.mvp = False # Reset
                
                if r > max_rating:
                    max_rating = r
                    mvp_student_id = p.id_estudiante
            
            # Set MVP
            if mvp_student_id:
                for p in performances:
                    if p.id_estudiante == mvp_student_id:
                        print(f"DEBUG: MVP Selected: {mvp_student_id} with rating {max_rating}")
                        p.mvp = True
                        break
            
            await db.commit()
            return performances
            
        except Exception as e:
            print(f"CRITICAL ERROR in calculate_mvp: {e}")
            import traceback
            traceback.print_exc()
            raise e

performance_service = PerformanceService()
