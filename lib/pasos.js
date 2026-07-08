// lib/pasos.js
// Definición de los 8 pasos del portal y el cálculo de cuáles están completos —
// centralizado acá para que el panel de admin (listClients) y el cron de
// recordatorios (cron-recordatorios) usen exactamente el mismo criterio.
export const PASOS_DEF = [
  { id: "procesadoras", nombre: "Procesadoras" },
  { id: "introduccion", nombre: "Introducción" },
  { id: "relevamiento", nombre: "Relevamiento" },
  { id: "sucursales", nombre: "Sucursales" },
  { id: "conexion", nombre: "Conexión API / CSV" },
  { id: "capacitacion", nombre: "Capacitación" },
  { id: "sandbox", nombre: "Pruebas sandbox" },
  { id: "golive", nombre: "Go-live" },
];
export const NOMBRE_PASO = Object.fromEntries(PASOS_DEF.map((p) => [p.id, p.nombre]));

// Devuelve { pasos: {id:boolean,...}, respuestas, archivos, eventos } para un cliente.
export async function calcularPasos(db, cli) {
  const [rv, arch, procs, evs, creds] = await Promise.all([
    db.from("relevamientos").select("respuestas, enviado_at").eq("cliente_id", cli.id).maybeSingle(),
    db.from("archivos").select("tipo, validacion").eq("cliente_id", cli.id),
    db.from("procesadoras_cliente").select("estado").eq("cliente_id", cli.id),
    db.from("eventos").select("tipo, estado").eq("cliente_id", cli.id),
    db.from("credenciales_api").select("id", { count: "exact", head: true }).eq("cliente_id", cli.id),
  ]);
  const respuestas = rv.data?.respuestas || {};
  const archivos = arch.data || [];
  const eventos = evs.data || [];
  const ventas = archivos.find((a) => a.tipo === "ventas");
  const ventasOk = !!(ventas && ventas.validacion?.ok !== false);
  const tieneApi = (creds.count || 0) > 0;
  const tieneEvento = (tipo, realizado) => eventos.some((e) => e.tipo === tipo && e.estado !== "cancelado" && (!realizado || e.estado === "realizado"));

  const pasos = {
    // Alcanza con que UNA procesadora esté "conectado" — las demás pueden seguir
    // en proceso o sin conectar, no bloquean el avance de este paso.
    procesadoras: (procs.data || []).some((p) => p.estado === "conectado"),
    introduccion: !!cli.intro_leida,
    relevamiento: !!rv.data?.enviado_at,
    sucursales: archivos.some((a) => a.tipo === "sucursales"),
    conexion: respuestas.d1 === "api" ? tieneApi : respuestas.d1 === "csv" ? ventasOk : respuestas.d1 === "ambos" ? (tieneApi && ventasOk) : false,
    capacitacion: tieneEvento("capacitacion_conciliador") || tieneEvento("capacitacion_cash"),
    sandbox: tieneEvento("resultados_sandbox", true),
    golive: tieneEvento("golive", true),
  };
  return { pasos, respuestas, archivos, eventos, ventas, ventasOk, tieneApi, procesadoras: procs.data || [] };
}

export const ORDEN_PASOS = ["procesadoras", "introduccion", "relevamiento", "sucursales", "conexion", "capacitacion", "sandbox", "golive"];

// Fase sugerida (0..7) a partir de la racha de pasos completos desde el principio —
// se usa para auto-avanzar el tablero sin dar saltos raros si algo se completa fuera
// de orden. Nunca decide retroceder: eso lo compara quien llama esta función.
export function faseSugerida(pasosCompletos) {
  let racha = 0;
  for (const p of ORDEN_PASOS) { if (pasosCompletos[p]) racha++; else break; }
  return Math.min(racha, 7);
}
