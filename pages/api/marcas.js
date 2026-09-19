// pages/api/marcas.js
//
// Marcas de color por cliente, privadas de cada persona del equipo.
// Se valida el código contra la tabla equipo, igual que el resto del portal:
// nadie puede leer ni escribir las marcas de otro.

import { supabaseAdmin as db } from "../../lib/supabaseAdmin";

const norm = (c) => (c || "").trim().toUpperCase();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { action } = req.body || {};
  const codigo = norm(req.body?.codigo);
  if (!codigo) return res.status(400).json({ error: "Falta el código." });

  try {
    const { data: miembro } = await db
      .from("equipo").select("id, nombre").eq("codigo", codigo).maybeSingle();
    if (!miembro) return res.status(403).json({ error: "Código no válido." });

    // Todas las marcas de esta persona, de una sola vez.
    if (action === "listar") {
      const { data } = await db
        .from("marcas_cliente").select("cliente_codigo, color").eq("team_id", miembro.id);
      const marcas = {};
      (data || []).forEach((m) => { marcas[m.cliente_codigo] = m.color; });
      return res.json({ marcas });
    }

    // Poner o sacar la marca de un cliente. color null = sin marca.
    if (action === "marcar") {
      const cc = norm(req.body.clienteCodigo);
      const color = req.body.color || null;
      if (!cc) return res.status(400).json({ error: "Falta el cliente." });
      if (color && !["naranja", "rojo"].includes(color)) {
        return res.status(400).json({ error: "Color inválido." });
      }

      if (!color) {
        await db.from("marcas_cliente").delete()
          .eq("team_id", miembro.id).eq("cliente_codigo", cc);
      } else {
        await db.from("marcas_cliente").upsert({
          team_id: miembro.id,
          cliente_codigo: cc,
          color,
          actualizado_at: new Date().toISOString(),
        }, { onConflict: "team_id,cliente_codigo" });
      }
      return res.json({ ok: true, color });
    }

    return res.status(400).json({ error: "Acción desconocida." });
  } catch (e) {
    console.error("marcas:", e);
    return res.status(500).json({ error: "No pudimos guardar la marca." });
  }
}
