// lib/googleCalendar.js
// Integración real con Google Calendar por REST (sin el SDK googleapis, para no sumar
// dependencias pesadas). Solo se importa desde rutas de API (servidor) — nunca del navegador.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.compose";

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error("Falta la variable de entorno " + name + " (configuración de Google Calendar)");
  return v;
}

// URL a la que mandamos al implementador/a para que autorice su calendario.
// `state` viaja y vuelve tal cual (acá va responsable + código de sesión, en base64).
export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: env("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    access_type: "offline",   // para recibir refresh_token
    prompt: "consent",        // fuerza a que Google lo mande siempre, no solo la primera vez
    scope: SCOPE,
    state,
  });
  return AUTH_URL + "?" + params.toString();
}

export async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: env("GOOGLE_REDIRECT_URI"), grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("Google rechazó el código de autorización: " + (await res.text()));
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

export async function refreshAccessToken(refresh_token) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token, client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("No se pudo renovar el acceso a Google Calendar: " + (await res.text()));
  return res.json(); // { access_token, expires_in, ... }
}

export async function getUserEmail(access_token) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: "Bearer " + access_token },
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j.email || null;
}

// Devuelve los bloques ocupados del calendario entre timeMin y timeMax (ISO strings).
export async function freeBusy(access_token, calendarId, timeMin, timeMax) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + access_token },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });
  if (!res.ok) throw new Error("No se pudo consultar la disponibilidad real en Google Calendar: " + (await res.text()));
  const j = await res.json();
  return (j.calendars && j.calendars[calendarId] && j.calendars[calendarId].busy) || [];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Crea el evento real e invita a los asistentes con email válido (Google les manda la
// invitación). Los invitados sin email o con email mal formado se descartan en silencio,
// para que un dato inválido no haga fallar toda la sincronización del evento.
export async function createEvent(access_token, calendarId, { summary, description, startISO, endISO, attendees }) {
  const invitados = (attendees || [])
    .filter((a) => a && a.email && EMAIL_RE.test(String(a.email).trim()))
    .map((a) => ({ email: String(a.email).trim(), displayName: a.nombre }));
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events?sendUpdates=all",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + access_token },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: startISO },
        end: { dateTime: endISO },
        attendees: invitados,
      }),
    }
  );
  if (!res.ok) throw new Error("No se pudo crear el evento en Google Calendar: " + (await res.text()));
  return res.json(); // incluye id, htmlLink
}


// ── Gmail: crea un BORRADOR (no envía) con el HTML del template y los destinatarios.
// El envío siempre lo hace la persona a mano desde Gmail. Requiere el scope gmail.compose
// (la persona debe reconectar su Google en Mi perfil para otorgarlo).
function b64url(str) {
  return Buffer.from(str, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}
export async function createGmailDraft(access_token, { to, subject, html }) {
  const destinatarios = (to || []).filter(Boolean).join(", ");
  const asuntoMime = "=?UTF-8?B?" + b64(subject || "") + "?=";
  const mime = [
    "To: " + destinatarios,
    "Subject: " + asuntoMime,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(html || ""),
  ].join("\r\n");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + access_token },
    body: JSON.stringify({ message: { raw: b64url(mime) } }),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 403 || /insufficient|scope/i.test(txt)) {
      throw new Error("SCOPE_GMAIL"); // hay que reconectar Google para dar permiso de Gmail
    }
    throw new Error("Gmail rechazó la creación del borrador: " + txt);
  }
  return res.json(); // { id, message: { id, threadId } }
}
