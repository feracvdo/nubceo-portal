// lib/avisosPlazos.js
// Arma y envía el mail de recordatorio o de incumplimiento para un plazo puntual,
// marca el plazo como avisado y deja registro en el historial del cliente.
// La usan tanto el cron diario (cron-recordatorios) como los botones manuales del
// panel de equipo, así el criterio de "a quién le toca qué" es siempre el mismo.
import { mailRecordatorio, mailIncumplimiento } from "./plantillasMail";
import { enviarMail } from "./email";
import { NOMBRE_HITO_GENERICO, hitosPara, calcularHitos } from "./hitos";
import { calcularPasos } from "./pasos";

// Argentina no tiene horario de verano desde 2009: UTC-3 todo el año.
export function hoyEnArgentina() {
  const ahora = new Date(Date.now() - 3 * 3600 * 1000);
  return ahora.toISOString().slice(0, 10); // YYYY-MM-DD
}
export function diffDias(fechaA, fechaB) {
  const a = new Date(fechaA + "T00:00:00Z");
  const b = new Date(fechaB + "T00:00:00Z");
  return Math.round((a - b) / 86400000);
}

// Decide si a un plazo le corresponde recordatorio o incumplimiento HOY — null si no
// le toca nada (todavía falta mucho, o ya se avisó lo que correspondía).
export function decidirTipoAviso(plazo, hoy) {
  const dias = diffDias(plazo.fecha_limite, hoy);
  if (!plazo.incumplimiento_enviado_at && dias < 0) return "incumplimiento";
  // Ventana amplia (0 o 1 día) para no perder el recordatorio si un día se corre.
  if (!plazo.recordatorio_enviado_at && dias >= 0 && dias <= 1) return "recordatorio";
  return null;
}

const fmtFechaLarga = (fechaISO) => {
  const d = new Date(fechaISO + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
};

// tipo: "recordatorio" | "incumplimiento"
export async function procesarAvisoPlazo(db, { cliente, plazoRow, tipo }) {
  const { data: involucrados } = await db.from("involucrados").select("nombre, email").eq("cliente_id", cliente.id);
  const destinatarios = (involucrados || []).map((p) => p.email).filter(Boolean);
  if (!destinatarios.length) return { enviado: false, motivo: "El cliente todavía no cargó involucrados con mail (paso de Relevamiento)." };

  let implementador = null;
  if (cliente.implementador_id) {
    const { data } = await db.from("equipo").select("nombre, email").eq("id", cliente.implementador_id).maybeSingle();
    implementador = data || null;
  }

  const pasoNombre = NOMBRE_HITO_GENERICO[plazoRow.paso] || plazoRow.paso;
  const fechaLimiteTxt = fmtFechaLarga(plazoRow.fecha_limite);
  const portalUrl = process.env.PORTAL_URL || null;

  const { subject, html } = tipo === "incumplimiento"
    ? mailIncumplimiento({ clienteNombre: cliente.nombre, pasoNombre, fechaLimiteTxt, portalUrl, implementador })
    : mailRecordatorio({ clienteNombre: cliente.nombre, pasoNombre, fechaLimiteTxt, portalUrl, implementador });

  await enviarMail({ to: destinatarios, subject, html });

  const campo = tipo === "incumplimiento" ? "incumplimiento_enviado_at" : "recordatorio_enviado_at";
  await db.from("plazos_cliente").update({ [campo]: new Date().toISOString() }).eq("id", plazoRow.id);
  await db.from("historial").insert({
    cliente_id: cliente.id,
    quien: "Portal (automático)",
    texto: (tipo === "incumplimiento" ? "Se envió aviso de plazo vencido" : "Se envió recordatorio (resta 1 día)") +
      " para el paso «" + pasoNombre + "» a: " + destinatarios.join(", "),
  });
  return { enviado: true, destinatarios };
}

// Revisa TODOS los plazos de un cliente puntual y manda ya mismo los avisos que
// correspondan — lo usa el botón manual de la tarjeta del cliente, sin depender del cron.
export async function enviarAvisosPendientesDeCliente(db, cliente) {
  const hoy = hoyEnArgentina();
  const { data: plazos } = await db.from("plazos_cliente").select("*").eq("cliente_id", cliente.id);
  if (!plazos || !plazos.length) return { enviados: [], omitidos: [], sinPlazos: true };

  const { pasos, respuestas, eventos, procesadoras } = await calcularPasos(db, cliente);
  const { data: pruebasRows } = await db.from("pruebas").select("*").eq("cliente_id", cliente.id);
  const hitosCliente = hitosPara(respuestas);
  const hitosCompletos = calcularHitos(cliente, pasos, { procesadoras, eventos, pruebas: Object.fromEntries((pruebasRows || []).map((p) => [p.etapa, p])) });

  const enviados = [];
  const omitidos = [];
  for (const plazo of plazos) {
    const nombre = NOMBRE_HITO_GENERICO[plazo.paso] || plazo.paso;
    if (!hitosCliente.some((h) => h.id === plazo.paso)) { omitidos.push({ paso: nombre, motivo: "el hito no aplica a este cliente" }); continue; }
    if (hitosCompletos[plazo.paso]) { omitidos.push({ paso: nombre, motivo: "ya está completo" }); continue; }
    const tipo = decidirTipoAviso(plazo, hoy);
    if (!tipo) { omitidos.push({ paso: nombre, motivo: "todavía no corresponde ningún aviso (no está vencido ni por vencer)" }); continue; }
    try {
      const r = await procesarAvisoPlazo(db, { cliente, plazoRow: plazo, tipo });
      if (r.enviado) enviados.push({ paso: nombre, tipo });
      else omitidos.push({ paso: nombre, motivo: r.motivo });
    } catch (e) {
      omitidos.push({ paso: nombre, motivo: e.message });
    }
  }
  return { enviados, omitidos, sinPlazos: false };
}
