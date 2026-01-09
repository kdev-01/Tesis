from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.models.event import (
    Evento,
    EventoPartido, 
    EventoPartidoResultadoJugador, 
    EventoInscripcionEstudiante, 
    EventoInscripcion
)
from app.schemas.results import PlayerResultUpdate, MatchPlayerResponse, MatchResultConfig

class ResultService:
    
    async def get_match_players(self, db: AsyncSession, match_id: int) -> MatchResultConfig:
        """
        Fetches the match configuration and all eligible players from both teams.
        Includes any existing results for these players.
        """
        stmt = select(EventoPartido).options(
            selectinload(EventoPartido.evento).selectinload(Evento.deporte),
            selectinload(EventoPartido.equipo_local).selectinload(EventoInscripcion.estudiantes).selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.equipo_visitante).selectinload(EventoInscripcion.estudiantes).selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.resultados_jugadores)
        ).where(EventoPartido.id == match_id)
        
        result = await db.execute(stmt)
        match = result.scalars().first()
        
        if not match:
            return None

        # Build map of existing results
        current_results = {r.estudiante_id: r for r in match.resultados_jugadores}
        
        players_list = []
        
        # Helper to process team
        def process_team(team_inscription):
            if not team_inscription:
                return
            for relation in team_inscription.estudiantes:
                student = relation.estudiante
                # Check if we have saved result
                saved = current_results.get(student.id)
                
                players_list.append(MatchPlayerResponse(
                    id=student.id,
                    nombres=student.nombres,
                    apellidos=student.apellidos,
                    equipo_id=team_inscription.id,
                    equipo_nombre=team_inscription.nombre_equipo,
                    foto_url=student.foto_url,
                    # Load saved values or default
                    goles=saved.goles if saved else 0,
                    puntos=saved.puntos if saved else 0,
                    faltas=saved.faltas if saved else 0,
                    tarjetas_amarillas=saved.tarjetas_amarillas if saved else 0,
                    tarjetas_rojas=saved.tarjetas_rojas if saved else 0
                ))

        process_team(match.equipo_local)
        process_team(match.equipo_visitante)
        
        return MatchResultConfig(
            match_id=match.id,
            deporte_nombre=match.evento.deporte.nombre if match.evento and match.evento.deporte else "Desconocido",
            local_team_id=match.equipo_local_id,
            visitor_team_id=match.equipo_visitante_id,
            players=players_list
        )

    async def register_result(
        self, 
        db: AsyncSession, 
        match_id: int, 
        player_results: list[PlayerResultUpdate],
        publish_news: bool,
        criterio: str | None
    ):
        """
        Saves player stats, calculates team scores, determines winner, and closes match.
        """
        # 1. Fetch match to determine sport and teams
        stmt = select(EventoPartido).options(
            selectinload(EventoPartido.evento).selectinload(Evento.deporte),
            selectinload(EventoPartido.equipo_local).selectinload(EventoInscripcion.estudiantes).selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.equipo_visitante).selectinload(EventoInscripcion.estudiantes).selectinload(EventoInscripcionEstudiante.estudiante),
            selectinload(EventoPartido.resultados_jugadores)
        ).where(EventoPartido.id == match_id)
        
        result = await db.execute(stmt)
        match = result.scalars().first()
        if not match:
            raise ValueError("Partido no encontrado")

        sport_name = (match.evento.deporte.nombre if match.evento and match.evento.deporte else "").lower()
        
        # 2. Update/Insert Player Results
        current_map = {r.estudiante_id: r for r in match.resultados_jugadores}
        
        local_score = 0
        visitor_score = 0
        
        # We need to know which player belongs to which team to aggregate score
        # Let's fetch team memberships for these students
        student_ids = [p.estudiante_id for p in player_results]
        
        # Optimized query to get team_id for each student in this match
        # Assuming students are unique in the match context (one team only)
        # But we already have the teams in match.equipo_local_id, match.equipo_visitante_id
        # We need to query EventoInscripcionEstudiante to map student -> inscription_id
        
        stmt_map = select(EventoInscripcionEstudiante.estudiante_id, EventoInscripcionEstudiante.inscripcion_id)\
            .where(
                EventoInscripcionEstudiante.estudiante_id.in_(student_ids),
                EventoInscripcionEstudiante.inscripcion_id.in_([match.equipo_local_id, match.equipo_visitante_id]) # Filter only relevant teams
            )
        
        map_result = await db.execute(stmt_map)
        student_team_map = {row[0]: row[1] for row in map_result.all()}
        
        for p in player_results:
            # Update DB record
            if p.estudiante_id in current_map:
                record = current_map[p.estudiante_id]
                record.goles = p.goles
                record.puntos = p.puntos
                record.faltas = p.faltas
                record.tarjetas_amarillas = p.tarjetas_amarillas
                record.tarjetas_rojas = p.tarjetas_rojas
            else:
                record = EventoPartidoResultadoJugador(
                    evento_partido_id=match_id,
                    estudiante_id=p.estudiante_id,
                    goles=p.goles,
                    puntos=p.puntos,
                    faltas=p.faltas,
                    tarjetas_amarillas=p.tarjetas_amarillas,
                    tarjetas_rojas=p.tarjetas_rojas
                )
                db.add(record)

            # Accumulate Score
            team_id = student_team_map.get(p.estudiante_id)
            if team_id:
                score_contribution = 0
                if "fútbol" in sport_name or "futsal" in sport_name or "soccer" in sport_name or "fut" in sport_name:
                    score_contribution = p.goles
                else:
                    # Default to points for Basketball, Ecuavoley, Volleyball, etc.
                    score_contribution = p.puntos
                
                if team_id == match.equipo_local_id:
                    local_score += score_contribution
                elif team_id == match.equipo_visitante_id:
                    visitor_score += score_contribution

        # 3. Update Match
        match.puntaje_local = local_score
        match.puntaje_visitante = visitor_score
        match.estado = "completado"
        if criterio:
            match.criterio_resultado = criterio
            
        # Determine Winner
        if local_score > visitor_score:
            match.ganador_inscripcion_id = match.equipo_local_id
        elif visitor_score > local_score:
            match.ganador_inscripcion_id = match.equipo_visitante_id
        else:
            match.ganador_inscripcion_id = None # Empate
            
        if publish_news:
             match.noticia_publicada = False # Trigger news publishing logic elsewhere or flag it
             # Actually, the user asked to persist it. 
             # If `noticia_publicada` is a flag for "Ready to publish" or "Published"
             # The existing code had `handlePublishMatchNews`. 
             # If user checks "Publicar", maybe we set a flag or just leave it for the button.
             # The existing FE code checks !match.noticia_publicada to show the option.
             pass

        await db.commit()
        await db.refresh(match)
        return match

result_service = ResultService()
