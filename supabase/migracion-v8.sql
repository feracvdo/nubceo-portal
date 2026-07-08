-- Migración v8 — correr en Supabase → SQL Editor sobre la base EXISTENTE
-- ============================================================
-- 1) Superadministrador/a: único rol con permiso para eliminar clientes y usuarios
-- ============================================================
alter table equipo add column if not exists es_superadmin boolean not null default false;

-- ============================================================
-- 2) Comercial de la cuenta (persona a cargo de la relación comercial, no necesariamente
--    parte del equipo de implementación)
-- ============================================================
alter table clientes add column if not exists comercial text;

-- ============================================================
-- 3) Redmine/Gmail personal — vinculación por implementador/a (self-service en "Mi perfil")
-- ============================================================
alter table equipo add column if not exists redmine_api_key text;

-- ============================================================
-- 4) Go-live e Hypercare pasan a ser fases separadas (antes una sola "Go-live e hypercare")
--    → el rango de "fase" pasa de 0-6 a 0-7.
-- ============================================================
alter table clientes drop constraint if exists clientes_fase_check;
alter table clientes add constraint clientes_fase_check check (fase between 0 and 7);
-- Los clientes que ya estaban en la fase 6 (antes "Go-live e hypercare") arrancan ahora
-- en la nueva fase 6 ("Go-live"); si en tu operación ya pasaron el go-live y están en
-- hypercare, movelos manualmente a la fase 7 desde el tablero.
