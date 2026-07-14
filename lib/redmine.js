// lib/redmine.js — se ejecuta SOLO en el servidor.
// La API key vive en la variable de entorno REDMINE_API_KEY, nunca llega al navegador.
import { supabaseAdmin } from "./supabaseAdmin";

// Eduardo André (id 241 en Redmine) recibe siempre las altas — él las reparte
// después con Santiago Suarez según corresponda.
const ASIGNADO_ALTA_ID = 241;

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

export function buildRedminePayloads(nombre, tenant, codigo, projectId, cuits) {
  const pid = projectId || "implementaciones";
  const nombreTenant = nombre + " - " + (tenant || "(a confirmar)");
  const cuit = Array.isArray(cuits) && cuits.length ? cuits[0] : "(a definir)";
  return [
    {
      titulo: "Feature de alta del cliente",
      body: {
        issue: {
          project_id: pid,
          tracker_name: "Feature",
          assigned_to_id: ASIGNADO_ALTA_ID,
          subject: "Implementación de " + nombreTenant,
          description:
            "Feature de implementación de " + nombre +
            "\n\nEn esta tarea se vincularán todas las solicitudes al área de IT relacionadas al cliente",
        },
      },
    },
    {
      titulo: "User Story: tenant sandbox + credenciales API",
      body: {
        issue: {
          project_id: pid,
          tracker_name: "User Story",
          assigned_to_id: ASIGNADO_ALTA_ID,
          subject: "[" + nombreTenant + "] Creación de tenant sandbox",
          description:
            "Se debe crear un tenant para que prueben la carga de ventas del punto de ventas en https://cash.nubceo.com/\n" +
            "Procedimiento:\n" +
            "- Probar usuario desde la web con formato de email \"" + slug(nombre) + ".sandbox@nubceo.com\"\n" +
            "- Modificar en la base de datos el tenant_tier a cash_reconciler\n" +
            "- Asignar el CUIT seleccionado por el cliente a la Company del usuario de prueba - " + cuit + "\n" +
            "- Crear api access key (consultar por el formato)\n" +
            "- Asociar esa access api key al tenant\n" +
            "- Crear sucursal cabecera de prueba\n" +
            "- Mes de pruebas electo por el cliente: a definir",
        },
      },
    },
  ];
}

// ── Plantillas de tickets a demanda (desde el detalle del cliente, sin que el cliente entre al portal) ──

export function buildTicketMigracionVentas(nombreCliente, desde, hasta, trackerName) {
  return {
    issue: {
      tracker_name: trackerName || "Task",
      subject: "Migración de ventas de plataforma (Sales) — " + nombreCliente,
      description:
        "Migrar las ventas de la plataforma (Sales) para " + nombreCliente + ".\n" +
        "Período a migrar: del " + fmtFechaLarga(desde) + " al " + fmtFechaLarga(hasta) + ".",
    },
  };
}

export function buildTicketEliminarPos(nombreCliente, entorno, trackerName) {
  const entornoTxt = entorno === "productivo" ? "Producción" : "Sandbox";
  return {
    issue: {
      tracker_name: trackerName || "Task",
      subject: "Eliminar pos_sales y pos_payments (" + entornoTxt + ") — " + nombreCliente,
      description: "Eliminar los registros de pos_sales y pos_payments del entorno " + entornoTxt + " para " + nombreCliente + ".",
    },
  };
}

export function buildTicketCambioRolAdmin(nombreCliente, usuarios, trackerName) {
  return {
    issue: {
      tracker_name: trackerName || "Task",
      subject: "Cambio de rol a Administrador — " + nombreCliente,
      description: "Otorgar rol de Administrador a los siguientes usuarios de " + nombreCliente + ":\n" + (usuarios || "(a definir)"),
    },
  };
}

export function buildTicketLibre(nombreCliente, subject, description, trackerName) {
  return {
    issue: {
      tracker_name: trackerName || "Task",
      subject: "[" + nombreCliente + "] " + (subject || "(sin asunto)"),
      description: description || "",
    },
  };
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

// Para vincular manualmente un ticket que ya existe en Redmine (de clientes que ya tenían
// el alta hecha antes de que el portal empezara a guardar el ID real) — de paso, si el
// ticket había quedado con el tracker por defecto del proyecto (ej: "Task") en vez de
// "Feature", lo corrige. Es "mejor esfuerzo": si no se puede, no rompe nada, solo avisa.
export async function corregirTrackerDeTicket(issueId, nombreTrackerDeseado, apiKeyOverride) {
  const apiKey = apiKeyOverride || process.env.REDMINE_API_KEY;
  const { data: cfgRow } = await supabaseAdmin.from("config").select("valor").eq("clave", "redmine").maybeSingle();
  const cfg = cfgRow?.valor || {};
  const url = process.env.REDMINE_URL || cfg.url;
  if (!url || !apiKey) return " (Redmine no está configurado del lado del servidor)";
  const trackers = await resolverTrackers(url, apiKey, cfg.projectId || "implementaciones");
  const tid = trackers[nombreTrackerDeseado];
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

// parentIssueIdOverride: para tickets a demanda que cuelgan de la Feature del cliente
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
      const issue = { ...p.body.issue };
      if (cfg.projectId) issue.project_id = cfg.projectId;
      if (idPadre) issue.parent_issue_id = idPadre;
      // "tracker_name" no es un campo real de la API de Redmine (usa tracker_id numérico) —
      // se resuelve acá contra los trackers reales del proyecto; si no se encuentra, se
      // saca el campo y Redmine usa el tracker por defecto del proyecto (mejor eso que
      // que la creación falle por un campo que Redmine no reconoce).
      if (issue.tracker_name) {
        const tid = trackers[issue.tracker_name];
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
