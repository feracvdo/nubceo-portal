-- Migración v12 — Link de Google Meet de cada reunión.
-- Correr en Supabase → SQL Editor ANTES de subir la v1.45.0 del portal.
alter table eventos
  add column if not exists meet_link text;
