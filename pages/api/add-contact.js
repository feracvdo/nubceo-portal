import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { cliente_id, nombre, email, rol } = req.body;

    // Validaciones
    if (!cliente_id || !nombre || !email || !rol) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const rolesValidos = ['sponsor', 'key_user', 'otro'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Verificar que el cliente existe
    const { data: cliente, error: clienteError } = await db
      .from('clientes')
      .select('id')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Insertar contacto
    const { data: contacto, error: insertError } = await db
      .from('involucrados')
      .insert({
        cliente_id,
        nombre,
        email,
        rol,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error insertando contacto:', insertError);
      return res.status(500).json({ error: 'Error al agregar contacto: ' + insertError.message });
    }

    return res.status(200).json({
      success: true,
      contact: contacto,
      message: 'Contacto agregado correctamente',
    });
  } catch (error) {
    console.error('Error en endpoint add-contact:', error);
    return res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
}
