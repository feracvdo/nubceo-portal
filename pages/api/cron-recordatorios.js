// pages/api/cron-recordatorios.js
// Corre 1 vez por día (ver vercel.json → 13:00 UTC = 10:00 Argentina) y para cada
// plazo definido decide si corresponde mandar el recordatorio ("resta 1 día") o el
// aviso de incumplimiento ("plazo vencido") — sin duplicar envíos gracias a las
// columnas *_enviado_at de plazos_cliente.
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";
import { calcularPasos } from "../../lib/pasos";
import { hitosPara, calcularHitos } from "../../lib/hitos";
import { procesarAvisoPlazo } from "../../lib/avisosPlazos";

// Argentina no tiene horario de verano desde 2009: UTC-3 todo el año.
function hoyEnArgentina() {
  const ahora = new Date(Date.now() - 3 * 3600 * 1000);
  return ahora.toISOString().slice(0, 10); // YYYY-MM-DD
}
function diffDias(fechaA, fechaB) {
  const a = new Date(fechaA + "T00:00:00Z");
  const b = new Date(fechaB + "T00:00:00Z");
  return Math.round((a - b) / 86400000);
}

export default async function handler(req, res) {
  // Vercel Cron manda esta cabecera cuando CRON_SECRET está configurado; si alguien
  // pega la URL a mano sin el secreto, se rechaza.
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "No autorizado" });
  }

  const hoy = hoyEnArgentina();
  const resultados = { fecha: hoy, recordatorios: [], incumplimientos: [], omitidos: [], errores: [] };

  try {
    const { data: plazos } = await db.from("plazos_cliente").select("*");
    for (const plazo of plazos || []) {
      try {
        const dias = diffDias(plazo.fecha_limite, hoy);
        // Ventana amplia (0 o 1 días para el recordatorio) para no perder el aviso si el cron
        // no corrió justo el día exacto; el flag *_enviado_at evita mandarlo dos veces.
        const necesitaRecordatorio = !plazo.recordatorio_enviado_at && dias >= 0 && dias <= 1;
        const necesitaIncumplimiento = !plazo.incumplimiento_enviado_at && dias < 0;
        if (!necesitaRecordatorio && !necesitaIncumplimiento) continue;

        const { data: cliente } = await db.from("clientes").select("*").eq("id", plazo.cliente_id).maybeSingle();
        if (!cliente) continue;

        const { pasos, respuestas, eventos, procesadoras } = await calcularPasos(db, cliente);
        const { data: pruebasRows } = await db.from("pruebas").select("*").eq("cliente_id", cliente.id);
        const hitosCliente = hitosPara(respuestas);
        if (!hitosCliente.some((h) => h.id === plazo.paso)) {
          resultados.omitidos.push({ cliente: cliente.nombre, paso: plazo.paso, motivo: "el hito no aplica a este cliente (cambió la vía API/CSV)" });
          continue;
        }
        const hitosCompletos = calcularHitos(cliente, pasos, { procesadoras, eventos, pruebas: Object.fromEntries((pruebasRows || []).map((p) => [p.etapa, p])) });
        if (hitosCompletos[plazo.paso]) {
          resultados.omitidos.push({ cliente: cliente.nombre, paso: plazo.paso, motivo: "el hito ya está completo" });
          continue;
        }

        const tipo = necesitaIncumplimiento ? "incumplimiento" : "recordatorio";
        const r = await procesarAvisoPlazo(db, { cliente, plazoRow: plazo, tipo });
        if (r.enviado) resultados[tipo === "incumplimiento" ? "incumplimientos" : "recordatorios"].push({ cliente: cliente.nombre, paso: plazo.paso });
        else resultados.omitidos.push({ cliente: cliente.nombre, paso: plazo.paso, motivo: r.motivo });
      } catch (e) {
        resultados.errores.push({ plazoId: plazo.id, error: e.message });
      }
    }
    return res.status(200).json({ ok: true, ...resultados });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
