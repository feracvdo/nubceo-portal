import { createClient } from '@supabase/supabase-js';
import { mailBienvenida, mailRecordatorioPlantilla, mailVencidoPlantilla, mailWorkshop, mailGoLive } from '../../lib/plantillasMail';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const plantillas = {
  bienvenida: (cliente) => mailBienvenida(cliente),
  recordatorio: (cliente) => mailRecordatorioPlantilla({ clienteNombre: cliente.nombre, pasoNombre: 'Paso pendiente', fechaLimiteTxt: new Date().toLocaleDateString('es-AR') }),
  vencido: (cliente) => mailVencidoPlantilla({ clienteNombre: cliente.nombre, pasoNombre: 'Paso vencido', fechaLimiteTxt: new Date().toLocaleDateString('es-AR') }),
  workshop: (cliente) => mailWorkshop({ clienteNombre: cliente.nombre, fechaWorkshop: null, implementador: null }),
  golive: (cliente) => mailGoLive({ clienteNombre: cliente.nombre, implementador: null }),
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { cliente_id, plantilla } = req.body;

    if (!cliente_id || !plantilla) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }

    if (!plantillas[plantilla]) {
      return res.status(400).json({ error: 'Plantilla no válida' });
    }

    // Obtener datos del cliente
    const { data: cliente, error: clienteError } = await db
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Generar el mail según la plantilla
    const { html, subject } = plantillas[plantilla](cliente);

    return res.status(200).json({
      success: true,
      html,
      subject,
    });
  } catch (error) {
    console.error('Error en endpoint preview-mail:', error);
    return res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
}
