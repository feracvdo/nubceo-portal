-- Migración v9 — Tipos de usuario (superuser/admin/colaborador) y archivo lógico de clientes
-- Correr en Supabase → SQL Editor sobre la base existente.

-- ── Tipo de usuario en la tabla equipo ──
-- Reemplaza es_superadmin (bool) por tipo_usuario (texto con 3 valores)
alter table equipo
  add column if not exists tipo_usuario text not null default 'colaborador'
    check (tipo_usuario in ('superuser', 'admin', 'colaborador'));

-- Migrar los superadmin actuales a superuser, y el resto queda como admin
-- (para no bajarles capacidades a quien ya venía usando el portal)
update equipo set tipo_usuario = 'superuser' where es_superadmin = true;
update equipo set tipo_usuario = 'admin' where es_superadmin = false or es_superadmin is null;

-- Dejamos es_superadmin por compatibilidad con código viejo — no lo borramos aún.
-- Si en el futuro querés eliminarla: alter table equipo drop column es_superadmin;

-- Índice para búsquedas por tipo (para el listado del panel)
create index if not exists idx_equipo_tipo on equipo (tipo_usuario);

-- ── Archivo lógico de clientes ──
alter table clientes
  add column if not exists archivado_at timestamptz,
  add column if not exists archivado_por uuid references equipo(id) on delete set null;

-- Índice: en el listado activo (99% de las consultas) filtramos por archivado_at is null
create index if not exists idx_clientes_activos on clientes (creado_at) where archivado_at is null;
