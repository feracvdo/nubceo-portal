// pages/api/retry-mail.js
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { mail_id } = req.body;
  if (!mail_id) return res.status(400).json({ error: "Falta mail_id" });

  try {
    const { data: mail, error: errFetch } = await db.from("mailsEnviados").select("*").eq("id", mail_id).maybeSingle();
    if (errFetch || !mail) return res.status(404).json({ error: "Mail no encontrado" });

    // Reintenta envío
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: mail.destinatarios.join(","),
      subject: mail.asunto,
      html: mail.contenido || "",
    });

    // Actualiza estado
    await db.from("mailsEnviados").update({ estado: "enviado", error_msg: null }).eq("id", mail_id);

    return res.json({ ok: true, message: "Mail reenviado exitosamente" });
  } catch (e) {
    console.error("Error en retry-mail:", e.message);
    // Guarda el error
    await db.from("mailsEnviados").update({ estado: "error", error_msg: e.message }).eq("id", mail_id);
    return res.status(500).json({ error: e.message });
  }
}
