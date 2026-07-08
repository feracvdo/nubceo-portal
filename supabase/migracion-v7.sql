-- Migración v7 — correr en Supabase → SQL Editor sobre la base EXISTENTE
-- ============================================================
-- 1) Nuevo rol de equipo: Finanzas (se suma a implementador/desarrollador)
-- ============================================================
alter table equipo drop constraint if exists equipo_rol_check;
alter table equipo add constraint equipo_rol_check check (rol in ('implementador','desarrollador','finanzas'));

-- ============================================================
-- 2) Datos financieros por cliente, cargados por el equipo de Finanzas
-- ============================================================
alter table clientes add column if not exists fee numeric;
alter table clientes add column if not exists moneda text not null default 'ARS' check (moneda in ('ARS','USD'));
alter table clientes add column if not exists costo_implementacion numeric;
alter table clientes add column if not exists estado_pago text not null default 'al_dia' check (estado_pago in ('al_dia','con_deuda'));
alter table clientes add column if not exists deuda_desde date;   -- solo tiene sentido si estado_pago = 'con_deuda'
alter table clientes add column if not exists finanzas_notas text;
