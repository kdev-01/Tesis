-- Actualiza los estados permitidos para eventos y normaliza valores existentes
BEGIN;

-- 1) Normaliza los estados viejos
UPDATE eventos SET estado = 'inscripcion' WHERE estado = 'publicado';
UPDATE eventos SET estado = 'campeonato' WHERE estado = 'en_curso';

-- 2) Elimina el constraint viejo (si existe)
ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_estado_check;

-- 3) Crea el constraint nuevo
ALTER TABLE eventos
    ADD CONSTRAINT eventos_estado_check
    CHECK (estado IN ('borrador','inscripcion','auditoria','campeonato','finalizado','archivado'));

COMMIT;
