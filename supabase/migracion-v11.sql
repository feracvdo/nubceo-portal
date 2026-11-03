-- Migración v11 — ¿El cliente usa ambiente de pruebas (sandbox)?
-- Correr en Supabase → SQL Editor ANTES de subir la v1.39.0 del portal.
--
-- true  (por defecto): se pide el tenant sandbox en Redmine y el cliente ve el
--                      paso "Pruebas con tus datos".
-- false: el cliente va directo a productivo; no se pide sandbox y ese paso no
--        aparece ni cuenta en su avance.
-- Los clientes que ya existen quedan con true, como funcionaban hasta ahora.

alter table clientes
  add column if not exists usa_sandbox boolean not null default true;
