from __future__ import annotations

import pathlib

import psycopg

from app.core.logging import get_logger

logger = get_logger(__name__)


def _read_sql_files(path: pathlib.Path) -> list[pathlib.Path]:
    if not path.exists():
        return []
    return sorted([p for p in path.iterdir() if p.suffix == ".sql"])


def _execute_sql_file(conn: psycopg.Connection, sql_file: pathlib.Path) -> None:
    logger.info("db_runner.execute", file=str(sql_file))
    with sql_file.open("r", encoding="utf-8") as file:
        sql = file.read()
        with conn.cursor() as cur:
            cur.execute(sql, prepare=False)


def run_migrations(database_url: str, migrations_path: pathlib.Path) -> None:
    files = _read_sql_files(migrations_path)
    if not files:
        logger.warning("db_runner.no_migrations", path=str(migrations_path))
        return
    with psycopg.connect(database_url, autocommit=True) as conn:
        for file in files:
            _execute_sql_file(conn, file)


def run_seeds(database_url: str, seeds_path: pathlib.Path) -> None:
    files = _read_sql_files(seeds_path)
    if not files:
        logger.warning("db_runner.no_seeds", path=str(seeds_path))
        return
    with psycopg.connect(database_url, autocommit=True) as conn:
        for file in files:
            _execute_sql_file(conn, file)


def run_reset(database_url: str, migrations_path: pathlib.Path, seeds_path: pathlib.Path) -> None:
    with psycopg.connect(database_url, autocommit=True) as conn:
        logger.info("db_runner.reset.start")
        with conn.cursor() as cur:
            cur.execute("DROP SCHEMA public CASCADE;", prepare=False)
            cur.execute("CREATE SCHEMA public;", prepare=False)
            cur.execute("GRANT ALL ON SCHEMA public TO CURRENT_USER;", prepare=False)
            cur.execute("GRANT ALL ON SCHEMA public TO public;", prepare=False)
        logger.info("db_runner.reset.done")
    run_migrations(database_url, migrations_path)
    run_seeds(database_url, seeds_path)
