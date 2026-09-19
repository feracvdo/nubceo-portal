// pages/api/chat.js
//
// Chat interno para el equipo: responde sobre el estado de los clientes leyendo
// las tablas del portal.
//
// Criterios:
//  - Solo lectura. El modelo no puede escribir nada en la base.
//  - No hay SQL libre: el modelo elige entre las herramientas de abajo, que son
//    consultas que escribimos nosotros. Lo que no está acá, no lo puede pedir.
//  - Solo entra gente del equipo, validada contra la tabla `equipo`.
//
// Necesita la variable de entorno ANTHROPIC_API_KEY en Vercel.

import { supabaseAdmin as db } from "../../lib/supabaseAdmin";

const MODELO = "claude-sonnet-5";
const MAX_VUELTAS = 6;

const FASES = [
  "Vinculación", "Introducción", "Relevamiento", "Workshop", "Integración API/CSV",
  "Configuración de reglas y secuencias", "Capacitación", "Go-Live", "Hypercare",
];

const dias = (iso) => (iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null);
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString("es-AR") : null);

// ─────────────── Herramientas ───────────────

const HERRAMIENTAS = [
  {
    name: "listar_clientes",
    description:
      "Lista los clientes en implementación con su estado resumido. Sirve para preguntas generales " +
      "(cuántos hay, quiénes están trabados, qué tiene tal implementador) y para encontrar el código " +
      "exacto de un cliente antes de pedir su detalle. Devuelve como máximo 80 clientes.",
    input_schema: {
      type: "object",
      properties: {
        buscar: { type: "string", description: "Texto parcial del nombre o del código del cliente." },
        implementador: { type: "string", description: "Nombre del implementador asignado." },
        sin_actividad_dias: { type: "number", description: "Solo los que no tienen actividad hace al menos estos días." },
      },
    },
  },
  {
    name: "detalle_cliente",
    description:
      "Todo el estado de un cliente: fase, responsables, fechas, contrato, finanzas, procesadoras, " +
      "avance del relevamiento y plazos con su cumplimiento. Usá el código exacto que devuelve listar_clientes.",
    input_schema: {
      type: "object",
      properties: { codigo: { type: "string", description: "Código de acceso del cliente." } },
      required: ["codigo"],
    },
  },
  {
    name: "notas_cliente",
    description:
      "Notas internas del equipo sobre un cliente y su historial de actividad reciente. " +
      "Es lo que hay que mirar para saber qué se le pidió, qué se reclamó o qué fue lo último que se hizo.",
    input_schema: {
      type: "object",
      properties: { codigo: { type: "string" } },
      required: ["codigo"],
    },
  },
  {
    name: "reuniones_cliente",
    description: "Reuniones agendadas y realizadas de un cliente, con fecha, responsable, invitados y minuta.",
    input_schema: {
      type: "object",
      properties: { codigo: { type: "string" } },
      required: ["codigo"],
    },
  },
];

async function equipoPorId() {
  const { data } = await db.from("equipo").select("id, nombre");
  const m = {};
  (data || []).forEach((e) => { m[e.id] = e.nombre; });
  return m;
}

async function ejecutar(nombre, args) {
  if (nombre === "listar_clientes") {
    const eq = await equipoPorId();
    const { data } = await db
      .from("clientes")
      .select("codigo, nombre, razon_social, fase, implementador_id, desarrollador_id, ultima_actividad, go_live_estimado, estado_contrato, estado_seguimiento, archivado_at")
      .order("nombre");

    let lista = (data || []).filter((c) => !c.archivado_at);

    const q = (args.buscar || "").trim().toLowerCase();
    if (q) lista = lista.filter((c) =>
      (c.nombre || "").toLowerCase().includes(q) ||
      (c.razon_social || "").toLowerCase().includes(q) ||
      (c.codigo || "").toLowerCase().includes(q));

    const imp = (args.implementador || "").trim().toLowerCase();
    if (imp) lista = lista.filter((c) => (eq[c.implementador_id] || "").toLowerCase().includes(imp));

    if (args.sin_actividad_dias) {
      lista = lista.filter((c) => (dias(c.ultima_actividad) ?? 9999) >= args.sin_actividad_dias);
    }

    return {
      total: lista.length,
      clientes: lista.slice(0, 80).map((c) => ({
        codigo: c.codigo,
        nombre: c.razon_social || c.nombre,
        fase: FASES[c.fase] || c.fase,
        implementador: eq[c.implementador_id] || "sin asignar",
        dias_sin_actividad: dias(c.ultima_actividad),
        go_live_estimado: c.go_live_estimado || null,
      })),
    };
  }

  const codigo = (args.codigo || "").trim().toUpperCase();
  const { data: cli } = await db.from("clientes").select("*").eq("codigo", codigo).maybeSingle();
  if (!cli) return { error: "No existe un cliente con el código " + codigo };
  const eq = await equipoPorId();

  if (nombre === "detalle_cliente") {
    const [procs, plazos, rele] = await Promise.all([
      db.from("procesadoras_cliente").select("*").eq("cliente_id", cli.id),
      db.from("plazos_cliente").select("*").eq("cliente_id", cli.id),
      db.from("relevamientos").select("*").eq("cliente_id", cli.id).maybeSingle(),
    ]);

    return {
      codigo: cli.codigo,
      nombre: cli.razon_social || cli.nombre,
      fase: FASES[cli.fase] || cli.fase,
      implementador: eq[cli.implementador_id] || "sin asignar",
      desarrollador: eq[cli.desarrollador_id] || "sin asignar",
      tenant: cli.tenant_productivo || null,
      fecha_ingreso: cli.fecha_ingreso || null,
      go_live_estimado: cli.go_live_estimado || null,
      dias_sin_actividad: dias(cli.ultima_actividad),
      ultima_actividad: fecha(cli.ultima_actividad),
      estado_contrato: cli.estado_contrato || null,
      estado_pago: cli.estado_pago || null,
      erp_pdv: cli.erp_pdv || null,
      relevamiento_enviado: !!(rele.data && rele.data.enviado_at),
      procesadoras: (procs.data || []).map((p) => p.nombre + " (" + p.estado + ")"),
      plazos: (plazos.data || []).map((p) => ({
        paso: p.paso,
        fecha_limite: p.fecha_limite,
        cumplimiento: p.cumplimiento || "sin confirmar",
        recordatorio_enviado: !!p.recordatorio_enviado,
      })),
    };
  }

  if (nombre === "notas_cliente") {
    const [notas, hist] = await Promise.all([
      db.from("notas_internas").select("*").eq("cliente_id", cli.id).order("creado_at", { ascending: false }).limit(30),
      db.from("historial").select("*").eq("cliente_id", cli.id).order("creado_at", { ascending: false }).limit(40),
    ]);
    return {
      cliente: cli.razon_social || cli.nombre,
      notas: (notas.data || []).map((n) => ({
        fecha: fecha(n.creado_at), quien: n.quien || n.who || null, texto: n.texto || n.txt,
      })),
      actividad_reciente: (hist.data || []).map((h) => ({
        fecha: fecha(h.creado_at), quien: h.quien || null, texto: h.texto,
      })),
    };
  }

  if (nombre === "reuniones_cliente") {
    const { data } = await db.from("eventos").select("*").eq("cliente_id", cli.id).order("fecha");
    return {
      cliente: cli.razon_social || cli.nombre,
      reuniones: (data || []).filter((e) => e.estado !== "cancelado").map((e) => ({
        tipo: e.tipo,
        fecha: e.fecha ? new Date(e.fecha).toLocaleString("es-AR") : null,
        estado: e.estado,
        responsable: e.responsable,
        invitados: (e.invitados || []).map((p) => p.nombre),
        minuta: e.minuta || null,
      })),
    };
  }

  return { error: "Herramienta desconocida." };
}

// ─────────────── Handler ───────────────

const SISTEMA = `Sos el asistente interno del equipo de Implementaciones de Nubceo, dentro del portal que usa el equipo.

Respondés preguntas sobre el estado de los clientes consultando las herramientas disponibles.

Cómo respondés:
- Español rioplatense, con voseo. Tono directo y de colega, sin formalidad innecesaria.
- Breve. Una o dos frases cuando alcanza. Nada de listas si no aportan.
- Siempre basado en datos que consultaste. Si no consultaste, consultá antes de responder.
- Si el dato no está, decilo sin rodeos en vez de suponer.
- Mencioná fechas y días concretos cuando los tengas: "hace 12 días" dice más que "hace tiempo".

Lo que NO podés saber, y conviene aclarar cuando te lo pregunten:
- El contenido de los mails con los clientes. Hoy cada implementador escribe desde su casilla personal y eso no está en el portal.
- Nada que haya pasado fuera del portal y que nadie haya anotado.

Si te preguntan por un cliente y no sabés cuál es exactamente, usá listar_clientes para encontrarlo antes de responder. Si hay varios que coinciden, preguntá cuál.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const codigo = (req.body?.codigo || "").trim().toUpperCase();
  const mensajes = Array.isArray(req.body?.mensajes) ? req.body.mensajes : null;
  if (!codigo || !mensajes) return res.status(400).json({ error: "Faltan datos." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." });
  }

  try {
    const { data: miembro } = await db
      .from("equipo").select("id, nombre").eq("codigo", codigo).maybeSingle();
    if (!miembro) return res.status(403).json({ error: "Código no válido." });

    // Historial acotado: las últimas 16 entradas alcanzan para mantener el hilo.
    const conversacion = mensajes.slice(-16).map((m) => ({ role: m.role, content: m.content }));

    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODELO,
          max_tokens: 1200,
          system: SISTEMA + "\n\nEstás hablando con " + (miembro.nombre || "alguien del equipo") + ".",
          tools: HERRAMIENTAS,
          messages: conversacion,
        }),
      });

      if (!r.ok) {
        const detalle = await r.text();
        console.error("chat anthropic:", r.status, detalle);
        return res.status(500).json({ error: "El asistente no está disponible en este momento." });
      }

      const data = await r.json();
      conversacion.push({ role: "assistant", content: data.content });

      if (data.stop_reason !== "tool_use") {
        const texto = (data.content || [])
          .filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        return res.json({ respuesta: texto || "No pude armar una respuesta. Probá de nuevo." });
      }

      const pedidos = (data.content || []).filter((b) => b.type === "tool_use");
      const resultados = [];
      for (const p of pedidos) {
        let salida;
        try { salida = await ejecutar(p.name, p.input || {}); }
        catch (e) { console.error("chat herramienta:", e); salida = { error: "No se pudo consultar." }; }
        resultados.push({ type: "tool_result", tool_use_id: p.id, content: JSON.stringify(salida) });
      }
      conversacion.push({ role: "user", content: resultados });
    }

    return res.json({ respuesta: "Me quedé dando vueltas con esa consulta. Probá preguntarlo de otra forma." });
  } catch (e) {
    console.error("chat:", e);
    return res.status(500).json({ error: "No pudimos procesar la consulta." });
  }
}
