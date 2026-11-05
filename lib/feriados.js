// lib/feriados.js
// Días en los que el equipo no trabaja (Argentina): feriados nacionales, días no laborables
// con fines turísticos y feriados extraordinarios. La agenda del portal nunca ofrece turnos
// en estas fechas ni los fines de semana.
//
// Fuente principal: API pública de ArgentinaDatos (se consulta y se guarda en memoria 12 h).
// Si no responde, se usa esta lista. Para sumar un día puntual (por ejemplo un asueto de
// CABA que el equipo también se toma), agregalo en DIAS_EXTRA.

const LISTA_FIJA = {
  2026: [
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-23", "2026-03-24", "2026-04-02", "2026-04-03",
    "2026-05-01", "2026-05-25", "2026-06-15", "2026-06-20", "2026-07-09", "2026-07-10", "2026-08-17",
    "2026-10-12", "2026-11-09", "2026-11-23", "2026-12-07", "2026-12-08", "2026-12-25",
  ],
};
// Días que el equipo no trabaja aunque no sean feriado nacional.
export const DIAS_EXTRA = [
  "2026-11-10", // feriado en CABA y feriado bancario por la visita del Papa
  "2026-12-24", "2026-12-31", // vísperas: el equipo no agenda reuniones con clientes
];

const cache = {}; // año -> { dias: Set, ts }
async function deApi(anio) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch("https://api.argentinadatos.com/v1/feriados/" + anio, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j.map((x) => x.fecha).filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)) : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function diasNoLaborables(anios) {
  const out = new Set(DIAS_EXTRA);
  for (const anio of anios) {
    const c = cache[anio];
    if (!c || Date.now() - c.ts > 12 * 3600 * 1000) {
      const api = await deApi(anio);
      cache[anio] = { dias: new Set([...(api || []), ...(LISTA_FIJA[anio] || [])]), ts: Date.now() };
    }
    cache[anio].dias.forEach((d) => out.add(d));
  }
  return out;
}

// ── Hora de Argentina (UTC-3, sin horario de verano) ──
export const ZONA_AR = "America/Argentina/Buenos_Aires";
export const HORA_INICIO = 9;   // primer turno 09:00
export const HORA_FIN = 18;     // la reunión tiene que terminar a las 18:00
const OFFSET_MS = 3 * 3600 * 1000;
// Fecha (YYYY-MM-DD), día de la semana (0 = domingo) y hora en Argentina de un instante.
export function enArgentina(date) {
  const d = new Date(date.getTime() - OFFSET_MS);
  return { ymd: d.toISOString().slice(0, 10), dow: d.getUTCDay(), hora: d.getUTCHours(), minuto: d.getUTCMinutes() };
}
export function instanteAR(ymd, hh, mm) {
  return new Date(ymd + "T" + String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + ":00-03:00");
}
// ¿Se puede agendar una reunión de `durMin` minutos que empieza en `date`?
export function esHorarioLaboral(date, noLaborables, durMin = 60) {
  const a = enArgentina(date);
  if (a.dow === 0 || a.dow === 6) return false;
  if (noLaborables.has(a.ymd)) return false;
  const ini = a.hora * 60 + a.minuto;
  return ini >= HORA_INICIO * 60 && ini + durMin <= HORA_FIN * 60;
}
