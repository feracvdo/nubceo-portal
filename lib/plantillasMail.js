// lib/plantillasMail.js
// Plantillas de mail de Implementaciones — estética de marca Nubceo (logo, navy/cyan),
// tono formal argentino (voseo cordial). Centraliza TODAS las plantillas y expone:
//   - generarPlantilla(plantilla, datos) -> { subject, html }  (usado por la UI: preview y envío)
//   - mailRecordatorio / mailIncumplimiento (usados por avisosPlazos.js — firmas preservadas)
// Envío por Resend (ver lib/email.js y pages/api/send-mail.js).

const LOGO_NUBCEO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAaIAAAB+CAYAAABmgBWPAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDkuMS1jMDAxIDc5LmE4ZDQ3NTM0OSwgMjAyMy8wMy8yMy0xMzowNTo0NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI0LjcgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RTc4NEQ2MkY0RjkzMTFFRTlENjNBMkNFRjRDQjUyQjciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RTc4NEQ2MzA0RjkzMTFFRTlENjNBMkNFRjRDQjUyQjciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpFNzg0RDYyRDRGOTMxMUVFOUQ2M0EyQ0VGNENCNTJCNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpFNzg0RDYyRTRGOTMxMUVFOUQ2M0EyQ0VGNENCNTJCNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pu63e9QAADtVSURBVHja7H0JmFxVsfC9Vd2pNCAgJgEEHHHFwQ0Eh6BRBhFFEZcRF351BHREFAeNJI4LKhGUKIrgIIoCjgyDG4q4wygYISoIo4Dgwh8HRMGOKAbo9FJ152x3edXVXe9VvVo6npPvprqW9589dznbPYt1zhkFBQUFBYVBQUWHQEFBQUFBGZGCgoKCgjIiBQUFBQUFZUQKCgoKCsqIFBQUFBQUlBEpKCgoKCgjUlBQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFZUQKCgoKCsqIFBQUFBSUESkoKCgoKCNSUFBQUFBGpKCgoKCgjEhBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgjUlBQUFBQRqSgoKCgoIxIQUFBQUEZkYKCgoKCMiIFBQUFBQVlRAoKCgoKyogUFBQUFJQRKSgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUFBGpKCgoKCgjEhBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUFJQRKSgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgjUlBQUFBQRqSgoKCgoIxIQUFBQUEZkYKCgoKCMiIFBQUFBWVECgoKCgrKiBQUFBQUFJQRKSgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFZUQKCgoKCsqIFBQUFBSUESkoKCgoKCNSUFBQUFBGpKCgoKCgjEhBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFZUQKCgoKCsrI/g8wAAsZFrf2Jym5AAAAAElFTkSuQmCC";
const PORTAL_URL_DEFAULT = "https://nubceo-portal.vercel.app";

// Líder de Implementaciones por defecto (se puede sobrescribir pasando datos.lider).
const LIDER_DEFAULT = { nombre: "Silvana Mascitelli", email: "silvana.mascitelli@nubceo.com" };

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Bloques reutilizables ────────────────────────────────────────────────
function bloqueContacto(rotulo, persona) {
  if (!persona || !persona.nombre) return "";
  const email = persona.email
    ? `<a href="mailto:${esc(persona.email)}" style="font-size:12.5px; color:#0a6bf4; font-weight:600; text-decoration:none;">${esc(persona.email)}</a>`
    : `<span style="font-size:12.5px; color:#8e96a8;">Por asignar</span>`;
  return `
  <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eef0f4;">
    <div>
      <div style="font-size:13px; color:#8e96a8;">${esc(rotulo)}</div>
      <div style="font-size:14px; font-weight:700; color:#0d1120;">${esc(persona.nombre)}</div>
    </div>
    ${email}
  </div>`;
}

function bloqueContactos(datos) {
  const impl = datos.implementador;
  const dev = datos.desarrollador;
  const lider = datos.lider || LIDER_DEFAULT;
  const filas = [
    bloqueContacto("Implementador/a asignado/a", impl),
    bloqueContacto("Desarrollador/a asignado/a", dev),
    bloqueContacto("Líder de Implementaciones", lider),
  ].filter(Boolean).join("");
  if (!filas) return "";
  return `
  <p style="margin-top:26px; margin-bottom:0; font-size:12px; font-weight:700; color:#0a6bf4; text-transform:uppercase; letter-spacing:0.06em;">Sus contactos en Nubceo</p>
  <div style="margin-top:6px;">${filas}</div>`;
}

function bloqueAcceso(datos) {
  const portal = datos.portalUrl || PORTAL_URL_DEFAULT;
  const codigo = datos.codigoAcceso
    ? `<div style="font-size:13.5px; color:#1e2433; margin-bottom:14px;">Código de acceso: <b style="font-family: ui-monospace, Menlo, monospace; font-size:15px;">${esc(datos.codigoAcceso)}</b></div>`
    : `<div style="font-size:13.5px; color:#8e96a8; margin-bottom:14px;">Su código de acceso se lo compartimos por este medio.</div>`;
  return `
  <div style="background:#eef6ff; border:1px solid #b9d2fb; border-radius:10px; padding:18px 20px; margin:22px 0;">
    <div style="font-size:12px; font-weight:700; color:#0550c0; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px;">Acceso al portal de implementación</div>
    <div style="font-size:13.5px; color:#1e2433; margin-bottom:4px;">Empresa: <b>${esc(datos.clienteNombre || "")}</b></div>
    ${codigo}
    <a href="${esc(portal)}" style="display:inline-block; background:#0a6bf4; color:#fff; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:600; font-size:14px;">Ingresar al portal &rarr;</a>
  </div>`;
}

// Envoltorio completo con header (logo), cuerpo, y pie. Los bloques de acceso y
// contactos se incluyen dentro de `cuerpoHtml` según cada plantilla.
function envoltorio(cuerpoHtml) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Nubceo</title></head><body style="background:#eef4ff; padding:40px 20px; margin:0;"><div style="background:#fff; max-width:600px; margin:0 auto; padding:20px 24px; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e2433;">
  <div style="padding: 24px 0 16px; border-bottom: 2px solid #0a6bf4;">
    <img src="${LOGO_NUBCEO}" alt="Nubceo" height="28" style="display:block; height:28px; width:auto;">
  </div>
  <div style="padding: 24px 0; font-size: 14px; line-height: 1.65;">
${cuerpoHtml}
  </div>
  <div style="padding: 16px 0; border-top: 1px solid #d8dce6; font-size: 12px; color: #8e96a8; line-height: 1.6;">
    Portal de Implementaciones de Nubceo. Si ya realizó esta acción, puede ignorar este mensaje &mdash; el sistema lo reflejará en las próximas horas.
  </div>
</div></div></body></html>`;
}

function firma() {
  return `
  <p style="margin: 26px 0 0;">
    Saludos cordiales,<br/>
    <b>Equipo de Implementaciones &mdash; Nubceo</b>
  </p>`;
}

// ── Pasos del proceso (para la bienvenida) ───────────────────────────────
const PASOS_PROCESO = [
  ["Procesadoras", "Nos cuenta con qué plataformas cobra y en qué estado está cada conexión. Con eso solicitamos los accesos correctos desde el arranque."],
  ["Relevamiento", "Un formulario sobre cómo vende y cobra su negocio, más las personas involucradas de su empresa (sponsor y key user). Con sus respuestas armamos el mapa de su operación y preparamos el workshop, que agenda ahí mismo al terminarlo."],
  ["Sucursales", "Carga su listado interno de sucursales y el portal lo convierte al formato oficial de Nubceo, validado y listo para subir a la plataforma."],
  ["Conexión API o CSV", "Definimos cómo van a llegar sus ventas a Nubceo. Si es por API, el portal lo guía para generar las credenciales en Nubceo y coordinar la reunión técnica. Si es por CSV, valida su archivo y lo deja en el formato exacto."],
  ["Capacitación", "Acceso a los manuales de Nubceo y agenda de capacitaciones de Conciliador y de Nubceo Cash para su equipo."],
  ["Pruebas en sandbox", "Probamos la conciliación con sus datos reales en un entorno de pruebas. Le mostramos los resultados en una reunión y dejamos la minuta ahí mismo."],
  ["Go-live", "Pasamos todo a producción, repasamos reglas y resultados, y arranca el acompañamiento de hypercare."],
];

function bloquePasos() {
  const items = PASOS_PROCESO.map(([t, d], i) => `
    <div style="display:flex; gap:12px; margin-bottom:14px;">
      <div style="width:24px; height:24px; border-radius:50%; flex-shrink:0; background:#0a6bf4; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">${i + 1}</div>
      <div>
        <div style="font-size:13.5px; font-weight:700; color:#0d1120;">${t}</div>
        <div style="font-size:13px; color:#4b5468; line-height:1.5; margin-top:2px;">${d}</div>
      </div>
    </div>`).join("");
  return `
  <p style="margin-top:26px; font-size:12px; font-weight:700; color:#0a6bf4; text-transform:uppercase; letter-spacing:0.06em;">Así es el proceso, paso a paso</p>
  <div style="margin-top:12px;">${items}</div>`;
}

// ── Plantillas de la UI ──────────────────────────────────────────────────
function plantillaBienvenida(datos) {
  const nombre = datos.clienteNombre || "su equipo";
  const subject = "Bienvenidos a Nubceo — su acceso al portal de implementación";
  const cuerpo = `
  <p>Estimados/as,</p>
  <p>Es un placer darles la bienvenida al proceso de implementación de <b>Nubceo Conciliador</b> &mdash; la solución para optimizar sus procesos financieros y asegurar la precisión en las conciliaciones. Estamos muy contentos de comenzar este proceso junto a <b>${esc(nombre)}</b>.</p>
  ${bloqueAcceso(datos)}
  <p>Desde el portal van a poder seguir el avance paso a paso, completar lo que depende de su equipo y agendar las reuniones con nosotros a medida que las necesiten.</p>
  ${bloqueContactos(datos)}
  ${bloquePasos()}
  <p style="margin-top:22px;">Un pedido importante: recuerden cargar en el portal a las personas de su equipo involucradas en la implementación (sponsor, key user y quien más haga falta) &mdash; lo hacen en el paso de Relevamiento, ni bien ingresen.</p>
  <p style="margin-top:20px;">Ante cualquier consulta, quedamos a su entera disposición.</p>
  ${firma()}`;
  return { subject, html: envoltorio(cuerpo) };
}

function plantillaRecordatorio(datos) {
  const nombre = datos.clienteNombre || "su equipo";
  const paso = datos.pasoNombre ? ` del paso «${esc(datos.pasoNombre)}»` : "";
  const subject = `Recordatorio — pasos pendientes en su implementación de Nubceo${datos.pasoNombre ? ` («${datos.pasoNombre}»)` : ""}`;
  const cuerpo = `
  <p>Estimados/as,</p>
  <p>Nos comunicamos desde Nubceo para recordarles que su implementación del Conciliador de <b>${esc(nombre)}</b> tiene tareas pendientes${paso}${datos.fechaLimiteTxt ? `, con fecha límite <b>${esc(datos.fechaLimiteTxt)}</b>` : ""}.</p>
  <p>Les solicitamos completarlas a la brevedad, a fin de no afectar el cronograma acordado. Pueden ingresar al portal con el código de acceso que les compartimos oportunamente.</p>
  ${bloqueAcceso(datos)}
  ${bloqueContactos(datos)}
  <p style="margin-top:20px;">Si surgió algún inconveniente que dificulte avanzar, les pedimos que nos lo hagan saber para poder acompañarlos.</p>
  ${firma()}`;
  return { subject, html: envoltorio(cuerpo) };
}

function plantillaVencido(datos) {
  const nombre = datos.clienteNombre || "su equipo";
  const paso = datos.pasoNombre ? ` «${esc(datos.pasoNombre)}»` : "";
  const subject = `Plazo vencido — tarea pendiente en su implementación de Nubceo${datos.pasoNombre ? ` («${datos.pasoNombre}»)` : ""}`;
  const cuerpo = `
  <p>Estimados/as,</p>
  <p>Les escribimos para informarles que el plazo establecido para completar la tarea${paso} de la implementación del Conciliador de <b>${esc(nombre)}</b>${datos.fechaLimiteTxt ? ` <b>venció el ${esc(datos.fechaLimiteTxt)}</b>` : " se encuentra vencido"} y, a la fecha, continúa pendiente.</p>
  <p>Les solicitamos completarla a la brevedad posible, dado que su demora impacta en el cronograma general de la implementación.</p>
  ${bloqueAcceso(datos)}
  ${bloqueContactos(datos)}
  <p style="margin-top:20px;">Si surgió algún inconveniente, quedamos a disposición para acompañarlos y encontrar una solución.</p>
  ${firma()}`;
  return { subject, html: envoltorio(cuerpo) };
}

function plantillaWorkshop(datos) {
  const nombre = datos.clienteNombre || "su equipo";
  const subject = "Invitación al workshop de implementación — Nubceo Conciliador";
  const cuerpo = `
  <p>Estimados/as,</p>
  <p>Tenemos el agrado de invitarlos al <b>workshop de implementación</b> de Nubceo Conciliador para <b>${esc(nombre)}</b>.</p>
  ${datos.fechaWorkshop ? `<p><b>Fecha propuesta:</b> ${esc(datos.fechaWorkshop)}</p>` : ""}
  <p>En esta sesión repasaremos el funcionamiento de la plataforma, la conciliación de medios de pago y el estado de la conexión, y responderemos todas las consultas que puedan surgir. Es fundamental contar con la presencia del sponsor y del key user del proyecto.</p>
  <p>Pueden confirmar y agendar la reunión directamente desde el portal.</p>
  ${bloqueAcceso(datos)}
  ${bloqueContactos(datos)}
  ${firma()}`;
  return { subject, html: envoltorio(cuerpo) };
}

function plantillaGoLive(datos) {
  const nombre = datos.clienteNombre || "su equipo";
  const subject = `Coordinación de go-live — Nubceo Conciliador (${esc(nombre)})`;
  const cuerpo = `
  <p>Estimados/as,</p>
  <p>Nos complace informarles que estamos próximos al <b>go-live</b> de Nubceo Conciliador para <b>${esc(nombre)}</b>.</p>
  <p>A partir de la puesta en producción, las conciliaciones se realizarán sobre el entorno productivo. Durante los primeros días acompañaremos con <b>hypercare</b>, monitoreando activamente y brindando soporte prioritario.</p>
  <p>Desde el portal pueden ver el detalle de esta etapa y coordinar la reunión de cierre.</p>
  ${bloqueAcceso(datos)}
  ${bloqueContactos(datos)}
  <p style="margin-top:20px;">Ante cualquier consulta durante este período, quedamos a su entera disposición.</p>
  ${firma()}`;
  return { subject, html: envoltorio(cuerpo) };
}

const _UI = {
  bienvenida: plantillaBienvenida,
  recordatorio: plantillaRecordatorio,
  vencido: plantillaVencido,
  workshop: plantillaWorkshop,
  golive: plantillaGoLive,
};

// Dispatcher usado por la UI (preview-mail y send-mail).
export function generarPlantilla(plantilla, datos = {}) {
  const fn = _UI[plantilla];
  if (!fn) return null;
  return fn(datos);
}

export const PLANTILLAS_DISPONIBLES = [
  { id: "bienvenida", nombre: "Mail de bienvenida" },
  { id: "recordatorio", nombre: "Recordatorio" },
  { id: "vencido", nombre: "Plazo vencido" },
  { id: "workshop", nombre: "Invitación a workshop" },
  { id: "golive", nombre: "Coordinación de go-live" },
];

// ── Compatibilidad: firmas usadas por avisosPlazos.js (NO CAMBIAR) ─────────
export function mailRecordatorio({ clienteNombre, pasoNombre, fechaLimiteTxt, portalUrl, implementador }) {
  return plantillaRecordatorio({ clienteNombre, pasoNombre, fechaLimiteTxt, portalUrl, implementador });
}
export function mailIncumplimiento({ clienteNombre, pasoNombre, fechaLimiteTxt, portalUrl, implementador }) {
  return plantillaVencido({ clienteNombre, pasoNombre, fechaLimiteTxt, portalUrl, implementador });
}
