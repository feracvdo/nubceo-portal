import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { cliente_id } = req.query;

    if (!cliente_id) {
      return res.status(400).json({ error: 'cliente_id es requerido' });
    }

    // Obtener mails enviados
    const { data: mails, error: mailsError } = await db
      .from('mailsEnviados')
      .select('*')
      .eq('cliente_id', cliente_id)
      .order('enviado_at', { ascending: false });

    if (mailsError) {
      throw mailsError;
    }

    // Obtener contactos del cliente
    const { data: contactos, error: contactosError } = await db
      .from('involucrados')
      .select('*')
      .eq('cliente_id', cliente_id)
      .order('nombre');

    if (contactosError) {
      throw contactosError;
    }

    return res.status(200).json({
      success: true,
      mails: mails || [],
      contactos: contactos || [],
    });
  } catch (error) {
    console.error('Error en endpoint get-mails:', error);
    return res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
}
