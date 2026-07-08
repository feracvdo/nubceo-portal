// lib/sucursalesTemplate.js — Convierte el archivo interno de sucursales del
// cliente (nro de comercio, procesadora, id de PDV, nombre, empresa/CUIT) al
// template oficial de carga masiva, aplicando las reglas:
// sin celdas vacías · códigos de PDV únicos entre sucursales · sin duplicados
// · comercios sin procesadora identificable → sucursal "No identificada".
import { TEMPLATE_SUCURSALES, CONECTORES } from "./nubceo";
import { parseCSV } from "./validadorVentas";

const TODOS = Object.values(CONECTORES).flat();
const norm = (t) => String(t ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Mapea el nombre de procesadora que escriba el cliente → platform_external_code
export function mapearProcesadora(texto) {
  const t = norm(texto);
  if (!t) return null;
  const directo = TODOS.find((c) => c.code === t);
  if (directo) return directo.code;
  const porNombre = TODOS.find((c) => norm(c.nombre).includes(t) || t.includes(norm(c.nombre).split(" ")[0]));
  if (porNombre) return porNombre.code;
  const alias = { payway: "prisma_ar", prisma: "prisma_ar", fiserv: "firstdata_ar", firstdata: "firstdata_ar", mp: "mercadopago_ar", "mercado pago": "mercadopago_ar", naranja: "naranja_ar", amex: "amex_ar", "american express": "amex_ar", getnet: "getnet_ar", cabal: "cabal_ar", gocuotas: "gocuotas_ar", "go cuotas": "gocuotas_ar", pedidosya: "pedidosya_ar", rappi: "rappi_ar", oca: "oca_uy", visanet: "visanet_uy" };
  for (const [k, v] of Object.entries(alias)) if (t.includes(k)) return v;
  return null;
}

// Detección heurística de columnas del archivo interno del cliente
function detectarColumnas(header) {
  const h = header.map(norm);
  const buscar = (...pats) => h.findIndex((c) => pats.some((p) => c.includes(p)));
  return {
    comercio: buscar("comercio", "establecimiento", "merchant"),
    procesadora: buscar("procesadora", "plataforma", "adquirente", "platform"),
    pdv: buscar("pdv", "punto de venta", "identificador", "codigo interno", "referencia"),
    nombre: buscar("nombre", "sucursal", "local"),
    empresa: buscar("cuit", "empresa", "razon social", "taxcode"),
  };
}

export function convertirSucursales(text, cuitUnico) {
  const { header, rows } = parseCSV(text);
  const errores = [], avisos = [];
  if (!rows.length) return { ok: false, errores: ["El archivo no tiene filas de datos."], avisos, salida: [] };

  const cols = detectarColumnas(header);
  const faltan = [];
  if (cols.comercio < 0) faltan.push("número de comercio");
  if (cols.pdv < 0) faltan.push("identificador de PDV");
  if (cols.nombre < 0) faltan.push("nombre de sucursal");
  if (faltan.length) errores.push("No pude identificar estas columnas en tu archivo: " + faltan.join(", ") + ". Renombrá los encabezados (ej: 'Numero de comercio', 'Procesadora', 'PDV', 'Nombre sucursal', 'CUIT') y volvé a subirlo.");
  if (cols.procesadora < 0) avisos.push("No encontré la columna de procesadora: los comercios sin procesadora van a ir a la sucursal 'No identificada' para revisar con tu implementador.");
  if (cols.empresa < 0 && !cuitUnico) avisos.push("No encontré la columna de empresa/CUIT y no cargaste un CUIT único: la columna taxCode va a quedar para completar.");
  if (errores.length) return { ok: false, errores, avisos, salida: [], mapeo: cols, header };

  const val = (r, i) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  const salida = [];
  const pdvVistos = new Map(); // pdv → nombre sucursal
  const filaVista = new Set();
  let noIdentificadas = 0;

  rows.forEach((r, n) => {
    const comercio = val(r, cols.comercio);
    const procTxt = val(r, cols.procesadora);
    const pdv = val(r, cols.pdv);
    let nombre = val(r, cols.nombre);
    const empresa = val(r, cols.empresa) || cuitUnico || "";
    const fila = n + 2;

    if (!comercio && !pdv && !nombre) return; // fila vacía

    const code = mapearProcesadora(procTxt);
    if (!code) {
      nombre = "No identificada";
      noIdentificadas++;
      avisos.push("Fila " + fila + ": procesadora '" + (procTxt || "(vacía)") + "' no identificada → la sucursal va como 'No identificada' con el comercio " + (comercio || "(sin nro)") + ". Revisala con tu implementador.");
    }

    // Sin celdas vacías
    const vacias = [];
    if (!nombre) vacias.push("nombre");
    if (!pdv && nombre !== "No identificada") vacias.push("identificador de PDV");
    if (!comercio) vacias.push("número de comercio");
    if (!empresa) vacias.push("CUIT/empresa");
    if (vacias.length) errores.push("Fila " + fila + ": celdas vacías (" + vacias.join(", ") + ") — el template no admite vacíos.");

    // PDV no repetido entre sucursales distintas
    if (pdv) {
      const previo = pdvVistos.get(pdv);
      if (previo && previo !== nombre) errores.push("Fila " + fila + ": el código de PDV '" + pdv + "' ya está usado por la sucursal '" + previo + "' — no puede repetirse en sucursales distintas.");
      else pdvVistos.set(pdv, nombre);
    }

    // Sin duplicados exactos (misma sucursal + procesadora + comercio)
    const clave = [nombre, code, comercio, empresa].join("|").toLowerCase();
    if (filaVista.has(clave)) { avisos.push("Fila " + fila + ": duplicado exacto — se descarta."); return; }
    filaVista.add(clave);

    salida.push({
      name: nombre,
      customerBranchReference: pdv || ("no-ident-" + noIdentificadas),
      taxCode: empresa,
      platform_external_code: code || "",
      platformBranchReference: comercio,
    });
  });

  return { ok: errores.length === 0, errores, avisos, salida, mapeo: cols, header, noIdentificadas };
}

export function exportarTemplateSucursales(salida) {
  const lineas = [TEMPLATE_SUCURSALES.join(";")];
  for (const s of salida) lineas.push(TEMPLATE_SUCURSALES.map((c) => s[c] ?? "").join(";"));
  return "\ufeff" + lineas.join("\n");
}
