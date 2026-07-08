// lib/avisosPlazos.js
// Arma y envía el mail de recordatorio o de incumplimiento para un plazo puntual,
// marca el plazo como avisado y deja registro en el historial del cliente.
// La usan tanto el cron diario (cron-recordatorios) como el botón manual del panel
// de equipo (acción "enviarAvisoAhora"), así el criterio es siempre el mismo.
import { mailRecordatorio, mailIncumplimiento } from "./plantillasMail";
import { enviarMail } from "./email";
import { NOMBRE_HITO_GENERICO } from "./hitos";

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
