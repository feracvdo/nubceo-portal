// pages/api/autoimp.js
//
// API del autoimplementador. Es la única puerta entre la guía y la base.
//
// Reglas que nos pusimos y conviene sostener:
//  - De las tablas del portal SOLO leemos (clientes, equipo). Nunca escribimos.
//  - No llamamos a /api/portal: su assemble() recalcula y avanza la fase del
//    cliente, y no queremos disparar eso desde la guía.
//  - Lo nuestro vive en tablas con prefijo auto_.

import { supabaseAdmin as db } from "../../lib/supabaseAdmin";

const norm = (c) => (c || "").trim().toUpperCase();

// Busca el cliente por su código de acceso del portal. Devuelve null si no existe.
async function buscarCliente(codigo) {
  const { data } = await db
    .from("clientes")
    .select("id, codigo, nombre, razon_social, implementador_id")
    .eq("codigo", codigo)
    .maybeSingle();
  return data || null;
}

async function implementadorDe(cliente) {
  if (!cliente?.implementador_id) return null;
  const { data } = await db
    .from("equipo")
    .select("nombre, email")
    .eq("id", cliente.implementador_id)
    .maybeSingle();
  return data || null;
}

async function progresoDe(codigo) {
  const { data } = await db
    .from("auto_progreso")
    .select("*")
    .eq("cliente_codigo", codigo)
    .maybeSingle();
  return data || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { action, quien } = req.body || {};
  const codigo = norm(req.body?.codigo);

  try {
    if (!codigo) return res.status(400).json({ error: "Falta el código de acceso." });

    const cliente = await buscarCliente(codigo);
    if (!cliente) {
      return res.status(404).json({ error: "No encontramos ese código. Revisalo o escribinos." });
    }

    // ── Entrar: valida el código y devuelve todo el estado de una ──
    if (action === "entrar") {
      const [impl, prog, coms] = await Promise.all([
        implementadorDe(cliente),
        progresoDe(codigo),
        db.from("auto_comentarios").select("paso, nivel, comentario").eq("cliente_codigo", codigo),
      ]);

      // Primera entrada: dejamos la fila creada para que el arranque quede fechado.
      if (!prog) {
        await db.from("auto_progreso").insert({ cliente_codigo: codigo, pasos: {} });
      }

      return res.json({
        cliente: {
          nombre: cliente.razon_social || cliente.nombre,
          implementador: impl?.nombre || null,
          implementadorEmail: impl?.email || null,
        },
        progreso: prog || { pasos: {}, origen: null, api_desarrolla: null },
        comentarios: coms.data || [],
      });
    }

    // ── Guardar progreso: un paso, el origen de las ventas o quién desarrolla ──
    if (action === "guardar") {
      const prog = (await progresoDe(codigo)) || { pasos: {} };
      const pasos = { ...(prog.pasos || {}) };

      if (typeof req.body.paso === "number") {
        if (req.body.hecho) {
          pasos[req.body.paso] = {
            hecho: true,
            quien: (quien || "").trim() || null,
            at: new Date().toISOString(),
          };
        } else {
          delete pasos[req.body.paso];
        }
      }

      const upd = {
        cliente_codigo: codigo,
        pasos,
        actualizado_at: new Date().toISOString(),
      };
      if (req.body.origen !== undefined) upd.origen = req.body.origen || null;
      if (req.body.apiDesarrolla !== undefined) upd.api_desarrolla = req.body.apiDesarrolla || null;

      // Se considera terminado cuando están todos los pasos marcados.
      const totalPasos = Number(req.body.totalPasos) || 0;
      const hechos = Object.values(pasos).filter((p) => p && p.hecho).length;
      upd.finalizado_at = totalPasos && hechos >= totalPasos ? new Date().toISOString() : null;

      await db.from("auto_progreso").upsert(upd, { onConflict: "cliente_codigo" });
      return res.json({ ok: true, pasos, finalizado: !!upd.finalizado_at });
    }

    // ── Comentario de un paso: la escala es obligatoria, el texto no ──
    if (action === "comentario") {
      const paso = Number(req.body.paso);
      const nivel = req.body.nivel;
      if (!Number.isInteger(paso)) return res.status(400).json({ error: "Paso inválido." });
      if (!["facil", "normal", "costo", "trabe"].includes(nivel)) {
        return res.status(400).json({ error: "Elegí cómo te resultó el paso." });
      }
      await db.from("auto_comentarios").upsert(
        {
          cliente_codigo: codigo,
          paso,
          nivel,
          comentario: (req.body.comentario || "").trim() || null,
          quien: (quien || "").trim() || null,
          creado_at: new Date().toISOString(),
        },
        { onConflict: "cliente_codigo,paso" }
      );
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "Acción desconocida." });
  } catch (e) {
    console.error("autoimp:", e);
    return res.status(500).json({ error: "No pudimos guardar. Probá de nuevo en un momento." });
  }
}
