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

// Bitácora: append-only. Nunca frena la respuesta si falla.
async function registrar(codigo, email, accion, paso, detalle) {
  try {
    await db.from("auto_eventos").insert({
      cliente_codigo: codigo,
      email: email || null,
      paso: paso === undefined ? null : paso,
      accion,
      detalle: detalle || null,
    });
  } catch (e) {
    console.error("autoimp bitácora:", e);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { action } = req.body || {};
  const email = ((req.body || {}).email || "").trim().toLowerCase() || null;
  const codigo = norm(req.body?.codigo);

  try {
    if (!codigo) return res.status(400).json({ error: "Falta el código de acceso." });

    // ─────────── Acciones internas (equipo de Nubceo) ───────────
    if (action && action.startsWith("panel")) {
      const { data: miembro } = await db
        .from("equipo")
        .select("id, nombre, email")
        .eq("codigo", codigo)
        .maybeSingle();

      if (!miembro) return res.status(403).json({ error: "Código no válido." });

      if (action === "panelEntrar") return res.json({ miembro });

      if (action === "panelDatos") {
        const [prog, coms, cls] = await Promise.all([
          db.from("auto_progreso").select("*"),
          db.from("auto_comentarios").select("*").order("creado_at", { ascending: false }),
          db.from("clientes").select("codigo, nombre, razon_social, implementador_id").order("nombre"),
        ]);

        const progPorCodigo = {};
        (prog.data || []).forEach((f) => { progPorCodigo[f.cliente_codigo] = f; });

        const ids = [...new Set((cls.data || []).map((c) => c.implementador_id).filter(Boolean))];
        const impl = {};
        if (ids.length) {
          const { data: eq } = await db.from("equipo").select("id, nombre").in("id", ids);
          (eq || []).forEach((e) => { impl[e.id] = e.nombre; });
        }

        // Se listan todos los clientes del portal: los habilitados para ver su
        // avance, y el resto para poder habilitarlos.
        const clientes = (cls.data || []).map((c) => {
          const f = progPorCodigo[c.codigo] || null;
          const pasos = (f && f.pasos) || {};
          const hechos = Object.keys(pasos).filter((k) => pasos[k] && pasos[k].hecho).map(Number);
          return {
            codigo: c.codigo,
            nombre: c.razon_social || c.nombre,
            implementador: impl[c.implementador_id] || null,
            habilitado: !!(f && f.habilitado),
            hechos,
            origen: f ? f.origen : null,
            apiDesarrolla: f ? f.api_desarrolla : null,
            iniciado: f ? f.iniciado_at : null,
            finalizado: f ? f.finalizado_at : null,
            actualizado: f ? f.actualizado_at : null,
            entro: !!f && (hechos.length > 0 || !!f.origen),
          };
        });

        return res.json({ clientes, comentarios: coms.data || [] });
      }

      // Prender o apagar el acceso de un cliente a la guía
      if (action === "panelHabilitar") {
        const cc = norm(req.body.clienteCodigo);
        const hab = !!req.body.habilitado;
        if (!cc) return res.status(400).json({ error: "Falta el cliente." });

        const { data: existente } = await db
          .from("auto_progreso").select("cliente_codigo").eq("cliente_codigo", cc).maybeSingle();

        if (existente) {
          await db.from("auto_progreso")
            .update({ habilitado: hab, actualizado_at: new Date().toISOString() })
            .eq("cliente_codigo", cc);
        } else {
          await db.from("auto_progreso").insert({ cliente_codigo: cc, pasos: {}, habilitado: hab });
        }

        await registrar(cc, miembro.email, hab ? "habilitado" : "deshabilitado", null,
          (hab ? "Habilitado" : "Deshabilitado") + " por " + (miembro.nombre || miembro.email));
        return res.json({ ok: true });
      }

      // Reset: un paso puntual o toda la configuración del cliente
      if (action === "panelReset") {
        const cc = norm(req.body.clienteCodigo);
        if (!cc) return res.status(400).json({ error: "Falta el cliente." });

        const { data: prog } = await db
          .from("auto_progreso").select("*").eq("cliente_codigo", cc).maybeSingle();
        if (!prog) return res.status(404).json({ error: "Ese cliente no tiene progreso cargado." });

        const paso = req.body.paso;
        let pasos = { ...(prog.pasos || {}) };
        if (Number.isInteger(paso)) {
          delete pasos[paso];
        } else {
          pasos = {};
        }

        await db.from("auto_progreso").update({
          pasos,
          finalizado_at: null,
          actualizado_at: new Date().toISOString(),
          ...(Number.isInteger(paso) ? {} : { origen: null, api_desarrolla: null }),
        }).eq("cliente_codigo", cc);

        await registrar(
          cc, miembro.email, "reset",
          Number.isInteger(paso) ? paso : null,
          "Reiniciado por " + (miembro.nombre || miembro.email)
        );
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: "Acción desconocida." });
    }
    // ────────────────────────────────────────────────────────────

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

      // La guía no se abre sola: un implementador tiene que habilitar al cliente
      // desde el panel. Sin fila habilitada, no hay acceso.
      if (!prog || !prog.habilitado) {
        return res.status(403).json({
          error: "Tu guía todavía no está habilitada. Escribile a tu referente de Nubceo para que te dé acceso.",
        });
      }
      await registrar(codigo, email, "entro");

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
          pasos[req.body.paso] = { hecho: true, email, at: new Date().toISOString() };
        } else {
          delete pasos[req.body.paso];
        }
        await registrar(codigo, email, req.body.hecho ? "marco" : "desmarco", req.body.paso);
      }

      const upd = {
        cliente_codigo: codigo,
        pasos,
        actualizado_at: new Date().toISOString(),
      };
      if (req.body.origen !== undefined) {
        upd.origen = req.body.origen || null;
        if (upd.origen) await registrar(codigo, email, "origen", null, upd.origen);
      }
      if (req.body.apiDesarrolla !== undefined) {
        upd.api_desarrolla = req.body.apiDesarrolla || null;
        if (upd.api_desarrolla) await registrar(codigo, email, "api", null, upd.api_desarrolla);
      }

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
          email,
          creado_at: new Date().toISOString(),
        },
        { onConflict: "cliente_codigo,paso" }
      );
      await registrar(codigo, email, "comentario", paso, nivel);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "Acción desconocida." });
  } catch (e) {
    console.error("autoimp:", e);
    return res.status(500).json({ error: "No pudimos guardar. Probá de nuevo en un momento." });
  }
}
