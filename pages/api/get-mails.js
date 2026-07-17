// pages/api/get-mails.js
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  const { cliente_id } = req.query;
  if (!cliente_id) return res.status(400).json({ error: "Falta cliente_id" });

  try {
    const [{ data: mails }, { data: contactos }] = await Promise.all([
      db.from("mailsEnviados").select("*").eq("cliente_id", cliente_id).order("enviado_at", { ascending: false }),
      db.from("involucrados").select("*").eq("cliente_id", cliente_id).order("nombre"),
    ]);

    return res.json({
      mails: mails || [],
      contactos: contactos || [],
    });
  } catch (e) {
    console.error("Error en get-mails:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
