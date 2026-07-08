-- Migración v6 — correr en Supabase → SQL Editor sobre la base EXISTENTE
-- ============================================================
-- 1) Roles del equipo (implementador / desarrollador) + foto de perfil
-- ============================================================
alter table equipo add column if not exists rol text not null default 'implementador' check (rol in ('implementador','desarrollador'));
alter table equipo add column if not exists foto text; -- data URL (base64), imagen chica

-- ============================================================
-- 2) Cliente: razón social, CUITs, logo, desarrollador asignado, fin de desarrollo de API
-- ============================================================
alter table clientes add column if not exists razon_social text;
alter table clientes add column if not exists cuits jsonb not null default '[]'::jsonb;
alter table clientes add column if not exists logo text; -- data URL (base64), imagen chica
alter table clientes add column if not exists desarrollador_id uuid references equipo(id) on delete set null;
alter table clientes add column if not exists api_desarrollo_completo boolean not null default false;

-- ============================================================
-- 3) Nuevo tipo de evento: workshop de cierre (post go-live)
-- ============================================================
alter table eventos drop constraint if exists eventos_tipo_check;
alter table eventos add constraint eventos_tipo_check check (tipo in
  ('workshop', 'reunion_tecnica', 'capacitacion_conciliador', 'capacitacion_cash',
   'resultados_sandbox', 'golive', 'workshop_cierre'));

-- ============================================================
-- 4) Plazos: se libera el check constraint fijo — la lista de hitos ahora vive en
--    código (lib/hitos.js) y puede crecer sin tener que migrar la base cada vez.
-- ============================================================
alter table plazos_cliente drop constraint if exists plazos_cliente_paso_check;
