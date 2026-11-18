CREATE TABLE IF NOT EXISTS tini_pines (
  id TEXT PRIMARY KEY NOT NULL,
  titulo TEXT NOT NULL DEFAULT '',
  enlace TEXT UNIQUE,
  fotos TEXT NOT NULL DEFAULT '[]',
  contenido BLOB,
  tipo TEXT,
  orden INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tini_pines_orden ON tini_pines(orden, id);
