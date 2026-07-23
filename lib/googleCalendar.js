// lib/googleCalendar.js
// Integración real con Google Calendar por REST (sin el SDK googleapis, para no sumar
// dependencias pesadas). Solo se importa desde rutas de API (servidor) — nunca del navegador.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar";

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

// Crea el evento real e invita a todos los asistentes (Google les manda el mail de invitación).
export async function createEvent(access_token, calendarId, { summary, description, startISO, endISO, attendees }) {
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
        attendees: (attendees || []).filter((a) => a.email).map((a) => ({ email: a.email, displayName: a.nombre })),
      }),
    }
  );
  if (!res.ok) throw new Error("No se pudo crear el evento en Google Calendar: " + (await res.text()));
  return res.json(); // incluye id, htmlLink
}
