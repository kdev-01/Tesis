BEGIN;

CREATE TABLE IF NOT EXISTS disciplinas (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evento_disciplinas (
    evento_id BIGINT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    disciplina_id BIGINT NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    PRIMARY KEY (evento_id, disciplina_id)
);

CREATE INDEX IF NOT EXISTS idx_evento_disciplinas_disciplina ON evento_disciplinas (disciplina_id);

INSERT INTO disciplinas (nombre)
SELECT DISTINCT disciplina
FROM eventos
WHERE disciplina IS NOT NULL
  AND disciplina <> ''
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO disciplinas (nombre)
VALUES
    ('Atletismo'),
    ('Baloncesto'),
    ('Fútbol'),
    ('Voleibol')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO evento_disciplinas (evento_id, disciplina_id)
SELECT e.id, d.id
FROM eventos AS e
JOIN disciplinas AS d ON lower(d.nombre) = lower(e.disciplina)
WHERE e.disciplina IS NOT NULL
  AND e.disciplina <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS fecha_auditoria_inicio DATE,
    ADD COLUMN IF NOT EXISTS fecha_auditoria_fin DATE;

COMMIT;
