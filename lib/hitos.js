// lib/hitos.js
// Hitos del calendario de "Plazos y recordatorios" del panel de equipo. Son más
// granulares que los 8 pasos del portal del cliente (por ejemplo, separan el
// workshop de relevamiento de la reunión técnica, y suman el fin del desarrollo
// de API y el workshop de cierre) y cambian según si el cliente va por API o CSV.
//
// hitosPara(respuestas): devuelve la lista de hitos aplicable a un cliente puntual
// según su respuesta a "d1" (api / csv / indef) en el relevamiento.
export function hitosPara(respuestas) {
  const via = respuestas?.d1; // "api" | "csv" | "indef" | undefined
  const base = [
    { id: "vinculacion_procesadora", nombre: "Vinculación de procesadora", responsable: "Cliente y CX" },
    { id: "relevamiento", nombre: "Llenado del formulario de relevamiento", responsable: "Cliente" },
    { id: "workshop", nombre: "Realización del workshop", responsable: "Implementaciones y Cliente" },
    { id: "sucursales", nombre: "Llenado del archivo de sucursales", responsable: "Cliente" },
    {
      id: "reunion_tecnica",
      nombre: via === "csv" ? "Reunión de mapeo del CSV de ventas" : "Reunión técnica con PDV",
      responsable: "Implementaciones y Cliente",
    },
  ];
  if (via !== "csv") {
    // Vía API (o todavía indefinida): el desarrollo de API es un hito propio.
    base.push({ id: "fin_desarrollo_api", nombre: "Fin del desarrollo de la API", responsable: "Desarrollador Nubceo" });
  }
  base.push(
    { id: "sandbox", nombre: "Prueba en sandbox", responsable: "Implementación" },
    { id: "golive", nombre: "Go-live", responsable: "Cliente e Implementaciones" },
    { id: "workshop_cierre", nombre: "Workshop de cierre", responsable: "CX, Desarrollo e Implementaciones" },
  );
  return base;
}

// Nombre de un hito por id, sin necesidad de saber la vía (api/csv) — se usa en los
// mails, donde alcanza con un nombre razonable aunque no sea 100% el de esta implementación.
export const NOMBRE_HITO_GENERICO = Object.fromEntries(
  hitosPara({}).map((h) => [h.id, h.nombre]).concat(hitosPara({ d1: "csv" }).map((h) => [h.id, h.nombre]))
);

// Calcula qué hitos están completos para un cliente, reusando las mismas señales que
// calcularPasos() (pasos) más las específicas de estos hitos nuevos.
export function calcularHitos(cliente, pasos, extra) {
  // extra: { procesadoras, eventos, pruebas, apiDesarrolloCompleto, ventasArchivo? } — datos crudos
  // adicionales que calcularPasos() no expone tal cual.
  const tieneEvento = (tipo, realizado) => (extra.eventos || []).some((e) => e.tipo === tipo && e.estado !== "cancelado" && (!realizado || e.estado === "realizado"));
  return {
    vinculacion_procesadora: (extra.procesadoras || []).some((p) => p.estado === "conectado"),
    relevamiento: pasos.relevamiento,
    workshop: tieneEvento("workshop", true),
    sucursales: pasos.sucursales,
    reunion_tecnica: tieneEvento("reunion_tecnica", true),
    fin_desarrollo_api: !!cliente.api_desarrollo_completo,
    sandbox: (extra.pruebas?.sandbox?.status || "") === "ok",
    golive: pasos.golive,
    workshop_cierre: tieneEvento("workshop_cierre", true),
  };
}
