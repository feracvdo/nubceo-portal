// pages/api/cron-recordatorios.js
// Corre 1 vez por día (ver vercel.json → 13:00 UTC = 10:00 Argentina). Solo manda algo
// si "Mails automáticos" está prendido en Configuración — apagado por default, para que
// el equipo dispare los avisos a mano desde la tarjeta de cada cliente hasta que se
// termine de probar el envío.
import { supabaseAdmin as db } from "../../lib/supabaseAdmin";
import { calcularPasos } from "../../lib/pasos";
import { hitosPara, calcularHitos } from "../../lib/hitos";
import { procesarAvisoPlazo, hoyEnArgentina, decidirTipoAviso } from "../../lib/avisosPlazos";

export default async function handler(req, res) {
  // Vercel Cron manda esta cabecera cuando CRON_SECRET está configurado; si alguien
  // pega la URL a mano sin el secreto, se rechaza.
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "No autorizado" });
  }

  const { data: cfgRow } = await db.from("config").select("valor").eq("clave", "avisos").maybeSingle();
  if (!cfgRow?.valor?.automatico) {
    return res.status(200).json({ ok: true, omitido: "Mails automáticos está apagado en Configuración — no se mandó nada. Usá el botón manual en cada cliente." });
  }

  const hoy = hoyEnArgentina();
  const resultados = { fecha: hoy, recordatorios: [], incumplimientos: [], omitidos: [], errores: [] };

  try {
    const { data: plazos } = await db.from("plazos_cliente").select("*");
    for (const plazo of plazos || []) {
      try {
        const tipo = decidirTipoAviso(plazo, hoy);
        if (!tipo) continue;

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
