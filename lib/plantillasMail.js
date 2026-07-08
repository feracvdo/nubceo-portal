// lib/plantillasMail.js
// Plantillas de mail — tono formal argentino (registro "usted"), para recordatorios
// e incumplimientos de plazo en la implementación del Conciliador.
const envoltorio = (cuerpoHtml) => `
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e2433;">
  <div style="padding: 24px 0 16px; border-bottom: 2px solid #0a6bf4;">
    <span style="font-size: 20px; font-weight: 700; color: #02265c; letter-spacing: -0.02em;">nubceo</span>
  </div>
  <div style="padding: 24px 0; font-size: 14px; line-height: 1.65;">
    ${cuerpoHtml}
  </div>
  <div style="padding: 16px 0; border-top: 1px solid #d8dce6; font-size: 12px; color: #8e96a8; line-height: 1.6;">
    Este es un mensaje automático del Portal de Implementaciones de Nubceo. Si ya completó este paso, puede ignorar este mensaje — el sistema lo va a reflejar en las próximas horas.
  </div>
</div>`;

const firma = (implementador) => `
  <p style="margin: 24px 0 0;">Ante cualquier consulta, quedamos a su disposición.</p>
  <p style="margin: 16px 0 0;">
    Saludos cordiales,<br/>
    <b>${implementador?.nombre ? implementador.nombre + " — " : ""}Equipo de Implementaciones</b><br/>
    Nubceo${implementador?.email ? ` · <a href="mailto:${implementador.email}" style="color:#0a6bf4;">${implementador.email}</a>` : ""}
  </p>`;

const botonPortal = (portalUrl) => portalUrl ? `
  <p style="margin: 20px 0;">
    <a href="${portalUrl}" style="display:inline-block; background:#0a6bf4; color:#fff; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:600; font-size:14px;">Ingresar al portal de implementación</a>
  </p>` : "";

export function mailRecordatorio({ clienteNombre, pasoNombre, fechaLimiteTxt, portalUrl, implementador }) {
  const subject = `Recordatorio — resta 1 día para completar «${pasoNombre}» en su implementación de Nubceo`;
  const html = envoltorio(`
    <p>Estimados/as,</p>
    <p>Nos comunicamos desde Nubceo para recordarles que <b>resta 1 (un) día</b> para completar el paso <b>«${pasoNombre}»</b> dentro del proceso de implementación del Conciliador de <b>${clienteNombre}</b>.</p>
    <p><b>Fecha límite:</b> ${fechaLimiteTxt}</p>
    <p>Le solicitamos completar este paso a la brevedad, a fin de no afectar el cronograma acordado. Puede ingresar al portal de implementación con el código de acceso que le fue oportunamente compartido.</p>
    ${botonPortal(portalUrl)}
    ${firma(implementador)}
  `);
  return { subject, html };
}

export function mailIncumplimiento({ clienteNombre, pasoNombre, fechaLimiteTxt, portalUrl, implementador }) {
  const subject = `Plazo vencido — paso «${pasoNombre}» pendiente en su implementación de Nubceo`;
  const html = envoltorio(`
    <p>Estimados/as,</p>
    <p>Les escribimos para informarles que el plazo establecido para completar el paso <b>«${pasoNombre}»</b> de la implementación del Conciliador de <b>${clienteNombre}</b> <b>venció el ${fechaLimiteTxt}</b> y, a la fecha, continúa pendiente.</p>
    <p>Le solicitamos completarlo a la brevedad posible, dado que su demora impacta en el cronograma general de la implementación. Si surgió algún inconveniente que esté dificultando este paso, le pedimos que nos lo haga saber para poder acompañarlos.</p>
    ${botonPortal(portalUrl)}
    ${firma(implementador)}
  `);
  return { subject, html };
}
