-- Migración v5 — correr en Supabase → SQL Editor sobre la base EXISTENTE
-- (si en cambio creás la base de cero, usá schema.sql, que ya incluye todo esto)
-- ============================================================
-- Plazos por paso y control de mails de recordatorio/incumplimiento enviados
-- ============================================================
create table if not exists plazos_cliente (
  id                          uuid primary key default gen_random_uuid(),
  cliente_id                  uuid not null references clientes(id) on delete cascade,
  paso                        text not null check (paso in
                               ('procesadoras','introduccion','relevamiento','sucursales','conexion','capacitacion','sandbox','golive')),
  fecha_limite                date not null,
  recordatorio_enviado_at     timestamptz,   -- mail "resta 1 día" ya enviado para este plazo
  incumplimiento_enviado_at   timestamptz,   -- mail de plazo vencido ya enviado para este plazo
  creado_por                  text,          -- código de quien definió el plazo
  creado_at                   timestamptz not null default now(),
  actualizado_at              timestamptz not null default now(),
  unique (cliente_id, paso)
);
create index if not exists idx_plazos_cliente on plazos_cliente (cliente_id);
alter table plazos_cliente enable row level security;
