// pages/api/portal.js
// Única puerta de entrada del portal a la base de datos.
// El navegador nunca toca Supabase directo: cada request valida el
// código de sesión y el service role hace el trabajo (RLS bloquea el resto).
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";
import {
  buildRedminePayloads, sendToRedmine, listarTrackers, corregirTrackerDeTicket,
  buildTicketMigracionVentas, buildTicketEliminarPos, buildTicketCambioRolAdmin, buildTicketLibre,
} from "../../lib/redmine";
import { buildDiagrama } from "../../lib/diagrama";
import * as gcal from "../../lib/googleCalendar";
import { calcularPasos, computarPasos, faseSugerida } from "../../lib/pasos";
import { hitosPara, calcularHitos, NOMBRE_HITO_GENERICO } from "../../lib/hitos";
import { procesarAvisoPlazo, enviarAvisosPendientesDeCliente } from "../../lib/avisosPlazos";
import crypto from "crypto";

const ADMIN_CODE = process.env.ADMIN_CODE || "NUBCEO-EQUIPO";
const rnd = (len) => crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);

// La sincronización de calendario es 100% personal — cada persona conecta solo la suya
// (ver calendarAuthUrl/calendarStatus/calendarDisconnect y getCalendarConnection más abajo).
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

// DEPRECATED: generarCredenciales() removida
// Las credenciales ahora se ingresan manualmente por el usuario desde su cuenta Nubceo
// Ver handler "guardarCredenciales" más abajo para cómo se persisten


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

// Si el cliente tiene implementador/a asignado y esa persona cargó su propia API key de
// Redmine (Mi perfil), se usa esa — así el ticket queda creado "como" esa persona en vez de
// con la key genérica del servidor. Si no hay nada personal, sendToRedmine cae sola a
// REDMINE_API_KEY (variable de entorno).
async function redmineKeyDelCliente(cliente) {
  if (!cliente?.implementador_id) return null;
  const { data } = await db.from("equipo").select("redmine_api_key").eq("id", cliente.implementador_id).maybeSingle();
  return data?.redmine_api_key || null;
}

// Nombre real de la persona detrás de un código — null si es el código maestro (no tiene
// perfil propio) o si el código no corresponde a nadie del equipo. Se usa para todo lo que
// tiene que ser estrictamente personal (calendario propio, filtro de "mis clientes", etc.).
async function nombreDeSesion(code) {
  if (!code || code === ADMIN_CODE) return null;
  const { data } = await db.from("equipo").select("nombre").eq("codigo", code).maybeSingle();
  return data?.nombre || null;
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
  // Se reusan los datos que assemble() ya trajo (en vez de llamar a calcularPasos(), que
  // volvería a consultar todo) pero con el mismo cálculo puro que usa listClients — así
  // los dos lugares no se desincronizan con el tiempo.
  const archivosArr = arch.data || [];
  const eventosArr = evs.data || [];
  const { pasos: pasosCompletos, respuestas: respuestasObj } = computarPasos(cliente, {
    relevamientoRow: rv.data, archivos: archivosArr, procesadoras: procs.data || [],
    eventos: eventosArr, tieneApi: !!creds.data,
  });
  const hitosCompletos = calcularHitos(cliente, pasosCompletos, { procesadoras: procs.data || [], eventos: eventosArr, pruebas: Object.fromEntries((prue.data || []).map((p) => [p.etapa, p])) });

  // Auto-avance de fase: la fase sugerida es cuántos pasos seguidos (desde el principio)
  // están completos — así no da saltos raros si algo se completa fuera de orden. Nunca
  // retrocede solo, y el equipo puede pisarlo en cualquier momento a mano desde el tablero.
  const faseSug = faseSugerida(pasosCompletos, hitosCompletos);
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
      id: cliente.id, codigo: cliente.codigo,
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
      redmine: rm.data ? { status: rm.data.estado, detail: rm.data.detalle, payloads: rm.data.payloads, ts: rm.data.actualizado_at, featureIssueId: rm.data.feature_issue_id, userStoryIssueId: rm.data.user_story_issue_id } : undefined,
      history: (hist.data || []).map((h) => ({ ts: h.creado_at, who: h.quien, txt: h.texto })),
      notas: (notas.data || []).map((n) => ({ ts: n.creado_at, who: n.autor, txt: n.texto })),
      plazos: Object.fromEntries((plazos.data || []).map((p) => [p.paso, {
        fechaLimite: p.fecha_limite, recordatorioEnviado: p.recordatorio_enviado_at, incumplimientoEnviado: p.incumplimiento_enviado_at,
        cumplimiento: p.cumplimiento || null,
      }])),
      pasosCompletos,
      hitos: hitosPara(respuestasObj),
      hitosCompletos,
    },
  };
}

// ── Objeto del portal → tablas (solo las secciones presentes) ──
async function decompose(cliente, data, esTeam) {
  const cid = cliente.id;
  if (data.involucrados !== undefined) {
    await db.from("involucrados").delete().eq("cliente_id", cid);
    const filas = data.involucrados.filter((p) => (p.nombre || "").trim() && (p.email || "").trim());
    if (filas.length) {
      await db.from("involucrados").insert(filas.map((p) => ({
        cliente_id: cid, nombre: p.nombre.trim(), cargo: (p.cargo || "").trim() || null,
        email: p.email.trim(), telefono: (p.telefono || "").trim() || null,
        rol: ["sponsor", "key_user", "desarrollador", "otro"].includes(p.rol) ? p.rol : "otro",
      })));
    }
  }
  if (data.relevamiento !== undefined) {
    // Una vez enviado (no borrador), el cliente ya no puede editarlo — el equipo sí puede,
    // por si hace falta corregir algo puntual sin pasar por "reabrir".
    const { data: actual } = await db.from("relevamientos").select("enviado_at").eq("cliente_id", cid).maybeSingle();
    if (actual?.enviado_at && !esTeam) {
      throw new Error("El relevamiento ya fue enviado y no se puede editar. Si necesitás corregir algo, escribile a tu implementador.");
    }
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

// Inserta en el historial Y mantiene clientes.ultima_actividad al día — así el
// listado (listClients) no necesita ir a buscar el último registro de historial
// por cada cliente, solo lee la columna que ya viene en la fila del cliente.
const addHistory = (cid, quien, texto) => {
  const ahora = new Date().toISOString();
  return Promise.all([
    db.from("historial").insert({ cliente_id: cid, quien, texto, creado_at: ahora }),
    db.from("clientes").update({ ultima_actividad: ahora }).eq("id", cid),
  ]);
};

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

    if (action === "setConexionLeida") {
      // Marca el paso "Conexión API / CSV" como leído/confirmado por el cliente.
      // Sirve para avanzar en cualquier vía (API, CSV o Ambos) sin depender de
      // credenciales o CSV. No pasa por la validación de "relevamiento ya enviado"
      // porque solo toca una marca dentro de respuestas, no el relevamiento en sí.
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });

      const leido = req.body.leido !== false; // default true
      const { data: relevActual } = await db.from("relevamientos")
        .select("respuestas").eq("cliente_id", cli.id).maybeSingle();
      const respuestas = relevActual?.respuestas || {};
      respuestas.conexionLeida = leido;

      const { error: upErr } = await db.from("relevamientos").upsert(
        { cliente_id: cli.id, respuestas, actualizado_at: new Date().toISOString() },
        { onConflict: "cliente_id" }
      );
      if (upErr) {
        console.error("Error al guardar conexionLeida:", upErr.message);
        return res.status(500).json({ error: upErr.message });
      }
      await addHistory(cli.id, who || "Cliente", leido ? "Marcó el paso de Conexión como leído" : "Desmarcó el paso de Conexión");
      return res.json(await assemble(cli));
    }

    if (action === "saveTipoConexion") {
      // Handler ESPECIAL para cambiar solo d1 (tipo de conexión: api/csv/ambos)
      // Permite cambiar la vía incluso después de haber enviado el relevamiento
      // porque d1 es un dato que se puede modificar sin afectar el rest del relevamiento
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      
      const tipoConexion = req.body.tipoConexion; // "api" | "csv" | "ambos"
      if (!["api", "csv", "ambos"].includes(tipoConexion)) {
        return res.status(400).json({ error: "Tipo de conexión inválido" });
      }

      // Obtener el relevamiento actual
      const { data: relevActual } = await db.from("relevamientos")
        .select("respuestas")
        .eq("cliente_id", cli.id)
        .maybeSingle();

      // Actualizar solo d1 dentro del JSON respuestas
      const respuestasActualizadas = relevActual?.respuestas || {};
      respuestasActualizadas.d1 = tipoConexion;

      // Guardar sin validación restrictiva de "relevamiento ya enviado"
      await db.from("relevamientos").upsert(
        {
          cliente_id: cli.id,
          respuestas: respuestasActualizadas,
          actualizado_at: new Date().toISOString(),
        },
        { onConflict: "cliente_id" }
      );

      // Log de auditoría
      const nombreTipo = tipoConexion === "ambos" ? "AMBOS (API + CSV)" : tipoConexion.toUpperCase();
      await addHistory(cli.id, who || "Cliente", `Definió la vía de conexión: ${nombreTipo}`);

      return res.json(await assemble(cli));
    }

    if (action === "saveClient") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      try {
        await decompose(cli, req.body.data || {}, team);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
      if (req.body.log) await addHistory(cli.id, who || (team ? "Equipo Nubceo" : "Cliente"), req.body.log);
      return res.json(await assemble(cli));
    }

    if (action === "setMiEmpresa") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const upd = {};
      if (req.body.razonSocial !== undefined) upd.razon_social = (req.body.razonSocial || "").trim() || null;
      if (req.body.cuits !== undefined) upd.cuits = Array.isArray(req.body.cuits) ? req.body.cuits.map((c) => String(c).trim()).filter(Boolean) : [];
      if (req.body.logo !== undefined) upd.logo = req.body.logo || null;
      // El tenant NUNCA se edita desde acá — es un dato técnico, no de la empresa.
      if (Object.keys(upd).length) await db.from("clientes").update(upd).eq("id", cli.id);
      await addHistory(cli.id, who || "Cliente", "Actualizó los datos de la empresa (razón social / CUITs / logo)");
      return res.json(await assemble(cli));
    }

    if (action === "onboarding") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const { data: ya } = await db.from("redmine_altas").select("id").eq("cliente_id", cli.id).maybeSingle();
      if (!ya) {
        try {
          const { data: cfgRow } = await db.from("config").select("valor").eq("clave", "redmine").maybeSingle();
          const payloads = buildRedminePayloads(cli.nombre, cli.tenant_productivo, cli.codigo, cfgRow?.valor?.projectId, cli.cuits);
          const result = await sendToRedmine(payloads, await redmineKeyDelCliente(cli));
          await db.from("redmine_altas").insert({
            cliente_id: cli.id, estado: result.estado, detalle: result.detalle, payloads,
            feature_issue_id: result.issueIds?.[0] || null, user_story_issue_id: result.issueIds?.[1] || null,
          });
          await addHistory(cli.id, "Portal (automático)", result.estado === "enviado"
            ? "Se crearon en Redmine la Feature de alta y la US de tenant sandbox"
            : "Se preparó el alta en Redmine (Feature de alta + US tenant sandbox) — " + result.detalle);
        } catch (redmineErr) {
          console.error("Redmine onboarding error (no fatal):", redmineErr.message);
          // Continúa sin Redmine por ahora — se puede reintentar después con "retryRedmine"
          await addHistory(cli.id, "Portal (automático)", "No se pudo conectar con Redmine en este momento — se puede reintentar después");
        }
        // Las credenciales de API ya NO se generan automáticamente.
        // El desarrollador del cliente las crea en Nubceo (Mi negocio → API Keys)
        // y las ingresa en el portal mediante la acción "guardarCredenciales".
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
      const TIPOS_VALIDOS = ["workshop", "reunion_tecnica", "capacitacion_conciliador", "capacitacion_cash", "resultados_sandbox", "golive", "workshop_cierre"];
      if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: "Tipo de evento desconocido" });

      // La reunión se agenda con la persona REAL asignada a este cliente — no con un rol
      // compartido. La reunión técnica va a quien tenga el cliente como desarrollador/a (o a
      // su implementador/a si todavía no tiene desarrollador/a asignado); el resto va siempre
      // al implementador/a del cliente.
      const equipoIdDestino = tipo === "reunion_tecnica" ? (cli.desarrollador_id || cli.implementador_id) : cli.implementador_id;
      if (!equipoIdDestino) {
        return res.status(400).json({ error: "Este cliente todavía no tiene " + (tipo === "reunion_tecnica" ? "desarrollador/a ni implementador/a" : "implementador/a") + " asignado — asignalo desde el módulo Clientes antes de agendar." });
      }
      const { data: persona } = await db.from("equipo").select("id, nombre").eq("id", equipoIdDestino).maybeSingle();
      if (!persona) return res.status(400).json({ error: "La persona asignada a este cliente ya no está en el equipo — reasignalo desde el módulo Clientes." });

      // Mínimo: mañana; para el workshop, al menos 3 días después de enviado el relevamiento
      let minDate = new Date(Date.now() + 24 * 3600 * 1000);
      if (tipo === "workshop") {
        const { data: rv } = await db.from("relevamientos").select("enviado_at").eq("cliente_id", cli.id).maybeSingle();
        if (!rv?.enviado_at) return res.status(400).json({ error: "Primero hay que enviar el relevamiento" });
        const tresDias = new Date(new Date(rv.enviado_at).getTime() + 3 * 24 * 3600 * 1000);
        if (tresDias > minDate) minDate = tresDias;
      }

      // Si la persona sincronizó su Google Calendar, la disponibilidad se filtra también
      // contra sus horarios ocupados reales (no solo lo agendado desde el portal).
      const ventanaMin = minDate.toISOString();
      const ventanaMax = new Date(minDate.getTime() + 21 * 24 * 3600 * 1000).toISOString();
      let busy = [];
      const conn = await getCalendarConnection(persona.nombre);
      if (conn) {
        try { busy = await gcal.freeBusy(conn.access_token, conn.calendarId, ventanaMin, ventanaMax); } catch (e) { busy = []; }
      }

      let { data: dispRows } = await db.from("disponibilidad_equipo").select("dia_semana, hora").eq("equipo_id", persona.id);
      if (!dispRows || !dispRows.length) {
        if (conn) {
          // Con el calendario conectado no hace falta cargar nada a mano: se ofrece un
          // horario comercial estándar (lun a vie, 10 a 17) y se descarta automáticamente
          // todo lo que el calendario real ya tenga ocupado.
          dispRows = [];
          for (let dia = 1; dia <= 5; dia++) for (let hh = 10; hh <= 17; hh++) dispRows.push({ dia_semana: dia, hora: String(hh).padStart(2, "0") + ":00" });
        } else {
          return res.status(400).json({ error: persona.nombre + " todavía no conectó su Google Calendar — puede hacerlo desde Mi perfil para que el portal ofrezca sus horarios libres automáticamente." });
        }
      }

      const { data: ocupados } = await db.from("eventos").select("fecha").eq("responsable", persona.nombre).eq("estado", "agendado");
      const ocupadosSet = new Set((ocupados || []).map((e) => new Date(e.fecha).toISOString()));

      const ocupaCalendarioReal = (f) => {
        if (!busy.length) return false;
        const finReunion = new Date(f.getTime() + 60 * 60 * 1000);
        return busy.some((b) => new Date(b.start) < finReunion && new Date(b.end) > f);
      };

      const slots = [];
      for (let d = 0; d < 21 && slots.length < 40; d++) {
        const dia = new Date(minDate.getTime() + d * 24 * 3600 * 1000);
        const dow = dia.getDay(); // 0=domingo
        for (const { dia_semana, hora } of dispRows) {
          if (dia_semana !== dow) continue;
          const [hh, mm] = hora.split(":").map(Number);
          const f = new Date(dia); f.setHours(hh, mm, 0, 0);
          if (f < minDate) continue;
          if (ocupadosSet.has(f.toISOString())) continue;
          if (ocupaCalendarioReal(f)) continue;
          slots.push({ fecha: f.toISOString(), responsable: persona.nombre, calendarioReal: !!conn });
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
      const miNombre = await nombreDeSesion(sc);
      if (!miNombre) return res.status(400).json({ error: "Tu usuario no tiene un perfil propio (¿estás con el código maestro?) — creá tu usuario personal en Equipo primero." });
      // Sincronización 100% personal: solo se puede conectar el propio calendario, nunca el de otra persona.
      const state = Buffer.from(JSON.stringify({ responsable: miNombre, sessionCode: sc })).toString("base64");
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
    if (action === "reabrirRelevamiento") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      await db.from("relevamientos").update({ enviado_at: null }).eq("cliente_id", cli.id);
      await addHistory(cli.id, who || "Equipo", "Reabrió el relevamiento para que el cliente pueda corregirlo");
      return res.json(await assemble(cli));
    }

    if (action === "setCumplimientoPlazo") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const valor = ["cumplido_tiempo", "cumplido_tarde", "incumplido"].includes(req.body.cumplimiento) ? req.body.cumplimiento : null;
      const { data: upd } = await db.from("plazos_cliente").update({ cumplimiento: valor }).eq("cliente_id", cli.id).eq("paso", req.body.paso).select().maybeSingle();
      if (!upd) return res.status(404).json({ error: "Ese hito todavía no tiene un plazo definido" });
      const NOMBRE_CUMPLIMIENTO = { cumplido_tiempo: "Cumplido a tiempo", cumplido_tarde: "Cumplido con atraso", incumplido: "No cumplido" };
      await addHistory(cli.id, who || "Equipo", "Marcó el hito «" + (NOMBRE_HITO_GENERICO[req.body.paso] || req.body.paso) + "»: " + (valor ? NOMBRE_CUMPLIMIENTO[valor] : "sin confirmar"));
      return res.json(await assemble(cli));
    }

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

    if (action === "enviarAvisosPendientesCliente") {
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      let resultado;
      try {
        resultado = await enviarAvisosPendientesDeCliente(db, cli);
      } catch (e) {
        return res.status(500).json({ error: "No se pudo enviar: " + e.message });
      }
      const datos = await assemble(cli);
      return res.json({ ...datos, avisos: resultado });
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
      const ids = (clis || []).map((c) => c.id);
      if (!ids.length) return res.json({ clients: [] });

      // Antes esto era ~8 queries POR CLIENTE, una por una (400+ queries con 50 clientes).
      // Ahora es un puñado de queries en bloque para TODOS los clientes de una, y después
      // se agrupa en memoria — el cuello de botella pasa a ser Node, no la red hacia Supabase.
      const [{ data: relRows }, { data: archRows }, { data: procRows }, { data: evRows }, { data: credRows }, { data: sucRows }, { data: notasRows }, { data: pruebasRows }] = await Promise.all([
        db.from("relevamientos").select("cliente_id, respuestas, enviado_at").in("cliente_id", ids),
        db.from("archivos").select("cliente_id, tipo, validacion").in("cliente_id", ids),
        db.from("procesadoras_cliente").select("cliente_id, estado").in("cliente_id", ids),
        db.from("eventos").select("cliente_id, tipo, estado").in("cliente_id", ids),
        db.from("credenciales_api").select("cliente_id").in("cliente_id", ids),
        db.from("sucursales").select("cliente_id").in("cliente_id", ids),
        db.from("notas_internas").select("cliente_id").in("cliente_id", ids),
        db.from("pruebas").select("cliente_id, etapa, status").in("cliente_id", ids),
      ]);
      const agrupar = (rows) => { const m = new Map(); for (const r of rows || []) { if (!m.has(r.cliente_id)) m.set(r.cliente_id, []); m.get(r.cliente_id).push(r); } return m; };
      const relPorCliente = new Map((relRows || []).map((r) => [r.cliente_id, r])); // 1:1 (unique en el schema)
      const archPorCliente = agrupar(archRows);
      const procPorCliente = agrupar(procRows);
      const evPorCliente = agrupar(evRows);
      const credPorCliente = agrupar(credRows);
      const sucPorCliente = agrupar(sucRows);
      const notasPorCliente = agrupar(notasRows);
      const pruebasPorCliente = agrupar(pruebasRows);

      const out = [];
      const actualizacionesFase = [];
      for (const cli of clis || []) {
        const procesadorasCli = procPorCliente.get(cli.id) || [];
        const eventosCli = evPorCliente.get(cli.id) || [];
        const { pasos, respuestas, ventas } = computarPasos(cli, {
          relevamientoRow: relPorCliente.get(cli.id),
          archivos: archPorCliente.get(cli.id) || [],
          procesadoras: procesadorasCli,
          eventos: eventosCli,
          tieneApi: (credPorCliente.get(cli.id) || []).length > 0,
        });
        const pruebasObj = Object.fromEntries((pruebasPorCliente.get(cli.id) || []).map((p) => [p.etapa, p]));
        const hitos = calcularHitos(cli, pasos, { procesadoras: procesadorasCli, eventos: eventosCli, pruebas: pruebasObj });
        const faseSug = faseSugerida(pasos, hitos);
        let fase = cli.fase;
        if (faseSug > fase) { actualizacionesFase.push(db.from("clientes").update({ fase: faseSug }).eq("id", cli.id)); fase = faseSug; }
        out.push({
          code: cli.codigo, name: cli.nombre, tenant: cli.tenant_productivo, phase: fase, createdAt: cli.creado_at,
          logo: cli.logo || null, razonSocial: cli.razon_social || null,
          implementadorId: cli.implementador_id || null,
          implementadorNombre: cli.implementador_id ? (nombreImpl[cli.implementador_id] || null) : null,
          desarrolladorId: cli.desarrollador_id || null,
          desarrolladorNombre: cli.desarrollador_id ? (nombreImpl[cli.desarrollador_id] || null) : null,
          estadoPago: cli.estado_pago || "al_dia",
          deudaDesde: cli.deuda_desde || null,
          goLiveEstimado: cli.go_live_estimado || null,
          relevamiento: respuestas, relevamientoEnviado: pasos.relevamiento,
          sucursalesCount: (sucPorCliente.get(cli.id) || []).length,
          notasCount: (notasPorCliente.get(cli.id) || []).length,
          tieneArchivoSucursales: pasos.sucursales,
          omitioSucursales: !!cli.sucursales_omitido && !pasos.sucursales,
          tieneVentas: !!ventas,
          completados: Object.values(pasos).filter(Boolean).length,
          totalPasos: 8,
          ultimaActividad: cli.ultima_actividad || null,
          estadoSeguimiento: cli.estado_seguimiento || "gris",
        });
      }
      if (actualizacionesFase.length) await Promise.all(actualizacionesFase);
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
      const miNombre = await nombreDeSesion(sc);
      if (!miNombre) return res.json({ miNombre: null, conectado: null });
      const { data } = await db.from("calendar_conexiones").select("google_email, conectado_at").eq("responsable", miNombre).maybeSingle();
      return res.json({ miNombre, conectado: data || null });
    }

    if (action === "calendarDisconnect") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const miNombre = await nombreDeSesion(sc);
      if (!miNombre) return res.status(400).json({ error: "Tu usuario no tiene un perfil propio" });
      await db.from("calendar_conexiones").delete().eq("responsable", miNombre);
      return res.json({ ok: true });
    }

    // Disponibilidad semanal personal — cada persona ve y edita únicamente la suya.
    if (action === "getMyAvailability") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const { data: yo } = await db.from("equipo").select("id").eq("codigo", sc).maybeSingle();
      if (!yo) return res.json({ slots: [] });
      const { data } = await db.from("disponibilidad_equipo").select("dia_semana, hora").eq("equipo_id", yo.id).order("dia_semana").order("hora");
      return res.json({ slots: data || [] });
    }

    if (action === "setMyAvailability") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const { data: yo } = await db.from("equipo").select("id").eq("codigo", sc).maybeSingle();
      if (!yo) return res.status(400).json({ error: "Tu usuario no tiene un perfil propio (¿estás con el código maestro?) — creá tu usuario personal en Equipo primero." });
      const slots = Array.isArray(req.body.slots) ? req.body.slots : [];
      const limpio = slots
        .filter((s) => Number.isInteger(s.dia_semana) && s.dia_semana >= 0 && s.dia_semana <= 6 && /^\d{2}:\d{2}$/.test(s.hora))
        .map((s) => ({ equipo_id: yo.id, dia_semana: s.dia_semana, hora: s.hora }));
      // Reemplazo total: se borra lo anterior y se inserta la lista nueva completa — más simple
      // y predecible que ir comparando diffs para una lista chica como esta.
      await db.from("disponibilidad_equipo").delete().eq("equipo_id", yo.id);
      if (limpio.length) await db.from("disponibilidad_equipo").insert(limpio);
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

    if (action === "getAvisosConfig") {
      const { data } = await db.from("config").select("valor").eq("clave", "avisos").maybeSingle();
      return res.json({ automatico: !!data?.valor?.automatico });
    }

    if (action === "setAvisosConfig") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      await db.from("config").upsert({ clave: "avisos", valor: { automatico: !!req.body.automatico } });
      return res.json({ ok: true });
    }

    if (action === "listarTrackersRedmine") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const cli = req.body.code ? await getCliente(cc) : null;
      const trackers = await listarTrackers(cli ? await redmineKeyDelCliente(cli) : null);
      return res.json({ trackers });
    }

    if (action === "vincularTicketRedmine") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const featureId = Number(req.body.featureIssueId);
      if (!featureId || !Number.isInteger(featureId)) return res.status(400).json({ error: "Ingresá el número de ticket tal cual aparece en la URL de Redmine (solo el número)" });
      const { data: rm } = await db.from("redmine_altas").select("id").eq("cliente_id", cli.id).maybeSingle();
      if (rm) {
        await db.from("redmine_altas").update({ feature_issue_id: featureId, estado: "enviado", detalle: null }).eq("id", rm.id);
      } else {
        await db.from("redmine_altas").insert({ cliente_id: cli.id, estado: "enviado", detalle: null, payloads: [], feature_issue_id: featureId });
      }
      let avisoTracker = "";
      try { avisoTracker = await corregirTrackerDeTicket(featureId, "Feature", await redmineKeyDelCliente(cli)); } catch (e) { avisoTracker = " (no se pudo verificar el tracker: " + e.message + ")"; }
      await addHistory(cli.id, who || "Equipo", "Vinculó manualmente el ticket #" + featureId + " de Redmine como Feature de este cliente" + avisoTracker);
      return res.json(await assemble(cli));
    }

    if (action === "crearTicketRedmine") {
      if (!team) return res.status(403).json({ error: "Solo para el equipo de implementaciones" });
      const cli = await getCliente(cc);
      if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });
      const { data: rm } = await db.from("redmine_altas").select("feature_issue_id").eq("cliente_id", cli.id).maybeSingle();
      if (!rm?.feature_issue_id) return res.status(400).json({ error: "Este cliente todavía no tiene la Feature de alta creada en Redmine — hace falta un alta exitosa antes de poder colgarle tickets nuevos." });

      const plantilla = req.body.plantilla;
      let payload;
      if (plantilla === "migracion_ventas") {
        if (!req.body.desde || !req.body.hasta) return res.status(400).json({ error: "Falta el período (desde / hasta)" });
        payload = buildTicketMigracionVentas(cli.nombre, req.body.desde, req.body.hasta, req.body.trackerName);
      } else if (plantilla === "eliminar_pos") {
        payload = buildTicketEliminarPos(cli.nombre, req.body.entorno === "productivo" ? "productivo" : "sandbox", req.body.trackerName);
      } else if (plantilla === "cambio_rol_admin") {
        if (!(req.body.usuarios || "").trim()) return res.status(400).json({ error: "Indicá qué usuarios deben quedar como administradores" });
        payload = buildTicketCambioRolAdmin(cli.nombre, req.body.usuarios, req.body.trackerName);
      } else if (plantilla === "libre") {
        if (!(req.body.subject || "").trim()) return res.status(400).json({ error: "Falta el asunto del ticket" });
        payload = buildTicketLibre(cli.nombre, req.body.subject, req.body.description, req.body.trackerName);
      } else {
        return res.status(400).json({ error: "Plantilla de ticket desconocida" });
      }

      const result = await sendToRedmine([payload], await redmineKeyDelCliente(cli), rm.feature_issue_id);
      if (result.estado !== "enviado") return res.status(502).json({ error: "No se pudo crear el ticket: " + (result.detalle || "error desconocido") });
      const nuevoId = result.issueIds?.[0];
      await addHistory(cli.id, who || "Equipo", "Creó un ticket en Redmine (\"" + payload.issue.subject + "\")" + (nuevoId ? " — #" + nuevoId : ""));
      return res.json({ ok: true, issueId: nuevoId });
    }

    if (action === "retryRedmine") {
      const cli = await getCliente(cc);
      const { data: rm } = await db.from("redmine_altas").select("*").eq("cliente_id", cli.id).maybeSingle();
      if (!rm) return res.status(404).json({ error: "Todavía no hay alta preparada (se dispara con el primer login del cliente)" });
      // Se reconstruye el payload con los datos ACTUALES del cliente (nombre, tenant, CUIT) —
      // así, si algo se completó después del primer login (ej: el CUIT), el reintento ya sale
      // bien en vez de reenviar para siempre el payload viejo guardado la primera vez.
      const { data: cfgRow } = await db.from("config").select("valor").eq("clave", "redmine").maybeSingle();
      const payloadsCompletos = buildRedminePayloads(cli.nombre, cli.tenant_productivo, cli.codigo, cfgRow?.valor?.projectId, cli.cuits);
      // Si la Feature ya se había creado bien en un intento anterior, NO la volvemos a crear
      // (evita duplicarla) — solo reintentamos lo que falta, colgado de esa Feature real.
      const payloads = rm.feature_issue_id ? [payloadsCompletos[1]] : payloadsCompletos;
      const result = await sendToRedmine(payloads, await redmineKeyDelCliente(cli), rm.feature_issue_id || null);
      const featureId = rm.feature_issue_id || result.issueIds?.[0] || null;
      const userStoryId = rm.feature_issue_id ? (result.issueIds?.[0] || rm.user_story_issue_id) : (result.issueIds?.[1] || rm.user_story_issue_id);
      await db.from("redmine_altas").update({
        payloads: payloadsCompletos, estado: result.estado, detalle: result.detalle, actualizado_at: new Date().toISOString(),
        feature_issue_id: featureId, user_story_issue_id: userStoryId,
      }).eq("id", rm.id);
      await addHistory(cli.id, who || "Equipo", result.estado === "enviado" ? "Reenvió el alta a Redmine: creada la Feature y la US de sandbox" : "Reintentó el envío a Redmine — " + result.detalle);
      return res.json(await assemble(cli));
    }

    if (action === "regenCreds") {
      // DEPRECATED: Ya no se regeneran credenciales desde el portal
      // El usuario debe generar nuevas en su cuenta Nubceo e ingresarlas con "guardarCredenciales"
      return res.status(400).json({ 
        error: "Este botón ya no está disponible. Para generar nuevas credenciales: 1) Abrí app.nubceo.com 2) Mi negocio → API keys 3) Creá una nueva 4) Pegála en el portal" 
      });
    }


    if (action === "setEstadoCliente") {
      // Guardar estado visual del cliente (gris, verde, amarillo, rojo)
      const { estado } = req.body || {};
      
      if (!code || !["gris", "verde", "amarillo", "rojo"].includes(estado)) {
        return res.status(400).json({ error: "Estado inválido" });
      }
      
      try {
        const cli = await getCliente(code);
        const { error: updErr } = await db
          .from("clientes")
          .update({ estado_seguimiento: estado })
          .eq("id", cli.id);
        if (updErr) {
          console.error("Error al guardar estado_seguimiento:", updErr.message);
          return res.status(500).json({ error: updErr.message });
        }

        await addHistory(cli.id, who || "Equipo", `Cambió estado a ${estado}`);
        return res.json({ success: true, estado });
      } catch (e) {
        console.error("Error en setEstadoCliente:", e.message);
        return res.status(500).json({ error: e.message });
      }
    }



    if (action === "guardarSucursalesMasivo") {
      // Guardar múltiples sucursales desde upload de Excel
      const { sucursales } = req.body || {};
      
      if (!Array.isArray(sucursales) || sucursales.length === 0) {
        return res.status(400).json({ error: "No hay sucursales para guardar" });
      }

      try {
        const cli = await getCliente(cc);
        const team = await getTeam(sc);
        
        // Preparar datos para insertar
        const datosInsert = sucursales.map((s) => ({
          cliente_id: cli.id,
          team_id: team.id,
          nombre: s.nombre || "",
          codigo_pdv: s.codigopdv || "",
          numero_comercio: s.numercomercio || "",
          nombre_comercio: s.nombrecomercio || "",
          plataforma: s.plataforma || "",
          cuit: s.cuit || "",
          empresa: s.empresa || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        // Insertar en tabla sucursales_cabecera
        const { data, error } = await db
          .from("sucursales_cabecera")
          .insert(datosInsert);

        if (error) {
          console.error("Error insertando sucursales:", error.message);
          return res.status(500).json({ error: "Error al guardar: " + error.message });
        }

        // Log de auditoría
        await addHistory(
          cli.id,
          who || "Cliente",
          `Cargó ${sucursales.length} sucursal(es) masivamente`
        ).catch(() => {});

        return res.json({ 
          success: true, 
          cantidad: sucursales.length,
          mensaje: `${sucursales.length} sucursal(es) guardada(s) correctamente`
        });
      } catch (e) {
        console.error("Error en guardarSucursalesMasivo:", e.message);
        return res.status(500).json({ error: e.message });
      }
    }


    if (action === "guardarCredenciales") {
      // El desarrollador del cliente (o el equipo) ingresa las credenciales REALES
      // generadas en Nubceo (Mi negocio -> API Keys). El portal ya no genera claves.
      // El permiso ya está validado arriba por puedeVerCliente (team || sc === cc).
      try {
        const cli = await getCliente(cc);
        if (!cli) return res.status(404).json({ error: "Cliente no encontrado" });

        const key = (req.body.key || "").trim();
        const secret = (req.body.secret || "").trim();
        const nombreKey = (req.body.nombreKey || "").trim();

        if (!key) return res.status(400).json({ error: "La API Key no puede estar vacía" });
        if (!secret) return res.status(400).json({ error: "La API Secret no puede estar vacía" });
        // Sin validar prefijo/longitud: el formato real de Nubceo puede variar y no queremos
        // rechazar una credencial válida. Solo chequeamos que no vengan vacías.

        const { error: credsErr } = await db.from("credenciales_api").upsert(
          {
            cliente_id: cli.id,
            entorno: "sandbox",
            api_key: key,
            api_secret: secret,
            generado_at: new Date().toISOString(),
          },
          { onConflict: "cliente_id,entorno" }
        );
        if (credsErr) {
          console.error("Error al guardar credenciales:", credsErr.message);
          return res.status(500).json({ error: credsErr.message });
        }

        await addHistory(
          cli.id,
          who || (team ? "Equipo Nubceo" : "Cliente"),
          "Cargó las credenciales de API sandbox generadas en Nubceo" + (nombreKey ? ' (key: "' + nombreKey + '")' : "")
        );

        return res.json(await assemble(cli));
      } catch (err) {
        console.error("Error en guardarCredenciales:", err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: "Acción desconocida: " + action });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error del servidor: " + e.message });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
