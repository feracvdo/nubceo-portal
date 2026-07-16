import { createClient } from '@supabase/supabase-js';
import { mailBienvenida, mailRecordatorioPlantilla, mailVencidoPlantilla, mailWorkshop, mailGoLive } from '../../lib/plantillasMail';
import { enviarMail } from '../../lib/email';

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

    const { mail_id } = req.query;

    if (!mail_id) {
      return res.status(400).json({ error: 'mail_id es requerido' });
    }

    // Obtener el registro de mail
    const { data: mailRecord, error: mailError } = await db
      .from('mailsEnviados')
      .select('*')
      .eq('id', mail_id)
      .single();

    if (mailError || !mailRecord) {
      return res.status(404).json({ error: 'Mail no encontrado' });
    }

    // Obtener datos del cliente
    const { data: cliente, error: clienteError } = await db
      .from('clientes')
      .select('*')
      .eq('id', mailRecord.cliente_id)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Generar el mail según la plantilla guardada
    if (!plantillas[mailRecord.plantilla]) {
      return res.status(400).json({ error: 'Plantilla no válida' });
    }

    const { html, subject } = plantillas[mailRecord.plantilla](cliente);

    try {
      // Enviar mail
      await enviarMail({
        to: mailRecord.destinatarios,
        subject,
        html,
      });

      // Actualizar estado en la BD
      await db
        .from('mailsEnviados')
        .update({
          estado: 'enviado',
          error_msg: null,
          enviado_at: new Date().toISOString(),
        })
        .eq('id', mail_id);

      return res.status(200).json({
        success: true,
        message: 'Mail reenviado correctamente',
      });
    } catch (emailError) {
      console.error('Error reenviando mail:', emailError);

      // Actualizar con nuevo error
      await db
        .from('mailsEnviados')
        .update({
          estado: 'error',
          error_msg: emailError.message,
        })
        .eq('id', mail_id);

      return res.status(500).json({
        success: false,
        error: 'Error reenviando mail: ' + emailError.message,
      });
    }
  } catch (error) {
    console.error('Error en endpoint retry-mail:', error);
    return res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
}
