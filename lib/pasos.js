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
  return computarPasos(cli, {
    relevamientoRow: rv.data, archivos: arch.data || [], procesadoras: procs.data || [],
    eventos: evs.data || [], tieneApi: (creds.count || 0) > 0,
  });
}

// Núcleo puro (sin queries): recibe los datos ya traídos y calcula los 8 pasos.
// Se separó de calcularPasos() para poder reusar exactamente la misma lógica cuando
// se trae la info de MUCHOS clientes de una — ver listClients en pages/api/portal.js,
// que trae todo en bloque (7 queries en total) en vez de repetir 5 queries por cliente.
export function computarPasos(cliente, { relevamientoRow, archivos, procesadoras, eventos, tieneApi }) {
  const respuestas = relevamientoRow?.respuestas || {};
  const archivosArr = archivos || [];
  const eventosArr = eventos || [];
  const procesadorasArr = procesadoras || [];
  const ventas = archivosArr.find((a) => a.tipo === "ventas");
  const ventasOk = !!(ventas && ventas.validacion?.ok !== false);
  const tieneEvento = (tipo, realizado) => eventosArr.some((e) => e.tipo === tipo && e.estado !== "cancelado" && (!realizado || e.estado === "realizado"));

  const pasos = {
    // Alcanza con que UNA procesadora esté "conectado" — las demás pueden seguir
    // en proceso o sin conectar, no bloquean el avance de este paso.
    procesadoras: procesadorasArr.some((p) => p.estado === "conectado"),
    introduccion: !!cliente.intro_leida,
    relevamiento: !!relevamientoRow?.enviado_at,
    sucursales: archivosArr.some((a) => a.tipo === "sucursales"),
    // El paso se puede dar por cumplido de dos formas: por la señal concreta de la vía
    // (API con credenciales / CSV validado), o porque el cliente marcó "Leí este paso".
    conexion: respuestas.conexionLeida ? true : (respuestas.d1 === "api" ? tieneApi : respuestas.d1 === "csv" ? ventasOk : respuestas.d1 === "ambos" ? (tieneApi && ventasOk) : false),
    capacitacion: tieneEvento("capacitacion_conciliador") || tieneEvento("capacitacion_cash"),
    sandbox: tieneEvento("resultados_sandbox", true),
    golive: tieneEvento("golive", true),
  };
  return { pasos, respuestas, archivos: archivosArr, eventos: eventosArr, ventas, ventasOk, tieneApi, procesadoras: procesadorasArr };
}

export const ORDEN_PASOS = ["procesadoras", "introduccion", "relevamiento", "sucursales", "conexion", "capacitacion", "sandbox", "golive"];

// Fase sugerida (0..8) — el tablero tiene 9 columnas que no calzan 1 a 1 con los 8 "pasos"
// del portal del cliente (Workshop y Hypercare no son pasos del cliente, son hitos), así que
// acá se combinan ambas señales en el orden real del tablero. Nunca decide retroceder: eso lo
// compara quien llama esta función, y el equipo siempre puede arrastrar la tarjeta a mano.
export function faseSugerida(pasosCompletos, hitosCompletos) {
  const hitos = hitosCompletos || {};
  const condiciones = [
    pasosCompletos.procesadoras,                                 // 0. Vinculación
    pasosCompletos.introduccion,                                 // 1. Introducción
    pasosCompletos.relevamiento,                                 // 2. Relevamiento
    !!hitos.workshop,                                             // 3. Workshop
    pasosCompletos.sucursales && pasosCompletos.conexion,         // 4. Integración API/CSV
    !!hitos.sandbox,                                              // 5. Configuración de reglas y secuencias
    pasosCompletos.capacitacion,                                  // 6. Capacitación
    pasosCompletos.golive,                                        // 7. Go-Live
    !!hitos.workshop_cierre,                                      // 8. Hypercare
  ];
  let racha = 0;
  for (const c of condiciones) { if (c) racha++; else break; }
  return Math.min(racha, 8);
}
