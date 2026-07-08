-- Migración v3 — correr en Supabase → SQL Editor sobre la base EXISTENTE
-- (si en cambio creás la base de cero, usá schema.sql que ya lo incluye)
alter table clientes
  add column if not exists implementador_id uuid references equipo(id) on delete set null;
