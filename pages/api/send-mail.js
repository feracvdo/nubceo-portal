// pages/api/send-mail.js
// Envía el mail por Resend usando la MISMA plantilla que la vista previa
// (lib/plantillasMail.js), de modo que el asunto y el HTML sean consistentes.
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";
import { generarPlantilla } from "../../lib/plantillasMail";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { cliente_id, plantilla, datos, destinatarios } = req.body || {};

  if (!cliente_id) return res.status(400).json({ error: "Falta cliente_id" });
  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return res.status(400).json({ error: "No hay destinatarios seleccionados" });
  }

  // Generamos asunto + html desde la plantilla (fuente única de verdad).
  const generado = generarPlantilla(plantilla, datos || {});
  // Fallback: si por algún motivo llega contenido/asunto ya armado, lo respetamos.
  const asunto = (generado && generado.subject) || req.body.asunto;
  const contenido = (generado && generado.html) || req.body.contenido;

  if (!asunto || !contenido) {
    return res.status(400).json({ error: "Plantilla no válida o sin contenido" });
  }

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || process.env.MAIL_FROM || "Nubceo <notificaciones@nubceo.com>",
      to: destinatarios,
      subject: asunto,
      html: contenido,
    });

    if (result.error) {
      throw new Error(result.error.message || "Resend rechazó el envío");
    }

    const { data, error } = await db.from("mailsEnviados").insert({
      cliente_id,
      plantilla: plantilla || null,
      asunto,
      destinatarios,
      estado: "enviado",
      contenido,
    }).select().single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true, mail: data });
  } catch (e) {
    console.error("Error en send-mail:", e.message);
    try {
      await db.from("mailsEnviados").insert({
        cliente_id, plantilla: plantilla || null, asunto,
        destinatarios, estado: "error", error_msg: e.message,
      });
    } catch (e2) { /* silencio */ }
    return res.status(500).json({ error: e.message });
  }
}
