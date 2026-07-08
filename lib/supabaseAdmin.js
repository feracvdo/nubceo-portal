// lib/supabaseAdmin.js
// Cliente de Supabase con la SERVICE ROLE KEY.
// SOLO se importa desde rutas de API (servidor). Nunca desde componentes.
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
