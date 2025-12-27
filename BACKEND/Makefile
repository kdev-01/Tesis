PYTHON=python3
APP_MODULE=app.main:app

.PHONY: dev db-migrate db-seed db-reset lint

dev:
	uvicorn $(APP_MODULE) --reload --host 0.0.0.0 --port 8000

db-migrate:
	$(PYTHON) -m app.cli db-migrate

db-seed:
	$(PYTHON) -m app.cli db-seed

db-reset:
	$(PYTHON) -m app.cli db-reset

lint:
	$(PYTHON) -m compileall app
