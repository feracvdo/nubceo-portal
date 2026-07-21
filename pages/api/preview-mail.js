// pages/api/preview-mail.js
// Devuelve el HTML de la plantilla para la vista previa, usando exactamente la
// misma fuente que el envío (lib/plantillasMail.js) — así preview == enviado.
import { generarPlantilla } from "../../lib/plantillasMail";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { plantilla, datos, cliente } = req.body || {};

  // Compatibilidad: si llega solo `cliente` (string), lo usamos como nombre.
  const datosPlantilla = datos || { clienteNombre: cliente || "Cliente" };

  const resultado = generarPlantilla(plantilla, datosPlantilla);
  if (!resultado) {
    return res.status(400).json({ error: "Plantilla no válida" });
  }

  try {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(resultado.html);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
