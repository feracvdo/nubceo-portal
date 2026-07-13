// lib/redmine.js — se ejecuta SOLO en el servidor.
// La API key vive en la variable de entorno REDMINE_API_KEY, nunca llega al navegador.
import { supabaseAdmin } from "./supabaseAdmin";

// Eduardo André (id 241 en Redmine) recibe siempre las altas — él las reparte
// después con Santiago Suarez según corresponda.
const ASIGNADO_ALTA_ID = 241;

export function buildRedminePayloads(nombre, tenant, codigo, projectId) {
  const pid = projectId || "implementaciones";
  return [
    {
      titulo: "Feature de alta del cliente",
      body: {
        issue: {
          project_id: pid,
          tracker_name: "Feature",
          assigned_to_id: ASIGNADO_ALTA_ID,
          subject: "[Implementación] Alta de cliente: " + nombre,
          description:
            "Alta automática disparada desde el portal de implementaciones.\nCliente: " + nombre +
            "\nTenant productivo (original): " + (tenant || "(a confirmar)") +
            "\nCódigo de portal: " + codigo,
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
          subject: "US: Alta tenant sandbox réplica del productivo — " + nombre,
          description:
            "Crear el tenant sandbox como réplica del tenant productivo '" + (tenant || "(a confirmar)") +
            "' y generar las credenciales de API (key + secret) del cliente para carga de ventas.",
        },
      },
    },
  ];
}

export async function sendToRedmine(payloads, apiKeyOverride) {
  const apiKey = apiKeyOverride || process.env.REDMINE_API_KEY;
  const { data: cfgRow } = await supabaseAdmin.from("config").select("valor").eq("clave", "redmine").maybeSingle();
  const cfg = cfgRow?.valor || {};
  const url = process.env.REDMINE_URL || cfg.url;
  if (!url || !apiKey) {
    return { estado: "en_cola", detalle: "Falta configurar REDMINE_URL / REDMINE_API_KEY en las variables de entorno. Los tickets quedan en cola con el payload listo." };
  }
  try {
    // Se crean en orden: cada ticket queda como "padre" del siguiente, empezando por
    // cfg.parentIssueId si está configurado (Configuración → Integración con Redmine).
    // Esto resuelve tanto el caso de "la User Story exige padre" como el caso de
    // "la Feature en sí exige padre" (algunos trackers de Redmine lo piden siempre,
    // sin importar que sea el ticket raíz de la implementación).
    let idPadre = cfg.parentIssueId ? Number(cfg.parentIssueId) : null;
    for (const p of payloads) {
      const issue = { ...p.body.issue };
      if (cfg.projectId) issue.project_id = cfg.projectId;
      if (idPadre) issue.parent_issue_id = idPadre;
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
        return { estado: "en_cola", detalle: "Redmine respondió HTTP " + res.status + (motivo ? ": " + motivo : "") + ". Queda en cola para reenviar." };
      }
      try { const creado = await res.json(); idPadre = creado?.issue?.id || idPadre; } catch (e) { /* si no vino el id, seguimos con el padre que ya teníamos */ }
    }
    return { estado: "enviado", detalle: null };
  } catch (e) {
    return { estado: "en_cola", detalle: "No se pudo llegar a Redmine desde el servidor (" + e.message + "). Queda en cola para reenviar." };
  }
}
