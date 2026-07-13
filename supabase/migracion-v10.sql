-- Migración v10 — Fecha estimada de go-live por cliente
-- Correr en Supabase → SQL Editor sobre la base existente.
--
-- Esta fecha es la que se compromete en la reunión de vinculación (Fase 1).
-- Se usa para priorizar clientes trabados en el tablero y para calcular la
-- proximidad al lanzamiento (semáforo verde/amarillo/rojo en el listado).

alter table clientes
  add column if not exists go_live_estimado date;

-- Índice para ordenar/filtrar por proximidad al go-live en el tablero
create index if not exists idx_clientes_go_live on clientes (go_live_estimado)
  where archivado_at is null and go_live_estimado is not null;
