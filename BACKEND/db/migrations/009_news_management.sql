-- Gestión de noticias: tabla y soporte para filtrado/organización
CREATE TABLE IF NOT EXISTS noticias (
    id BIGSERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    resumen TEXT,
    contenido TEXT NOT NULL,
    categoria TEXT,
    etiquetas JSONB NOT NULL DEFAULT '[]'::jsonb,
    estado TEXT NOT NULL DEFAULT 'borrador',
    destacado BOOLEAN NOT NULL DEFAULT FALSE,
    orden INTEGER NOT NULL DEFAULT 0,
    fecha_publicacion TIMESTAMPTZ,
    autor_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    eliminado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_noticias_estado ON noticias (estado);
CREATE INDEX IF NOT EXISTS ix_noticias_destacado ON noticias (destacado);
CREATE INDEX IF NOT EXISTS ix_noticias_fecha_publicacion ON noticias (fecha_publicacion DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS ix_noticias_categoria ON noticias (categoria);
CREATE INDEX IF NOT EXISTS ix_noticias_orden ON noticias (orden);
CREATE INDEX IF NOT EXISTS ix_noticias_busqueda ON noticias USING GIN (
    to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(resumen, '') || ' ' || coalesce(contenido, ''))
);
CREATE INDEX IF NOT EXISTS ix_noticias_etiquetas ON noticias USING GIN (etiquetas jsonb_path_ops);
