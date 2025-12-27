-- Marca si un partido ya generó una noticia publicada
ALTER TABLE eventos_partidos
    ADD COLUMN IF NOT EXISTS noticia_publicada boolean NOT NULL DEFAULT false;
