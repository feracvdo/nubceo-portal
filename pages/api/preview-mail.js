// pages/api/preview-mail.js
import { mailBienvenida, mailRecordatorioPlantilla, mailVencidoPlantilla, mailWorkshop, mailGoLive } from "../../lib/plantillasMail";

const PLANTILLAS = {
  bienvenida: mailBienvenida,
  recordatorio: mailRecordatorioPlantilla,
  vencido: mailVencidoPlantilla,
  workshop: mailWorkshop,
  golive: mailGoLive,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { plantilla, cliente } = req.body;
  if (!plantilla || !PLANTILLAS[plantilla]) {
    return res.status(400).json({ error: "Plantilla no válida" });
  }

  try {
    const html = PLANTILLAS[plantilla](cliente);
    // Devuelve HTML directo, no JSON
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (e) {
    console.error("Error en preview-mail:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
