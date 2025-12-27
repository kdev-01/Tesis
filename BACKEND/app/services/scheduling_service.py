from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, Mapping, Sequence

from ortools.sat.python import cp_model
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApplicationError
from app.models.event import (
    Evento,
    EventoConfiguracion,
    EventoEscenario,
    EventoInscripcion,
    EventoPartido,
)


@dataclass(frozen=True)
class Team:
    id: int | None
    nombre: str

    @property
    def is_placeholder(self) -> bool:
        return self.id is None


@dataclass
class TeamStanding:
    team: Team
    serie: str | None
    points: int = 0
    goals_for: int = 0
    goals_against: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0

    @property
    def goal_diff(self) -> int:
        return self.goals_for - self.goals_against


@dataclass(frozen=True)
class Venue:
    id: int
    nombre: str


@dataclass(frozen=True)
class ScheduleConfig:
    hora_inicio: time
    hora_fin: time
    duracion_horas: int
    descanso_min_dias: int

    def as_timedelta(self) -> timedelta:
        return timedelta(hours=self.duracion_horas)


@dataclass(frozen=True)
class Slot:
    index: int
    day_index: int
    time_index: int
    fecha: date
    hora_inicio: time
    hora_fin: time
    venue: Venue


@dataclass
class MatchDefinition:
    internal_id: int
    code: str
    fase: str
    serie: str | None
    ronda: str
    local: Team | None
    visitante: Team | None
    placeholder_local: str | None
    placeholder_visitante: str | None
    is_playoff: bool


@dataclass(frozen=True)
class PartidoDTO:
    fecha: date
    hora_inicio: time
    hora_fin: time
    escenario_evento_id: int
    fase: str
    serie: str | None
    ronda: str
    llave: str | None
    equipo_local_id: int | None
    equipo_local_nombre: str
    equipo_visitante_id: int | None
    equipo_visitante_nombre: str
    placeholder_local: str | None
    placeholder_visitante: str | None
    estado: str = "programado"

    def to_model_payload(self) -> dict:
        return {
            "fecha": self.fecha,
            "hora": self.hora_inicio,
            "hora_fin": self.hora_fin,
            "escenario_evento_id": self.escenario_evento_id,
            "fase": self.fase,
            "serie": self.serie,
            "ronda": self.ronda,
            "llave": self.llave,
            "equipo_local_id": self.equipo_local_id,
            "equipo_visitante_id": self.equipo_visitante_id,
            "placeholder_local": self.placeholder_local,
            "placeholder_visitante": self.placeholder_visitante,
            "estado": self.estado,
        }


@dataclass(frozen=True)
class TournamentStructure:
    series: int
    playoff_teams: int


SERIE_LABELS = "ABCDE"


def determine_tournament_structure(num_teams: int) -> TournamentStructure:
    if 2 <= num_teams <= 7:
        return TournamentStructure(series=1, playoff_teams=0)
    if 8 <= num_teams <= 11:
        return TournamentStructure(series=2, playoff_teams=4)
    if 12 <= num_teams <= 15:
        return TournamentStructure(series=3, playoff_teams=8)
    if 16 <= num_teams <= 19:
        return TournamentStructure(series=4, playoff_teams=8)
    if 20 <= num_teams <= 25:
        return TournamentStructure(series=5, playoff_teams=8)
    raise ApplicationError(
        "La generación automática solo está soportada para eventos entre 2 y 25 equipos",
    )


def resolve_stage_sequence(playoff_teams: int) -> list[str]:
    if playoff_teams == 4:
        return ["group", "semifinal", "final", "third_place"]
    if playoff_teams == 8:
        return ["group", "quarterfinal", "semifinal", "final", "third_place"]
    return ["group", "final"]


def _standing_sort_key(item: TeamStanding) -> tuple:
    return (
        -item.points,
        -item.goal_diff,
        -item.goals_for,
        -item.wins,
        item.team.nombre.lower(),
    )


def compute_group_standings(
    matches: Sequence[EventoPartido],
    team_lookup: Mapping[int, Team],
) -> dict[str, list[TeamStanding]]:
    standings: dict[int, TeamStanding] = {}
    for match in matches:
        if (getattr(match, "fase", "") or "").lower() != "group":
            continue
        serie = getattr(match, "serie", None)
        pairs = [
            (
                getattr(match, "equipo_local_id", None),
                getattr(match, "puntaje_local", None),
                getattr(match, "puntaje_visitante", None),
            ),
            (
                getattr(match, "equipo_visitante_id", None),
                getattr(match, "puntaje_visitante", None),
                getattr(match, "puntaje_local", None),
            ),
        ]
        for team_id, scored, conceded in pairs:
            if team_id is None:
                continue
            if team_id not in standings:
                team = team_lookup.get(team_id, Team(id=team_id, nombre="Equipo"))
                standings[team_id] = TeamStanding(team=team, serie=serie)
            standing = standings[team_id]
            standing.goals_for += scored or 0
            standing.goals_against += conceded or 0

        status = (getattr(match, "estado", "") or "").lower()
        if status != "finalizado":
            continue
        local_id = getattr(match, "equipo_local_id", None)
        visitor_id = getattr(match, "equipo_visitante_id", None)
        local_score = getattr(match, "puntaje_local", None)
        visitor_score = getattr(match, "puntaje_visitante", None)
        if local_id is None or visitor_id is None:
            continue
        if local_id not in standings:
            standings[local_id] = TeamStanding(
                team=team_lookup.get(local_id, Team(id=local_id, nombre="Equipo")),
                serie=serie,
            )
        if visitor_id not in standings:
            standings[visitor_id] = TeamStanding(
                team=team_lookup.get(visitor_id, Team(id=visitor_id, nombre="Equipo")),
                serie=serie,
            )
        if local_score is None or visitor_score is None:
            continue
        if local_score == visitor_score:
            standings[local_id].draws += 1
            standings[visitor_id].draws += 1
            standings[local_id].points += 1
            standings[visitor_id].points += 1
        elif local_score > visitor_score:
            standings[local_id].wins += 1
            standings[visitor_id].losses += 1
            standings[local_id].points += 3
        else:
            standings[visitor_id].wins += 1
            standings[local_id].losses += 1
            standings[visitor_id].points += 3

    by_serie: dict[str, list[TeamStanding]] = {}
    for standing in standings.values():
        serie_label = standing.serie or "Serie"
        by_serie.setdefault(serie_label, []).append(standing)
    for serie, serie_standings in by_serie.items():
        serie_standings.sort(key=_standing_sort_key)
    return by_serie


def resolve_seed_team(
    seed_label: str,
    standings_by_serie: Mapping[str, list[TeamStanding]],
    global_rankings: Sequence[TeamStanding],
    used_ids: set[int],
) -> Team | None:
    if seed_label.lower().startswith("ganador") or seed_label.lower().startswith("perdedor"):
        return None
    seed_label = seed_label.strip()
    if seed_label.startswith("1° Serie "):
        serie = seed_label.replace("1° Serie ", "").strip()
        candidate = (standings_by_serie.get(serie) or [])[:1]
        for standing in candidate:
            if standing.team.id not in used_ids:
                used_ids.add(standing.team.id)
                return standing.team
    if seed_label.startswith("2° Serie "):
        serie = seed_label.replace("2° Serie ", "").strip()
        candidate = (standings_by_serie.get(serie) or [])
        if len(candidate) > 1 and candidate[1].team.id not in used_ids:
            used_ids.add(candidate[1].team.id)
            return candidate[1].team
    if seed_label.lower().startswith("clasificado #"):
        try:
            index = int(seed_label.split("#")[-1]) - 1
        except ValueError:
            index = None
        if index is not None:
            for standing in global_rankings:
                if standing.team.id in used_ids:
                    continue
                if index == 0:
                    used_ids.add(standing.team.id)
                    return standing.team
                index -= 1
    return None


def _build_series_assignments(teams: Sequence[Team], series_count: int) -> list[tuple[str, list[Team]]]:
    series: list[list[Team]] = [[] for _ in range(series_count)]
    for idx, team in enumerate(teams):
        series[idx % series_count].append(team)

    assignments: list[tuple[str, list[Team]]] = []
    for index, serie_teams in enumerate(series):
        label = f"Serie {SERIE_LABELS[index]}" if index < len(SERIE_LABELS) else f"Serie {index + 1}"
        assignments.append((label, serie_teams))
    return assignments


def _round_robin_pairs(teams: Sequence[Team]) -> list[list[tuple[Team, Team]]]:
    ordered = list(teams)
    n = len(ordered)
    if n % 2 == 1:
        ordered.append(Team(id=None, nombre="BYE"))
        n += 1
    rounds: list[list[tuple[Team, Team]]] = []
    half = n // 2
    for _round in range(n - 1):
        pairs: list[tuple[Team, Team]] = []
        for i in range(half):
            home = ordered[i]
            away = ordered[n - 1 - i]
            if home.nombre == "BYE" or away.nombre == "BYE":
                continue
            pairs.append((home, away))
        rounds.append(pairs)
        ordered = [ordered[0]] + [ordered[-1]] + ordered[1:-1]
    return rounds


def _seed_labels(series_names: Sequence[str], total_slots: int) -> list[str]:
    seeds: list[str] = []
    for serie in series_names:
        seeds.append(f"1° {serie}")
    for serie in series_names:
        if len(seeds) >= total_slots:
            break
        seeds.append(f"2° {serie}")
    qualifier_index = 1
    while len(seeds) < total_slots:
        seeds.append(f"Clasificado #{qualifier_index}")
        qualifier_index += 1
    return seeds[:total_slots]


def _placeholder_winner(code: str) -> str:
    return f"Ganador {code}"


def _placeholder_loser(code: str) -> str:
    return f"Perdedor {code}"


def build_matches(structure: TournamentStructure, assignments: Sequence[tuple[str, list[Team]]]) -> list[MatchDefinition]:
    matches: list[MatchDefinition] = []
    match_id = 0
    for serie_name, serie_teams in assignments:
        rounds = _round_robin_pairs(serie_teams)
        for round_index, pairings in enumerate(rounds, start=1):
            for local, visitante in pairings:
                matches.append(
                    MatchDefinition(
                        internal_id=match_id,
                        code=f"GRP-{serie_name}-{round_index}-{match_id}",
                        fase="group",
                        serie=serie_name,
                        ronda=f"Ronda {round_index}",
                        local=local,
                        visitante=visitante,
                        placeholder_local=None,
                        placeholder_visitante=None,
                        is_playoff=False,
                    )
                )
                match_id += 1

    series_names = [name for name, _ in assignments]
    if structure.playoff_teams == 4:
        seeds = _seed_labels(series_names, 4)
        semifinal_pairs = [
            ("SF1", seeds[0], seeds[-1]),
            ("SF2", seeds[1], seeds[-2]),
        ]
        for idx, (code, home_seed, away_seed) in enumerate(semifinal_pairs, start=1):
            matches.append(
                MatchDefinition(
                    internal_id=match_id,
                    code=code,
                    fase="semifinal",
                    serie=None,
                    ronda=f"Semifinal {idx}",
                    local=None,
                    visitante=None,
                    placeholder_local=home_seed,
                    placeholder_visitante=away_seed,
                    is_playoff=True,
                )
            )
            match_id += 1
        matches.append(
            MatchDefinition(
                internal_id=match_id,
                code="FINAL",
                fase="final",
                serie=None,
                ronda="Final",
                local=None,
                visitante=None,
                placeholder_local=_placeholder_winner("SF1"),
                placeholder_visitante=_placeholder_winner("SF2"),
                is_playoff=True,
            )
        )
        match_id += 1
        matches.append(
            MatchDefinition(
                internal_id=match_id,
                code="THIRD",
                fase="third_place",
                serie=None,
                ronda="Tercer puesto",
                local=None,
                visitante=None,
                placeholder_local=_placeholder_loser("SF1"),
                placeholder_visitante=_placeholder_loser("SF2"),
                is_playoff=True,
            )
        )
        match_id += 1
    elif structure.playoff_teams == 8:
        seeds = _seed_labels(series_names, 8)
        quarter_pairs = [
            ("QF1", seeds[0], seeds[7]),
            ("QF2", seeds[3], seeds[4]),
            ("QF3", seeds[1], seeds[6]),
            ("QF4", seeds[2], seeds[5]),
        ]
        for idx, (code, home_seed, away_seed) in enumerate(quarter_pairs, start=1):
            matches.append(
                MatchDefinition(
                    internal_id=match_id,
                    code=code,
                    fase="quarterfinal",
                    serie=None,
                    ronda=f"Cuartos de final {idx}",
                    local=None,
                    visitante=None,
                    placeholder_local=home_seed,
                    placeholder_visitante=away_seed,
                    is_playoff=True,
                )
            )
            match_id += 1
        semifinal_pairs = [
            ("SF1", _placeholder_winner("QF1"), _placeholder_winner("QF4")),
            ("SF2", _placeholder_winner("QF2"), _placeholder_winner("QF3")),
        ]
        for idx, (code, home_seed, away_seed) in enumerate(semifinal_pairs, start=1):
            matches.append(
                MatchDefinition(
                    internal_id=match_id,
                    code=code,
                    fase="semifinal",
                    serie=None,
                    ronda=f"Semifinal {idx}",
                    local=None,
                    visitante=None,
                    placeholder_local=home_seed,
                    placeholder_visitante=away_seed,
                    is_playoff=True,
                )
            )
            match_id += 1
        matches.append(
            MatchDefinition(
                internal_id=match_id,
                code="FINAL",
                fase="final",
                serie=None,
                ronda="Final",
                local=None,
                visitante=None,
                placeholder_local=_placeholder_winner("SF1"),
                placeholder_visitante=_placeholder_winner("SF2"),
                is_playoff=True,
            )
        )
        match_id += 1
        matches.append(
            MatchDefinition(
                internal_id=match_id,
                code="THIRD",
                fase="third_place",
                serie=None,
                ronda="Tercer puesto",
                local=None,
                visitante=None,
                placeholder_local=_placeholder_loser("SF1"),
                placeholder_visitante=_placeholder_loser("SF2"),
                is_playoff=True,
            )
        )
        match_id += 1
    return matches


def build_slots(
    *,
    start_date: date,
    end_date: date,
    config: ScheduleConfig,
    venues: Sequence[Venue],
) -> list[Slot]:
    if start_date > end_date:
        raise ApplicationError("La fecha de inicio del campeonato debe ser anterior al final")
    duration = config.as_timedelta()
    start_minutes = config.hora_inicio.hour * 60 + config.hora_inicio.minute
    end_minutes = config.hora_fin.hour * 60 + config.hora_fin.minute
    available_minutes = end_minutes - start_minutes
    if available_minutes < duration.total_seconds() / 60:
        raise ApplicationError("La ventana horaria diaria es insuficiente para al menos un partido")
    duration_minutes = int(duration.total_seconds() // 60)
    slots_per_day = max(available_minutes // duration_minutes, 1)
    total_days = (end_date - start_date).days + 1
    slots: list[Slot] = []
    index = 0
    for day_offset in range(total_days):
        current_date = start_date + timedelta(days=day_offset)
        for time_index in range(slots_per_day):
            start_total = start_minutes + time_index * duration_minutes
            hora_inicio = time(hour=start_total // 60, minute=start_total % 60)
            end_total = start_total + duration_minutes
            if end_total > 24 * 60:
                raise ApplicationError(
                    "La configuración horaria no puede superar el límite diario de 24 horas"
                )
            hora_fin = time(hour=end_total // 60, minute=end_total % 60)
            for venue in venues:
                slots.append(
                    Slot(
                        index=index,
                        day_index=day_offset,
                        time_index=time_index,
                        fecha=current_date,
                        hora_inicio=hora_inicio,
                        hora_fin=hora_fin,
                        venue=venue,
                    )
                )
                index += 1
    return slots


def solve_schedule(
    matches: Sequence[MatchDefinition],
    slots: Sequence[Slot],
    *,
    config: ScheduleConfig,
) -> dict[int, Slot]:
    if not matches:
        return {}
    model = cp_model.CpModel()
    assignment: dict[tuple[int, int], cp_model.IntVar] = {}
    for match in matches:
        for slot in slots:
            assignment[(match.internal_id, slot.index)] = model.NewBoolVar(
                f"m{match.internal_id}_s{slot.index}"
            )

    for match in matches:
        model.AddExactlyOne(
            [assignment[(match.internal_id, slot.index)] for slot in slots]
        )

    for slot in slots:
        model.Add(
            sum(assignment[(match.internal_id, slot.index)] for match in matches) <= 1
        )

    max_day = max(slot.day_index for slot in slots)
    match_day: dict[int, cp_model.IntVar] = {}
    for match in matches:
        match_day[match.internal_id] = model.NewIntVar(0, max_day, f"day_m{match.internal_id}")
        for slot in slots:
            model.Add(match_day[match.internal_id] == slot.day_index).OnlyEnforceIf(
                assignment[(match.internal_id, slot.index)]
            )

    slots_by_day_time: dict[tuple[int, int], list[int]] = defaultdict(list)
    for slot in slots:
        slots_by_day_time[(slot.day_index, slot.time_index)].append(slot.index)

    real_team_ids = {
        team.id
        for match in matches
        for team in (match.local, match.visitante)
        if team and not team.is_placeholder
    }
    for team_id in real_team_ids:
        if team_id is None:
            continue
        for slot_indexes in slots_by_day_time.values():
            relevant = [
                assignment[(other.internal_id, slot_index)]
                for other in matches
                if (
                    (other.local and other.local.id == team_id)
                    or (other.visitante and other.visitante.id == team_id)
                )
                for slot_index in slot_indexes
            ]
            if relevant:
                model.Add(sum(relevant) <= 1)

    rest_days = max(config.descanso_min_dias, 0)
    max_diff = max_day
    real_team_ids = {
        team.id
        for match in matches
        for team in (match.local, match.visitante)
        if team and not team.is_placeholder
    }
    for team_id in real_team_ids:
        if team_id is None:
            continue
        team_matches = [
            match for match in matches if (match.local and match.local.id == team_id)
            or (match.visitante and match.visitante.id == team_id)
        ]
        for i in range(len(team_matches)):
            for j in range(i + 1, len(team_matches)):
                diff = model.NewIntVar(0, max_diff, f"rest_{team_id}_{i}_{j}")
                model.AddAbsEquality(
                    diff,
                    match_day[team_matches[i].internal_id]
                    - match_day[team_matches[j].internal_id],
                )
                model.Add(diff >= rest_days + 1)

    group_matches = [match for match in matches if match.fase == "group"]
    playoff_matches = [match for match in matches if match.is_playoff]
    if group_matches and playoff_matches:
        last_group_day = model.NewIntVar(0, max_day, "last_group_day")
        for match in group_matches:
            model.Add(last_group_day >= match_day[match.internal_id])
        for match in playoff_matches:
            model.Add(match_day[match.internal_id] > last_group_day)

    last_day_used = model.NewIntVar(0, max_day, "last_day_used")
    for match in matches:
        model.Add(last_day_used >= match_day[match.internal_id])
    model.Minimize(last_day_used)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise ApplicationError("No se encontró una programación factible con las restricciones actuales")

    solution: dict[int, Slot] = {}
    for match in matches:
        for slot in slots:
            if solver.Value(assignment[(match.internal_id, slot.index)]) == 1:
                solution[match.internal_id] = slot
                break
    return solution


async def _ensure_config(session: AsyncSession, event: Evento) -> EventoConfiguracion:
    config = getattr(event, "configuracion", None)
    if config:
        return config
    result = await session.execute(
        select(EventoConfiguracion).where(EventoConfiguracion.evento_id == event.id)
    )
    config = result.scalars().first()
    if config:
        event.configuracion = config
        return config
    config = EventoConfiguracion(evento_id=event.id)
    session.add(config)
    await session.flush()
    event.configuracion = config
    return config


def _ensure_event_ready(event: Evento) -> None:
    if not event.fecha_campeonato_inicio or not event.fecha_campeonato_fin:
        raise ApplicationError("El evento no tiene definidas las fechas del campeonato")
    if event.fecha_campeonato_inicio > event.fecha_campeonato_fin:
        raise ApplicationError("El rango de fechas del campeonato es inválido")
    if not event.escenarios:
        raise ApplicationError("Debes registrar al menos una cancha para el evento")


def collect_eligible_registrations(event: Evento) -> list[EventoInscripcion]:
    """Obtiene las inscripciones habilitadas para el campeonato.

    Da prioridad a las instituciones aprobadas para campeonato, pero también
    considera el flag de aprobación de cada inscripción. Se eliminan
    duplicados manteniendo el primer registro encontrado.
    """

    eligible: list[EventoInscripcion] = []
    seen: set[int] = set()

    for invitation in getattr(event, "instituciones_invitadas", []) or []:
        invitation_approved = (
            getattr(invitation, "habilitado_campeonato", False)
            or (getattr(invitation, "estado_auditoria", "") or "").lower() == "aprobada"
        )
        for registration in getattr(invitation, "inscripciones", []) or []:
            if not invitation_approved and not getattr(registration, "aprobado", False):
                continue
            registration_id = getattr(registration, "id", None)
            if registration_id is None or registration_id in seen:
                continue
            seen.add(registration_id)
            eligible.append(registration)

    if not eligible:
        for registration in getattr(event, "inscripciones", []) or []:
            if not getattr(registration, "aprobado", False):
                continue
            registration_id = getattr(registration, "id", None)
            if registration_id is None or registration_id in seen:
                continue
            seen.add(registration_id)
            eligible.append(registration)

    return eligible


def _map_teams(registrations: Iterable[EventoInscripcion]) -> list[Team]:
    teams = [
        Team(id=registration.id, nombre=registration.nombre_equipo)
        for registration in registrations
    ]
    teams.sort(key=lambda team: team.nombre.lower())
    if len(teams) < 2:
        raise ApplicationError(
            "Se requieren al menos dos instituciones habilitadas con equipos para generar el calendario"
        )
    return teams


def _map_venues(venues: Iterable[EventoEscenario]) -> list[Venue]:
    mapped: list[Venue] = []
    for venue in venues:
        if venue.id is None:
            continue
        mapped.append(Venue(id=venue.id, nombre=venue.nombre_escenario))
    if not mapped:
        raise ApplicationError("No hay escenarios disponibles para programar partidos")
    return mapped


async def build_event_schedule(
    session: AsyncSession,
    *,
    event: Evento,
    override_config: ScheduleConfig | None = None,
) -> list[PartidoDTO]:
    _ensure_event_ready(event)
    config_model = await _ensure_config(session, event)

    config = ScheduleConfig(
        hora_inicio=override_config.hora_inicio if override_config else config_model.hora_inicio,
        hora_fin=override_config.hora_fin if override_config else config_model.hora_fin,
        duracion_horas=override_config.duracion_horas
        if override_config
        else config_model.duracion_horas,
        descanso_min_dias=override_config.descanso_min_dias
        if override_config
        else config_model.descanso_min_dias,
    )

    teams = _map_teams(collect_eligible_registrations(event))
    structure = determine_tournament_structure(len(teams))
    assignments = _build_series_assignments(teams, structure.series)
    matches = build_matches(structure, assignments)
    venues = _map_venues(event.escenarios or [])
    slots = build_slots(
        start_date=event.fecha_campeonato_inicio,
        end_date=event.fecha_campeonato_fin,
        config=config,
        venues=venues,
    )
    if len(slots) < len(matches):
        raise ApplicationError(
            "No hay suficientes franjas horarias para programar todos los partidos dentro del rango de fechas"
        )
    solution = solve_schedule(matches, slots, config=config)
    if not solution:
        return []
    dtos: list[PartidoDTO] = []
    for match in matches:
        slot = solution.get(match.internal_id)
        if not slot:
            continue
        local_id = match.local.id if match.local and not match.local.is_placeholder else None
        visitante_id = (
            match.visitante.id if match.visitante and not match.visitante.is_placeholder else None
        )
        local_name = (
            match.local.nombre
            if match.local and match.local.nombre
            else match.placeholder_local or "Por definir"
        )
        visitante_name = (
            match.visitante.nombre
            if match.visitante and match.visitante.nombre
            else match.placeholder_visitante or "Por definir"
        )
        dto = PartidoDTO(
            fecha=slot.fecha,
            hora_inicio=slot.hora_inicio,
            hora_fin=slot.hora_fin,
            escenario_evento_id=slot.venue.id,
            fase=match.fase,
            serie=match.serie,
            ronda=match.ronda,
            llave=match.code,
            equipo_local_id=local_id,
            equipo_local_nombre=local_name,
            equipo_visitante_id=visitante_id,
            equipo_visitante_nombre=visitante_name,
            placeholder_local=match.placeholder_local
            if match.placeholder_local
            else (None if local_id is not None else local_name),
            placeholder_visitante=match.placeholder_visitante
            if match.placeholder_visitante
            else (None if visitante_id is not None else visitante_name),
        )
        dtos.append(dto)
    dtos.sort(key=lambda item: (item.fecha, item.hora_inicio, item.escenario_evento_id))
    return dtos


async def schedule_stage_matches(
    session: AsyncSession,
    *,
    event: Evento,
    matches: Sequence[MatchDefinition],
    override_config: ScheduleConfig | None = None,
    start_date: date | None = None,
    exclude_slots: set[tuple[date, time, int | None]] | None = None,
) -> list[PartidoDTO]:
    _ensure_event_ready(event)
    config_model = await _ensure_config(session, event)
    config = ScheduleConfig(
        hora_inicio=override_config.hora_inicio if override_config else config_model.hora_inicio,
        hora_fin=override_config.hora_fin if override_config else config_model.hora_fin,
        duracion_horas=override_config.duracion_horas
        if override_config
        else config_model.duracion_horas,
        descanso_min_dias=override_config.descanso_min_dias
        if override_config
        else config_model.descanso_min_dias,
    )
    venues = _map_venues(event.escenarios or [])
    slots = build_slots(
        start_date=start_date or event.fecha_campeonato_inicio,
        end_date=event.fecha_campeonato_fin,
        config=config,
        venues=venues,
    )
    if exclude_slots:
        slots = [
            slot
            for slot in slots
            if (slot.fecha, slot.hora_inicio, slot.venue.id) not in exclude_slots
        ]
    solution = solve_schedule(matches, slots, config=config)
    dtos: list[PartidoDTO] = []
    for match in matches:
        slot = solution.get(match.internal_id)
        if not slot:
            continue
        local_id = match.local.id if match.local and not match.local.is_placeholder else None
        visitante_id = (
            match.visitante.id if match.visitante and not match.visitante.is_placeholder else None
        )
        local_name = match.local.nombre if match.local else match.placeholder_local or "Por definir"
        visitante_name = (
            match.visitante.nombre if match.visitante else match.placeholder_visitante or "Por definir"
        )
        dto = PartidoDTO(
            fecha=slot.fecha,
            hora_inicio=slot.hora_inicio,
            hora_fin=slot.hora_fin,
            escenario_evento_id=slot.venue.id,
            fase=match.fase,
            serie=match.serie,
            ronda=match.ronda,
            llave=match.code,
            equipo_local_id=local_id,
            equipo_local_nombre=local_name,
            equipo_visitante_id=visitante_id,
            equipo_visitante_nombre=visitante_name,
            placeholder_local=match.placeholder_local
            if match.placeholder_local and local_id is None
            else None,
            placeholder_visitante=match.placeholder_visitante
            if match.placeholder_visitante and visitante_id is None
            else None,
        )
        dtos.append(dto)
    dtos.sort(key=lambda item: (item.fecha, item.hora_inicio, item.escenario_evento_id))
    return dtos


async def persist_schedule(
    session: AsyncSession,
    *,
    event: Evento,
    matches: Sequence[PartidoDTO],
    force: bool,
) -> None:
    existing = await session.execute(
        select(EventoPartido.id, EventoPartido.estado).where(EventoPartido.evento_id == event.id)
    )
    rows = existing.all()
    if rows and not force:
        raise ApplicationError(
            "Ya existe un calendario generado. Utiliza force=true para reemplazarlo",
            status_code=409,
        )
    if rows:
        if any(row.estado and row.estado.lower() != "programado" for row in rows):
            raise ApplicationError(
                "No es posible regenerar el calendario porque existen resultados registrados",
                status_code=409,
            )
        await session.execute(
            EventoPartido.__table__.delete().where(EventoPartido.evento_id == event.id)
        )
    for match in matches:
        payload = match.to_model_payload()
        session.add(EventoPartido(evento_id=event.id, **payload))
    await session.flush()


async def persist_additional_matches(
    session: AsyncSession,
    *,
    event: Evento,
    matches: Sequence[PartidoDTO],
) -> None:
    if not matches:
        return
    for match in matches:
        payload = match.to_model_payload()
        session.add(EventoPartido(evento_id=event.id, **payload))
    await session.flush()


async def update_event_config(
    session: AsyncSession,
    *,
    event: Evento,
    config: ScheduleConfig,
) -> None:
    config_model = await _ensure_config(session, event)
    config_model.hora_inicio = config.hora_inicio
    config_model.hora_fin = config.hora_fin
    config_model.duracion_horas = config.duracion_horas
    config_model.descanso_min_dias = config.descanso_min_dias
    config_model.actualizado_en = datetime.now(timezone.utc)
    await session.flush()
