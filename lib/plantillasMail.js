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

// Plantilla: Recordatorio de plazo (reutiliza la existente de plantillasMail)
export function mailRecordatorioPlantilla({ clienteNombre, pasoNombre, fechaLimiteTxt }) {
  return mailRecordatorio({ clienteNombre, pasoNombre, fechaLimiteTxt, portalUrl: process.env.PORTAL_URL || null, implementador: null });
}

// Plantilla: Plazo vencido (reutiliza la existente)
export function mailVencidoPlantilla({ clienteNombre, pasoNombre, fechaLimiteTxt }) {
  return mailIncumplimiento({ clienteNombre, pasoNombre, fechaLimiteTxt, portalUrl: process.env.PORTAL_URL || null, implementador: null });
}

// Plantilla: Invitación a workshop
export function mailWorkshop({ clienteNombre, fechaWorkshop, implementador }) {
  const subject = `Invitación a workshop de implementación - Nubceo Conciliador`;
  const html = envoltorio(`
    <p>Estimados/as,</p>
    <p>Es un placer invitarles al workshop de implementación de <b>Nubceo Conciliador</b> para <b>${clienteNombre}</b>.</p>
    ${fechaWorkshop ? `<p><b>Fecha programada:</b> ${fechaWorkshop}</p>` : ''}
    <p>En esta sesión nos adentraremos en los detalles técnicos de la conexión, la conciliación de medios de pago y responderemos todas las preguntas que puedan surgir. Es fundamental contar con la presencia del sponsor y el key user del proyecto.</p>
    ${botonPortal(process.env.PORTAL_URL || null)}
    ${firma(implementador)}
  `);
  return { subject, html };
}

// Plantilla: Confirmación de go-live
export function mailGoLive({ clienteNombre, implementador }) {
  const subject = `Go-live de Nubceo Conciliador - ${clienteNombre}`;
  const html = envoltorio(`
    <p>Estimados/as,</p>
    <p>¡Nos complace confirmar que estamos listos para el go-live de <b>Nubceo Conciliador</b> para <b>${clienteNombre}</b>!</p>
    <p>A partir de este momento, todas las transacciones serán procesadas a través de Nubceo. Hemos completado todas las pruebas necesarias y el sistema está funcionando correctamente.</p>
    <p>Durante las próximas 72 horas estaremos en <b>hypercare</b> — monitoreando activamente cualquier inconveniente y brindando soporte prioritario.</p>
    <p>Si surgiera cualquier problema o pregunta durante este período, no dude en contactarnos inmediatamente.</p>
    ${botonPortal(process.env.PORTAL_URL || null)}
    ${firma(implementador)}
  `);
  return { subject, html };
}

export function mailBienvenida(cliente) {
  const nombreEmpresa = cliente.nombre || 'Equipo';
  const codigoAcceso = cliente.codigoAcceso || 'CODIGO_PENDIENTE';
  const cuit = cliente.cuit && cliente.cuit.length > 0 ? cliente.cuit[0] : '';
  
  // Generar mail de sandbox a partir del nombre del cliente
  const mailSandbox = nombreEmpresa
    .toLowerCase()
    .replace(/[áéíóú]/g, (char) => {
      const acentos = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
      return acentos[char] || char;
    })
    .replace(/[^\w]+/g, '')
    .concat('.sandbox@nubceo.com');

  // Contactos por defecto (ajustar según roles asignados)
  const implementadora = cliente.team?.find(p => p.rol === 'implementadora') || {
    nombre: 'Fernanda Acevedo',
    email: 'fernanda.acevedo@nubceo.com'
  };
  
  const desarrollador = cliente.team?.find(p => p.rol === 'desarrollador') || {
    nombre: 'Santiago Suarez',
    email: 'santiago.suarez@nubceo.com'
  };
  
  const lider = cliente.team?.find(p => p.rol === 'lider') || {
    nombre: 'Silvana Mascitelli',
    email: 'silvana.mascitelli@nubceo.com'
  };

  const asunto = `Bienvenida a Nubceo — Tu acceso al portal de implementación`;
  
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Preview</title></head><body style="background:#eef4ff; padding:40px 20px;"><div style="background:#fff; max-width:600px; margin:0 auto; padding:20px; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e2433;">
  <div style="padding: 24px 0 16px; border-bottom: 2px solid #0a6bf4;">
    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAaIAAAB+CAYAAABmgBWPAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyhpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDkuMS1jMDAxIDc5LmE4ZDQ3NTM0OSwgMjAyMy8wMy8yMy0xMzowNTo0NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI0LjcgKE1hY2ludG9zaCkiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RTc4NEQ2MkY0RjkzMTFFRTlENjNBMkNFRjRDQjUyQjciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RTc4NEQ2MzA0RjkzMTFFRTlENjNBMkNFRjRDQjUyQjciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpFNzg0RDYyRDRGOTMxMUVFOUQ2M0EyQ0VGNENCNTJCNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpFNzg0RDYyRTRGOTMxMUVFOUQ2M0EyQ0VGNENCNTJCNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pu63e9QAADtVSURBVHja7H0JmFxVsfC9Vd2pNCAgJgEEHHHFwQ0Eh6BRBhFFEZcRF351BHREFAeNJI4LKhGUKIrgIIoCjgyDG4q4wygYISoIo4Dgwh8HRMGOKAbo9FJ152x3edXVXe9VvVo6npPvprqW9589dznbPYt1zhkFBQUFBYVBQUWHQEFBQUFBGZGCgoKCgjIiBQUFBQUFZUQKCgoKCsqIFBQUFBQUlBEpKCgoKCgjUlBQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFZUQKCgoKCsqIFBQUFBSUESkoKCgoKCNSUFBQUFBGpKCgoKCgjEhBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgjUlBQUFBQRqSgoKCgoIxIQUFBQUEZkYKCgoKCMiIFBQUFBQVlRAoKCgoKyogUFBQUFJQRKSgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUFBGpKCgoKCgjEhBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUFJQRKSgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgjUlBQUFBQRqSgoKCgoIxIQUFBQUEZkYKCgoKCMiIFBQUFBWVECgoKCgrKiBQUFBQUFJQRKSgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFZUQKCgoKCsqIFBQUFBSUESkoKCgoKCNSUFBQUFBGpKCgoKCgjEhBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBQRmRgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFBWVECgoKCgrKiBQUFBQUlBEpKCgoKCgoI1JQUFBQUEakoKCgoKCMSEFBQUFBGZGCgoKCgoIyIgUFBQUFZUQKCgoKCsrI/g8wAAsZFrf2Jym5AAAAAElFTkSuQmCC" alt="Nubceo" height="28" style="display:block; height:28px; width:auto;">
  </div>
  <div style="padding: 24px 0; font-size: 14px; line-height: 1.65;">
    
  <p>¡Hola, equipo de ${nombreEmpresa}!</p>
  <p>Bienvenidos a Nubceo. Es un placer darles la bienvenida al proceso de implementación de <b>Nubceo Conciliador</b> — la solución para optimizar sus procesos financieros y asegurar la precisión en las conciliaciones. Estamos muy contentos de empezar este proceso junto a ustedes.</p>

  <div style="background:#eef6ff; border:1px solid #b9d2fb; border-radius:10px; padding:18px 20px; margin:22px 0;">
    <div style="font-size:12px; font-weight:700; color:#0550c0; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px;">Tu acceso al portal de implementación</div>
    <div style="font-size:13.5px; color:#1e2433; margin-bottom:4px;">Empresa: <b>${nombreEmpresa}</b></div>
    <div style="font-size:13.5px; color:#1e2433; margin-bottom:14px;">Código de acceso: <b style="font-family: ui-monospace, Menlo, monospace; font-size:15px;">${codigoAcceso}</b></div>
    <a href="https://nubceo-portal.vercel.app" style="display:inline-block; background:#0a6bf4; color:#fff; text-decoration:none; padding:10px 20px; border-radius:8px; font-weight:600; font-size:14px;">Ingresar al portal →</a>
  </div>

  <p>Ahí vas a poder seguir el avance paso a paso, completar lo que depende de tu equipo, y agendar las reuniones con nosotros a medida que las vayas necesitando.</p>

  <p style="margin-top:24px; font-size:12px; font-weight:700; color:#0a6bf4; text-transform:uppercase; letter-spacing:0.06em;">Tus contactos en Nubceo</p>
  <div style="margin-top:6px;">
    
  <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eef0f4;">
    <div>
      <div style="font-size:13px; color:#8e96a8;">Implementadora asignada</div>
      <div style="font-size:14px; font-weight:700; color:#0d1120;">${implementadora.nombre}</div>
    </div>
    <a href="mailto:${implementadora.email}" style="font-size:12.5px; color:#0a6bf4; font-weight:600;">${implementadora.email}</a>
  </div>
    
  <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eef0f4;">
    <div>
      <div style="font-size:13px; color:#8e96a8;">Desarrollador asignado</div>
      <div style="font-size:14px; font-weight:700; color:#0d1120;">${desarrollador?.nombre || 'Por asignar'}</div>
    </div>
    ${desarrollador?.email ? `<a href="mailto:${desarrollador.email}" style="font-size:12.5px; color:#0a6bf4; font-weight:600;">${desarrollador.email}</a>` : '<span style="font-size:12.5px; color:#8e96a8;">En proceso</span>'}
  </div>
    
  <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eef0f4;">
    <div>
      <div style="font-size:13px; color:#8e96a8;">Líder de Implementaciones</div>
      <div style="font-size:14px; font-weight:700; color:#0d1120;">${lider?.nombre || 'Por asignar'}</div>
    </div>
    ${lider?.email ? `<a href="mailto:${lider.email}" style="font-size:12.5px; color:#0a6bf4; font-weight:600;">${lider.email}</a>` : '<span style="font-size:12.5px; color:#8e96a8;">En proceso</span>'}
  </div>
  </div>
  <p style="font-size:12.5px; color:#8e96a8; margin-top:10px;">También podés escribirle a tu implementadora directo desde el botón de contacto dentro del portal.</p>

  <p style="margin-top:26px; font-size:12px; font-weight:700; color:#0a6bf4; text-transform:uppercase; letter-spacing:0.06em;">Así es el proceso, paso a paso</p>
  <div style="margin-top:12px;">
    
    <div style="display:flex; gap:12px; margin-bottom:14px;">
      <div style="width:24px; height:24px; border-radius:50%; flex-shrink:0; background:#0a6bf4; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">1</div>
      <div>
        <div style="font-size:13.5px; font-weight:700; color:#0d1120;">Procesadoras</div>
        <div style="font-size:13px; color:#4b5468; line-height:1.5; margin-top:2px;">Nos contás con qué plataformas cobrás y en qué estado está cada conexión. Con eso pedimos los accesos correctos desde el arranque.</div>
      </div>
    </div>
    <div style="display:flex; gap:12px; margin-bottom:14px;">
      <div style="width:24px; height:24px; border-radius:50%; flex-shrink:0; background:#0a6bf4; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">2</div>
      <div>
        <div style="font-size:13.5px; font-weight:700; color:#0d1120;">Relevamiento</div>
        <div style="font-size:13px; color:#4b5468; line-height:1.5; margin-top:2px;">Un formulario sobre cómo vendés y cobrás, más quiénes están involucrados del lado de tu empresa (sponsor y key user). Con tus respuestas armamos el mapa de tu operación y preparamos el workshop, que agendás ahí mismo al terminarlo.</div>
      </div>
    </div>
    <div style="display:flex; gap:12px; margin-bottom:14px;">
      <div style="width:24px; height:24px; border-radius:50%; flex-shrink:0; background:#0a6bf4; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">3</div>
      <div>
        <div style="font-size:13.5px; font-weight:700; color:#0d1120;">Sucursales</div>
        <div style="font-size:13px; color:#4b5468; line-height:1.5; margin-top:2px;">Cargás tu listado interno de sucursales y el portal lo convierte al formato oficial de Nubceo, validado y listo para subir a la plataforma.</div>
      </div>
    </div>
    <div style="display:flex; gap:12px; margin-bottom:14px;">
      <div style="width:24px; height:24px; border-radius:50%; flex-shrink:0; background:#0a6bf4; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">4</div>
      <div>
        <div style="font-size:13.5px; font-weight:700; color:#0d1120;">Conexión API o CSV</div>
        <div style="font-size:13px; color:#4b5468; line-height:1.5; margin-top:2px;">Definimos cómo van a llegar tus ventas a Nubceo. Si es por API, ahí tenés tus credenciales, la documentación técnica y la reunión con nuestro equipo de desarrollo. Si es por CSV, el portal valida tu archivo y lo deja en el formato exacto.</div>
      </div>
    </div>
    <div style="display:flex; gap:12px; margin-bottom:14px;">
      <div style="width:24px; height:24px; border-radius:50%; flex-shrink:0; background:#0a6bf4; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">5</div>
      <div>
        <div style="font-size:13.5px; font-weight:700; color:#0d1120;">Capacitación</div>
        <div style="font-size:13px; color:#4b5468; line-height:1.5; margin-top:2px;">Acceso a los manuales de Nubceo y agenda de capacitaciones de Conciliador y de Nubceo Cash para tu equipo.</div>
      </div>
    </div>
    <div style="display:flex; gap:12px; margin-bottom:14px;">
      <div style="width:24px; height:24px; border-radius:50%; flex-shrink:0; background:#0a6bf4; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">6</div>
      <div>
        <div style="font-size:13.5px; font-weight:700; color:#0d1120;">Pruebas en sandbox</div>
        <div style="font-size:13px; color:#4b5468; line-height:1.5; margin-top:2px;">Probamos la conciliación con tus datos reales en un entorno de pruebas. Te mostramos los resultados en una reunión y dejamos la minuta ahí mismo.</div>
      </div>
    </div>
    <div style="display:flex; gap:12px; margin-bottom:14px;">
      <div style="width:24px; height:24px; border-radius:50%; flex-shrink:0; background:#0a6bf4; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">7</div>
      <div>
        <div style="font-size:13.5px; font-weight:700; color:#0d1120;">Go-live</div>
        <div style="font-size:13px; color:#4b5468; line-height:1.5; margin-top:2px;">Pasamos todo a producción, repasamos reglas y resultados, y arranca el acompañamiento de hypercare.</div>
      </div>
    </div>
  </div>

  <p style="margin-top:22px;">Un pedido importante: recordá cargar en el portal a las personas de tu equipo involucradas en la implementación (sponsor, key user, y quien más haga falta) — lo hacés en el paso de Relevamiento, ni bien entrés.</p>

  <p style="margin-top:24px;">Ante cualquier duda, escribinos por acá o directo a tu implementadora. ¡Arrancamos!</p>

  <p style="margin: 24px 0 0;">
    Saludos,<br/>
    <b>Equipo de Implementaciones — Nubceo</b>
  </p>

  </div>
  <div style="padding: 16px 0; border-top: 1px solid #d8dce6; font-size: 12px; color: #8e96a8; line-height: 1.6;">
    Portal de Implementaciones de Nubceo
  </div>
</div></div></body></html>`;

  return {
    subject: asunto,
    html: html,
    cuit: cuit,
    mailSandbox: mailSandbox,
  };
}
