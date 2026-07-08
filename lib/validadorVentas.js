// lib/validadorVentas.js — Validador del CSV de ventas.
// Port a JavaScript del "Validador CSV Nubceo" de Federico Ciccarone
// (validator.py + config.py), para correr en el navegador dentro del portal.
import {
  COLUMNAS_OBLIGATORIAS, COLUMNAS_ESPERADAS, CARD_BRANDS_VALIDOS,
  PLATFORM_CODES_VALIDOS, TIPOS_PAGO_VALIDOS, TIPOS_DOCUMENTO_VALIDOS,
} from "./nubceo";

const norm = (t) => String(t ?? "").replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ").toUpperCase();
const BRANDS = new Set(CARD_BRANDS_VALIDOS.map(norm));
const PLATFORMS = new Set(PLATFORM_CODES_VALIDOS.map(norm));
const TIPOS_PAGO = new Set(TIPOS_PAGO_VALIDOS.map(norm));
const TIPOS_DOC = new Set(TIPOS_DOCUMENTO_VALIDOS);

// Parser CSV con soporte de comillas
export function parseCSV(text, sep) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return { header: [], rows: [] };
  if (!sep) sep = [";", ",", "\t", "|"].map((s) => [s, lines[0].split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const parseLine = (line) => {
    const out = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseLine);
  return { header, rows, sep };
}

// Montos formato AR: "1.234,56" → 1234.56
const parseMonto = (v) => {
  const s = String(v ?? "").trim();
  if (s === "" || s.toLowerCase() === "nan" || s.toLowerCase() === "none") return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const parseFecha = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s); return isNaN(d) ? null : d; }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) { const d = new Date(+("" + (m[3].length === 2 ? "20" + m[3] : m[3])), +m[2] - 1, +m[1]); return isNaN(d) ? null : d; }
  const d = new Date(s);
  return isNaN(d) ? null : d;
};

export function validarVentas(text) {
  const { header, rows, sep } = parseCSV(text);
  const r = validarTabla(header, rows);
  if (r.resumen) r.resumen.sep = sep === "\t" ? "tabulación" : sep;
  return r;
}

// Núcleo de la validación, separado de parseCSV: recibe header + filas ya parseadas (arrays de
// strings) y devuelve el mismo resultado que validarVentas(). Se reusa para revalidar en vivo
// cuando el cliente corrige una celda en la preview, sin tener que ir y volver por texto CSV.
export function validarTabla(header, rows) {
  const errores = [];
  const warnings = [];
  if (!rows.length) return { ok: false, errores: ["El archivo no tiene filas de datos."], warnings, filas: [], header, idx: {}, rows, resumen: null };

  const seen = new Set();
  const hdr = header.map((h) => { const c = String(h ?? "").trim(); if (seen.has(c)) return null; seen.add(c); return c; });
  const idx = {}; hdr.forEach((h, i) => { if (h) idx[h] = i; });

  for (const col of COLUMNAS_OBLIGATORIAS) if (!(col in idx)) errores.push("Falta columna obligatoria: " + col);
  if (errores.length) return { ok: false, errores, warnings, filas: [], header: hdr, idx, rows, resumen: null };
  for (const col of COLUMNAS_ESPERADAS) if (!(col in idx)) warnings.push("Falta columna esperada: " + col);

  const get = (row, col) => (idx[col] !== undefined ? (row[idx[col]] ?? "").toString().trim() : "");

  // Agrupación por ID de venta (multipago)
  const porVenta = new Map();
  rows.forEach((r, i) => {
    const id = get(r, "ID de venta");
    if (!porVenta.has(id)) porVenta.set(id, []);
    porVenta.get(id).push(i);
  });

  // Cada error/warning va como {col, msg}: `col` es la columna a resaltar en la preview, `msg` el texto.
  const filas = rows.map((r, i) => {
    const errs = [];
    const id = get(r, "ID de venta");
    if (!id) errs.push({ col: "ID de venta", msg: "ID de venta vacío" });

    if ("CUIT" in idx) { const c = get(r, "CUIT"); if (!c || c.toLowerCase() === "nan") errs.push({ col: "CUIT", msg: "CUIT vacío" }); }

    if (!parseFecha(get(r, "Fecha"))) errs.push({ col: "Fecha", msg: "Fecha inválida" });

    const bruto = parseMonto(get(r, "Monto bruto venta"));
    if (bruto === null || Number.isNaN(bruto)) errs.push({ col: "Monto bruto venta", msg: "Monto bruto inválido o vacío" });

    if ("Tipo" in idx) { const t = get(r, "Tipo"); if (t && !TIPOS_DOC.has(t)) errs.push({ col: "Tipo", msg: "Tipo inválido: '" + t + "' (válidos: " + TIPOS_DOCUMENTO_VALIDOS.join(", ") + ")" }); }

    const tp = get(r, "Tipo de pago");
    if (tp && !TIPOS_PAGO.has(norm(tp))) errs.push({ col: "Tipo de pago", msg: "Tipo de pago inválido: '" + tp + "' (válidos: " + TIPOS_PAGO_VALIDOS.join(", ") + ")" });
    if (!tp) errs.push({ col: "Tipo de pago", msg: "Tipo de pago vacío" });

    if ("Marca de tarjeta" in idx) { const m = get(r, "Marca de tarjeta"); if (m && !BRANDS.has(norm(m))) errs.push({ col: "Marca de tarjeta", msg: "Marca de tarjeta desconocida: '" + m + "'" }); }

    if ("Codigo Plataforma Externa" in idx) { const p = get(r, "Codigo Plataforma Externa"); if (p && !PLATFORMS.has(norm(p))) errs.push({ col: "Codigo Plataforma Externa", msg: "Codigo Plataforma Externa inválido: '" + p + "'" }); }

    return { i, id, errs, warns: [] };
  });

  // Multipago: ID de pago duplicado en misma venta + descuadre de montos
  for (const [id, idxs] of porVenta) {
    if (idxs.length <= 1) continue;
    if ("ID de pago" in idx) {
      const pagos = new Set(idxs.map((i) => get(rows[i], "ID de pago")));
      if (pagos.size !== idxs.length) idxs.forEach((i) => filas[i].errs.push({ col: "ID de pago", msg: "ID de pago duplicado en misma venta" }));
    }
    if ("Monto bruto pago" in idx) {
      const suma = idxs.reduce((a, i) => a + (parseMonto(get(rows[i], "Monto bruto pago")) || 0), 0);
      const ref = parseMonto(get(rows[idxs[0]], "Monto bruto venta")) || 0;
      if (Math.abs(suma - ref) > 1) idxs.forEach((i) => filas[i].errs.push({ col: "Monto bruto pago", msg: "Descuadre en montos por ID de venta (suma pagos " + suma.toFixed(2) + " vs venta " + ref.toFixed(2) + ")" }));
    }
  }

  // Smart Fix contable (de smart_fix.py): Neto == Bruto e Impuestos vacío → sugerir Impuestos = 0
  let fixContable = 0;
  if ("Monto neto" in idx && "Impuestos" in idx) {
    rows.forEach((r, i) => {
      const neto = parseMonto(get(r, "Monto neto"));
      const bruto = parseMonto(get(r, "Monto bruto venta"));
      const imp = get(r, "Impuestos");
      if (neto !== null && bruto !== null && !Number.isNaN(neto) && neto === bruto && (imp === "" || imp.toLowerCase() === "nan")) {
        filas[i].warns.push({ col: "Impuestos", msg: "Neto = Bruto con Impuestos vacío → se sugiere Impuestos = 0" });
        fixContable++;
      }
    });
  }

  const conError = filas.filter((f) => f.errs.length);
  const resumen = { total: rows.length, ok: rows.length - conError.length, conError: conError.length, fixContable };
  return { ok: conError.length === 0, errores, warnings, filas, header: hdr, idx, rows, resumen };
}

// Aplica Smart Fix contable y exporta en formato Nubceo:
// UTF-8, separado por ";", orden exacto de columnas, sin columnas internas.
export function exportarNubceo(resultado, aplicarFixContable) {
  const { rows, idx } = resultado;
  const get = (row, col) => (idx[col] !== undefined ? (row[idx[col]] ?? "").toString().trim() : "");
  const lineas = [COLUMNAS_ESPERADAS.join(";")];
  for (const r of rows) {
    const vals = COLUMNAS_ESPERADAS.map((col) => {
      let v = get(r, col);
      if (aplicarFixContable && col === "Impuestos" && (v === "" || v.toLowerCase() === "nan")) {
        const neto = get(r, "Monto neto"), bruto = get(r, "Monto bruto venta");
        if (neto && bruto && neto === bruto) v = "0";
      }
      return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    });
    lineas.push(vals.join(";"));
  }
  return "\ufeff" + lineas.join("\n"); // BOM para Excel + UTF-8
}
