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
  fase              smallint not null default 0 check (fase between 0 and 8),  -- 0..8: ver FASES en components/PortalApp.jsx
  ultima_actividad  timestamptz,           -- denormalizado: se actualiza en cada addHistory(), evita escanear historial en el listado
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
  feature_issue_id   integer,                 -- ID real del ticket Feature ya creado en Redmine
  user_story_issue_id integer,                -- ID real del ticket User Story ya creado en Redmine
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
  responsable    text not null unique,       -- nombre de la persona (100% personal, nunca un rol compartido)
  google_email   text,
  refresh_token  text not null,
  conectado_por  text,
  conectado_at   timestamptz not null default now()
);

-- ── Disponibilidad semanal personal — cada persona carga la suya desde su perfil ──
create table disponibilidad_equipo (
  id          uuid primary key default gen_random_uuid(),
  equipo_id   uuid not null references equipo(id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 0 and 6),
  hora        text not null,
  unique (equipo_id, dia_semana, hora)
);

-- ── Plazos por paso, con control de qué mails de recordatorio/incumplimiento ya se enviaron ──
create table plazos_cliente (
  id                          uuid primary key default gen_random_uuid(),
  cliente_id                  uuid not null references clientes(id) on delete cascade,
  paso                        text not null,  -- lista de hitos vive en lib/hitos.js, no hay check fijo acá
  fecha_limite                date not null,
  cumplimiento                text check (cumplimiento in ('cumplido_tiempo', 'cumplido_tarde', 'incumplido')), -- null = sin confirmar
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
create index idx_clientes_ultima_actividad on clientes (ultima_actividad desc);
create index idx_disponibilidad_equipo on disponibilidad_equipo (equipo_id);

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

insert into equipo (codigo, nombre) values ('FER-IMPL', 'Fernanda');

-- Disponibilidad de ejemplo para la implementadora demo — cada persona carga la suya
-- desde Mi perfil una vez logueada; esto es solo para que el seed no quede vacío.
-- (dia: 0=domingo ... 6=sábado; horarios de inicio de reuniones de 1 hora)
insert into disponibilidad_equipo (equipo_id, dia_semana, hora)
select id, dia, hora from equipo, (values
  (1,'10:00'), (1,'11:00'), (2,'15:00'), (3,'10:00'), (4,'11:00'), (4,'15:00'), (5,'10:00')
) as t(dia, hora)
where codigo = 'FER-IMPL';
