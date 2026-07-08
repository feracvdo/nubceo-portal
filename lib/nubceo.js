// lib/nubceo.js — Formato oficial Nubceo.
// Portado del "Validador CSV Nubceo" de Federico Ciccarone (config.py).
// Compartido entre el portal (cliente) y las rutas de API (servidor).

export const COLUMNAS_OBLIGATORIAS = ["ID de venta", "Fecha", "Monto bruto venta", "Tipo de pago"];

export const COLUMNAS_ESPERADAS = [
  "ID de venta", "CUIT", "Sucursal", "Fecha", "Moneda venta", "Tipo",
  "Monto bruto venta", "Monto neto", "Impuestos", "Categoria", "Sub categoria",
  "Sub categoria 2", "Codigo de referencia", "ID de pago", "Codigo Plataforma Externa",
  "Fecha del pago", "Fecha de presentacion", "Lote", "Voucher", "Terminal",
  "Codigo de autorizacion", "Referencia de sucursal de plataforma", "Monto bruto pago",
  "Marca de tarjeta", "Numero de tarjeta", "Numero de identificacion del cliente",
  "Cuotas", "Codigo de promocion", "Tipo de pago", "Referencia externa",
  "Comodin 1", "Comodin 2", "Moneda pago", "Tasa de conversion", "Importe convertido",
];

export const CARD_BRANDS_VALIDOS = [
  "ACCOR", "AMEX", "ANDA CREDIT", "ANK", "ARGENCARD", "BILLETERA SANTA FE", "BM CIUDAD",
  "BNA PLUS", "CABAL", "CABAL DEBIT", "CDNI", "CENTROCARD", "CLARO PAY", "CONSUMAX",
  "CREDENCIAL MBARETE", "CREDICASH", "CREDITOS DIRECTOS", "DINAMICA", "DINERS CLUB",
  "DISCOVER", "FALABELLA CMR", "ITALCRED", "LOCRED", "MAESTRO", "MAESTRO DEBIT",
  "MASTERCARD", "MASTERCARD DEBIT", "MERCADO PAGO", "MODO", "MONI ONLINE", "NARANJA",
  "NARANJA DEBIT", "NATIVA", "NOA EXPRESS", "OCA", "OTHER", "PASSCARD", "POSNET CELULAR",
  "REBA", "RED LIDER", "RESIMPLE", "SOL", "SUCREDITO", "SUPER DIGITAL", "TARJETA MAS",
  "TICKET NACION", "TITANIO", "TUYA CREDITO", "TUYA PREPAGA", "UALA", "UNICA",
  "UNION PAY", "VALEPEI", "VISA", "VISA DEBIT", "VISA PREPAGA", "YACARE QR",
];

export const TIPOS_PAGO_VALIDOS = ["cash", "debit", "credit", "qr", "wallet"];
export const TIPOS_DOCUMENTO_VALIDOS = ["invoice", "creditNote", "chargeback", "adjustment"];

// ── Conectores por país (derivado de PLATFORM_CODES_VALIDOS) ──
export const CONECTORES = {
  "🇦🇷 Argentina": [
    { code: "prisma_ar", nombre: "Prisma / Payway" },
    { code: "firstdata_ar", nombre: "Fiserv (Firstdata)" },
    { code: "mercadopago_ar", nombre: "Mercado Pago" },
    { code: "naranja_ar", nombre: "Naranja X" },
    { code: "amex_ar", nombre: "American Express" },
    { code: "getnet_ar", nombre: "Getnet" },
    { code: "cabal_ar", nombre: "Cabal" },
    { code: "gocuotas_ar", nombre: "Go Cuotas" },
    { code: "accor_ar", nombre: "Accor" },
    { code: "bilsantafe_ar", nombre: "Billetera Santa Fe" },
    { code: "italcred_ar", nombre: "Italcred" },
    { code: "tiendanube_ar", nombre: "Tiendanube" },
    { code: "pedidosya_ar", nombre: "PedidosYa" },
    { code: "rappi_ar", nombre: "Rappi" },
  ],
  "🇺🇾 Uruguay": [
    { code: "oca_uy", nombre: "OCA" },
    { code: "visanet_uy", nombre: "VisaNet" },
    { code: "firstdata_uy", nombre: "Fiserv (Firstdata)" },
    { code: "mercadopago_uy", nombre: "Mercado Pago" },
    { code: "amex_uy", nombre: "American Express" },
    { code: "cabal_uy", nombre: "Cabal" },
    { code: "anda_uy", nombre: "Anda" },
    { code: "creditel_uy", nombre: "Creditel" },
    { code: "cdirectos_uy", nombre: "Créditos Directos" },
    { code: "dlocal_uy", nombre: "dLocal" },
    { code: "edenred_uy", nombre: "Edenred" },
    { code: "passcard_uy", nombre: "Passcard" },
    { code: "pedidosya_uy", nombre: "PedidosYa" },
    { code: "rappi_uy", nombre: "Rappi" },
  ],
  "🇨🇴 Colombia": [
    { code: "citi_co", nombre: "Citi" },
    { code: "colpatria_co", nombre: "Colpatria" },
    { code: "diners_co", nombre: "Diners" },
    { code: "mercadopago_co", nombre: "Mercado Pago" },
    { code: "didi_co", nombre: "DiDi" },
    { code: "rappi_co", nombre: "Rappi" },
  ],
};

export const PLATFORM_CODES_VALIDOS = Object.values(CONECTORES).flat().map((c) => c.code);

export const ESTADOS_PROCESADORA = [
  ["no_conectado", "No conectado"],
  ["en_espera", "En espera de documentación / credenciales"],
  ["conectado", "Conectado"],
];

// ── Template de sucursales cabecera (columnas del archivo de carga masiva) ──
// Verificar contra el template oficial vigente de Nubceo antes del go-live.
export const TEMPLATE_SUCURSALES = [
  "name",                        // nombre con el que el cliente identifica la sucursal
  "customerBranchReference",     // identificador del punto de venta (PDV) del cliente
  "taxCode",                     // CUIT de la empresa a la que corresponde
  "platform_external_code",      // código de la procesadora (ej: prisma_ar)
  "platformBranchReference",     // número de comercio en esa procesadora
];

export const DOCS = {
  apiVentas: "https://nubceo-docs.gitbook.io/nubceo-manuales/gW86Bto4HVPZcnzRSh9V/api-s/endpoints/endpoint-ventas",
  conciliador: "https://nubceo-docs.gitbook.io/nubceo-manuales/gW86Bto4HVPZcnzRSh9V/conciliador-nubceo",
};
