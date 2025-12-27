from __future__ import annotations

import pathlib

import typer

from app.core.config import settings
from app.core.logging import setup_logging
from app.scripts.db_runner import run_migrations, run_reset, run_seeds

setup_logging()

app = typer.Typer(help="Herramientas de línea de comandos para el backend AGXport")


@app.command("db-migrate")
def migrate() -> None:
    """Ejecuta los scripts de migración (.sql)."""
    run_migrations(settings.sync_database_uri, pathlib.Path(__file__).resolve().parent.parent / "db" / "migrations")


@app.command("db-seed")
def seed() -> None:
    """Ejecuta los scripts de seeds (.sql)."""
    run_seeds(settings.sync_database_uri, pathlib.Path(__file__).resolve().parent.parent / "db" / "seeds")


@app.command("db-reset")
def reset() -> None:
    """Reinicia la base de datos, ejecutando migraciones y seeds."""
    run_reset(
        settings.sync_database_uri,
        pathlib.Path(__file__).resolve().parent.parent / "db" / "migrations",
        pathlib.Path(__file__).resolve().parent.parent / "db" / "seeds",
    )


if __name__ == "__main__":
    app()
