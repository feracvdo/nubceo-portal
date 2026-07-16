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

    const { cliente_id, plantilla, destinatarios } = req.body;

    if (!cliente_id || !plantilla || !destinatarios || destinatarios.length === 0) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }

    if (!plantillas[plantilla]) {
      return res.status(400).json({ error: 'Plantilla no válida' });
    }

    const { data: cliente, error: clienteError } = await db
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const { html, subject } = plantillas[plantilla](cliente);
    const emails = destinatarios.map(d => d.email);
    const nombredestinos = destinatarios.map(d => d.email);

    try {
      await enviarMail({
        to: emails,
        subject,
        html,
      });

      const { data: mailRecord, error: insertError } = await db
        .from('mailsEnviados')
        .insert({
          cliente_id,
          plantilla,
          asunto: subject,
          destinatarios: nombredestinos,
          estado: 'enviado',
          enviado_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error guardando historial:', insertError);
      }

      return res.status(200).json({
        success: true,
        mailId: mailRecord?.id,
        message: 'Mail enviado correctamente',
      });
    } catch (emailError) {
      console.error('Error enviando mail:', emailError);

      await db
        .from('mailsEnviados')
        .insert({
          cliente_id,
          plantilla,
          asunto: subject,
          destinatarios: nombredestinos,
          estado: 'error',
          error_msg: emailError.message,
          enviado_at: new Date().toISOString(),
        });

      return res.status(500).json({
        success: false,
        error: 'Error enviando mail: ' + emailError.message,
      });
    }
  } catch (error) {
    console.error('Error en endpoint send-mail:', error);
    return res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
}
