// lib/plantillasMail.js
// Plantillas de mail de Implementaciones — estética de marca Nubceo (logo, navy/cyan),
// tono formal argentino (voseo cordial). Centraliza TODAS las plantillas y expone:
//   - generarPlantilla(plantilla, datos) -> { subject, html }  (usado por la UI: preview y envío)
//   - mailRecordatorio / mailIncumplimiento (usados por avisosPlazos.js — firmas preservadas)
// Envío por Resend (ver lib/email.js y pages/api/send-mail.js).

const LOGO_NUBCEO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAaIAAAB+CAYAAABmgBWPAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDkuMS1jMDAxIDc5LmE4ZDQ3NTM0OSwgMjAyMy8wMy8yMy0xMzowNTo0NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI0LjcgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RTc4NEQ2MkY0RjkzMTFFRTlENjNBMkNFRjRDQjUyQjciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RTc4NEQ2MzA0RjkzMTFFRTlENjNBMkNFRjRDQjUyQjciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpFNzg0RDYyRDRGOTMxMUVFOUQ2M0EyQ0VGNENCNTJCNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpFNzg0RDYyRTRGOTMxMUVFOUQ2M0EyQ0VGNENCNTJCNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pu63e9QAADtVSURBVHja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";
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
