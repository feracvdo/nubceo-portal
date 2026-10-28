// lib/redmine.js — se ejecuta SOLO en el servidor.
// La API key vive en la variable de entorno REDMINE_API_KEY, nunca llega al navegador.
import { supabaseAdmin } from "./supabaseAdmin";

// ── Proyecto Nubceo Implementaciones (oct 2026) ──
// Solo admite dos trackers: "Implementación" (una por cliente, sin padre) y
// "Solicitud" (pedido operativo a IT, cuelga de la Implementación del cliente).
// IDs de respaldo por si la resolución por nombre falla (acentos, permisos, etc.).
export const TRACKER_IMPLEMENTACION = "Implementación";
export const TRACKER_SOLICITUD = "Solicitud";
const TRACKER_IDS_RESPALDO = { [TRACKER_IMPLEMENTACION]: 15, [TRACKER_SOLICITUD]: 16 };

// Campos custom de Redmine
const CF_TENANT = 14;      // texto numérico — en Implementación y Solicitud, cargarlo siempre
const CF_QUERY_TYPE = 45;  // lista múltiple — OBLIGATORIO en Solicitud

export const QUERY_TYPES = [
  "Creación sandbox", "Migración ventas", "Migración reglas y secuencias", "Eliminación de datos",
  "Credenciales", "Usuarios y permisos", "Flags y configuración", "Actualización de datos", "Otro",
];

// Desarrolladores a los que se les puede asignar una Solicitud (id de usuario en Redmine).
// Eduardo André sigue siendo el asignado por defecto de las altas.
export const DESARROLLADORES_REDMINE = [
  { id: 241, nombre: "Eduardo André" },
  { id: 254, nombre: "Adrián Quintana" },
  { id: 258, nombre: "Santiago Suarez" },
];
const ASIGNADO_ALTA_ID = 241;
export const asignadoValido = (id) => {
  const n = Number(id);
  return DESARROLLADORES_REDMINE.some((d) => d.id === n) ? n : null;
};

// Busca el id de Redmine de una persona por nombre (sin acentos ni mayúsculas).
const normNombre = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
export function redmineIdPorNombre(nombre) {
  const n = normNombre(nombre);
  if (!n) return null;
  const d = DESARROLLADORES_REDMINE.find((x) => n.includes(normNombre(x.nombre)) || normNombre(x.nombre).includes(n));
  return d ? d.id : null;
}

// Tenant numérico (el campo custom en Redmine solo acepta números)
const tenantNum = (tenant) => {
  const t = String(tenant || "").replace(/\D/g, "");
  return t || null;
};
// Prefijo de las Solicitudes: "[<Cliente> - T<tenant>]"
const prefijoSolicitud = (nombre, tenant) => "[" + nombre + (tenantNum(tenant) ? " - T" + tenantNum(tenant) : "") + "] ";
const camposSolicitud = (tenant, queryType) => {
  const cf = [{ id: CF_QUERY_TYPE, value: [QUERY_TYPES.includes(queryType) ? queryType : "Otro"] }];
  if (tenantNum(tenant)) cf.unshift({ id: CF_TENANT, value: tenantNum(tenant) });
  return cf;
};

// Para el ejemplo de mail de prueba en la descripción de la User Story — un slug
// simple, sin espacios ni acentos, como necesita la parte local de un mail real.
const slug = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // saca acentos
    .replace(/[^a-z0-9]+/g, "");

const fmtFechaLarga = (iso) => {
  if (!iso) return "(sin definir)";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
};

export function buildRedminePayloads(nombre, tenant, codigo, projectId, cuits, asignadoId) {
  const pid = projectId || "implementaciones";
  const nombreTenant = nombre + " - " + (tenant || "(a confirmar)");
  const cuit = Array.isArray(cuits) && cuits.length ? cuits[0] : "(a definir)";
  const asignado = asignadoValido(asignadoId) || ASIGNADO_ALTA_ID;
  return [
    {
      titulo: "Implementación del cliente",
      body: {
        issue: {
          project_id: pid,
          tracker_name: TRACKER_IMPLEMENTACION,
          assigned_to_id: ASIGNADO_ALTA_ID,
          subject: "Implementación de " + nombreTenant,
          description:
            "Implementación de " + nombre +
            "\n\nAcá se vinculan como Solicitudes todos los pedidos al área de IT relacionados al cliente.",
          custom_fields: tenantNum(tenant) ? [{ id: CF_TENANT, value: tenantNum(tenant) }] : [],
        },
      },
    },
    {
      titulo: "Solicitud: creación de tenant sandbox",
      body: {
        issue: {
          project_id: pid,
          tracker_name: TRACKER_SOLICITUD,
          assigned_to_id: asignado,
          subject: prefijoSolicitud(nombre, tenant) + "Creación de tenant sandbox",
          description:
            "Se debe crear un tenant para que prueben la carga de ventas del punto de ventas en https://cash.nubceo.com/\n" +
            "Procedimiento:\n" +
            "- Probar usuario desde la web con formato de email \"" + slug(nombre) + ".sandbox@nubceo.com\"\n" +
            "- Modificar en la base de datos el tenant_tier a cash_reconciler\n" +
            "- Asignar el CUIT seleccionado por el cliente a la Company del usuario de prueba - " + cuit + "\n" +
            "- Crear api access key (consultar por el formato)\n" +
            "- Asociar esa access api key al tenant\n" +
            "- Crear sucursal cabecera de prueba\n" +
            "- Mes de pruebas electo por el cliente: a definir\n\n" +
            "Validación: el usuario de prueba ingresa al tenant sandbox y la API key asociada responde.",
          custom_fields: camposSolicitud(tenant, "Creación sandbox"),
        },
      },
    },
  ];
}

// ── Plantillas de tickets a demanda (desde el detalle del cliente, sin que el cliente entre al portal) ──

// opts: { tenant, asignadoId, trackerName, queryType }
const solicitud = (nombreCliente, opts, queryTypeDefault, subject, description) => {
  const o = opts || {};
  const issue = {
    tracker_name: o.trackerName || TRACKER_SOLICITUD,
    subject: prefijoSolicitud(nombreCliente, o.tenant) + subject,
    description,
    custom_fields: camposSolicitud(o.tenant, o.queryType || queryTypeDefault),
  };
  const asignado = asignadoValido(o.asignadoId);
  if (asignado) issue.assigned_to_id = asignado;
  return { issue };
};

export function buildTicketMigracionVentas(nombreCliente, desde, hasta, opts) {
  return solicitud(nombreCliente, opts, "Migración ventas",
    "Migración de ventas de plataforma (Sales)",
    "Migrar las ventas de la plataforma (Sales) para " + nombreCliente + ".\n" +
    "Período a migrar: del " + fmtFechaLarga(desde) + " al " + fmtFechaLarga(hasta) + ".");
}

export function buildTicketEliminarPos(nombreCliente, entorno, opts) {
  const entornoTxt = entorno === "productivo" ? "Producción" : "Sandbox";
  return solicitud(nombreCliente, opts, "Eliminación de datos",
    "Eliminar pos_sales y pos_payments (" + entornoTxt + ")",
    "Eliminar los registros de pos_sales y pos_payments del entorno " + entornoTxt + " para " + nombreCliente + ".");
}

export function buildTicketCambioRolAdmin(nombreCliente, usuarios, opts) {
  return solicitud(nombreCliente, opts, "Usuarios y permisos",
    "Cambio de rol a Administrador",
    "Otorgar rol de Administrador a los siguientes usuarios de " + nombreCliente + ":\n" + (usuarios || "(a definir)"));
}

export function buildTicketLibre(nombreCliente, subject, description, opts) {
  return solicitud(nombreCliente, opts, "Otro", subject || "(sin asunto)", description || "");
}

// Trackers realmente habilitados en el proyecto — Redmine no acepta "tracker_name",
// así que esto resuelve el nombre al tracker_id numérico real antes de enviar.
export async function resolverTrackers(url, apiKey, projectId) {
  const res = await fetch(url.replace(/\/+$/, "") + "/projects/" + encodeURIComponent(projectId) + ".json?include=trackers", {
    headers: { "X-Redmine-API-Key": apiKey },
  });
  if (!res.ok) return {};
  const data = await res.json();
  const lista = data?.project?.trackers || [];
  return Object.fromEntries(lista.map((t) => [t.name, t.id]));
}

// Busca el id del tracker por nombre, tolerando acentos/mayúsculas; si no aparece,
// usa el id conocido del proyecto Nubceo Implementaciones (15 / 16).
function idTracker(trackers, nombre) {
  if (trackers[nombre]) return trackers[nombre];
  const n = normNombre(nombre);
  const hit = Object.entries(trackers).find(([k]) => normNombre(k) === n);
  if (hit) return hit[1];
  return TRACKER_IDS_RESPALDO[nombre] || null;
}

// Para vincular manualmente un ticket que ya existe en Redmine (de clientes que ya tenían
// el alta hecha antes de que el portal empezara a guardar el ID real) — de paso, si el
// ticket había quedado con el tracker por defecto del proyecto (ej: "Task") en vez de
// "Implementación", lo corrige. Es "mejor esfuerzo": si no se puede, no rompe nada, solo avisa.
export async function corregirTrackerDeTicket(issueId, nombreTrackerDeseado, apiKeyOverride) {
  const apiKey = apiKeyOverride || process.env.REDMINE_API_KEY;
  const { data: cfgRow } = await supabaseAdmin.from("config").select("valor").eq("clave", "redmine").maybeSingle();
  const cfg = cfgRow?.valor || {};
  const url = process.env.REDMINE_URL || cfg.url;
  if (!url || !apiKey) return " (Redmine no está configurado del lado del servidor)";
  const trackers = await resolverTrackers(url, apiKey, cfg.projectId || "implementaciones");
  const tid = idTracker(trackers, nombreTrackerDeseado);
  if (!tid) return " (no se encontró el tracker \"" + nombreTrackerDeseado + "\" en el proyecto — se vinculó igual, pero revisá el tracker a mano)";
  const res = await fetch(url.replace(/\/+$/, "") + "/issues/" + issueId + ".json", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Redmine-API-Key": apiKey },
    body: JSON.stringify({ issue: { tracker_id: tid } }),
  });
  if (!res.ok) {
    let motivo = "";
    try { const cuerpo = await res.json(); if (Array.isArray(cuerpo?.errors)) motivo = cuerpo.errors.join(" · "); } catch (e) { /* sin detalle */ }
    return " (no se pudo corregir el tracker en Redmine: HTTP " + res.status + (motivo ? " — " + motivo : "") + ")";
  }
  return " · tracker corregido a \"" + nombreTrackerDeseado + "\" en Redmine ✓";
}

// Para el selector de tracker del "ticket libre" en el panel del equipo.
export async function listarTrackers(apiKeyOverride) {
  const apiKey = apiKeyOverride || process.env.REDMINE_API_KEY;
  const { data: cfgRow } = await supabaseAdmin.from("config").select("valor").eq("clave", "redmine").maybeSingle();
  const cfg = cfgRow?.valor || {};
  const url = process.env.REDMINE_URL || cfg.url;
  if (!url || !apiKey) return [];
  try {
    const mapa = await resolverTrackers(url, apiKey, cfg.projectId || "implementaciones");
    return Object.entries(mapa).map(([nombre, id]) => ({ nombre, id }));
  } catch (e) {
    return [];
  }
}

// parentIssueIdOverride: para Solicitudes a demanda que cuelgan de la Implementación del cliente
// (en vez de usar cfg.parentIssueId, que es el "padre por defecto" de las altas nuevas).
export async function sendToRedmine(payloads, apiKeyOverride, parentIssueIdOverride) {
  const apiKey = apiKeyOverride || process.env.REDMINE_API_KEY;
  const { data: cfgRow } = await supabaseAdmin.from("config").select("valor").eq("clave", "redmine").maybeSingle();
  const cfg = cfgRow?.valor || {};
  const url = process.env.REDMINE_URL || cfg.url;
  if (!url || !apiKey) {
    return { estado: "en_cola", detalle: "Falta configurar REDMINE_URL / REDMINE_API_KEY en las variables de entorno. Los tickets quedan en cola con el payload listo.", issueIds: [] };
  }
  const projectId = cfg.projectId || "implementaciones";
  let trackers = {};
  try { trackers = await resolverTrackers(url, apiKey, projectId); } catch (e) { /* si falla, Redmine usa el tracker default del proyecto */ }

  try {
    // Se crean en orden: cada ticket queda como "padre" del siguiente, empezando por
    // parentIssueIdOverride (tickets a demanda) o cfg.parentIssueId (altas nuevas) si están
    // configurados. Esto resuelve los trackers de Redmine que exigen tarea padre obligatoria.
    let idPadre = parentIssueIdOverride || (cfg.parentIssueId ? Number(cfg.parentIssueId) : null);
    const issueIds = [];
    for (const p of payloads) {
      // Acepta los dos formatos de payload: el del alta ({ body: { issue } }) y el de
      // los tickets a demanda ({ issue }). Así ningún llamador queda afuera.
      const issue = { ...((p.body && p.body.issue) || p.issue || {}) };
      if (cfg.projectId) issue.project_id = cfg.projectId;
      // La Implementación es raíz en la metodología: no lleva padre.
      if (idPadre && issue.tracker_name !== TRACKER_IMPLEMENTACION) issue.parent_issue_id = idPadre;
      if (Array.isArray(issue.custom_fields) && !issue.custom_fields.length) delete issue.custom_fields;
      // "tracker_name" no es un campo real de la API de Redmine (usa tracker_id numérico) —
      // se resuelve acá contra los trackers reales del proyecto; si no se encuentra, se
      // saca el campo y Redmine usa el tracker por defecto del proyecto (mejor eso que
      // que la creación falle por un campo que Redmine no reconoce).
      if (issue.tracker_name) {
        const tid = idTracker(trackers, issue.tracker_name);
        if (tid) issue.tracker_id = tid;
        delete issue.tracker_name;
      }
      const res = await fetch(url.replace(/\/+$/, "") + "/issues.json", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Redmine-API-Key": apiKey },
        body: JSON.stringify({ issue }),
      });
      if (!res.ok) {
        // Redmine devuelve el motivo real en el body (ej: {"errors":["Project can't be blank","Tracker can't be blank"]}) —
        // antes se descartaba y solo se guardaba el código HTTP, que no alcanza para diagnosticar nada.
        let motivo = "";
        try {
          const cuerpo = await res.json();
          if (Array.isArray(cuerpo?.errors)) motivo = cuerpo.errors.join(" · ");
        } catch (e) { /* el body no era JSON, seguimos solo con el código */ }
        return { estado: "en_cola", detalle: "Redmine respondió HTTP " + res.status + (motivo ? ": " + motivo : "") + ". Queda en cola para reenviar.", issueIds };
      }
      try {
        const creado = await res.json();
        const nuevoId = creado?.issue?.id || null;
        if (nuevoId) { issueIds.push(nuevoId); idPadre = nuevoId; }
      } catch (e) { /* si no vino el id, seguimos con el padre que ya teníamos */ }
    }
    return { estado: "enviado", detalle: null, issueIds };
  } catch (e) {
    return { estado: "en_cola", detalle: "No se pudo llegar a Redmine desde el servidor (" + e.message + "). Queda en cola para reenviar.", issueIds: [] };
  }
}
