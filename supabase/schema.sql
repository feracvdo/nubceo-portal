-- ============================================================
-- Portal de Implementaciones Nubceo — Esquema de base de datos
-- Motor: PostgreSQL (Supabase)
-- Ejecutar en: Supabase → SQL Editor → New query → pegar y Run
-- ============================================================

-- ── Equipo de implementación (superadmins) ──
create table equipo (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,          -- código de acceso del implementador
  nombre      text not null,
  email       text,                          -- para que el cliente lo pueda contactar por mail
  rol         text not null default 'implementador' check (rol in ('implementador','desarrollador','finanzas')),
  foto        text,                          -- data URL (base64), imagen chica
  es_superadmin boolean not null default false, -- único rol con permiso para eliminar
  redmine_api_key text,                       -- key personal de Redmine (self-service, opcional)
  creado_at   timestamptz not null default now()
);

-- ── Clientes en implementación ──
create table clientes (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null unique,    -- código de acceso del cliente
  nombre            text not null,
  razon_social      text,
  cuits             jsonb not null default '[]'::jsonb,  -- puede operar con más de un CUIT/razón social
  logo              text,                    -- data URL (base64), imagen chica
  tenant_productivo text,
  implementador_id  uuid references equipo(id) on delete set null,  -- implementador/a asignado
  desarrollador_id  uuid references equipo(id) on delete set null,  -- dev de Nubceo a cargo del desarrollo de API
  comercial         text,                    -- persona a cargo de la relación comercial
  api_desarrollo_completo boolean not null default false,
  fee                     numeric,
  moneda                  text not null default 'ARS' check (moneda in ('ARS','USD')),
  costo_implementacion    numeric,
  estado_pago             text not null default 'al_dia' check (estado_pago in ('al_dia','con_deuda')),
  deuda_desde             date,
  finanzas_notas          text,
  fase              smallint not null default 0 check (fase between 0 and 7),  -- 0..7: Go-live (6) e Hypercare (7) son fases separadas
  intro_leida       boolean not null default false,
  sucursales_omitido boolean not null default false,
  creado_at         timestamptz not null default now()
);

-- ── Relevamiento (una fila por cliente; respuestas en JSONB para
--    poder agregar/quitar preguntas sin migrar el esquema) ──
create table relevamientos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null unique references clientes(id) on delete cascade,
  respuestas     jsonb not null default '{}'::jsonb,
  enviado_at     timestamptz,                -- null = borrador
  diagrama       text,                       -- flowchart Mermaid generado al enviar
  actualizado_at timestamptz not null default now()
);

-- ── Sucursales cargadas a mano en el portal ──
create table sucursales (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references clientes(id) on delete cascade,
  nombre       text not null,
  direccion    text,
  localidad    text,
  nro_comercio text,
  creado_at    timestamptz not null default now()
);

-- ── Archivos subidos (template de sucursales cabecera y CSV de ventas)
--    v1: contenido en base64 dentro de la tabla; upgrade: Supabase Storage ──
create table archivos (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo       text not null check (tipo in ('sucursales', 'ventas')),
  nombre     text not null,
  tamanio    integer not null,
  contenido  text,                           -- data URL base64 (v1)
  validacion jsonb,                          -- resultado del validador de CSV
  subido_at  timestamptz not null default now(),
  unique (cliente_id, tipo)                  -- se conserva la última versión
);

-- ── Credenciales de API del cliente (sandbox / productivo) ──
create table credenciales_api (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete cascade,
  entorno     text not null default 'sandbox' check (entorno in ('sandbox', 'productivo')),
  api_key     text not null,
  api_secret  text not null,
  generado_at timestamptz not null default now(),
  unique (cliente_id, entorno)
);

-- ── Procesadoras del cliente y estado de conexión (Paso 1) ──
create table procesadoras_cliente (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references clientes(id) on delete cascade,
  codigo         text not null,              -- platform_external_code (ej: prisma_ar)
  nombre         text not null,
  pais           text not null,
  estado         text not null default 'no_conectado'
                 check (estado in ('no_conectado', 'en_espera', 'conectado')),
  actualizado_at timestamptz not null default now(),
  unique (cliente_id, codigo)
);

-- ── Involucrados de la implementación del lado del cliente ──
create table involucrados (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre     text not null,
  cargo      text,
  email      text not null,
  telefono   text,                            -- opcional
  rol        text not null default 'otro' check (rol in ('sponsor', 'key_user', 'otro'))
);

-- ── Eventos agendables (workshop, reunión técnica, capacitaciones,
--    resultados de sandbox y go-live) con su minuta ──
create table eventos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete cascade,
  tipo        text not null check (tipo in ('workshop', 'reunion_tecnica',
                'capacitacion_conciliador', 'capacitacion_cash',
                'resultados_sandbox', 'golive', 'workshop_cierre')),
  fecha       timestamptz not null,
  responsable text not null,                  -- con quién se agenda
  estado      text not null default 'agendado'
              check (estado in ('agendado', 'realizado', 'cancelado')),
  invitados   jsonb not null default '[]'::jsonb,  -- involucrados invitados
  minuta      text,                           -- se completa al realizarse
  google_event_id   text,                     -- id del evento real en Google Calendar (si el responsable está sincronizado)
  google_event_link text,                     -- link al evento en Google Calendar
  creado_at   timestamptz not null default now()
);

-- ── Status de pruebas (sandbox y go-live), cargado por el equipo ──
create table pruebas (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references clientes(id) on delete cascade,
  etapa          text not null check (etapa in ('sandbox', 'golive')),
  status         text not null default 'pendiente',
  notas          text,
  actualizado_at timestamptz not null default now(),
  unique (cliente_id, etapa)
);

-- ── Alta en Redmine (Feature + US sandbox) y su cola de envío ──
create table redmine_altas (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null unique references clientes(id) on delete cascade,
  estado         text not null default 'en_cola' check (estado in ('en_cola', 'enviado')),
  detalle        text,                        -- motivo si quedó en cola
  payloads       jsonb not null,              -- cuerpos exactos para POST /issues.json
  actualizado_at timestamptz not null default now()
);

-- ── Historial de actividad (visible para el cliente) ──
create table historial (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  quien      text not null,                   -- persona o "Portal (automático)"
  texto      text not null,
  creado_at  timestamptz not null default now()
);

-- ── Notas internas del equipo (el cliente NO las ve) ──
create table notas_internas (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  autor      text not null,
  texto      text not null,
  creado_at  timestamptz not null default now()
);

-- ── Sincronización real de Google Calendar por responsable
--    (Implementaciones, Eduardo Andre, Santiago Suarez, Mariana Macri) ──
create table calendar_conexiones (
  id             uuid primary key default gen_random_uuid(),
  responsable    text not null unique,       -- clave: mismo nombre que en config.disponibilidad
  google_email   text,
  refresh_token  text not null,
  conectado_por  text,
  conectado_at   timestamptz not null default now()
);

-- ── Plazos por paso, con control de qué mails de recordatorio/incumplimiento ya se enviaron ──
create table plazos_cliente (
  id                          uuid primary key default gen_random_uuid(),
  cliente_id                  uuid not null references clientes(id) on delete cascade,
  paso                        text not null,  -- lista de hitos vive en lib/hitos.js, no hay check fijo acá
  fecha_limite                date not null,
  recordatorio_enviado_at     timestamptz,
  incumplimiento_enviado_at   timestamptz,
  creado_por                  text,
  creado_at                   timestamptz not null default now(),
  actualizado_at              timestamptz not null default now(),
  unique (cliente_id, paso)
);

-- ── Configuración del portal (URL de Redmine, ID de proyecto)
--    IMPORTANTE: la API key de Redmine NO va acá — va en la variable
--    de entorno REDMINE_API_KEY del servidor ──
create table config (
  clave text primary key,
  valor jsonb not null
);

-- ── Índices para las consultas frecuentes ──
create index idx_sucursales_cliente on sucursales (cliente_id);
create index idx_archivos_cliente on archivos (cliente_id);
create index idx_proc_cliente on procesadoras_cliente (cliente_id);
create index idx_involucrados_cliente on involucrados (cliente_id);
create index idx_eventos_cliente on eventos (cliente_id, fecha);
create index idx_historial_cliente on historial (cliente_id, creado_at desc);
create index idx_notas_cliente on notas_internas (cliente_id, creado_at desc);
create index idx_plazos_cliente on plazos_cliente (cliente_id);

-- ============================================================
-- Seguridad: Row Level Security
-- Todo el acceso pasa por las rutas de API del servidor (service
-- role, que ignora RLS). Para el navegador (anon key) TODO queda
-- bloqueado: RLS habilitado sin políticas = denegar todo.
-- Cuando se active Supabase Auth (magic link / SSO Nubceo), acá se
-- agregan las políticas por usuario.
-- ============================================================
alter table equipo enable row level security;
alter table clientes enable row level security;
alter table relevamientos enable row level security;
alter table sucursales enable row level security;
alter table archivos enable row level security;
alter table credenciales_api enable row level security;
alter table procesadoras_cliente enable row level security;
alter table involucrados enable row level security;
alter table eventos enable row level security;
alter table pruebas enable row level security;
alter table redmine_altas enable row level security;
alter table historial enable row level security;
alter table notas_internas enable row level security;
alter table config enable row level security;
alter table calendar_conexiones enable row level security;
alter table plazos_cliente enable row level security;

-- ── Datos iniciales de ejemplo (borrar en producción) ──
insert into clientes (codigo, nombre, tenant_productivo) values ('DEMO123', 'Cliente Demo S.A.', 'demo-prod');

-- Disponibilidad semanal del equipo para los agendadores
-- (dia: 1=lunes ... 5=viernes; horarios de inicio de reuniones de 1 hora)
insert into config (clave, valor) values ('disponibilidad', '{
  "Implementaciones":   [[1,"10:00"],[1,"11:00"],[2,"15:00"],[3,"10:00"],[4,"11:00"],[4,"15:00"],[5,"10:00"]],
  "Eduardo Andre":      [[2,"10:00"],[2,"11:00"],[4,"14:00"],[4,"15:00"]],
  "Santiago Suarez":    [[1,"14:00"],[3,"14:00"],[3,"15:00"],[5,"11:00"]],
  "Mariana Macri":      [[2,"14:00"],[3,"11:00"],[5,"14:00"],[5,"15:00"]]
}'::jsonb);
insert into equipo (codigo, nombre) values ('FER-IMPL', 'Fernanda');
