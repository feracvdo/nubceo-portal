// pages/api/memoria.js
//
// Ayuda memoria: bloc de notas privado de cada persona del equipo.
// Se valida el código contra la tabla equipo, igual que el resto del portal.
// Nadie puede leer ni escribir la memoria de otro: el team_id sale siempre del
// código validado, nunca de lo que mande el navegador.

import { supabaseAdmin as db } from "../../lib/supabaseAdmin";

const LIMITE = 100000; // ~100 mil caracteres, de sobra para un anotador

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { action } = req.body || {};
  const codigo = (req.body?.codigo || "").trim().toUpperCase();
  if (!codigo) return res.status(400).json({ error: "Falta el código." });

  try {
    const { data: miembro } = await db
      .from("equipo").select("id").eq("codigo", codigo).maybeSingle();
    if (!miembro) return res.status(403).json({ error: "Código no válido." });

    if (action === "leer") {
      const { data } = await db
        .from("ayuda_memoria").select("texto, actualizado_at")
        .eq("team_id", miembro.id).maybeSingle();
      return res.json({
        texto: (data && data.texto) || "",
        actualizado: (data && data.actualizado_at) || null,
      });
    }

    if (action === "guardar") {
      const texto = String(req.body.texto ?? "");
      if (texto.length > LIMITE) return res.status(400).json({ error: "El texto es demasiado largo." });
      const actualizado = new Date().toISOString();
      await db.from("ayuda_memoria").upsert(
        { team_id: miembro.id, texto, actualizado_at: actualizado },
        { onConflict: "team_id" }
      );
      return res.json({ ok: true, actualizado });
    }

    return res.status(400).json({ error: "Acción desconocida." });
  } catch (e) {
    console.error("memoria:", e);
    return res.status(500).json({ error: "No pudimos guardar." });
  }
}
