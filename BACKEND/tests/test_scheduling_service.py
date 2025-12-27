from datetime import date, time

import pytest

from app.services.scheduling_service import (
    ScheduleConfig,
    Team,
    Venue,
    build_matches,
    build_slots,
    determine_tournament_structure,
    solve_schedule,
    _build_series_assignments,
    _round_robin_pairs,
)


def test_determine_tournament_structure_ranges():
    assert determine_tournament_structure(2).series == 1
    assert determine_tournament_structure(2).playoff_teams == 0

    structure_10 = determine_tournament_structure(10)
    assert structure_10.series == 2
    assert structure_10.playoff_teams == 4

    structure_14 = determine_tournament_structure(14)
    assert structure_14.series == 3
    assert structure_14.playoff_teams == 8

    structure_18 = determine_tournament_structure(18)
    assert structure_18.series == 4
    assert structure_18.playoff_teams == 8

    structure_24 = determine_tournament_structure(24)
    assert structure_24.series == 5
    assert structure_24.playoff_teams == 8

    with pytest.raises(Exception):
        determine_tournament_structure(30)


def test_round_robin_pairs_handles_bye():
    teams = [Team(id=index, nombre=f"Equipo {index}") for index in range(5)]
    rounds = _round_robin_pairs(teams)
    total_matches = sum(len(ronda) for ronda in rounds)
    # For 5 teams, after adding BYE we expect 5 rounds with 2 matches each => 10 matches.
    assert total_matches == 10
    # Ensure no BYE team appears in pairings.
    assert all("BYE" not in {home.nombre, away.nombre} for ronda in rounds for home, away in ronda)


def test_solve_schedule_generates_unique_slots():
    teams = [Team(id=index, nombre=f"Equipo {index}") for index in range(4)]
    structure = determine_tournament_structure(len(teams))
    assignments = _build_series_assignments(teams, structure.series)
    matches = build_matches(structure, assignments)

    config = ScheduleConfig(
        hora_inicio=time(8, 0),
        hora_fin=time(12, 0),
        duracion_horas=2,
        descanso_min_dias=0,
    )
    venues = [Venue(id=1, nombre="Cancha Principal")]
    slots = build_slots(
        start_date=date(2025, 1, 1),
        end_date=date(2025, 1, 2),
        config=config,
        venues=venues,
    )
    solution = solve_schedule(matches, slots, config=config)

    # Every match must be assigned to exactly one slot
    assert len(solution) == len(matches)
    assigned_slots = list(solution.values())
    # Slots should not repeat
    slot_ids = {slot.index for slot in assigned_slots}
    assert len(slot_ids) == len(matches)

    # Ensure no team plays two matches on the same day at the same time
    team_schedule: dict[int, set[tuple[int, int]]] = {}
    for match in matches:
        slot = solution[match.internal_id]
        for participant in (match.local, match.visitante):
            if not participant or participant.is_placeholder:
                continue
            played = team_schedule.setdefault(participant.id, set())
            key = (slot.day_index, slot.time_index)
            assert key not in played
            played.add(key)
