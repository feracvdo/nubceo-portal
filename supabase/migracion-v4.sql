-- Migración v4 — correr en Supabase → SQL Editor sobre la base EXISTENTE
-- (si en cambio creás la base de cero, usá schema.sql, que ya incluye todo esto)
-- ============================================================
-- 1) Mail del implementador/a, para que el cliente lo pueda contactar
-- ============================================================
alter table equipo
  add column if not exists email text;

-- ============================================================
-- 2) Sincronización real de Google Calendar por responsable
--    (Implementaciones, Eduardo Andre, Santiago Suarez, Mariana Macri)
-- ============================================================
create table if not exists calendar_conexiones (
  id             uuid primary key default gen_random_uuid(),
  responsable    text not null unique,       -- clave: mismo nombre que en config.disponibilidad
  google_email   text,                       -- cuenta de Google conectada
  refresh_token  text not null,              -- vive solo en el servidor
  conectado_por  text,                       -- código de quien conectó
  conectado_at   timestamptz not null default now()
);
alter table calendar_conexiones enable row level security;

-- ============================================================
-- 3) Referencia al evento real creado en Google Calendar
-- ============================================================
alter table eventos
  add column if not exists google_event_id   text,
  add column if not exists google_event_link text;
