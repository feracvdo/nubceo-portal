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
