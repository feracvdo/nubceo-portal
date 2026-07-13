// lib/redmine.js — se ejecuta SOLO en el servidor.
// La API key vive en la variable de entorno REDMINE_API_KEY, nunca llega al navegador.
import { supabaseAdmin } from "./supabaseAdmin";

export function buildRedminePayloads(nombre, tenant, codigo, projectId) {
  const pid = projectId || "implementaciones";
  return [
    {
      titulo: "Feature de alta del cliente",
      body: {
        issue: {
          project_id: pid,
          tracker_name: "Feature",
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
    for (const p of payloads) {
      const body = cfg.projectId ? { issue: { ...p.body.issue, project_id: cfg.projectId } } : p.body;
      const res = await fetch(url.replace(/\/+$/, "") + "/issues.json", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Redmine-API-Key": apiKey },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { estado: "en_cola", detalle: "Redmine respondió HTTP " + res.status + ". Queda en cola para reenviar." };
    }
    return { estado: "enviado", detalle: null };
  } catch (e) {
    return { estado: "en_cola", detalle: "No se pudo llegar a Redmine desde el servidor (" + e.message + "). Queda en cola para reenviar." };
  }
}
