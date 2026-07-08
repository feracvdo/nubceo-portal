// lib/diagrama.js — Genera el diagrama de flujo (Mermaid) del proceso del
// cliente a partir del relevamiento completado. Se guarda en la base al
// enviar el formulario y alimenta el mapa del workshop de Fase 3.

const OPTS = {
  a1: { fisicas: "Tiendas físicas", ecommerce: "E-commerce propio", marketplaces: "Marketplaces", delivery: "Apps de delivery", telefonica: "Venta telefónica/WhatsApp", mayorista: "Mayorista" },
  b2: { junto: "Liquidación 24/48hs", semanal: "Liquidación semanal", cuota: "Liquidación CUOTA A CUOTA", nose: "Liquidación (a confirmar)" },
};

const esc = (t) => String(t || "").replace(/["\[\]{}()|<>]/g, " ").trim().slice(0, 60);

export function buildDiagrama(rv, involucrados, nombreCliente, procesadoras) {
  const L = [];
  L.push("flowchart TD");
  L.push('  CLI["' + esc(nombreCliente) + '"]');

  // Canales de venta
  const canales = Array.isArray(rv.a1) ? rv.a1.filter((c) => c !== "otro") : [];
  canales.forEach((c, i) => {
    L.push('  CAN' + i + '["' + esc(OPTS.a1[c] || c) + '"]');
    L.push("  CLI --> CAN" + i);
  });
  if (rv.a1Otro) { L.push('  CANX["' + esc(rv.a1Otro) + '"]'); L.push("  CLI --> CANX"); }

  // Sistemas (PDV/ERP)
  const sistemas = esc(rv.a2 || "PDV/ERP a relevar");
  L.push('  SIS["Sistema de ventas: ' + sistemas + '"]');
  (canales.length ? canales.map((_, i) => "CAN" + i) : ["CLI"]).forEach((n) => L.push("  " + n + " --> SIS"));

  // Procesadoras / medios de cobro
  const procs = (procesadoras || []).slice(0, 10);
  procs.forEach((p, i) => {
    const estado = p.estado === "conectado" ? " ✓" : p.estado === "en_espera" ? " ⏳" : " ✕";
    L.push('  PR' + i + '["' + esc(p.nombre) + estado + '"]');
    L.push("  SIS --> PR" + i);
  });
  if (!procs.length) { L.push('  PR0["Procesadoras a relevar"]'); L.push("  SIS --> PR0"); }

  // Liquidación
  L.push('  LIQ["' + esc(OPTS.b2[rv.b2] || "Liquidación a confirmar") + '"]');
  (procs.length ? procs.map((_, i) => "PR" + i) : ["PR0"]).forEach((n) => L.push("  " + n + " --> LIQ"));

  // Conexión con Nubceo
  const conx = rv.d1 === "api" ? "API (dev: " + esc(rv.d2 || "a definir") + ")" : rv.d1 === "csv" ? "CSV periódico (" + esc(rv.d4 || "responsable a definir") + ")" : "Conexión a definir";
  L.push('  NUB["Nubceo Conciliador ← ' + conx + '"]');
  L.push("  SIS --> NUB");
  L.push("  LIQ --> NUB");
  L.push('  CONC["Conciliación ventas vs. pagos"]');
  L.push("  NUB --> CONC");

  // Contexto de la empresa
  const ctx = [];
  if (rv.c1 === "varias") ctx.push("Varias razones sociales" + (rv.c1detalle ? ": " + esc(rv.c1detalle) : ""));
  if (rv.c2) ctx.push(esc(rv.c2) + " sucursales");
  if (rv.c5) ctx.push(esc(rv.c5) + " transacciones/mes");
  if (rv.e1) ctx.push("Concilian hoy: " + (rv.e1 === "no" ? "no concilian" : rv.e1));
  if (ctx.length) {
    L.push('  CTX["Contexto: ' + ctx.join(" · ").slice(0, 120) + '"]');
    L.push("  CLI -.-> CTX");
  }

  // Alertas de casos borde
  const alertas = [];
  if (rv.a3 === "total" && rv.b2 === "cuota") alertas.push("⚠ CUOTA A CUOTA");
  if (rv.c3 === "compartidos") alertas.push("⚠ Nros de comercio compartidos");
  if (rv.f3 === "si") alertas.push("⚠ Migración de sistemas prevista");
  if (rv.d1 === "api" && rv.d3 !== "aprobada") alertas.push("⚠ API sin aprobar");
  if (alertas.length) {
    L.push('  AL["' + alertas.join(" · ") + '"]');
    L.push("  CONC -.-> AL");
    L.push("  style AL fill:#fee2e2,stroke:#991b1b");
  }

  // Involucrados
  const inv = (involucrados || []).slice(0, 8);
  if (inv.length) {
    const txt = inv.map((p) => esc(p.nombre) + (p.rol === "sponsor" ? " (Sponsor)" : p.rol === "key_user" ? " (Key user)" : "")).join(" · ");
    L.push('  EQ["Equipo del cliente: ' + txt.slice(0, 140) + '"]');
    L.push("  CLI -.-> EQ");
  }

  L.push("  style CLI fill:#e8f1fe,stroke:#0a6bf4,stroke-width:2px");
  L.push("  style NUB fill:#0a6bf4,color:#ffffff");
  return L.join("\n");
}
