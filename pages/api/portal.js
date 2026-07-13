// pages/api/portal.js
// Única puerta de entrada del portal a la base de datos.
// El navegador nunca toca Supabase directo: cada request valida el
// código de sesión y el service role hace el trabajo (RLS bloquea el resto).
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";
import { buildRedminePayloads, sendToRedmine } from "../../lib/redmine";
import { buildDiagrama } from "../../lib/diagrama";
import * as gcal from "../../lib/googleCalendar";
import { calcularPasos, faseSugerida } from "../../lib/pasos";
import { hitosPara, calcularHitos, NOMBRE_HITO_GENERICO } from "../../lib/hitos";
import { procesarAvisoPlazo } from "../../lib/avisosPlazos";
import crypto from "crypto";

const ADMIN_CODE = process.env.ADMIN_CODE || "NUBCEO-EQUIPO";
const rnd = (len) => crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);

// Responsables cuyo calendario se puede sincronizar (mismas claves que config.disponibilidad)
const RESPONSABLES_CALENDARIO = ["Implementaciones", "Eduardo Andre", "Santiago Suarez", "Mariana Macri"];
const NOMBRES_EVENTO_SRV = {
  workshop: "Workshop de relevamiento", reunion_tecnica: "Reunión técnica de API",
  capacitacion_conciliador: "Capacitación Conciliador", capacitacion_cash: "Capacitación Nubceo Cash",
  resultados_sandbox: "Presentación de resultados sandbox", golive: "Evento de go-live",
  workshop_cierre: "Workshop de cierre",
};

// Devuelve un access_token fresco para el calendario de un responsable, o null si no está conectado.
async function getCalendarConnection(responsable) {
  const { data } = await db.from("calendar_conexiones").select("*").eq("responsable", responsable).maybeSingle();
  if (!data) return null;
  try {
    const tok = await gcal.refreshAccessToken(data.refresh_token);
    return { access_token: tok.access_token, calendarId: data.google_email };
  } catch (e) {
    return null; // token revocado o vencido: se trata como "no conectado" (cae a la disponibilidad estática)
  }
}

// Genera credenciales de API: si hay endpoint de Nubceo configurado lo consume;
// si no, genera placeholders sandbox (se reemplazan cuando devs exponga el generador).
async function generarCredenciales(cliente) {
  const { data: cfgRow } = await db.from("config").select("valor").eq("clave", "nubceo").maybeSingle();
  const keygenUrl = process.env.NUBCEO_KEYGEN_URL || cfgRow?.valor?.keygenUrl;
  if (keygenUrl) {
    try {
      const res = await fetch(keygenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.NUBCEO_KEYGEN_TOKEN ? { Authorization: "Bearer " + process.env.NUBCEO_KEYGEN_TOKEN } : {}) },
        body: JSON.stringify({ cliente: cliente.nombre, tenant: cliente.tenant_productivo, entorno: "sandbox" }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.key && j.secret) return { api_key: j.key, api_secret: j.secret, origen: "nubceo" };
      }
    } catch (e) { /* cae al placeholder */ }
  }
  return { api_key: "nub_sbx_" + rnd(24), api_secret: rnd(48), origen: "placeholder" };
}


function codigoEquipoValido(codigo) {
  if (!codigo || codigo.length < 8) return "El código del equipo debe tener al menos 8 caracteres.";
  if (!/[A-Z]/i.test(codigo) || !/[0-9]/.test(codigo)) return "El código del equipo debe combinar letras y números.";
  return null;
}

async function isTeam(code) {
  if (!code) return false;
  if (code === ADMIN_CODE) return true;
  const { data } = await db.from("equipo").select("id").eq("codigo", code).maybeSingle();
  return !!data;
}

// El código maestro (ADMIN_CODE) siempre es superadmin (acceso de emergencia); además,
// cualquier fila de equipo puede tener es_superadmin=true para dar el mismo nivel a una
// persona puntual sin compartir el código maestro.
async function esSuperadmin(code) {
  if (!code) return false;
  if (code === ADMIN_CODE) return true;
  const { data } = await db.from("equipo").select("tipo_usuario, es_superadmin").eq("codigo", code).maybeSingle();
  if (!data) return false;
  return data.tipo_usuario === "superuser" || !!data.es_superadmin;
}

// Tipos de usuario del portal — decide quién puede hacer qué.
// superuser: todo (eliminar usuarios, archivar/restaurar clientes, cambiar tipos)
// admin: crea clientes y usuarios (admin o colaborador), asigna, no elimina
// colaborador: ve todo, trabaja sus clientes, no crea usuarios ni clientes
async function tipoUsuario(code) {
  if (!code) return null;
  if (code === ADMIN_CODE) return "superuser";
  const { data } = await db.from("equipo").select("tipo_usuario, es_superadmin").eq("codigo", code).maybeSingle();
  if (!data) return null;
  if (data.tipo_usuario) return data.tipo_usuario;
  return data.es_superadmin ? "superuser" : "admin"; // fallback pre-migración
}
const puedeCrearUsuarios = (t) => t === "superuser" || t === "admin";
const puedeCrearClientes = (t) => t === "superuser" || t === "admin";

async function getCliente(code) {
  const { data } = await db.from("clientes").select("*").eq("codigo", code).maybeSingle();
  return data;
}

// ── Tablas → objeto que consume el componente del portal ──
async function assemble(cliente) {
  const cid = cliente.id;
  const [rv, suc, arch, creds, procs, inv, evs, prue, rm, hist, notas, plazos] = await Promise.all([
    db.from("relevamientos").select("*").eq("cliente_id", cid).maybeSingle(),
    db.from("sucursales").select("*").eq("cliente_id", cid).order("creado_at"),
    db.from("archivos").select("*").eq("cliente_id", cid),
    db.from("credenciales_api").select("*").eq("cliente_id", cid).eq("entorno", "sandbox").maybeSingle(),
    db.from("procesadoras_cliente").select("*").eq("cliente_id", cid).order("nombre"),
    db.from("involucrados").select("*").eq("cliente_id", cid).order("nombre"),
    db.from("eventos").select("*").eq("cliente_id", cid).order("fecha"),
    db.from("pruebas").select("*").eq("cliente_id", cid),
    db.from("redmine_altas").select("*").eq("cliente_id", cid).maybeSingle(),
    db.from("historial").select("*").eq("cliente_id", cid).order("creado_at", { ascending: false }).limit(200),
    db.from("notas_internas").select("*").eq("cliente_id", cid).order("creado_at", { ascending: false }),
    db.from("plazos_cliente").select("*").eq("cliente_id", cid),
  ]);
  // Se calcula acá mismo (en vez de llamar a calcularPasos()) reusando los datos que
  // assemble() ya trajo — así no se duplican 5 queries en cada acción del portal.
  const archivosArr = arch.data || [];
  const eventosArr = evs.data || [];
  const respuestasObj = rv.data?.respuestas || {};
  const ventasFile = archivosArr.find((a) => a.tipo === "ventas");
  const ventasOkFlag = !!(ventasFile && ventasFile.validacion?.ok !== false);
  const tieneApiFlag = !!creds.data;
  const tieneEventoFn = (tipo, realizado) => eventosArr.some((e) => e.tipo === tipo && e.estado !== "cancelado" && (!realizado || e.estado === "realizado"));
  const pasosCompletos = {
    // Alcanza con que UNA procesadora esté "conectado" — igual criterio que calcularPasos().
    procesadoras: (procs.data || []).some((p) => p.estado === "conectado"),
    introduccion: !!cliente.intro_leida,
    relevamiento: !!rv.data?.enviado_at,
    sucursales: archivosArr.some((a) => a.tipo === "sucursales"),
    conexion: respuestasObj.d1 === "api" ? tieneApiFlag : respuestasObj.d1 === "csv" ? ventasOkFlag : respuestasObj.d1 === "ambos" ? (tieneApiFlag && ventasOkFlag) : false,
    capacitacion: tieneEventoFn("capacitacion_conciliador") || tieneEventoFn("capacitacion_cash"),
    sandbox: tieneEventoFn("resultados_sandbox", true),
    golive: tieneEventoFn("golive", true),
  };
  const hitosCompletos = calcularHitos(cliente, pasosCompletos, { procesadoras: procs.data || [], eventos: eventosArr, pruebas: Object.fromEntries((prue.data || []).map((p) => [p.etapa, p])) });

  // Auto-avance de fase: la fase sugerida es cuántos pasos seguidos (desde el principio)
  // están completos — así no da saltos raros si algo se completa fuera de orden. Nunca
  // retrocede solo, y el equipo puede pisarlo en cualquier momento a mano desde el tablero.
  const faseSug = faseSugerida(pasosCompletos);
  let faseActual = cliente.fase;
  if (faseSug > faseActual) {
    await db.from("clientes").update({ fase: faseSug }).eq("id", cid);
    faseActual = faseSug;
  }
  const archivos = arch.data || [];
  const fArch = (tipo) => {
    const a = archivos.find((x) => x.tipo === tipo);
    return a ? { name: a.nombre, size: a.tamanio, ts: a.subido_at, dataUrl: a.contenido, validacion: a.validacion } : undefined;
  };
  let implementador = null;
  if (cliente.implementador_id) {
    const { data: impl } = await db.from("equipo").select("id, nombre, email").eq("id", cliente.implementador_id).maybeSingle();
    implementador = impl || null;
  }
  let desarrollador = null;
  if (cliente.desarrollador_id) {
    const { data: dev } = await db.from("equipo").select("id, nombre, email").eq("id", cliente.desarrollador_id).maybeSingle();
    desarrollador = dev || null;
  }
  return {
    meta: {
      implementadorId: implementador?.id || null, implementadorNombre: implementador?.nombre || null, implementadorEmail: implementador?.email || null,
      desarrolladorId: desarrollador?.id || null, desarrolladorNombre: desarrollador?.nombre || null, desarrolladorEmail: desarrollador?.email || null,
      name: cliente.nombre, razonSocial: cliente.razon_social || null, cuits: cliente.cuits || [], logo: cliente.logo || null,
      comercial: cliente.comercial || null,
      goLiveEstimado: cliente.go_live_estimado || null,
      tenant: cliente.tenant_productivo, phase: faseActual, createdAt: cliente.creado_at, introLeida: cliente.intro_leida, sucursalesOmitido: cliente.sucursales_omitido,
      apiDesarrolloCompleto: !!cliente.api_desarrollo_completo,
      finanzas: {
        fee: cliente.fee, moneda: cliente.moneda || "ARS", costoImplementacion: cliente.costo_implementacion,
        estadoPago: cliente.estado_pago || "al_dia", deudaDesde: cliente.deuda_desde, notas: cliente.finanzas_notas,
      },
    },
    data: {
      relevamiento: rv.data?.respuestas || {},
      relevamientoEnviado: rv.data?.enviado_at || null,
      diagrama: rv.data?.diagrama || null,
      procesadoras: (procs.data || []).map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, pais: p.pais, estado: p.estado })),
      involucrados: (inv.data || []).map((p) => ({ id: p.id, nombre: p.nombre, cargo: p.cargo || "", email: p.email, telefono: p.telefono || "", rol: p.rol })),
      eventos: (evs.data || []).map((e) => ({ id: e.id, tipo: e.tipo, fecha: e.fecha, responsable: e.responsable, estado: e.estado, invitados: e.invitados, minuta: e.minuta, google_event_link: e.google_event_link || null })),
      pruebas: Object.fromEntries((prue.data || []).map((p) => [p.etapa, { status: p.status, notas: p.notas, ts: p.actualizado_at }])),
      sucursales: (suc.data || []).map((s) => ({ nombre: s.nombre, direccion: s.direccion || "", localidad: s.localidad || "", comercio: s.nro_comercio || "" })),
      sucursalesArchivo: fArch("sucursales"),
      ventasArchivo: fArch("ventas"),
      apiCreds: creds.data ? { key: creds.data.api_key, secret: creds.data.api_secret, createdAt: creds.data.generado_at } : undefined,
      redmine: rm.data ? { status: rm.data.estado, detail: rm.data.detalle, payloads: rm.data.payloads, ts: rm.data.actualizado_at } : undefined,
      history: (hist.data || []).map((h) => ({ ts: h.creado_at, who: h.quien, txt: h.texto })),
      notas: (notas.data || []).map((n) => ({ ts: n.creado_at, who: n.autor, txt: n.texto })),
      plazos: Object.fromEntries((plazos.data || []).map((p) => [p.paso, {
        fechaLimite: p.fecha_limite, recordatorioEnviado: p.recordatorio_enviado_at, incumplimientoEnviado: p.incumplimiento_enviado_at,
      }])),
      pasosCompletos,
      hitos: hitosPara(respuestasObj),
      hitosCompletos,
    },
  };
}

// ── Objeto del portal → tablas (solo las secciones presentes) ──
async function decompose(cliente, data) {
  const cid = cliente.id;
  if (data.involucrados !== undefined) {
    await db.from("involucrados").delete().eq("cliente_id", cid);
    const filas = data.involucrados.filter((p) => (p.nombre || "").trim() && (p.email || "").trim());
    if (filas.length) {
      await db.from("involucrados").insert(filas.map((p) => ({
        cliente_id: cid, nombre: p.nombre.trim(), cargo: (p.cargo || "").trim() || null,
        email: p.email.trim(), telefono: (p.telefono || "").trim() || null,
        rol: ["sponsor", "key_user", "otro"].includes(p.rol) ? p.rol : "otro",
      })));
    }
  }
  if (data.relevamiento !== undefined) {
    const upd = { cliente_id: cid, respuestas: data.relevamiento, enviado_at: data.relevamientoEnviado || null, actualizado_at: new Date().toISOString() };
    // Al enviar el relevamiento, se genera "por atrás" el diagrama de flujo del proceso
    if (data.relevamientoEnviado) {
      const [inv, procs] = await Promise.all([
        db.from("involucrados").select("*").eq("cliente_id", cid),
        db.from("procesadoras_cliente").select("*").eq("cliente_id", cid),
      ]);
      upd.diagrama = buildDiagrama(data.relevamiento, inv.data || [], cliente.nombre, procs.data || []);
    }
    await db.from("relevamientos").upsert(upd, { onConflict: "cliente_id" });
  }
  if (data.sucursales !== undefined) {
    await db.from("sucursales").delete().eq("cliente_id", cid);
    if (data.sucursales.length) {
      await db.from("sucursales").insert(
        data.sucursales.map((s) => ({ cliente_id: cid, nombre: s.nombre, direccion: s.direccion || null, localidad: s.localidad || null, nro_comercio: s.comercio || null }))
      );
    }
  }
  for (const [campo, tipo] of [["sucursalesArchivo", "sucursales"], ["ventasArchivo", "ventas"]]) {
    if (data[campo]) {
      const a = data[campo];
      await db.from("archivos").upsert(
        { cliente_id: cid, tipo, nombre: a.name, tamanio: a.size, contenido: a.dataUrl || null, validacion: a.validacion || null, subido_at: new Date().toISOString() },
        { onConflict: "cliente_id,tipo" }
      );
    }
  }
}

const addHistory = (cid, quien, texto) => db.from("historial").insert({ cliente_id: cid, quien, texto });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const { action, sessionCode, code, who } = req.body || {};
  const sc = (sessionCode || "").trim().toUpperCase();
  const cc = (code || sc || "").trim().toUpperCase();

  try {
    // ── Login ──
    if (action === "login") {
      if (sc === ADMIN_CODE) return res.json({ role: "team", name: who || "Equipo Nubceo", superadmin: true });
      const { data: impl } = await db.from("equipo").select("id, nombre, rol, tipo_usuario, es_superadmin").eq("codigo", sc).maybeSingle();
      if (impl) {
        const tu = impl.tipo_usuario || (impl.es_superadmin ? "superuser" : "admin");
        return res.json({ role: "team", name: impl.nombre, teamId: impl.id, teamRol: impl.rol, tipoUsuario: tu, superadmin: tu === "superuser" });
      }
      const cli = await getCliente(sc);
      if (cli) return res.json({ role: "client", name: cli.nombre });
      return res.status(404).json({ error: "Código no encontrado" });
    }

    const team = await isTeam(sc);

    // ── Acceso del cliente a sus propios datos (o del equipo a cualquiera) ──
    const puedeVerCliente = team || sc === cc;
    if (!puedeVerCliente) return res.status(403).json({ error: "Sin permiso" });

    if (action === "getClient") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      return res.json(await assemble(cli));
    }

    if (action === "saveClient") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      await decompose(cli, req.body.data || {});
      if (req.body.log) await addHistory(cli.id, who || (team ? "Equipo Nubceo" : "Cliente"), req.body.log);
      return res.json(await assemble(cli));
    }

    if (action === "onboarding") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const { data: ya } = await db.from("redmine_altas").select("id").eq("cliente_id", cli.id).maybeSingle();
      if (!ya) {
        const { data: cfgRow } = await db.from("config").select("valor").eq("clave", "redmine").maybeSingle();
        const payloads = buildRedminePayloads(cli.nombre, cli.tenant_productivo, cli.codigo, cfgRow?.valor?.projectId);
        const result = await sendToRedmine(payloads);
        await db.from("redmine_altas").insert({ cliente_id: cli.id, estado: result.estado, detalle: result.detalle, payloads });
        const creds = await generarCredenciales(cli);
        await db.from("credenciales_api").upsert(
          { cliente_id: cli.id, entorno: "sandbox", api_key: creds.api_key, api_secret: creds.api_secret, generado_at: new Date().toISOString() },
          { onConflict: "cliente_id,entorno" }
        );
        await addHistory(cli.id, "Portal (automático)", result.estado === "enviado"
          ? "Se crearon en Redmine la Feature de alta y la US de tenant sandbox"
          : "Se preparó el alta en Redmine (Feature de alta + US tenant sandbox) — " + result.detalle);
        await addHistory(cli.id, "Portal (automático)", "Se generaron las credenciales de API sandbox del cliente");
      }
      return res.json(await assemble(cli));
    }

    if (action === "saveProcesadoras") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const lista = req.body.lista || [];
      await db.from("procesadoras_cliente").delete().eq("cliente_id", cli.id);
      if (lista.length) {
        await db.from("procesadoras_cliente").insert(lista.map((p) => ({
          cliente_id: cli.id, codigo: p.codigo, nombre: p.nombre, pais: p.pais,
          estado: ["no_conectado", "en_espera", "conectado"].includes(p.estado) ? p.estado : "no_conectado",
        })));
      }
      if (req.body.log) await addHistory(cli.id, who || "Cliente", req.body.log);
      return res.json(await assemble(cli));
    }

    if (action === "marcarIntro") {
      const cli = await getCliente(cc);
      await db.from("clientes").update({ intro_leida: true }).eq("id", cli.id);
      await addHistory(cli.id, who || "Cliente", "Leyó la introducción de la implementación");
      return res.json(await assemble({ ...cli, intro_leida: true }));
    }

    if (action === "omitirSucursales") {
      const cli = await getCliente(cc);
      await db.from("clientes").update({ sucursales_omitido: true }).eq("id", cli.id);
      await addHistory(cli.id, who || "Cliente", "Omitió (por ahora) el paso de sucursales — queda pendiente para terminar la implementación");
      return res.json(await assemble({ ...cli, sucursales_omitido: true }));
    }

    // ── Agenda: slots disponibles según tipo de evento ──
    if (action === "getSlots") {
      const cli = await getCliente(cc);
      const tipo = req.body.tipo;
      const PERSONAS = {
        workshop: ["Implementaciones"],
        reunion_tecnica: ["Eduardo Andre", "Santiago Suarez"],
        capacitacion_conciliador: ["Mariana Macri"],
        capacitacion_cash: ["Mariana Macri"],
        resultados_sandbox: ["Implementaciones"],
        golive: ["Implementaciones"],
        workshop_cierre: ["Implementaciones"],
      };
      const personas = PERSONAS[tipo];
      if (!personas) return res.status(400).json({ error: "Tipo de evento desconocido" });
      const { data: cfgRow } = await db.from("config").select("valor").eq("clave", "disponibilidad").maybeSingle();
      const disp = cfgRow?.valor || {};
      // Mínimo: mañana; para el workshop, al menos 3 días después de enviado el relevamiento
      let minDate = new Date(Date.now() + 24 * 3600 * 1000);
      if (tipo === "workshop") {
        const { data: rv } = await db.from("relevamientos").select("enviado_at").eq("cliente_id", cli.id).maybeSingle();
        if (!rv?.enviado_at) return res.status(400).json({ error: "Primero hay que enviar el relevamiento" });
        const tresDias = new Date(new Date(rv.enviado_at).getTime() + 3 * 24 * 3600 * 1000);
        if (tresDias > minDate) minDate = tresDias;
      }
      const { data: ocupados } = await db.from("eventos").select("fecha, responsable").eq("estado", "agendado");
      const ocupadosSet = new Set((ocupados || []).map((e) => e.responsable + "|" + new Date(e.fecha).toISOString()));

      // Si el responsable sincronizó su Google Calendar, la disponibilidad se filtra
      // también contra sus horarios ocupados reales (no solo lo agendado desde el portal).
      const ventanaMin = minDate.toISOString();
      const ventanaMax = new Date(minDate.getTime() + 21 * 24 * 3600 * 1000).toISOString();
      const busyPorPersona = {};
      for (const persona of personas) {
        const conn = await getCalendarConnection(persona);
        if (!conn) continue;
        try {
          busyPorPersona[persona] = await gcal.freeBusy(conn.access_token, conn.calendarId, ventanaMin, ventanaMax);
        } catch (e) {
          busyPorPersona[persona] = []; // si falla la consulta, no bloqueamos el agendador — se filtra igual por lo interno
        }
      }
      const ocupaCalendarioReal = (persona, f) => {
        const busy = busyPorPersona[persona];
        if (!busy || !busy.length) return false;
        const finReunion = new Date(f.getTime() + 60 * 60 * 1000);
        return busy.some((b) => new Date(b.start) < finReunion && new Date(b.end) > f);
      };

      const slots = [];
      for (let d = 0; d < 21 && slots.length < 40; d++) {
        const dia = new Date(minDate.getTime() + d * 24 * 3600 * 1000);
        const dow = dia.getDay(); // 0=domingo
        for (const persona of personas) {
          for (const [diaSem, hora] of disp[persona] || []) {
            if (diaSem !== dow) continue;
            const [hh, mm] = hora.split(":").map(Number);
            const f = new Date(dia); f.setHours(hh, mm, 0, 0);
            if (f < minDate) continue;
            const key = persona + "|" + f.toISOString();
            if (ocupadosSet.has(key)) continue;
            if (ocupaCalendarioReal(persona, f)) continue;
            slots.push({ fecha: f.toISOString(), responsable: persona, calendarioReal: !!busyPorPersona[persona] });
          }
        }
      }
      slots.sort((a, b) => a.fecha.localeCompare(b.fecha));
      return res.json({ slots: slots.slice(0, 24) });
    }

    if (action === "agendarEvento") {
      const cli = await getCliente(cc);
      const { tipo, fecha, responsable } = req.body;
      if (!tipo || !fecha || !responsable) return res.status(400).json({ error: "Faltan datos del evento" });
      // Invitados: si el cliente editó la lista en el paso de confirmación, se usa esa;
      // si no, cae a los involucrados cargados en el relevamiento (comportamiento anterior).
      let invitados = Array.isArray(req.body.invitados) ? req.body.invitados.filter((p) => p && p.email) : null;
      if (!invitados) {
        const { data: inv } = await db.from("involucrados").select("nombre, email").eq("cliente_id", cli.id);
        invitados = inv || [];
      }
      const { data: nuevoEvento, error: errIns } = await db
        .from("eventos")
        .insert({ cliente_id: cli.id, tipo, fecha, responsable, invitados })
        .select()
        .single();
      if (errIns) return res.status(500).json({ error: "No se pudo agendar: " + errIns.message });

      let notaCalendario = "";
      try {
        const conn = await getCalendarConnection(responsable);
        if (conn) {
          const inicio = new Date(fecha);
          const fin = new Date(inicio.getTime() + 60 * 60 * 1000);
          const ev = await gcal.createEvent(conn.access_token, conn.calendarId, {
            summary: (NOMBRES_EVENTO_SRV[tipo] || tipo) + " — " + cli.nombre,
            description: "Agendado automáticamente desde el Portal de Implementaciones de Nubceo.",
            startISO: inicio.toISOString(),
            endISO: fin.toISOString(),
            attendees: invitados,
          });
          await db.from("eventos").update({ google_event_id: ev.id, google_event_link: ev.htmlLink || null }).eq("id", nuevoEvento.id);
          notaCalendario = " · invitaciones reales enviadas por Google Calendar a " + invitados.length + " persona(s)";
        }
      } catch (e) {
        notaCalendario = " · no se pudo sincronizar con Google Calendar (" + e.message + ") — la reunión quedó agendada igual en el portal";
      }

      await addHistory(cli.id, who || "Cliente", "Agendó: " + (NOMBRES_EVENTO_SRV[tipo] || tipo) + " con " + responsable + " el " +
        new Date(fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) + " · invitados: " +
        (invitados.map((p) => p.nombre || p.email).join(", ") || "sin invitados") + notaCalendario);
      return res.json(await assemble(cli));
    }

    // ── Calendario: URL de conexión (cualquier miembro del equipo puede iniciarla) ──
    if (action === "calendarAuthUrl") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const responsable = req.body.responsable;
      if (!RESPONSABLES_CALENDARIO.includes(responsable)) return res.status(400).json({ error: "Responsable desconocido" });
      const state = Buffer.from(JSON.stringify({ responsable, sessionCode: sc })).toString("base64");
      try {
        return res.json({ url: gcal.buildAuthUrl(state) });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // ── De acá para abajo, solo equipo ──
    if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });

    if (action === "setPrueba") {
      const cli = await getCliente(cc);
      await db.from("pruebas").upsert(
        { cliente_id: cli.id, etapa: req.body.etapa, status: req.body.status, notas: req.body.notas || null, actualizado_at: new Date().toISOString() },
        { onConflict: "cliente_id,etapa" }
      );
      await addHistory(cli.id, who || "Equipo", "Actualizó el status de pruebas " + req.body.etapa + ": " + req.body.status);
      return res.json(await assemble(cli));
    }

    // ── Plazos por paso: el equipo "calendariza" cada paso; el cron diario dispara los mails ──
    if (action === "setPlazo") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const { paso, fechaLimite } = req.body;
      const { data: rvRow } = await db.from("relevamientos").select("respuestas").eq("cliente_id", cli.id).maybeSingle();
      const hitosCliente = hitosPara(rvRow?.respuestas || {});
      const hito = hitosCliente.find((h) => h.id === paso);
      if (!hito) return res.status(400).json({ error: "Ese hito no aplica a este cliente" });
      if (!fechaLimite || !/^\d{4}-\d{2}-\d{2}$/.test(fechaLimite)) return res.status(400).json({ error: "Fecha límite inválida" });
      // Si se redefine la fecha, se resetean los avisos ya enviados — un plazo nuevo merece su propio recordatorio.
      await db.from("plazos_cliente").upsert(
        { cliente_id: cli.id, paso, fecha_limite: fechaLimite, creado_por: who || sc, recordatorio_enviado_at: null, incumplimiento_enviado_at: null, actualizado_at: new Date().toISOString() },
        { onConflict: "cliente_id,paso" }
      );
      await addHistory(cli.id, who || "Equipo", "Definió el plazo del hito «" + hito.nombre + "»: " + fechaLimite);
      return res.json(await assemble(cli));
    }

    if (action === "quitarPlazo") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      await db.from("plazos_cliente").delete().eq("cliente_id", cli.id).eq("paso", req.body.paso);
      await addHistory(cli.id, who || "Equipo", "Quitó el plazo del hito «" + (NOMBRE_HITO_GENERICO[req.body.paso] || req.body.paso) + "»");
      return res.json(await assemble(cli));
    }

    if (action === "enviarAvisoAhora") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const { data: plazoRow } = await db.from("plazos_cliente").select("*").eq("cliente_id", cli.id).eq("paso", req.body.paso).maybeSingle();
      if (!plazoRow) return res.status(404).json({ error: "Ese paso todavía no tiene un plazo definido" });
      const tipo = new Date(plazoRow.fecha_limite + "T00:00:00") < new Date(new Date().toDateString()) ? "incumplimiento" : "recordatorio";
      try {
        const r = await procesarAvisoPlazo(db, { cliente: cli, plazoRow, tipo });
        if (!r.enviado) return res.status(400).json({ error: r.motivo });
      } catch (e) {
        return res.status(500).json({ error: "No se pudo enviar el mail: " + e.message });
      }
      return res.json(await assemble(cli));
    }

    if (action === "setApiDesarrolloCompleto") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const val = !!req.body.completo;
      await db.from("clientes").update({ api_desarrollo_completo: val }).eq("id", cli.id);
      await addHistory(cli.id, who || "Equipo", val ? "Marcó como completo el desarrollo de la API" : "Marcó el desarrollo de la API como pendiente nuevamente");
      return res.json(await assemble(cli));
    }

    if (action === "setMinuta") {
      const cli = await getCliente(cc);
      await db.from("eventos").update({ minuta: req.body.minuta, estado: "realizado" }).eq("id", req.body.eventoId).eq("cliente_id", cli.id);
      await addHistory(cli.id, who || "Equipo", "Registró la minuta de la reunión");
      return res.json(await assemble(cli));
    }

    if (action === "listClients") {
      const incluirArchivados = !!req.body.includeArchived && (await tipoUsuario(sc)) === "superuser";
      const [{ data: clis }, { data: equipoRows }] = await Promise.all([
        (incluirArchivados ? db.from("clientes").select("*").order("creado_at") : db.from("clientes").select("*").is("archivado_at", null).order("creado_at")),
        db.from("equipo").select("id, nombre, rol"),
      ]);
      const nombreImpl = Object.fromEntries((equipoRows || []).map((e) => [e.id, e.nombre]));
      const out = [];
      for (const cli of clis || []) {
        const [{ count: sucCountN }, { data: hist }, { count: notasCountN }] = await Promise.all([
          db.from("sucursales").select("id", { count: "exact", head: true }).eq("cliente_id", cli.id),
          db.from("historial").select("creado_at").eq("cliente_id", cli.id).order("creado_at", { ascending: false }).limit(1),
          db.from("notas_internas").select("id", { count: "exact", head: true }).eq("cliente_id", cli.id),
        ]);
        const { pasos, respuestas, ventas } = await calcularPasos(db, cli);
        const faseSug = faseSugerida(pasos);
        let fase = cli.fase;
        if (faseSug > fase) { await db.from("clientes").update({ fase: faseSug }).eq("id", cli.id); fase = faseSug; }
        out.push({
          code: cli.codigo, name: cli.nombre, tenant: cli.tenant_productivo, phase: fase, createdAt: cli.creado_at,
          logo: cli.logo || null, razonSocial: cli.razon_social || null,
          implementadorId: cli.implementador_id || null,
          implementadorNombre: cli.implementador_id ? (nombreImpl[cli.implementador_id] || null) : null,
          desarrolladorId: cli.desarrollador_id || null,
          desarrolladorNombre: cli.desarrollador_id ? (nombreImpl[cli.desarrollador_id] || null) : null,
          estadoPago: cli.estado_pago || "al_dia",
          deudaDesde: cli.deuda_desde || null,
          relevamiento: respuestas, relevamientoEnviado: pasos.relevamiento,
          sucursalesCount: sucCountN || 0,
          notasCount: notasCountN || 0,
          tieneArchivoSucursales: pasos.sucursales,
          omitioSucursales: !!cli.sucursales_omitido && !pasos.sucursales,
          tieneVentas: !!ventas,
          completados: Object.values(pasos).filter(Boolean).length,
          totalPasos: 8,
          ultimaActividad: hist.data?.[0]?.creado_at || null,
        });
      }
      return res.json({ clients: out });
    }

    if (action === "assignClient") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const rol = req.body.rol === "desarrollador" ? "desarrollador" : "implementador";
      const miembroId = req.body.implementadorId || null;
      let nombre = null;
      if (miembroId) {
        const { data: m } = await db.from("equipo").select("id, nombre").eq("id", miembroId).maybeSingle();
        if (!m) return res.status(404).json({ error: "No encontrado" });
        nombre = m.nombre;
      }
      const campo = rol === "desarrollador" ? "desarrollador_id" : "implementador_id";
      await db.from("clientes").update({ [campo]: miembroId }).eq("id", cli.id);
      await addHistory(cli.id, who || "Equipo", miembroId
        ? (rol === "desarrollador" ? "Desarrollador asignado: " : "Cliente asignado a ") + nombre
        : (rol === "desarrollador" ? "Se quitó la asignación de desarrollador" : "Cliente sin asignar (se quitó la asignación)"));
      return res.json(await assemble({ ...cli, [campo]: miembroId }));
    }

    if (action === "listTeam") {
      const { data } = await db.from("equipo").select("id, codigo, nombre, email, rol, foto, tipo_usuario, es_superadmin, redmine_api_key").order("nombre");
      return res.json({ team: (data || []).map((m) => ({ ...m, redmine_api_key: undefined, tieneRedmineKey: !!m.redmine_api_key })) });
    }

    if (action === "getMyProfile") {
      const { data } = await db.from("equipo").select("id, codigo, nombre, email, rol, foto, tipo_usuario, es_superadmin, redmine_api_key").eq("codigo", sc).maybeSingle();
      if (!data) return res.status(404).json({ error: "No encontrado" });
      return res.json({ perfil: data });
    }

    if (action === "calendarStatus") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const { data } = await db.from("calendar_conexiones").select("responsable, google_email, conectado_por, conectado_at");
      const porResponsable = Object.fromEntries((data || []).map((c) => [c.responsable, c]));
      return res.json({ responsables: RESPONSABLES_CALENDARIO, conexiones: porResponsable });
    }

    if (action === "calendarDisconnect") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      await db.from("calendar_conexiones").delete().eq("responsable", req.body.responsable);
      return res.json({ ok: true });
    }

    if (action === "createClient") {
      const tu = await tipoUsuario(sc);
      if (!puedeCrearClientes(tu)) return res.status(403).json({ error: "Tu tipo de usuario (Colaborador) no puede dar de alta clientes. Pedile a un Admin o al Superuser." });

      const nuevo = (req.body.codigo || "").trim().toUpperCase();
      if (!nuevo || !req.body.nombre) return res.status(400).json({ error: "Faltan nombre o código" });
      if (nuevo === ADMIN_CODE || (await isTeam(nuevo)) || (await getCliente(nuevo))) return res.status(409).json({ error: "Ese código ya está en uso" });
      const cuits = Array.isArray(req.body.cuits) ? req.body.cuits.map((c) => String(c).trim()).filter(Boolean) : [];
      const { data: nuevoCliente, error: errIns } = await db.from("clientes").insert({
        codigo: nuevo, nombre: req.body.nombre.trim(), tenant_productivo: (req.body.tenant || "").trim() || null,
        razon_social: (req.body.razonSocial || "").trim() || null, cuits, logo: req.body.logo || null,
        comercial: (req.body.comercial || "").trim() || null,
        go_live_estimado: req.body.goLiveEstimado || null,
      }).select().single();
      if (errIns) return res.status(500).json({ error: "No se pudo crear el cliente: " + errIns.message });
      const contactos = Array.isArray(req.body.contactos) ? req.body.contactos.filter((c) => (c.nombre || "").trim()) : [];
      if (contactos.length) {
        await db.from("involucrados").insert(contactos.map((c) => ({
          cliente_id: nuevoCliente.id, nombre: (c.nombre || "").trim(), cargo: (c.cargo || "").trim() || null,
          email: (c.email || "").trim() || null, telefono: (c.telefono || "").trim() || null, rol: c.rol || "otro",
        })));
      }
      return res.json({ ok: true });
    }

    if (action === "setClientInfo") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const upd = {};
      if (req.body.razonSocial !== undefined) upd.razon_social = (req.body.razonSocial || "").trim() || null;
      if (req.body.cuits !== undefined) upd.cuits = Array.isArray(req.body.cuits) ? req.body.cuits.map((c) => String(c).trim()).filter(Boolean) : [];
      if (req.body.logo !== undefined) upd.logo = req.body.logo || null;
      if (req.body.goLiveEstimado !== undefined) upd.go_live_estimado = req.body.goLiveEstimado || null;
      if (Object.keys(upd).length) await db.from("clientes").update(upd).eq("id", cli.id);
      await addHistory(cli.id, who || "Equipo", "Actualizó los datos del cliente (razón social / CUITs / logo / go-live estimado)");
      return res.json(await assemble(cli));
    }

    if (action === "setFinanzas") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const b = req.body;
      const upd = {
        fee: b.fee === "" || b.fee === undefined || b.fee === null ? null : Number(b.fee),
        moneda: b.moneda === "USD" ? "USD" : "ARS",
        costo_implementacion: b.costoImplementacion === "" || b.costoImplementacion === undefined || b.costoImplementacion === null ? null : Number(b.costoImplementacion),
        estado_pago: b.estadoPago === "con_deuda" ? "con_deuda" : "al_dia",
        deuda_desde: b.estadoPago === "con_deuda" ? (b.deudaDesde || null) : null,
        finanzas_notas: (b.finanzasNotas || "").trim() || null,
      };
      if (upd.fee !== null && Number.isNaN(upd.fee)) return res.status(400).json({ error: "El fee tiene que ser un número" });
      if (upd.costo_implementacion !== null && Number.isNaN(upd.costo_implementacion)) return res.status(400).json({ error: "El costo de implementación tiene que ser un número" });
      await db.from("clientes").update(upd).eq("id", cli.id);
      await addHistory(cli.id, who || "Finanzas", "Actualizó los datos financieros" + (upd.estado_pago === "con_deuda" ? " · con deuda desde " + (upd.deuda_desde || "sin fecha") : " · al día"));
      return res.json(await assemble(cli));
    }

    // ── Solo superadmin: borrar clientes/personas y designar otros superadmin ──
    // Archivo lógico de clientes (soft delete): solo superuser. Los datos se conservan y se restauran cuando quiera.
    if (action === "archiveClient") {
      if ((await tipoUsuario(sc)) !== "superuser") return res.status(403).json({ error: "Solo el Superuser puede archivar clientes" });
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const { data: yo } = await db.from("equipo").select("id").eq("codigo", sc).maybeSingle();
      await db.from("clientes").update({ archivado_at: new Date().toISOString(), archivado_por: yo?.id || null }).eq("id", cli.id);
      await addHistory(cli.id, who || "Superuser", "Cliente archivado — dejó de aparecer en el listado activo. Se puede restaurar desde el panel.");
      return res.json({ ok: true });
    }

    if (action === "restoreClient") {
      if ((await tipoUsuario(sc)) !== "superuser") return res.status(403).json({ error: "Solo el Superuser puede restaurar clientes" });
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      await db.from("clientes").update({ archivado_at: null, archivado_por: null }).eq("id", cli.id);
      await addHistory(cli.id, who || "Superuser", "Cliente restaurado desde archivo — vuelve a aparecer en el listado activo.");
      return res.json({ ok: true });
    }

    if (action === "listArchived") {
      if ((await tipoUsuario(sc)) !== "superuser") return res.status(403).json({ error: "Solo el Superuser ve los clientes archivados" });
      const { data } = await db.from("clientes").select("id, codigo, nombre, archivado_at, archivado_por, creado_at").not("archivado_at", "is", null).order("archivado_at", { ascending: false });
      return res.json({ archivados: data || [] });
    }

    // deleteClient sigue existiendo pero ya no debería usarse desde la UI — queda como acción para casos extremos.
    if (action === "deleteClient") {
      if ((await tipoUsuario(sc)) !== "superuser") return res.status(403).json({ error: "Solo el Superuser puede eliminar clientes" });
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      await db.from("clientes").delete().eq("id", cli.id); // cascadea por FK
      return res.json({ ok: true });
    }

    if (action === "deleteTeamMember") {
      if ((await tipoUsuario(sc)) !== "superuser") return res.status(403).json({ error: "Solo el Superuser puede eliminar usuarios del equipo" });
      const { data: target } = await db.from("equipo").select("id, codigo").eq("id", req.body.teamId).maybeSingle();
      if (!target) return res.status(404).json({ error: "No encontrado" });
      if (target.codigo === sc) return res.status(400).json({ error: "No podés eliminar tu propio usuario mientras estás conectada con él" });
      await db.from("clientes").update({ implementador_id: null }).eq("implementador_id", target.id);
      await db.from("clientes").update({ desarrollador_id: null }).eq("desarrollador_id", target.id);
      await db.from("equipo").delete().eq("id", target.id);
      return res.json({ ok: true });
    }

    if (action === "setSuperadmin") {
      // Legacy — redirigimos a setTipoUsuario para no romper llamadas viejas
      if ((await tipoUsuario(sc)) !== "superuser") return res.status(403).json({ error: "Solo el Superuser puede cambiar tipos de usuario" });
      const nuevoTipo = req.body.valor ? "superuser" : "admin";
      await db.from("equipo").update({ tipo_usuario: nuevoTipo, es_superadmin: !!req.body.valor }).eq("id", req.body.teamId);
      return res.json({ ok: true });
    }

    if (action === "setTipoUsuario") {
      if ((await tipoUsuario(sc)) !== "superuser") return res.status(403).json({ error: "Solo el Superuser puede cambiar tipos de usuario" });
      const nuevoTipo = req.body.tipo;
      if (!["superuser", "admin", "colaborador"].includes(nuevoTipo)) return res.status(400).json({ error: "Tipo de usuario inválido" });
      // Chequeo de seguridad: no dejar el sistema sin ningún superuser
      if (nuevoTipo !== "superuser") {
        const { data: yo } = await db.from("equipo").select("id").eq("codigo", sc).maybeSingle();
        if (yo?.id === req.body.teamId) {
          const { count } = await db.from("equipo").select("id", { count: "exact", head: true }).eq("tipo_usuario", "superuser");
          if ((count || 0) <= 1) return res.status(400).json({ error: "No podés dejar el portal sin ningún Superuser — designá otro antes de cambiar tu propio tipo." });
        }
      }
      await db.from("equipo").update({ tipo_usuario: nuevoTipo, es_superadmin: nuevoTipo === "superuser" }).eq("id", req.body.teamId);
      return res.json({ ok: true });
    }

    if (action === "createTeam") {
      const tu = await tipoUsuario(sc);
      if (!puedeCrearUsuarios(tu)) return res.status(403).json({ error: "Tu tipo de usuario (Colaborador) no puede crear usuarios del equipo. Pedile a un Admin o al Superuser." });
      const nuevo = (req.body.codigo || "").trim().toUpperCase();
      if (!nuevo || !req.body.nombre) return res.status(400).json({ error: "Faltan nombre o código" });
      const errPolitica = codigoEquipoValido(nuevo);
      if (errPolitica) return res.status(400).json({ error: errPolitica });
      if (nuevo === ADMIN_CODE || (await isTeam(nuevo)) || (await getCliente(nuevo))) return res.status(409).json({ error: "Ese código ya está en uso" });
      const rol = ["desarrollador", "finanzas"].includes(req.body.rol) ? req.body.rol : "implementador";
      // El tipo de usuario del que se crea: por defecto colaborador (el más restrictivo).
      // Un admin puede elegir crear admin o colaborador, pero NO superuser (solo un superuser puede promover).
      let tipoNuevo = ["superuser", "admin", "colaborador"].includes(req.body.tipoUsuario) ? req.body.tipoUsuario : "colaborador";
      if (tipoNuevo === "superuser" && tu !== "superuser") tipoNuevo = "admin";
      await db.from("equipo").insert({
        codigo: nuevo, nombre: req.body.nombre.trim(), email: (req.body.email || "").trim() || null,
        rol, foto: req.body.foto || null, tipo_usuario: tipoNuevo,
        es_superadmin: tipoNuevo === "superuser", // compat con código viejo
      });
      return res.json({ ok: true });
    }

    if (action === "updateTeamEmail") {
      const { data: yo } = await db.from("equipo").select("id").eq("codigo", sc).maybeSingle();
      const targetId = req.body.teamId || yo?.id;
      if (!targetId) return res.status(400).json({ error: "No se encontró a quién actualizar" });
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const upd = {};
      if (req.body.email !== undefined) upd.email = (req.body.email || "").trim() || null;
      if (req.body.foto !== undefined) upd.foto = req.body.foto || null;
      if (req.body.nombre !== undefined && (req.body.nombre || "").trim()) upd.nombre = req.body.nombre.trim();
      if (req.body.redmineApiKey !== undefined) upd.redmine_api_key = (req.body.redmineApiKey || "").trim() || null;
      if (Object.keys(upd).length) await db.from("equipo").update(upd).eq("id", targetId);
      return res.json({ ok: true });
    }

    if (action === "setPhase") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      await db.from("clientes").update({ fase: req.body.fase }).eq("id", cli.id);
      if (req.body.faseNombre) await addHistory(cli.id, who || "Equipo Nubceo", "El proyecto avanzó a la fase: " + req.body.faseNombre);
      return res.json(await assemble({ ...cli, fase: req.body.fase }));
    }

    if (action === "addNote") {
      const cli = await getCliente(cc);
      await db.from("notas_internas").insert({ cliente_id: cli.id, autor: who || "Equipo", texto: req.body.texto });
      return res.json(await assemble(cli));
    }

    if (action === "changeMyCode") {
      const { data: yo } = await db.from("equipo").select("id, nombre").eq("codigo", sc).maybeSingle();
      if (!yo) return res.status(403).json({ error: "Esta opción es para implementadores con código propio (no el código maestro)." });
      const nuevo = (req.body.nuevoCodigo || "").trim().toUpperCase();
      const errPolitica = codigoEquipoValido(nuevo);
      if (errPolitica) return res.status(400).json({ error: errPolitica });
      if (nuevo === ADMIN_CODE || (await isTeam(nuevo)) || (await getCliente(nuevo))) return res.status(409).json({ error: "Ese código ya está en uso. Elegí otro." });
      await db.from("equipo").update({ codigo: nuevo }).eq("id", yo.id);
      return res.json({ ok: true });
    }

    if (action === "getConfig") {
      const { data } = await db.from("config").select("valor").eq("clave", "redmine").maybeSingle();
      return res.json({ cfg: data?.valor || { url: "", projectId: "" }, apiKeyEnEnv: !!process.env.REDMINE_API_KEY });
    }

    if (action === "saveConfig") {
      await db.from("config").upsert({ clave: "redmine", valor: req.body.cfg || {} });
      return res.json({ ok: true });
    }

    if (action === "retryRedmine") {
      const cli = await getCliente(cc);
      const { data: rm } = await db.from("redmine_altas").select("*").eq("cliente_id", cli.id).maybeSingle();
      if (!rm) return res.status(404).json({ error: "Todavía no hay alta preparada (se dispara con el primer login del cliente)" });
      const result = await sendToRedmine(rm.payloads);
      await db.from("redmine_altas").update({ estado: result.estado, detalle: result.detalle, actualizado_at: new Date().toISOString() }).eq("id", rm.id);
      await addHistory(cli.id, who || "Equipo", result.estado === "enviado" ? "Reenvió el alta a Redmine: creada la Feature y la US de sandbox" : "Reintentó el envío a Redmine — " + result.detalle);
      return res.json(await assemble(cli));
    }

    if (action === "regenCreds") {
      const cli = await getCliente(cc);
      const creds = await generarCredenciales(cli);
      await db.from("credenciales_api").upsert(
        { cliente_id: cli.id, entorno: "sandbox", api_key: creds.api_key, api_secret: creds.api_secret, generado_at: new Date().toISOString() },
        { onConflict: "cliente_id,entorno" }
      );
      await addHistory(cli.id, who || "Equipo", "Regeneró las credenciales de API sandbox del cliente");
      return res.json(await assemble(cli));
    }

    return res.status(400).json({ error: "Acción desconocida: " + action });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error del servidor: " + e.message });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
