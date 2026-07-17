// pages/api/send-mail.js
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { cliente_id, plantilla, asunto, destinatarios, contenido } = req.body;
  if (!cliente_id || !asunto || !destinatarios || !Array.isArray(destinatarios) || destinatarios.length === 0) {
    return res.status(400).json({ error: "Faltan datos (cliente_id, asunto, destinatarios)" });
  }

  try {
    // Envía el mail con Resend
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@nubceo.com",
      to: destinatarios,
      subject: asunto,
      html: contenido || "",
    });

    if (!result.id) {
      throw new Error(result.error?.message || "Error enviando mail con Resend");
    }

    // Guarda en historial
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
    // Guarda el error en BD
    try {
      await db.from("mailsEnviados").insert({
        cliente_id,
        plantilla: plantilla || null,
        asunto,
        destinatarios,
        estado: "error",
        error_msg: e.message,
      });
    } catch (e2) { /* silencio */ }
    return res.status(500).json({ error: e.message });
  }
}
