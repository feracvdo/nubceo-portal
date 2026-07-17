// pages/api/add-contact.js
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { cliente_id, nombre, email, rol } = req.body;
  if (!cliente_id || !nombre || !email) {
    return res.status(400).json({ error: "Faltan datos (cliente_id, nombre, email)" });
  }

  try {
    const { data, error } = await db.from("involucrados").insert({
      cliente_id,
      nombre: nombre.trim(),
      email: email.trim(),
      rol: rol || "otro",
    }).select().single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true, contacto: data });
  } catch (e) {
    console.error("Error en add-contact:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
