// pages/api/calendar-callback.js
// Google redirige acá después de que el implementador/a autoriza su calendario.
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";
import { exchangeCode, getUserEmail } from "../../lib/googleCalendar";

const ADMIN_CODE = process.env.ADMIN_CODE || "NUBCEO-EQUIPO";

async function esEquipo(codigo) {
  if (!codigo) return false;
  if (codigo === ADMIN_CODE) return true;
  const { data } = await db.from("equipo").select("id").eq("codigo", codigo).maybeSingle();
  return !!data;
}

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  if (error) return res.redirect(302, "/?calendar=error&motivo=" + encodeURIComponent(String(error)));
  if (!code || !state) return res.redirect(302, "/?calendar=error");

  let responsable, sessionCode;
  try {
    const parsed = JSON.parse(Buffer.from(String(state), "base64").toString("utf8"));
    responsable = parsed.responsable;
    sessionCode = parsed.sessionCode;
  } catch (e) {
    return res.redirect(302, "/?calendar=error");
  }

  try {
    if (!(await esEquipo(sessionCode))) return res.redirect(302, "/?calendar=sinpermiso");

    const tok = await exchangeCode(code);
    if (!tok.refresh_token) {
      // Pasa si Google ya había autorizado antes esta cuenta sin "prompt=consent" persistido.
      return res.redirect(302, "/?calendar=sinrefresh");
    }
    const email = await getUserEmail(tok.access_token);

    await db.from("calendar_conexiones").upsert(
      {
        responsable,
        google_email: email,
        refresh_token: tok.refresh_token,
        conectado_por: sessionCode,
        conectado_at: new Date().toISOString(),
      },
      { onConflict: "responsable" }
    );

    return res.redirect(302, "/?calendar=ok&responsable=" + encodeURIComponent(responsable));
  } catch (e) {
    console.error(e);
    return res.redirect(302, "/?calendar=error");
  }
}
