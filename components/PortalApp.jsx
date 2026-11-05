import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { VINCULACION, REQUISITOS_GENERALES, manualDe } from "../lib/vinculacion";
import { CONECTORES, PAISES, ID_FISCAL, ESTADOS_PROCESADORA, DOCS, COLUMNAS_OBLIGATORIAS, TEMPLATE_SUCURSALES, PLATFORM_CODES_VALIDOS, PREFIJO_OTRA, codigoOtra } from "../lib/nubceo";
import { validarVentas, validarTabla, exportarNubceo } from "../lib/validadorVentas";
import { convertirSucursales, exportarTemplateSucursales } from "../lib/sucursalesTemplate";
import MailsCard from "./MailsCard";
import PanelAutoimp from "../lib/autoimp/PanelAutoimp";
import useMarcas, { MarcaPunto, COLORES } from "../lib/marcas/useMarcas";
import AyudaMemoria from "../lib/memoria/AyudaMemoria";
import ChatBot from "../lib/chat/ChatBot";

// ─── Tokens de marca Nubceo (tema C — Soft, portal de usuario) ───
const T = {
  bg: "#f0f4f8",
  card: "#ffffff",
  cardBorder: "#e2e8f0",
  primary: "#0a6bf4",
  primary50: "#e8f1fe",
  primary100: "#b9d2fb",
  primary600: "#0550c0",
  primary800: "#033a8a",
  primary900: "#02265c",
  sky: "#38b6ff",
  n50: "#f8fafc",
  n100: "#f1f5f9",
  n200: "#e2e8f0",
  n400: "#94a3b8",
  n600: "#475569",
  n800: "#1e293b",
  n900: "#0f172a",
  okBg: "#dcfce7", okTx: "#166534", okBorder: "#bbe8c9",
  warnBg: "#fef9c3", warnTx: "#854d0e", warnBorder: "#fde68a",
  errBg: "#fee2e2", errTx: "#991b1b", errBorder: "#fca5a5",
  infoBg: "#eef6ff", infoTx: "#0550c0", infoBorder: "#b9d2fb",
};

// Escala de espaciado única — así todo el portal respira igual y no hay que
// inventar números sueltos en cada pantalla.
const SP = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 44 };

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Se actualiza a mano en cada deploy visible, para saber de un vistazo si el portal
// que se está mirando es la última versión.
const APP_VERSION = "1.48.0";
const APP_VERSION_FECHA = "2026-11-03";

const FASES = [
  "Vinculación",
  "Introducción",
  "Relevamiento",
  "Workshop",
  "Integración API/CSV",
  "Configuración de reglas y secuencias",
  "Capacitación",
  "Go-Live",
  "Hypercare",
];


// ─── Capa de datos: todo pasa por /api/portal (el navegador nunca toca la base) ───
const apiBase = (...args) => api(...args);

// Acciones del panel del equipo que se confirman con un aviso flotante.
const AVISOS_EQUIPO = {
  setPhase: "Fase actualizada", assignClient: "Asignación guardada", setComerciales: "Vendedores actualizados",
  setEstadoCliente: "Seguimiento actualizado", setEstadoContrato: "Estado del contrato actualizado",
  setClientInfo: "Datos del cliente guardados", setFinanzas: "Datos financieros guardados", addNote: "Nota agregada",
  setPlazo: "Plazo guardado", quitarPlazo: "Plazo quitado", setCumplimientoPlazo: "Cumplimiento del plazo actualizado",
  setPrueba: "Estado de las pruebas actualizado", setMinuta: "Minuta guardada", saveProcesadoras: "Procesadora actualizada",
  setApiDesarrolloCompleto: "Estado del desarrollo de la API actualizado", saveConfig: "Configuración guardada",
  updateTeamEmail: "Mail actualizado", setMyAvailability: "Disponibilidad guardada", retryRedmine: "Alta reenviada a Redmine",
  crearTicketRedmine: "Ticket creado en Redmine", marcarNotificacionesLeidas: "Notificaciones marcadas como leídas",
  agendarEvento: "Reunión agendada", changeMyCode: "Código actualizado",
};

async function api(action, payload = {}) {
  const res = await fetch("/api/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Error de conexión");
  return json;
}

const now = () => new Date().toISOString();
// "hace 5 min", "hace 3 h", "ayer"… y, si es más viejo, la fecha completa.
const haceCuanto = (iso) => {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return "hace " + min + " min";
  const h = Math.round(min / 60);
  if (h < 24) return "hace " + h + " h";
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return "hace " + d + " días";
  return fmtDate(iso);
};
const grupoDia = (iso) => {
  if (!iso) return "Sin fecha";
  const d = new Date(iso), hoy = new Date();
  const inicio = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dif = Math.round((inicio(hoy) - inicio(d)) / 86400000);
  if (dif === 0) return "Hoy";
  if (dif === 1) return "Ayer";
  if (dif < 7) return "Esta semana";
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
};

const TZ_AR = "America/Argentina/Buenos_Aires";
// Botón para entrar a la videollamada de una reunión.
const BotonMeet = ({ e, chico }) => e && e.meet_link ? (
  <a href={e.meet_link} target="_blank" rel="noopener noreferrer" className={"nub-meet" + (chico ? " nub-meet--chico" : "")}>
    <Icon n="video" size={chico ? 13 : 15} /> Entrar a la reunión de Meet
  </a>
) : null;

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: TZ_AR }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ_AR });
};

const fmtMoneda = (n, moneda) => {
  const num = Number(n) || 0;
  const simbolo = moneda === "USD" ? "US$" : "$";
  return simbolo + " " + num.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const diasDesde = (fechaISO) => {
  if (!fechaISO) return 0;
  const dias = Math.floor((Date.now() - new Date(fechaISO + "T00:00:00").getTime()) / 86400000);
  return Math.max(0, dias);
};

// Días hasta una fecha (negativos = vencido). Sirve para el semáforo de go-live.
const diasHasta = (fechaISO) => {
  if (!fechaISO) return null;
  return Math.floor((new Date(fechaISO + "T00:00:00").getTime() - Date.now()) / 86400000);
};

// Semáforo visual para la fecha de go-live comprometida
const semaforoGoLive = (fechaISO) => {
  if (!fechaISO) return null;
  const d = diasHasta(fechaISO);
  const fLocal = new Date(fechaISO + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  if (d < 0) return { txt: "Vencido " + fLocal, tone: "red" };
  if (d <= 14) return { txt: fLocal + " · en " + d + "d", tone: "red" };
  if (d <= 30) return { txt: fLocal + " · en " + d + "d", tone: "amber" };
  return { txt: "Go-live " + fLocal, tone: "blue" };
};

// ─── Detección de casos borde a partir del relevamiento ───
function detectarAlertas(rv) {
  if (!rv) return [];
  const a = [];
  if (rv.a3 === "total" && rv.b2 === "cuota") {
    a.push({ nivel: "alta", txt: "Cuota a cuota: factura el total pero cobra por cuota. Anticipar en el archivo de reglas — sin lógica especial la conciliación cae a ~30%." });
  }
  if (rv.c1 === "varias") {
    a.push({ nivel: "media", txt: "Varias razones sociales: definir estructura de tenant/empresas antes de pedir datos." + (rv.c1detalle ? " Detalle: " + rv.c1detalle : "") });
  }
  if (rv.c3 === "compartidos") {
    a.push({ nivel: "media", txt: "Números de comercio compartidos entre sucursales: definir criterio de atribución en el workshop." });
  }
  if (rv.d1 === "api" && rv.d3 !== "aprobada") {
    a.push({ nivel: "alta", txt: "API sin aprobar o sin fecha comprometida: activar acuerdo de fecha límite API/CSV (15 días hábiles)." });
  }
  if (rv.d1 === "csv" && !(rv.d4 || "").trim()) {
    a.push({ nivel: "alta", txt: "CSV sin responsable de carga con nombre propio: riesgo alto de abandono de la carga periódica." });
  }
  if (rv.a5 === "algunas" || rv.a5 === "ninguna") {
    a.push({ nivel: "media", txt: "Terminales sin integrar al PDV: esperar diferencias por carga manual, calibrar tolerancias." });
  }
  if (rv.f3 === "si") {
    a.push({ nivel: "alta", txt: "Migración de PDV/ERP prevista: replantear cronograma ahora." + (rv.f3detalle ? " Detalle: " + rv.f3detalle : "") });
  }
  return a;
}

function fmtRespuesta(q, rv) {
  const val = rv[q.id];
  const otro = rv[q.id + "Otro"];
  if (Array.isArray(val)) {
    if (!val.length) return null;
    return val.map((v) => (v === "otro" ? "Otro: " + (otro || "sin detalle") : (q.opts?.find(([o]) => o === v)?.[1] || v))).join(" · ");
  }
  if (q.type === "radio") {
    if (val === "otro") return "Otro: " + (otro || "sin detalle");
    return q.opts?.find(([o]) => o === val)?.[1] || val;
  }
  return val;
}

// ─── Validador básico del CSV de ventas ───

// ─── UI base ───

// Para divs clickeables (nav, opciones): Enter y Espacio hacen lo mismo que el clic.
const alTeclear = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
};

// ─── Iconos SVG propios (trazo 2px, 24×24). Reemplazan a los emojis de la interfaz,
// que cambian de dibujo según el sistema operativo. Uso: <Icon n="bell" size={16} />
const ICON_PATHS = {
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  check: ["M20 6 9 17l-5-5"],
  lock: ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z", "M7 11V7a5 5 0 0 1 10 0v4"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  sliders: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  folder: ["M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"],
  kanban: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M9 3v18", "M15 3v18"],
  rocket: ["M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z", "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z", "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0", "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"],
  clipboard: ["M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z", "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M12 11h4", "M12 16h4", "M8 11h.01", "M8 16h.01"],
  calendar: ["M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M16 2v4", "M8 2v4", "M3 10h18"],
  building: ["M6 2h12a2 2 0 0 1 2 2v18H4V4a2 2 0 0 1 2-2z", "M9 22v-4h6v4", "M8 6h.01", "M16 6h.01", "M12 6h.01", "M12 10h.01", "M12 14h.01", "M16 10h.01", "M16 14h.01", "M8 10h.01", "M8 14h.01"],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16v-4", "M12 8h.01"],
  warning: ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z", "M12 9v4", "M12 17h.01"],
  error: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "m15 9-6 6", "m9 9 6 6"],
  success: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "m9 12 2 2 4-4"],
  pending: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 8v4", "M12 16h.01"],
  left: ["m15 18-6-6 6-6"],
  video: ["m22 8-6 4 6 4V8z", "M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"],
  mail: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "m22 6-10 7L2 6"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  history: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l4 2"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
  inbox: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"],
  panel: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M9 3v18"],
  sort: ["m7 15 5 5 5-5", "m7 9 5-5 5 5"],
  flag: ["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z", "M4 22v-7"],
  right: ["m9 18 6-6-6-6"],
};
const Icon = ({ n, size = 16, stroke = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0, display: "block", ...style }}>
    {(ICON_PATHS[n] || []).map((d, i) => <path key={i} d={d} />)}
  </svg>
);

// ─── Encabezado de página único: ubicación, título, una frase y las acciones ───
const PageHeader = ({ crumb, title, desc, actions, style }) => (
  <header className="nub-pagehead" style={style}>
    {crumb && <div className="nub-pagehead__crumb">{crumb} / <b>{title}</b></div>}
    <div className="nub-pagehead__row">
      <div style={{ minWidth: 0 }}>
        <h1 className="nub-pagehead__title">{title}</h1>
        {desc && <p className="nub-pagehead__desc">{desc}</p>}
      </div>
      {actions && <div className="nub-pagehead__actions">{actions}</div>}
    </div>
  </header>
);

// ─── Estado vacío: explica qué pasa y qué hacer ───
const EstadoVacio = ({ icon = "inbox", titulo, children, accion, compacto }) => (
  <div className={"nub-empty" + (compacto ? " nub-empty--compacto" : "")}>
    <span className="nub-empty__ic"><Icon n={icon} size={compacto ? 16 : 20} /></span>
    <div className="nub-empty__t">{titulo}</div>
    {children && <div className="nub-empty__d">{children}</div>}
    {accion && <div style={{ marginTop: 10 }}>{accion}</div>}
  </div>
);

// ─── Selector de implementador/a o desarrollador/a (lista, alta y edición del cliente) ───
const SelectorMiembro = ({ valor, opciones, onChange, vacio = "Sin asignar", compacto, disabled, etiqueta }) => (
  <select value={valor || ""} disabled={disabled} aria-label={etiqueta} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange(e.target.value || null)}
    className={"nub-selm" + (compacto ? " nub-selm--compacto" : "") + (!valor ? " nub-selm--vacio" : "")}>
    <option value="">{vacio}</option>
    {opciones.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
  </select>
);

// ─── Iniciales para avatares (Lucía Martín → LM) ───
const iniciales = (nombre) => (nombre || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
const Avatar = ({ nombre, size = 24, tono = "azul", style }) => (
  <span className={"nub-av nub-av--" + tono} title={nombre} style={{ width: size, height: size, fontSize: Math.round(size * 0.42), ...style }}>{iniciales(nombre)}</span>
);

// ─── Número que se cuenta al aparecer (se apaga con "reducir movimiento") ───
function useCuentaRegresiva(objetivo, dur = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (reduce) { setV(objetivo); return; }
    let raf, t0;
    const paso = (ts) => {
      if (!t0) t0 = ts;
      const k = Math.min(1, (ts - t0) / dur);
      setV(Math.round(objetivo * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo, dur]);
  return v;
}

// ─── Aviso flotante (abajo a la derecha) con check que se dibuja ───
const Toast = ({ toast, className }) => {
  if (!toast) return null;
  const ok = toast.tono !== "error";
  return (
    <div className={"nub-toast" + (ok ? "" : " nub-toast--error") + (className ? " " + className : "")} role="status" aria-live="polite" key={toast.id}>
      {ok ? (
        <svg className="nub-toast__chk" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m8 12.5 2.6 2.6L16 9.5" /></svg>
      ) : <Icon n="warning" size={20} style={{ color: "#fca5a5" }} />}
      <div>
        <div style={{ fontWeight: 700 }}>{toast.titulo}</div>
        {toast.detalle && <div style={{ opacity: 0.78, marginTop: 2 }}>{toast.detalle}</div>}
      </div>
    </div>
  );
};

// ─── Esqueletos de carga: reemplazan los "Cargando…" manteniendo la forma de la pantalla ───
const Skeleton = ({ w = "100%", h = 14, r = 6, style }) => (
  <div className="nub-skel" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
);
const SkeletonLineas = ({ lineas = 3, style }) => (
  <div role="status" aria-label="Cargando" style={{ display: "grid", gap: 8, ...style }}>
    {Array.from({ length: lineas }).map((_, i) => (
      <Skeleton key={i} w={i === lineas - 1 ? "60%" : "100%"} h={12} />
    ))}
  </div>
);
const Btn = ({ children, onClick, variant = "primary", size = "md", disabled, style, type = "button" }) => {
  const base = {
    primary: { background: T.primary, color: "#fff", border: "none", boxShadow: "0 1px 3px rgba(10,107,244,0.25)" },
    secondary: { background: T.primary50, color: T.primary800, border: "none" },
    ghost: { background: "transparent", color: T.n600, border: "1px solid " + T.n200 },
    outline: { background: "transparent", color: T.primary, border: "1.5px solid " + T.primary },
  }[variant];
  const pad = size === "sm" ? "6px 14px" : "10px 20px";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={"nub-btn nub-btn--" + variant}
      style={{
        ...base, padding: pad, borderRadius: 8, fontSize: 14, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit", transition: "all .15s ease", ...style,
      }}
    >
      {children}
    </button>
  );
};

const Badge = ({ children, tone = "blue" }) => {
  const c = {
    blue: [T.primary50, T.primary800],
    green: [T.okBg, T.okTx],
    amber: [T.warnBg, T.warnTx],
    red: [T.errBg, T.errTx],
    gray: [T.n100, T.n600],
  }[tone];
  return (
    <span style={{ background: c[0], color: c[1], fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>
      {children}
    </span>
  );
};

const Card = ({ children, style }) => (
  <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 14, padding: "1.5rem", boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.06)", ...style }}>
    {children}
  </div>
);

// ─── Título de sección: separa visualmente "de qué trata esta card" del resto ───
const SectionHeader = ({ icon, title, subtitle, badge, style }) => (
  <div style={{ marginBottom: subtitle ? 14 : 10, ...style }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: T.n900, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}{title}
      </h2>
      {badge}
    </div>
    {subtitle && <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "6px 0 0" }}>{subtitle}</p>}
  </div>
);

// ─── Alert: para distinguir de un vistazo "tutorial/explicación" de "advertencia" de "error" ───
// tone: info (celeste, explica algo) · warning (ámbar, requiere atención) · error (rojo, bloquea) · success (verde, confirma)
const Alert = ({ tone = "info", icon, children, style }) => {
  const c = {
    info: [T.infoBg, T.infoTx, T.infoBorder, "info"],
    warning: [T.warnBg, T.warnTx, T.warnBorder, "warning"],
    error: [T.errBg, T.errTx, T.errBorder, "error"],
    success: [T.okBg, T.okTx, T.okBorder, "success"],
  }[tone];
  return (
    <div role={tone === "error" || tone === "warning" ? "alert" : undefined} style={{
      display: "flex", gap: 10, alignItems: "flex-start", background: c[0], color: c[1],
      border: "1px solid " + c[2], borderRadius: 10, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.55, ...style,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 2 }}>{icon || <Icon n={c[3]} size={16} />}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
};

// ─── Barra de acciones: separa "leer" de "hacer" con una línea divisoria y aire propio ───
const ActionBar = ({ children, style }) => (
  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 18, paddingTop: 16, borderTop: "1px solid " + T.n100, ...style }}>
    {children}
  </div>
);

// ─── Etiqueta pequeña en mayúsculas para agrupar (ej. "PASO 3", "EQUIPO") ───
const Eyebrow = ({ children }) => (
  <div style={{ fontSize: 12.5, fontWeight: 650, color: T.primary600, marginBottom: 6 }}>
    {children}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    style={{
      height: 40, padding: "0 12px", border: "1px solid " + T.n200, borderRadius: 6,
      fontSize: 14, width: "100%", boxSizing: "border-box", fontFamily: "inherit",
      outline: "none", color: T.n800, background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s", ...props.style,
    }}
    onFocus={(e) => { e.target.style.border = "1px solid " + T.primary; e.target.style.boxShadow = "0 0 0 3px rgba(10,107,244,0.12)"; }}
    onBlur={(e) => { e.target.style.border = "1px solid " + T.n200; e.target.style.boxShadow = "none"; }}
  />
);

const Label = ({ children }) => (
  <div style={{ fontSize: 13, fontWeight: 600, color: T.n800, marginBottom: 6 }}>
    {children}
  </div>
);

const Radio = ({ options, value, onChange }) => (
  <div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    {options.map(([v, lbl]) => (
      <div
        key={v}
        role="radio"
        aria-checked={value === v}
        tabIndex={0}
        className="nub-opt"
        onClick={() => onChange(v)}
        onKeyDown={alTeclear(() => onChange(v))}
        style={{
          padding: "8px 14px", borderRadius: 8, fontSize: 14, cursor: "pointer",
          border: "1.5px solid " + (value === v ? T.primary : T.n200),
          background: value === v ? T.primary50 : "#fff",
          color: value === v ? T.primary800 : T.n600,
          fontWeight: value === v ? 600 : 400,
        }}
      >
        {lbl}
      </div>
    ))}
  </div>
);

const Multi = ({ options, value = [], onChange }) => {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map(([v, lbl]) => {
        const on = value.includes(v);
        return (
          <div
            key={v}
            role="checkbox"
            aria-checked={on}
            tabIndex={0}
            className="nub-opt"
            onClick={() => toggle(v)}
            onKeyDown={alTeclear(() => toggle(v))}
            style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 14, cursor: "pointer",
              border: "1.5px solid " + (on ? T.primary : T.n200),
              background: on ? T.primary50 : "#fff",
              color: on ? T.primary800 : T.n600,
              fontWeight: on ? 600 : 400,
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              border: "2px solid " + (on ? T.primary : T.n200),
              background: on ? T.primary : "#fff", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
            }}>{on ? <Icon n="check" size={11} stroke={3} /> : ""}</span>
            {lbl}
          </div>
        );
      })}
    </div>
  );
};

// Logo real de Nubceo (/public/logo-nubceo.png). `white` invierte a blanco para fondos oscuros
// (con un filtro CSS, así no hace falta mantener dos archivos de imagen).
const Wordmark = ({ white = false, height = 26 }) => (
  <img
    src="/logo-nubceo.png"
    alt="Nubceo"
    height={height}
    style={{ height, width: "auto", display: "block", filter: white ? "brightness(0) invert(1)" : "none" }}
  />
);

// ─── Stepper de fases ───
const Stepper = ({ fase }) => {
  const ref = useRef(null);
  // En pantallas angostas el stepper scrollea: dejamos la fase actual a la vista.
  useEffect(() => {
    const cont = ref.current;
    const act = cont && cont.querySelector('[aria-current="step"]');
    if (cont && act && cont.scrollWidth > cont.clientWidth) {
      cont.scrollLeft = act.offsetLeft - cont.clientWidth / 2 + act.offsetWidth / 2;
    }
  }, [fase]);
  return (
    <ol ref={ref} aria-label="Fases de la implementación" style={{ display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", paddingBottom: 4, margin: 0, paddingLeft: 0, listStyle: "none" }}>
      {FASES.map((f, i) => {
        const done = i < fase, current = i === fase;
        return (
          <li key={f} aria-current={current ? "step" : undefined} style={{ display: "flex", alignItems: "flex-start", flex: "1 0 auto", minWidth: 86 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 6 }}>
              <div className={current ? "nub-step-actual" : undefined} style={{
                width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                background: done ? T.primary : current ? T.card : T.n100,
                color: done ? "#fff" : current ? T.primary : T.n400,
                border: current ? "2.5px solid " + T.primary : "2.5px solid transparent",
                boxShadow: current ? "0 0 0 4px rgba(10,107,244,0.15)" : "none",
              }}>
                {done ? <Icon n="check" size={15} stroke={3} /> : i + 1}
              </div>
              <div style={{ fontSize: 11, fontWeight: current ? 700 : 500, color: current ? T.primary800 : done ? T.n600 : T.n400, textAlign: "center", lineHeight: 1.25, maxWidth: 90 }}>
                {f}
                {current && <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: T.primary, marginTop: 2 }}>Fase actual</span>}
              </div>
            </div>
            {i < FASES.length - 1 && (
              <div aria-hidden="true" style={{ height: 2.5, background: i < fase ? T.primary : T.n200, flex: "1 0 12px", marginTop: 14, borderRadius: 2 }} />
            )}
          </li>
        );
      })}
    </ol>
  );
};

// ══════════════════════════ APP ══════════════════════════
export default function PortalImplementacion() {
  const [screen, setScreen] = useState("login"); // login | client | admin
  const [session, setSession] = useState(null); // {code, name, who}
  const [err, setErr] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const login = async (code, who) => {
    setErr("");
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLoggingIn(true);
    try {
      const r = await api("login", { sessionCode: c, who });
      if (r.role === "team") {
        setSession({ code: c, who: r.name, teamId: r.teamId || null, teamRol: r.teamRol || null, tipoUsuario: r.tipoUsuario || (r.superadmin ? "superuser" : "admin"), superadmin: !!r.superadmin });
        setScreen("admin");
      } else {
        setSession({ code: c, name: r.name, who: who || r.name });
        setScreen("client");
      }
      // Persistimos la sesión para que refrescar la página no cierre la sesión.
      try { localStorage.setItem("nubceo_session", JSON.stringify({ code: c, who: who || "" })); } catch (e) {}
    } catch (e) {
      try { localStorage.removeItem("nubceo_session"); } catch (e2) {}
      setErr(e.message === "Código no encontrado" ? "Código no encontrado. Verificá el código que te envió tu implementador." : e.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    try { localStorage.removeItem("nubceo_session"); localStorage.removeItem("nubceo_modulo"); } catch (e) {}
    setSession(null); setScreen("login");
  };

  // Al cargar, si hay una sesión guardada, la rehidratamos (revalidando el código).
  const [rehidratando, setRehidratando] = useState(true);
  useEffect(() => {
    let guardada = null;
    try { guardada = JSON.parse(localStorage.getItem("nubceo_session") || "null"); } catch (e) {}
    if (guardada && guardada.code) {
      login(guardada.code, guardada.who || "").finally(() => setRehidratando(false));
    } else {
      setRehidratando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (rehidratando) {
    return (
      <div className="nub-app" role="status" aria-label="Cargando el portal" style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <Wordmark height={28} />
        <Skeleton w={160} h={4} r={100} />
      </div>
    );
  }

  return (
    <div className="nub-app" style={{ minHeight: "100vh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: T.n800 }}>
      {screen === "login" && <Login onLogin={login} err={err} loggingIn={loggingIn} />}
      {screen === "client" && <ClientPortal session={session} onLogout={logout} />}
      {screen === "admin" && <AdminPortal session={session} onLogout={logout} />}
    </div>
  );
}

// ══════════════════════════ LOGIN ══════════════════════════
function Login({ onLogin, err, loggingIn }) {
  const [code, setCode] = useState("");
  const [who, setWho] = useState("");
  const [verCodigo, setVerCodigo] = useState(false);
  const submit = (e) => { e.preventDefault(); onLogin(code, who); };
  return (
    <div className="nub-login">
      <main className="nub-login__form">
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: SP.xl }}>
            <Wordmark height={30} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T.n900, margin: "0 0 8px", letterSpacing: "-0.01em" }}>Portal de implementación</h1>
          <p style={{ fontSize: 14.5, color: T.n600, margin: "0 0 28px", lineHeight: 1.6 }}>
            Ingresá con el nombre de tu empresa y el código de acceso que te compartió tu referente de Nubceo.
          </p>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 16 }}>
              <Label>Nombre del cliente</Label>
              <Input name="username" autoComplete="username" placeholder="Ej: Freddo" value={who} onChange={(e) => setWho(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <Label>Código de acceso</Label>
              <div style={{ position: "relative" }}>
                <Input name="password" type={verCodigo ? "text" : "password"} autoComplete="current-password" placeholder="Ej: FREDDO26" value={code} onChange={(e) => setCode(e.target.value)} style={{ paddingRight: 80 }} />
                <button type="button" onClick={() => setVerCodigo(!verCodigo)} aria-label={verCodigo ? "Ocultar código" : "Mostrar código"} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 12.5, fontWeight: 600, color: T.primary, cursor: "pointer", background: "transparent", border: "none", padding: "6px 8px", borderRadius: 6, fontFamily: "inherit" }}>{verCodigo ? "Ocultar" : "Mostrar"}</button>
              </div>
            </div>
            {err && <Alert tone="error" style={{ marginBottom: 16 }}>{err}</Alert>}
            <Btn type="submit" disabled={loggingIn || !code.trim() || !who.trim()} style={{ width: "100%", padding: "12px 20px" }}>{loggingIn ? "Ingresando…" : "Ingresar"}</Btn>
          </form>
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid " + T.n200, fontSize: 12.5, color: T.n600, lineHeight: 1.55 }}>
            ¿Sos del equipo de Nubceo? Ingresá con tu nombre y tu código de implementador.
          </div>
          <div style={{ marginTop: 28, fontSize: 11.5, color: T.n400 }}>
            Portal de Implementaciones · v{APP_VERSION} · {new Date(APP_VERSION_FECHA + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </main>

      {/* Panel de marca: el recorrido real de la implementación es la imagen del login */}
      <aside className="nub-login__fases" aria-label="Fases de la implementación">
        <div style={{ maxWidth: 380 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 10px", lineHeight: 1.3 }}>Así avanza tu implementación</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.78)", margin: "0 0 30px", lineHeight: 1.6 }}>
            Nueve fases, desde la vinculación hasta el acompañamiento después del go-live. En el portal ves en cuál estás y qué falta para avanzar.
          </p>
          <ol className="nub-rail">
            {FASES.map((f, i) => (
              <li key={f} className="nub-rail__item" style={{ animationDelay: (120 + i * 70) + "ms" }}>
                <span className="nub-rail__num">{i + 1}</span>
                <span className="nub-rail__txt">{f}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}

// Botón para escribirle al implementador/a asignado — arma el mailto con asunto prellenado.
const ContactoImplementador = ({ nombre, email, cliente }) => {
  if (!nombre) return null;
  const asunto = encodeURIComponent("Consulta — implementación de " + (cliente || ""));
  return email ? (
    <a
      href={"mailto:" + email + "?subject=" + asunto}
      title={"Escribirle a " + nombre + " (" + email + ")"}
      style={{
        display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: T.primary800,
        background: T.primary50, border: "1px solid " + T.primary100, borderRadius: 100, padding: "6px 12px", textDecoration: "none", whiteSpace: "nowrap",
      }}
    >
      ✉️ Contactar a {nombre}
    </a>
  ) : (
    <span title="Tu implementador/a todavía no cargó su mail en el portal" style={{ fontSize: 12.5, color: T.n400, whiteSpace: "nowrap" }}>
      Tu implementador/a: {nombre}
    </span>
  );
};

const Nav = ({ name, who, onLogout, admin, implementador, extra, onMenu }) => (
  <div className="nub-topbar" style={{ background: "#fff", borderBottom: "1px solid " + T.n200, minHeight: 60, display: "flex", alignItems: "center", padding: "10px 24px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, gap: 12, flexWrap: "wrap" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {onMenu && (
        <button type="button" className="nub-menu-btn" onClick={onMenu} aria-label="Abrir menú" style={{ alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 8, border: "1px solid " + T.n200, background: "#fff", color: T.n800, cursor: "pointer", marginRight: 4 }}>
          <Icon n="menu" size={18} />
        </button>
      )}
      <Wordmark />
      <span title={"Versión " + APP_VERSION} style={{ fontSize: 10.5, color: T.n400, fontWeight: 600 }}>v{APP_VERSION}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      {implementador && <ContactoImplementador nombre={implementador.nombre} email={implementador.email} cliente={name} />}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.n800 }}>{name}</div>
        {who && <div style={{ fontSize: 11.5, color: T.n400 }}>{who}{admin ? " · Equipo Nubceo" : ""}</div>}
      </div>
      {extra}
      <Btn variant="ghost" size="sm" onClick={onLogout}>Salir</Btn>
    </div>
  </div>
);

// ══════════════════════════ PORTAL DEL CLIENTE ══════════════════════════

const PASOS = [
  { id: "procesadoras", n: "Procesadoras" },
  { id: "empresa", n: "Datos de tu empresa" },
  { id: "introduccion", n: "Introducción" },
  { id: "relevamiento", n: "Relevamiento" },
  { id: "sucursales", n: "Sucursales" },
  { id: "conexion", n: "Conexión API / CSV" },
  { id: "capacitacion", n: "Capacitación" },
  { id: "sandbox", n: "Pruebas con tus datos" },
  { id: "golive", n: "Go-live" },
];

const EVENTO_NOMBRES = {
  workshop: "Workshop de relevamiento",
  reunion_tecnica: "Reunión técnica de API",
  capacitacion_conciliador: "Capacitación Conciliador",
  capacitacion_cash: "Capacitación Nubceo Cash",
  resultados_sandbox: "Presentación de resultados de pruebas",
  workshop_cierre: "Workshop de cierre",
  golive: "Evento de go-live",
};

const descargar = (nombre, contenido) => {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

const aDataUrl = (texto) => "data:text/csv;base64," + btoa(unescape(encodeURIComponent(texto)));

// Render de diagramas Mermaid (para el panel del equipo)
// Carga Mermaid en runtime vía <script> (el bundler de Next no soporta imports desde URL)
let _mermaidPromise = null;
function loadMermaid() {
  if (typeof window === "undefined") return Promise.reject(new Error("solo en navegador"));
  if (window.mermaid) return Promise.resolve(window.mermaid);
  if (_mermaidPromise) return _mermaidPromise;
  _mermaidPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    s.onload = () => (window.mermaid ? resolve(window.mermaid) : reject(new Error("Mermaid no se inicializó")));
    s.onerror = () => reject(new Error("No se pudo descargar Mermaid del CDN"));
    document.head.appendChild(s);
  });
  return _mermaidPromise;
}

function MermaidView({ code }) {
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({ startOnLoad: false, theme: "neutral", fontFamily: "inherit" });
        const { svg } = await mermaid.render("dg" + Math.random().toString(36).slice(2), code);
        if (vivo) setSvg(svg);
      } catch (e) { if (vivo) setErr("No se pudo renderizar el diagrama: " + e.message); }
    })();
    return () => { vivo = false; };
  }, [code]);
  if (err) return <div style={{ fontSize: 13, color: T.errTx }}>{err}</div>;
  if (!svg) return <div style={{ fontSize: 13, color: T.n400 }}>Generando diagrama…</div>;
  return <div style={{ overflowX: "auto" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

// Agendador genérico: pide slots al servidor (con disponibilidad real de Google Calendar si el
// responsable está sincronizado), y antes de confirmar deja editar la lista de invitados —
// que sale precargada de los involucrados del relevamiento.
function Agendador({ session, tipo, nota, invitadosDefault = [], onDone }) {
  const [slots, setSlots] = useState(null);
  const [err, setErr] = useState("");
  const [agendando, setAgendando] = useState(false);
  const [elegido, setElegido] = useState(null); // slot elegido, pendiente de confirmar invitados
  const [invitados, setInvitados] = useState([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoMail, setNuevoMail] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api("getSlots", { sessionCode: session.code, code: session.code, tipo });
        setSlots(r.slots);
      } catch (e) { setErr(e.message); }
    })();
  }, [session.code, tipo]);

  const elegirSlot = (s) => {
    setInvitados(invitadosDefault.filter((p) => (p.nombre || "").trim() && (p.email || "").trim()).map((p) => ({ ...p, incluir: true })));
    setElegido(s);
  };

  const toggleInvitado = (i) => setInvitados((prev) => prev.map((p, idx) => idx === i ? { ...p, incluir: !p.incluir } : p));
  const quitarInvitado = (i) => setInvitados((prev) => prev.filter((_, idx) => idx !== i));
  const agregarInvitado = () => {
    if (!nuevoNombre.trim() || !nuevoMail.trim()) return;
    setInvitados((prev) => [...prev, { nombre: nuevoNombre.trim(), email: nuevoMail.trim(), incluir: true }]);
    setNuevoNombre(""); setNuevoMail("");
  };

  const confirmar = async () => {
    setAgendando(true);
    try {
      const lista = invitados.filter((p) => p.incluir).map((p) => ({ nombre: p.nombre, email: p.email }));
      const r = await api("agendarEvento", { sessionCode: session.code, code: session.code, who: session.who, tipo, fecha: elegido.fecha, responsable: elegido.responsable, invitados: lista });
      onDone(r);
    } catch (e) { setErr(e.message); setAgendando(false); }
  };

  if (err) return <Alert tone="error">{err}</Alert>;
  if (!slots) return <div style={{ fontSize: 13, color: T.n400 }}>Buscando horarios disponibles…</div>;
  if (!slots.length) return <div style={{ fontSize: 13, color: T.n600 }}>No hay horarios disponibles en las próximas semanas — escribile a tu implementador para coordinar.</div>;

  // ── Paso 2: confirmar quién queda invitado antes de mandar la invitación real ──
  if (elegido) {
    return (
      <div>
        <div style={{ fontSize: 13.5, color: T.n800, marginBottom: 4 }}>
          <b>{new Date(elegido.fecha).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ_AR })}</b>
          {" a las "}<b>{new Date(elegido.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ_AR })} hs</b> (hora de Argentina) con {elegido.responsable}
        </div>
        {elegido.calendarioReal && (
          <Alert tone="success" style={{ margin: "10px 0" }}>Este horario ya se chequeó contra el calendario real de {elegido.responsable} — al confirmar se manda la invitación de Google Calendar a cada invitado.</Alert>
        )}
        <Label>Invitados</Label>
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {invitados.length === 0 && <div style={{ fontSize: 13, color: T.n400 }}>Sin invitados cargados todavía — agregá al menos uno abajo.</div>}
          {invitados.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, border: "1px solid " + T.n200, background: p.incluir ? "#fff" : T.n50, opacity: p.incluir ? 1 : 0.5 }}>
              <input type="checkbox" checked={p.incluir} onChange={() => toggleInvitado(i)} style={{ width: 16, height: 16, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.n800 }}>{p.nombre}</div>
                <div style={{ fontSize: 12, color: T.n400, overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</div>
              </div>
              <span onClick={() => quitarInvitado(i)} style={{ fontSize: 13, color: T.n400, cursor: "pointer", padding: "2px 6px" }}>✕</span>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr auto", gap: 8, marginBottom: 6 }}>
          <Input placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
          <Input placeholder="Mail" value={nuevoMail} onChange={(e) => setNuevoMail(e.target.value)} />
          <Btn variant="secondary" size="sm" onClick={agregarInvitado}>+ Agregar</Btn>
        </div>
        <ActionBar>
          <Btn variant="ghost" onClick={() => setElegido(null)} disabled={agendando}>← Elegir otro horario</Btn>
          <Btn onClick={confirmar} disabled={agendando || invitados.filter((p) => p.incluir).length === 0}>{agendando ? "Confirmando…" : "Confirmar y enviar invitaciones"}</Btn>
        </ActionBar>
      </div>
    );
  }

  const porDia = {};
  slots.forEach((s) => { const d = new Date(s.fecha).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short", timeZone: TZ_AR }); (porDia[d] = porDia[d] || []).push(s); });
  return (
    <div>
      {nota && <div style={{ fontSize: 13, color: T.n600, marginBottom: 10, lineHeight: 1.5 }}>{nota}</div>}
      <div style={{ fontSize: 12.5, color: T.n600, marginBottom: 10 }}>Horarios en hora de Argentina, de lunes a viernes de 9 a 18. Cada reunión se crea con su link de Google Meet.</div>
      <div style={{ display: "grid", gap: 10 }}>
        {Object.entries(porDia).map(([dia, ss]) => (
          <div key={dia}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.n600, textTransform: "capitalize", marginBottom: 6 }}>{dia}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ss.map((s) => (
                <div key={s.fecha + s.responsable} onClick={() => elegirSlot(s)} style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 13.5, cursor: "pointer",
                  border: "1.5px solid " + T.primary, color: T.primary800, background: T.primary50,
                }}>
                  {new Date(s.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ_AR })} hs · {s.responsable}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const EventoLinea = ({ e }) => (
  <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 10, background: e.estado === "realizado" ? T.okBg : T.primary50, border: "1px solid " + (e.estado === "realizado" ? T.okBorder : T.primary100) }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: e.estado === "realizado" ? T.okTx : T.primary900 }}>{EVENTO_NOMBRES[e.tipo] || e.tipo}</div>
      <div style={{ fontSize: 12.5, color: T.n600, marginTop: 2 }}>
        {fmtDate(e.fecha)} · con {e.responsable} · {(e.invitados || []).length ? "invitados: " + e.invitados.map((p) => p.nombre).join(", ") : "sin invitados cargados"}
      </div>
      {(e.meet_link || e.google_event_link) && e.estado !== "realizado" && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <BotonMeet e={e} chico />
          {e.google_event_link && <a href={e.google_event_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: T.primary }}>Ver en Google Calendar</a>}
        </div>
      )}
    </div>
    <Badge tone={e.estado === "realizado" ? "green" : "blue"}>{e.estado === "realizado" ? "Realizada" : "Agendada"}</Badge>
  </div>
);

// "8 nov" (y el año solo si no es el actual): para tarjetas y tablas
const fmtCorta = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  const mismoAnio = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es-AR", mismoAnio ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
};
const fmtDateSolo = (iso) => {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
};

// ─── Menú lateral del portal del cliente ───
const CLIENT_NAV_ITEMS = [
  ["implementacion", "clipboard", "Implementación"],
  ["cronograma", "calendar", "Cronograma"],
  ["perfil", "building", "Mi Perfil"],
];

// En celular el menú lateral se abre como panel; Escape lo cierra.
function useCerrarConEscape(abierto, onCerrar) {
  useEffect(() => {
    if (!abierto || !onCerrar) return;
    const fn = (e) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [abierto, onCerrar]);
}
const SidebarCerrar = ({ onCerrar, oscuro }) => (
  <button type="button" className="nub-sidebar-close" onClick={onCerrar} aria-label="Cerrar menú" style={{ alignItems: "center", gap: 6, marginBottom: 14, background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", padding: "6px 4px", color: oscuro ? "#fff" : T.n600 }}>
    <Icon n="x" size={16} /> Cerrar
  </button>
);

function ClientSidebar({ activo, onCambiar, abierto, onCerrar }) {
  useCerrarConEscape(abierto, onCerrar);
  const ir = (id) => { onCambiar(id); onCerrar && onCerrar(); };
  return (
    <>
    {abierto && <div className="nub-backdrop" onClick={onCerrar} />}
    <nav aria-label="Secciones del portal" className={"nub-sidebar nub-nav--dark" + (abierto ? " is-open" : "")} style={{ width: 210, flexShrink: 0, background: "linear-gradient(180deg, #0a6bf4 0%, #0550c0 100%)", padding: "20px 14px", minHeight: "calc(100vh - 61px)", borderRadius: "0 16px 16px 0" }}>
      <div style={{ display: "grid", gap: 3 }}>
        {onCerrar && <SidebarCerrar onCerrar={onCerrar} oscuro />}
        {CLIENT_NAV_ITEMS.map(([id, icon, lbl]) => (
          <div key={id} role="button" tabIndex={0} aria-current={activo === id ? "page" : undefined} className="nub-nav-item" onClick={() => ir(id)} onKeyDown={alTeclear(() => ir(id))} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer",
            fontSize: 13.5, fontWeight: activo === id ? 700 : 500,
            background: activo === id ? "rgba(255,255,255,0.18)" : "transparent", color: activo === id ? "#fff" : "rgba(255,255,255,0.72)", transition: "all 0.15s ease",
          }}>
            <Icon n={icon} size={17} />{lbl}
          </div>
        ))}
      </div>
    </nav>
    </>
  );
}


// ─── Tu próximo paso: una sola acción, con su plazo y a quién preguntarle ───
const PROXIMO_TXT = {
  procesadoras: ["Contanos con qué procesadoras cobran", "Elegí tu país, marcá las plataformas de pago que usan y en qué estado está cada conexión.", "Marcar procesadoras"],
  empresa: ["Revisá los datos de tu empresa", "Confirmá lo que cargamos: razones sociales, contactos y sistemas. Te lleva un par de minutos.", "Revisar mis datos"],
  introduccion: ["Leé cómo va a ser tu implementación", "Cinco minutos para conocer las fases, quién hace qué y qué vamos a necesitar de tu equipo.", "Leer la introducción"],
  relevamiento: ["Completá el formulario de relevamiento", "Preguntas sobre cómo venden, cobran y facturan. Con tus respuestas armamos el workshop y la configuración de reglas.", "Completar relevamiento"],
  sucursales: ["Cargá tus sucursales", "Entendé cómo funcionan, cargá la lista de tus locales y seguí la guía para crearlos en Nubceo.", "Empezar con sucursales"],
  conexion: ["Definí cómo nos van a llegar las ventas", "Por API o por archivo CSV. Te explicamos cada opción y qué necesita tu equipo técnico.", "Ver opciones de conexión"],
  capacitacion: ["Agendá la capacitación de tu equipo", "Elegí un horario para que tu equipo aprenda a usar el Conciliador con sus propios datos.", "Agendar capacitación"],
  sandbox: ["Revisemos juntos los resultados de las pruebas", "Estamos probando la conciliación con tus datos. Cuando estén listos te pedimos un horario para mostrártelos.", "Ver estado de las pruebas"],
  golive: ["Preparemos el go-live", "Pasamos la configuración probada a tu entorno productivo y coordinamos el lanzamiento con tu equipo.", "Ver el go-live"],
};
// Paso del cliente → hito con fecha límite en "Plazos y recordatorios"
const PASO_A_HITO = { procesadoras: "vinculacion_procesadora", relevamiento: "relevamiento", sucursales: "sucursales", sandbox: "sandbox", golive: "golive" };

function textoPlazo(fechaISO) {
  if (!fechaISO) return null;
  const d = diasHasta(fechaISO);
  const f = new Date(fechaISO + "T00:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  if (d < 0) return { txt: "Venció el " + f, tono: "rojo" };
  if (d === 0) return { txt: "Vence hoy", tono: "rojo" };
  if (d === 1) return { txt: "Vence mañana", tono: "ambar" };
  return { txt: "Vence el " + f + ", en " + d + " días", tono: d <= 3 ? "ambar" : "neutro" };
}


// ═════════════════ Modo tutorial: tarjetas cortas con Siguiente ═════════════════
// "Siguiente" avanza dentro del paso; el paso se completa recién en la última parte.

const BANDERA_SVG = {
  ar: '<rect width="30" height="20" fill="#74ACDF"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><circle cx="15" cy="10" r="2.2" fill="#F6B40E"/>',
  uy: '<rect width="30" height="20" fill="#fff"/><rect y="2.22" width="30" height="2.22" fill="#0038A8"/><rect y="6.67" width="30" height="2.22" fill="#0038A8"/><rect y="11.11" width="30" height="2.22" fill="#0038A8"/><rect y="15.56" width="30" height="2.22" fill="#0038A8"/><rect width="13.3" height="11.1" fill="#fff"/><circle cx="6.6" cy="5.5" r="2.7" fill="#FCD116"/>',
  py: '<rect width="30" height="6.67" fill="#D52B1E"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#0038A8"/><circle cx="15" cy="10" r="2.1" fill="none" stroke="#0a7d32" stroke-width=".8"/>',
  co: '<rect width="30" height="10" fill="#FCD116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#CE1126"/>',
  cr: '<rect width="30" height="20" fill="#002B7F"/><rect y="3.33" width="30" height="13.34" fill="#fff"/><rect y="6.67" width="30" height="6.66" fill="#CE1126"/>',
  pa: '<rect width="30" height="20" fill="#fff"/><rect x="15" width="15" height="10" fill="#DA121A"/><rect y="10" width="15" height="10" fill="#072357"/><polygon fill="#072357" points="7.5,2.4 8.1,4.2 10,4.2 8.5,5.3 9.1,7.1 7.5,6 5.9,7.1 6.5,5.3 5,4.2 6.9,4.2"/><polygon fill="#DA121A" points="22.5,12.4 23.1,14.2 25,14.2 23.5,15.3 24.1,17.1 22.5,16 20.9,17.1 21.5,15.3 20,14.2 21.9,14.2"/>',
};
const Bandera = ({ c, w = 36 }) => (
  <svg width={w} height={Math.round(w * 2 / 3)} viewBox="0 0 30 20" aria-hidden="true" focusable="false" className="nub-bandera" dangerouslySetInnerHTML={{ __html: BANDERA_SVG[c] || "" }} />
);
const codPais = (nombre) => (PAISES.find(([, n]) => n === nombre) || [])[0] || null;


// ─── Cómo vincular cada procesadora que el cliente confirmó ───
const ESTADO_TXT = { conectado: ["Conectada", "conectado"], en_espera: ["En espera", "en_espera"], no_conectado: ["Sin conectar", "no_conectado"] };

// Panel con los pasos, el video y el manual de una procesadora. Se abre desde cualquier
// pantalla del paso de Procesadoras.
function PanelVinculacion({ proc, onClose }) {
  const g = VINCULACION[proc.codigo];
  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
        <div className="nub-overlay nub-modal" role="dialog" aria-modal="true" aria-labelledby="vincT" onClick={() => onClose()}>
          <div className="nub-modal__box nub-vinc__panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div className="nub-tut__k">Vincular procesadora</div>
                <h2 id="vincT" className="nub-tut__h" style={{ marginBottom: 6 }}>{(proc.nombre || "").replace(/^Otra:\s*/, "")}</h2>
              </div>
              <button type="button" className="nub-lnk" onClick={() => onClose()} aria-label="Cerrar"><Icon n="x" size={18} /></button>
            </div>
            {g ? (
              <>
                <div className="nub-vinc__datos">
                  <div><small>Cómo se conecta</small><b>{g.metodo}</b></div>
                  <div><small>Quién lo hace</small><b>{g.quien}</b></div>
                  {g.demora && <div><small>Demora estimada</small><b>{g.demora}</b></div>}
                </div>
                {g.video && (
                  <div className="nub-vinc__video">
                    <iframe src={"https://www.youtube-nocookie.com/embed/" + g.video + "?rel=0"} title={"Tutorial de vinculación de " + proc.nombre} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
                  </div>
                )}
                <h3 className="nub-vinc__h">Antes de empezar</h3>
                <ul className="nub-vinc__pre">
                  {[...g.pre, ...REQUISITOS_GENERALES].map((x, k) => <li key={k}>{x}</li>)}
                </ul>
                <h3 className="nub-vinc__h">Paso a paso</h3>
                <ol className="nub-vinc__pasos">
                  {g.pasos.map(([t, d], k) => <li key={k}><b>{t}</b><span>{d}</span></li>)}
                </ol>
                {g.demora && g.demora !== "En el momento" && (
                  <Alert tone="warning" style={{ marginTop: 12 }}>Esta alta demora {g.demora.toLowerCase()}: conviene pedirla hoy para no frenar la implementación.</Alert>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                  <a className="nub-vinc__dl" href={manualDe(proc.codigo)} download target="_blank" rel="noopener noreferrer"><Icon n="file" size={15} /> Descargar el manual (PDF)</a>
                  <a className="nub-vinc__dl nub-vinc__dl--sec" href="mailto:team.cx@nubceo.com">Escribir al equipo de Nubceo</a>
                </div>
              </>
            ) : (
              <p className="nub-tut__p">Para esta procesadora te pasamos los pasos de vinculación por mail. Si tenés dudas, escribinos a <a href="mailto:team.cx@nubceo.com">team.cx@nubceo.com</a>.</p>
            )}
          </div>
        </div>
        );
}

function GuiaVinculacion({ procesadoras }) {
  const [abierta, setAbierta] = useState(null);
  const lista = (procesadoras || []).filter((p) => p.estado !== "conectado").concat((procesadoras || []).filter((p) => p.estado === "conectado"));
  if (!lista.length) return null;
  const pendientes = lista.filter((p) => p.estado !== "conectado").length;
  return (
    <div className="nub-vinc">
      <h3 className="nub-vinc__t">Cómo vincular tus procesadoras</h3>
      <p className="nub-vinc__d">{pendientes ? "Tenés " + pendientes + (pendientes === 1 ? " procesadora por vincular" : " procesadoras por vincular") + ". Elegí una para ver los pasos, el video y el manual." : "Todas tus procesadoras están conectadas."}</p>
      <div className="nub-vinc__grid">
        {lista.map((p) => {
          const info = VINCULACION[p.codigo];
          const [eLbl, eCls] = ESTADO_TXT[p.estado] || ESTADO_TXT.no_conectado;
          return (
            <button key={p.codigo} type="button" className="nub-vinc__card" onClick={() => setAbierta(p)}>
              <span className="nub-vinc__nom">{(p.nombre || "").replace(/^Otra:\s*/, "")}</span>
              <span className={"nub-pill nub-pill--" + eCls}>{eLbl}</span>
              <span className="nub-vinc__met">{info ? info.metodo + (info.demora ? " · " + info.demora : "") : "Te pasamos los pasos"}</span>
              <span className="nub-vinc__ver">{p.estado === "conectado" ? "Ver cómo se vinculó" : "Ver cómo vincularla"}</span>
            </button>
          );
        })}
      </div>

      {abierta && <PanelVinculacion proc={abierta} onClose={() => setAbierta(null)} />}
    </div>
  );
}

function Tutorial({ titulo, partes: armarPartes, onCompletar, completo, final, guardando }) {
  const [i, setI] = useState(completo ? 99 : 0);
  // Si el cliente intenta seguir con algo sin completar, se marca en rojo y se dice qué falta.
  const [marcar, setMarcar] = useState(false);
  const partes = armarPartes(marcar);
  const total = partes.length;
  const enFinal = i >= total;
  const p = partes[Math.min(i, total - 1)];
  const ultima = i === total - 1;
  const faltan = p.faltan || [];
  const ok = faltan.length === 0;
  const irA = (n) => { setMarcar(false); setI(n); };
  const siguiente = async () => {
    if (p.alSiguiente && p.alSiguiente()) return;
    if (!ok) { setMarcar(true); return; }
    if (ultima) { const r = await onCompletar(); if (r !== false) irA(total); }
    else irA(i + 1);
  };
  return (
    <section className="nub-tut" aria-label={titulo}>
      <div className="nub-tut__top">
        <div className="nub-tut__paso"><b>{titulo}</b></div>
        <div className="nub-tut__barras" aria-hidden="true">
          {partes.map((_, k) => <i key={k} className={enFinal || k < i ? "d" : k === i ? "c" : ""} />)}
        </div>
        <div className="nub-tut__paso">{enFinal ? "Paso completo" : "Parte " + (i + 1) + " de " + total}</div>
      </div>
      <div className="nub-tut__card">
        {enFinal ? (
          <div className="nub-tut__parte nub-tut__parte--solo nub-fade">
            <div className="nub-tut__final">
              <svg className="nub-tut__ck" width="60" height="60" viewBox="0 0 52 52" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="m16 27 7 7 13-14" /></svg>
              {final}
              <div style={{ marginTop: 14 }}><Btn variant="ghost" onClick={() => irA(0)}>Revisar o cambiar</Btn></div>
            </div>
          </div>
        ) : (
          <div className="nub-tut__parte nub-fade" key={i}>
            <div>
              {p.k && <div className="nub-tut__k">{p.k}</div>}
              <h2 className="nub-tut__h">{p.h}</h2>
              {p.texto && <p className="nub-tut__p">{p.texto}</p>}
              {p.nota && <div className="nub-tut__nota">{p.nota}</div>}
            </div>
            <div style={{ minWidth: 0 }}>{p.contenido}</div>
          </div>
        )}
        {!enFinal && (
          <div className="nub-tut__bar">
            <Btn variant="ghost" onClick={() => { if (p.alAnterior && p.alAnterior()) return; irA(i - 1); }} style={{ visibility: i === 0 ? "hidden" : "visible" }}>{p.textoAnterior || "Anterior"}</Btn>
            <span className={"nub-tut__hint" + (marcar && !ok ? " nub-tut__hint--error" : "")} role={marcar && !ok ? "alert" : undefined}>
              {marcar && !ok ? "Falta completar: " + faltan.join(", ") + "." : (p.hint || "Lo que hacés se guarda al completar el paso.")}
            </span>
            <Btn onClick={siguiente} disabled={guardando}>{ultima ? (guardando ? "Guardando…" : "Completar paso") : (p.textoSiguiente || "Siguiente")}</Btn>
          </div>
        )}
      </div>
    </section>
  );
}

const ESTADOS_TUT = [["conectado", "Conectada"], ["en_espera", "En espera"], ["no_conectado", "Sin conectar"]];
const AYUDA_ESTADO = {
  conectado: "Perfecto. Ya podemos ver sus liquidaciones.",
  en_espera: "Tu implementador/a te ayuda a conseguir lo que falta. No frena tu avance.",
  no_conectado: "No pasa nada: la vinculación la coordinamos con tu implementador/a.",
};

// ── Paso 1: Procesadoras ──
function TabProcesadorasTut({ data, act, saving, onSeguir, avisar }) {
  const rv = data.relevamiento || {};
  const previas = data.procesadoras || [];
  const paisPrevio = rv.pais || (previas[0] && (previas[0].pais || "").replace(/[^\p{L}\s]/gu, "").trim()) || null;
  const [pais, setPais] = useState(PAISES.some(([, n]) => n === paisPrevio) ? paisPrevio : null);
  const [sel, setSel] = useState(() => Object.fromEntries(previas.filter((p) => !(p.codigo || "").startsWith(PREFIJO_OTRA)).map((p) => [p.codigo, p.estado])));
  const [otras, setOtras] = useState(() => previas.filter((p) => (p.codigo || "").startsWith(PREFIJO_OTRA)).map((p) => ({ nombre: (p.nombre || "").replace(/^Otra:\s*/i, ""), estado: p.estado })));
  const [otraTxt, setOtraTxt] = useState("");
  const [guiaDe, setGuiaDe] = useState(null);
  const conns = (pais && CONECTORES[pais]) || [];
  const elegidas = conns.filter((c) => sel[c.code] !== undefined);
  const cant = elegidas.length + otras.length;
  const elegirPais = (n) => { if (n !== pais) { setSel({}); setOtras([]); } setPais(n); };
  const toggle = (code) => setSel((s) => { const x = { ...s }; if (x[code] !== undefined) delete x[code]; else x[code] = ""; return x; });
  const agregarOtra = () => {
    const v = otraTxt.trim();
    if (v && !otras.some((o) => o.nombre.toLowerCase() === v.toLowerCase())) { setOtras([...otras, { nombre: v, estado: "" }]); avisar && avisar({ titulo: "Agregaste " + v, detalle: "Se guarda al completar el paso." }); }
    setOtraTxt("");
  };
  const filas = [...elegidas.map((c) => ({ key: c.code, codigo: c.code, nombre: c.nombre, estado: sel[c.code], set: (e) => setSel({ ...sel, [c.code]: e }) })),
    ...otras.map((o, k) => ({ key: "otra" + k, nombre: o.nombre, estado: o.estado, set: (e) => setOtras(otras.map((x, j) => j === k ? { ...x, estado: e } : x)) }))];
  const cuenta = (e) => filas.filter((f) => (f.estado || "no_conectado") === e).length;
  const completar = async () => {
    const suf = codPais(pais) || "xx";
    const lista = [
      ...elegidas.map((c) => ({ codigo: c.code, nombre: c.nombre, pais, estado: sel[c.code] || "no_conectado" })),
      ...otras.map((o, k) => ({ codigo: PREFIJO_OTRA + suf + "_" + (k + 1), nombre: "Otra: " + o.nombre, pais, estado: o.estado || "no_conectado" })),
    ];
    const r = await act("saveProcesadoras", { lista, pais, confirmar: true, log: "Confirmó sus procesadoras en " + pais + " (" + lista.length + ")" });
    return !!r;
  };
  const partes = (marcar) => [
    { k: "Dónde operan", h: "¿En qué país opera tu empresa?", texto: "Así te mostramos solo las procesadoras que trabajan en ese país.",
      nota: "Si operan en más de un país, elegí el principal. Los demás los vemos con tu implementador/a.",
      faltan: pais ? [] : ["el país"],
      contenido: (
        <div className={"nub-paises" + (marcar && !pais ? " nub-falta" : "")} role="group" aria-label="País">
          {PAISES.map(([c, n]) => (
            <button key={c} type="button" className="nub-pais" aria-pressed={pais === n} onClick={() => elegirPais(n)}><Bandera c={c} /><span>{n}</span></button>
          ))}
        </div>
      ) },
    { k: "Con quién cobran", h: "¿Con qué procesadoras cobran" + (pais ? " en " + pais : "") + "?",
      texto: "Marcá todas las que usan hoy para cobrar con tarjeta, QR o billetera. Si alguna no está en la lista, agregala abajo.",
      nota: "Una procesadora es la empresa que te liquida las ventas: la que te manda el resumen de lo que te va a pagar y cuándo.",
      faltan: cant ? [] : ["marcar al menos una procesadora"], hint: cant ? cant + (cant === 1 ? " procesadora marcada." : " procesadoras marcadas.") : null,
      contenido: (
        <div className={marcar && !cant ? "nub-falta nub-falta--caja" : undefined}>
          {conns.length === 0 && <div className="nub-tut__nota nub-tut__nota--azul" style={{ marginBottom: 12 }}>Todavía no tenemos procesadoras precargadas para {pais}. Agregá las que usan y tu implementador/a las confirma.</div>}
          <div className="nub-procs" role="group" aria-label="Procesadoras">
            {conns.map((c) => (
              <button key={c.code} type="button" role="checkbox" aria-checked={sel[c.code] !== undefined} className="nub-proc" onClick={() => toggle(c.code)}>
                <span className="nub-proc__box">{sel[c.code] !== undefined && <Icon n="check" size={12} stroke={3.2} />}</span>{c.nombre}
              </button>
            ))}
            {otras.map((o, k) => (
              <button key={"o" + k} type="button" role="checkbox" aria-checked="true" className="nub-proc" onClick={() => setOtras(otras.filter((_, j) => j !== k))} title="Clic para quitar">
                <span className="nub-proc__box"><Icon n="check" size={12} stroke={3.2} /></span>{o.nombre}
              </button>
            ))}
          </div>
          <Label>¿Usan otra que no está en la lista?</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={otraTxt} onChange={(e) => setOtraTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarOtra(); } }} placeholder="Nombre de la procesadora" />
            <Btn variant="secondary" onClick={agregarOtra}>Agregar</Btn>
          </div>
        </div>
      ) },
    { k: "Estado de cada una", h: "¿Cómo está la vinculación de cada procesadora?",
      texto: "Contanos en qué punto está cada una. Podés seguir con cualquier estado: las que falten las resolvemos juntos.",
      nota: <><b>Conectada:</b> ya nos diste el acceso. <b>En espera:</b> la pediste, pero falta documentación o credenciales. <b>Sin conectar:</b> todavía no se empezó.</>,
      contenido: (
        <div style={{ display: "grid", gap: 8 }}>
          {filas.map((f) => (
            <div key={f.key} className="nub-est">
              <div className="nub-est__h">
                <b>{f.nombre}</b>
                <div className="nub-segs" role="group" aria-label={"Estado de " + f.nombre}>
                  {ESTADOS_TUT.map(([e, l]) => <button key={e} type="button" data-e={e} aria-pressed={f.estado === e} onClick={() => f.set(e)}>{l}</button>)}
                </div>
              </div>
              {f.estado && <div className="nub-est__d">{AYUDA_ESTADO[f.estado]}</div>}
              {f.codigo && VINCULACION[f.codigo] && f.estado !== "conectado" && (
                <button type="button" className="nub-vinc__link" onClick={() => setGuiaDe({ codigo: f.codigo, nombre: f.nombre })}>
                  <Icon n={VINCULACION[f.codigo].video ? "video" : "file"} size={14} /> Cómo vincularla{VINCULACION[f.codigo].video ? ": video y manual" : ": pasos y manual"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) },
    { k: "Revisá antes de terminar", h: "Así quedan tus procesadoras",
      texto: cuenta("conectado") + (cuenta("conectado") === 1 ? " conectada, " : " conectadas, ") + cuenta("en_espera") + " en espera y " + cuenta("no_conectado") + " sin conectar. Podés completar el paso igual: las que falten las vemos en la reunión de vinculación.",
      nota: "Podés volver a este paso cuando quieras para actualizar los estados.",
      contenido: (
        <div className="nub-sum">
          <div className="nub-sum__r"><span>País</span><b>{pais}</b></div>
          {filas.map((f) => {
            const e = f.estado || "no_conectado";
            return (
              <div key={f.key} className="nub-sum__r">
                <span>{f.nombre}{f.codigo && VINCULACION[f.codigo] && e !== "conectado" && <button type="button" className="nub-vinc__link" style={{ marginLeft: 10 }} onClick={() => setGuiaDe({ codigo: f.codigo, nombre: f.nombre })}>Cómo vincularla</button>}</span>
                <span className={"nub-pill nub-pill--" + e}>{ESTADOS_TUT.find(([x]) => x === e)[1]}</span>
              </div>
            );
          })}
        </div>
      ) },
  ];
  return (
    <>
    {guiaDe && <PanelVinculacion proc={guiaDe} onClose={() => setGuiaDe(null)} />}
    <Tutorial titulo="Procesadoras" partes={partes} onCompletar={completar} guardando={saving} completo={!!rv.procesadorasConfirmadas || (previas.length > 0 && previas.some((x) => x.estado === "conectado"))}
      final={<><h2 className="nub-tut__h">Procesadoras cargadas</h2><p className="nub-tut__p">Tu implementador/a ya recibió el aviso{(previas.some((x) => x.estado !== "conectado")) ? " y coordina con vos las que faltan" : ""}.</p><GuiaVinculacion procesadoras={previas} /><div style={{ marginTop: 22 }}><Btn onClick={onSeguir}>Seguir con Datos de tu empresa</Btn></div></>} />
    </>
  );
}

const RUBROS = ["Gastronomía", "Supermercado", "Retail o comercio minorista", "Indumentaria y calzado", "Farmacia y perfumería", "Estación de servicio", "Salud", "Educación", "Turismo y hotelería", "E-commerce", "Servicios", "Otro"];
const ROLES_TUT = [["sponsor", "Quien decide (sponsor)"], ["key_user", "Usuario principal (key user)"], ["desarrollador", "Desarrollo o sistemas"], ["otro", "Otro"]];

// ── Paso 2: Datos de tu empresa ──
function TabEmpresaTut({ data, meta, act, saving, onSeguir, avisar }) {
  const rv = data.relevamiento || {};
  const cp = codPais(rv.pais) || "ar";
  const [fiscalLbl, fiscalLen] = ID_FISCAL[cp] || ["CUIT", 11];
  const [rubro, setRubro] = useState(rv.rubro || "");
  const [rubroOtro, setRubroOtro] = useState(rv.rubroOtro || "");
  const [razones, setRazones] = useState(() => rv.razones && rv.razones.length ? rv.razones
    : (meta.cuits || []).length ? meta.cuits.map((c, k) => ({ rs: k === 0 ? (meta.razonSocial || "") : "", id: c }))
    : [{ rs: meta.razonSocial || "", id: "" }]);
  const [contactos, setContactos] = useState(() => (data.involucrados || []).map((c) => ({ ...c })));
  const [pdv, setPdv] = useState(rv.pdv || meta.erpPdv || []);
  const [erp, setErp] = useState(rv.erp || []);
  const [inPdv, setInPdv] = useState(""), [inErp, setInErp] = useState("");
  const errId = (v) => {
    const d = String(v || "").replace(/\D/g, "");
    if (!String(v || "").trim()) return "Completalo o quitá esta razón social.";
    if (fiscalLen && d.length !== fiscalLen) return "El " + fiscalLbl + " tiene " + fiscalLen + " números.";
    if (d.length < 6) return "Revisá el número: parece incompleto.";
    return "";
  };
  const mailOk = (m) => !m || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);
  const setR = (k, campo, v) => setRazones(razones.map((r, j) => j === k ? { ...r, [campo]: v, tocado: campo === "id" ? true : r.tocado } : r));
  const setC = (k, campo, v) => setContactos(contactos.map((c, j) => j === k ? { ...c, [campo]: v } : c));
  const Chips = ({ lista, set }) => (
    <div className="nub-chipsx">
      {lista.length === 0 && <span style={{ fontSize: 13, color: T.n400 }}>Ninguno cargado</span>}
      {lista.map((v, j) => <span key={v} className="nub-chipx">{v}<button type="button" aria-label={"Quitar " + v} onClick={() => set(lista.filter((_, x) => x !== j))}><Icon n="x" size={11} stroke={3} /></button></span>)}
    </div>
  );
  const sumar = (v, lista, set, limpiar) => { const t = v.trim(); if (t && !lista.includes(t)) { set([...lista, t]); avisar && avisar({ titulo: "Agregaste " + t }); } limpiar(""); };
  const completar = async () => {
    const r = await act("confirmarEmpresa", {
      rubro, rubroOtro: rubro === "Otro" ? rubroOtro : "",
      razones: razones.map(({ rs, id }) => ({ rs, id })),
      contactos: contactos.map(({ id, nombre, cargo, email, telefono, rol }) => ({ id, nombre, cargo, email, telefono, rol })),
      pdv, erp,
    });
    return !!r;
  };
  const faltanRs = [];
  razones.forEach((r, k) => {
    const n = razones.length > 1 ? " de la razón social " + (k + 1) : "";
    if (!r.rs.trim()) faltanRs.push("el nombre" + n);
    if (errId(r.id)) faltanRs.push("el " + fiscalLbl + n);
  });
  const faltanCt = [];
  contactos.forEach((c, k) => {
    const n = " del contacto " + (k + 1);
    if (!(c.nombre || "").trim()) faltanCt.push("el nombre" + n);
    if (!mailOk(c.email)) faltanCt.push("un mail válido" + n);
  });
  const rojo = { borderColor: "#dc2626", background: "#fef2f2" };
  const partes = (marcar) => [
    { k: "Revisá lo que cargamos", h: "Tu empresa en Nubceo", texto: "Cargamos estos datos cuando arrancamos. En las próximas tarjetas los revisás y corregís lo que haga falta.",
      contenido: (
        <div>
          <Label>Nombre de la empresa</Label>
          <Input value={meta.name || ""} readOnly style={{ background: T.n50, color: T.n600 }} />
          <div style={{ fontSize: 12.5, color: T.n600, marginTop: 6 }}>Es el nombre con el que ingresás al portal. Si está mal escrito, avisale a tu implementador/a.</div>
          {meta.tenant && (
            <div className="nub-tenant">
              <div><small>Tu número de cliente en Nubceo</small><div className="nub-tenant__n">{meta.tenant}</div></div>
              <div style={{ fontSize: 12.5, color: T.n600, lineHeight: 1.5 }}>Es fijo y no se puede cambiar. Tenelo a mano cuando hables con soporte.</div>
            </div>
          )}
        </div>
      ) },
    { k: "Tu actividad", h: "¿A qué se dedica tu empresa?", texto: "Nos ayuda a anticipar cómo venden y cobran: no es lo mismo un restaurante que una farmacia o una estación de servicio.",
      faltan: !rubro ? ["el rubro"] : rubro === "Otro" && !rubroOtro.trim() ? ["cuál es el rubro"] : [],
      contenido: (
        <div>
          <div className={"nub-procs" + (marcar && !rubro ? " nub-falta" : "")} role="radiogroup" aria-label="Rubro">
            {RUBROS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={rubro === r} className="nub-proc nub-proc--radio" onClick={() => setRubro(r)}>
                <span className="nub-proc__box nub-proc__box--radio" />{r}
              </button>
            ))}
          </div>
          {rubro === "Otro" && <div style={{ marginTop: 12 }}><Label>Contanos cuál</Label><Input value={rubroOtro} onChange={(e) => setRubroOtro(e.target.value)} placeholder="Ej: venta de repuestos" style={marcar && !rubroOtro.trim() ? rojo : null} /></div>}
        </div>
      ) },
    { k: "Identificación fiscal", h: "Razones sociales y " + fiscalLbl, texto: "Estas son las que tenemos. Si facturan con otras, agregalas.",
      nota: "No hace falta cargar todas: con las que usan para vender y cobrar alcanza. Las demás las podés sumar después.",
      faltan: faltanRs,
      contenido: (
        <div>
          {razones.map((r, k) => {
            const e = errId(r.id);
            return (
              <div key={k} className="nub-dato">
                <div className="nub-dato__h"><b>{k === 0 ? "Principal" : "Razón social " + (k + 1)}</b>{razones.length > 1 && <button type="button" className="nub-lnk" onClick={() => setRazones(razones.filter((_, j) => j !== k))}>Quitar</button>}</div>
                <div className="nub-grid2">
                  <div><Label>Razón social</Label><Input value={r.rs} onChange={(ev) => setR(k, "rs", ev.target.value)} style={!r.rs.trim() && (marcar || r.tocado) ? rojo : null} />
                    {!r.rs.trim() && marcar && <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>Completá la razón social.</div>}</div>
                  <div><Label>{fiscalLbl}</Label><Input value={r.id} inputMode="numeric" onChange={(ev) => setR(k, "id", ev.target.value)} style={e && (r.tocado || marcar) ? rojo : null} />
                    {e && (r.tocado || marcar) && <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>{e}</div>}</div>
                </div>
              </div>
            );
          })}
          <button type="button" className="nub-lnk" onClick={() => { setRazones([...razones, { rs: "", id: "" }]); avisar && avisar({ titulo: "Agregaste una razón social", detalle: "Completá el nombre y el " + fiscalLbl + "." }); }}>Agregar otra razón social</button>
        </div>
      ) },
    { k: "Contactos", h: "¿Quiénes participan de la implementación?", texto: "Son las personas a las que les escribimos y a las que invitamos a las reuniones. Revisá sus datos y sumá a quien falte.",
      nota: "No hace falta cargar a todo el equipo. Con quien decide, quien va a usar Nubceo todos los días y, si hay integración, quien la desarrolla, alcanza.",
      faltan: faltanCt,
      contenido: (
        <div>
          {contactos.map((c, k) => (
            <div key={c.id || "n" + k} className="nub-dato">
              <div className="nub-dato__h"><b>{c.id ? c.nombre || "Contacto" : "Nuevo contacto"}</b><button type="button" className="nub-lnk" onClick={() => setContactos(contactos.filter((_, j) => j !== k))}>Quitar</button></div>
              <div className="nub-grid2">
                <div><Label>Nombre y apellido</Label><Input value={c.nombre || ""} onChange={(e) => setC(k, "nombre", e.target.value)} style={marcar && !(c.nombre || "").trim() ? rojo : null} />
                  {marcar && !(c.nombre || "").trim() && <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>Completá el nombre.</div>}</div>
                <div><Label>Rol en la implementación</Label>
                  <select value={c.rol || "otro"} onChange={(e) => setC(k, "rol", e.target.value)} className="nub-select">
                    {ROLES_TUT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></div>
                <div><Label>Mail</Label><Input type="email" value={c.email || ""} onChange={(e) => setC(k, "email", e.target.value)} style={mailOk(c.email) ? null : rojo} />
                  {!mailOk(c.email) && <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>Revisá el mail: falta la @ o el dominio.</div>}</div>
                <div><Label>Celular (opcional)</Label><Input inputMode="tel" value={c.telefono || ""} onChange={(e) => setC(k, "telefono", e.target.value)} placeholder="+54 11 ..." /></div>
              </div>
            </div>
          ))}
          <button type="button" className="nub-lnk" onClick={() => { setContactos([...contactos, { nombre: "", rol: "otro", email: "", telefono: "" }]); avisar && avisar({ titulo: "Agregaste un contacto", detalle: "Completá su nombre y mail." }); }}>Agregar otro contacto</button>
        </div>
      ) },
    { k: "Tus sistemas", h: "¿Con qué sistemas venden y facturan?", texto: "Nos sirve para saber de dónde salen las ventas que vamos a conciliar.",
      nota: "El punto de venta es donde se registra cada venta (la caja). El ERP es el sistema de gestión o facturación.",
      contenido: (
        <div>
          <Label>Punto de venta</Label>
          <Chips lista={pdv} set={setPdv} />
          <div style={{ display: "flex", gap: 8 }}><Input value={inPdv} onChange={(e) => setInPdv(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sumar(inPdv, pdv, setPdv, setInPdv); } }} placeholder="Agregar sistema de punto de venta" /><Btn variant="secondary" onClick={() => sumar(inPdv, pdv, setPdv, setInPdv)}>Agregar</Btn></div>
          <div style={{ height: 18 }} />
          <Label>ERP o sistema de gestión</Label>
          <Chips lista={erp} set={setErp} />
          <div style={{ display: "flex", gap: 8 }}><Input value={inErp} onChange={(e) => setInErp(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sumar(inErp, erp, setErp, setInErp); } }} placeholder="Agregar ERP" /><Btn variant="secondary" onClick={() => sumar(inErp, erp, setErp, setInErp)}>Agregar</Btn></div>
        </div>
      ) },
    { k: "Confirmá", h: "¿Está todo bien?", texto: "Al confirmar, tu implementador/a recibe estos datos actualizados.",
      contenido: (
        <div className="nub-sum">
          <div className="nub-sum__r"><span>Empresa</span><b>{meta.name}</b></div>
          {meta.tenant && <div className="nub-sum__r"><span>Número de cliente</span><b>{meta.tenant}</b></div>}
          <div className="nub-sum__r"><span>Rubro</span><b>{rubro === "Otro" ? rubroOtro : rubro}</b></div>
          {razones.map((r, k) => <div key={k} className="nub-sum__r"><span>{r.rs}</span><span>{fiscalLbl} {r.id}</span></div>)}
          {contactos.map((c, k) => <div key={k} className="nub-sum__r"><span>{c.nombre}</span><span style={{ color: T.n600 }}>{(ROLES_TUT.find(([v]) => v === c.rol) || ROLES_TUT[3])[1]}</span></div>)}
          <div className="nub-sum__r"><span>Punto de venta</span><b>{pdv.join(", ") || "Sin cargar"}</b></div>
          <div className="nub-sum__r"><span>ERP</span><b>{erp.join(", ") || "Sin cargar"}</b></div>
        </div>
      ) },
  ];
  return (
    <Tutorial titulo="Datos de tu empresa" partes={partes} onCompletar={completar} guardando={saving} completo={!!rv.empresaConfirmada}
      final={<><h2 className="nub-tut__h">Datos confirmados</h2><p className="nub-tut__p">Tu implementador/a ya recibió el aviso.</p><Btn onClick={onSeguir}>Seguir con la Introducción</Btn></>} />
  );
}


// ═════════════ Relevamiento en modo tutorial ═════════════
// Una pregunta por tarjeta, todas obligatorias. Las de una opción avanzan solas; el botón
// Siguiente aparece en las de varias opciones, las de texto o cuando falta un detalle.
// El borrador se guarda solo; una vez enviado queda cerrado.
// Se arma la primera vez que se usa: RV_PREGUNTAS se declara más abajo en el archivo.
let _rvSecciones = null;
const rvSecciones = () => {
  if (_rvSecciones) return _rvSecciones;
  const out = []; let cur = -1;
  RV_PREGUNTAS.forEach((q) => { if (q.sec) { out.push({ nombre: q.sec, desc: q.desc || "" }); cur = out.length - 1; } else if (q.id) q._sec = cur; });
  _rvSecciones = out;
  return out;
};
const rvPrincipales = (r) => RV_PREGUNTAS.filter((q) => q.id && !q.legado && !q.detalleDe && (!q.showIf || q.showIf(r)));
const rvDetalle = (q, r) => RV_PREGUNTAS.find((d) => d.detalleDe === q.id && (!d.showIf || d.showIf(r))) || null;
const rvRespondida = (q, r) => { const v = r[q.id]; return q.type === "multi" ? Array.isArray(v) && v.length > 0 : v !== undefined && v !== null && String(v).trim() !== ""; };
const rvFaltaDetalle = (q, r) => {
  const v = r[q.id];
  const otro = q.otro && (q.type === "multi" ? (v || []).includes("otro") : v === "otro");
  if (otro && !String(r[q.id + "Otro"] || "").trim()) return { campo: "otro", txt: "cuál es la otra opción" };
  const d = rvDetalle(q, r);
  if (d && !String(r[d.id] || "").trim()) return { campo: "detalle", txt: d.lbl.replace(/^¿/, "").replace(/\?$/, "").toLowerCase() };
  return null;
};
const rvCompleta = (q, r) => rvRespondida(q, r) && !rvFaltaDetalle(q, r);
const rvTexto = (q, r) => {
  const base = fmtRespuesta(q, r);
  const d = rvDetalle(q, r);
  return base ? base + (d && r[d.id] ? " (" + r[d.id] + ")" : "") : "";
};

function InfoTip({ texto }) {
  const [abierto, setAbierto] = useState(false);
  if (!texto) return null;
  return (
    <span className={"nub-tip" + (abierto ? " is-open" : "")}>
      <button type="button" aria-label="Qué significa esta pregunta" aria-expanded={abierto} onClick={() => setAbierto(!abierto)} onBlur={() => setAbierto(false)}>i</button>
      <span className="nub-tip__tt" role="tooltip">{texto}</span>
    </span>
  );
}

function TabRelevamientoTut({ data, session, setAll, avisar }) {
  rvSecciones();
  const enviado = !!data.relevamientoEnviado;
  const [R, setR] = useState(() => ({ ...(data.relevamiento || {}) }));
  const [i, setI] = useState(() => {
    const L = rvPrincipales(data.relevamiento || {});
    const k = L.findIndex((q) => !rvCompleta(q, data.relevamiento || {}));
    return k < 0 ? L.length : k;
  });
  const [marcar, setMarcar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [verResumenError, setVerResumenError] = useState(false);
  const L = rvPrincipales(R);
  const enResumen = i >= L.length;
  const q = enResumen ? null : L[i];
  const completas = L.filter((x) => rvCompleta(x, R)).length;
  const pct = L.length ? Math.round((completas / L.length) * 100) : 0;
  const faltan = L.length - completas;
  const minutos = Math.max(1, Math.round(faltan * 0.4));
  const pendientes = L.filter((x) => !rvCompleta(x, R));

  // Borrador: se guarda solo, sin avisos, un momento después de cada cambio.
  const primera = useRef(true);
  useEffect(() => {
    if (enviado) return;
    if (primera.current) { primera.current = false; return; }
    const id = setTimeout(() => {
      api("saveClient", { sessionCode: session.code, code: session.code, who: session.who || "Cliente", data: { relevamiento: R } }).catch(() => {});
    }, 900);
    return () => clearTimeout(id);
  }, [R, enviado, session]);

  const set = (k, v) => setR((r) => ({ ...r, [k]: v }));
  const irA = (n) => { setMarcar(false); setVerResumenError(false); setI(n); };
  const siguiente = () => {
    if (!q) return;
    if (!rvCompleta(q, R)) { setMarcar(true); return; }
    irA(i + 1);
  };
  const elegir = (val) => {
    if (q.type === "multi") {
      const a = Array.isArray(R[q.id]) ? R[q.id] : [];
      set(q.id, a.includes(val) ? a.filter((x) => x !== val) : [...a, val]);
      setMarcar(false);
      return;
    }
    const nuevo = { ...R, [q.id]: val };
    setR(nuevo); setMarcar(false);
    if (rvCompleta(q, nuevo)) setTimeout(() => setI((n) => (n === i ? n + 1 : n)), 380);
  };
  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await api("saveClient", { sessionCode: session.code, code: session.code, who: session.who || "Cliente", data: { relevamiento: R, relevamientoEnviado: now() }, log: "Envió el relevamiento" });
      setConfirmar(false); setAll(r);
      avisar && avisar({ titulo: "Relevamiento enviado", detalle: "Tu implementador/a ya lo recibió para preparar el workshop." });
    } catch (e) {
      avisar && avisar({ titulo: "No se pudo enviar el relevamiento", detalle: e.message, tono: "error" });
    } finally { setEnviando(false); }
  };

  if (enviado) {
    const Lv = rvPrincipales(data.relevamiento || {});
    return (
      <section className="nub-tut">
        <div className="nub-tut__card">
          <div className="nub-tut__parte">
            <div>
              <div className="nub-tut__k">Relevamiento</div>
              <h2 className="nub-tut__h">Tus respuestas</h2>
              <p className="nub-tut__p"><span className="nub-lock"><Icon n="lock" size={12} /> Enviado el {fmtDate(data.relevamientoEnviado)}: ya no se puede editar</span></p>
              <p className="nub-tut__p">Si necesitás corregir algo, escribile a tu implementador/a.</p>
            </div>
            <div className="nub-sum">
              {Lv.map((x) => <div key={x.id} className="nub-sum__r"><span>{x.lbl}</span><b style={{ textAlign: "right" }}>{rvTexto(x, data.relevamiento || {}) || "Sin respuesta"}</b></div>)}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const falta = q && marcar ? (!rvRespondida(q, R)
    ? (q.type === "multi" ? "Marcá al menos una opción para seguir." : q.opts ? "Elegí una opción para seguir." : "Escribí tu respuesta para seguir.")
    : (rvFaltaDetalle(q, R) ? "Falta completar: " + rvFaltaDetalle(q, R).txt + "." : null)) : null;
  const opts = q && q.opts ? (q.otro ? [...q.opts, ["otro", "Otro"]] : q.opts) : [];
  const det = q ? rvDetalle(q, R) : null;
  const otroOn = q && q.otro && (q.type === "multi" ? (R[q.id] || []).includes("otro") : R[q.id] === "otro");
  const fd = q ? rvFaltaDetalle(q, R) : null;
  const conDetalle = q && q.type === "radio" && (otroOn || !!det);
  const mostrarSiguiente = q && (q.type !== "radio" || conDetalle);

  return (
    <section className="nub-tut" aria-label="Relevamiento">
      <div className="nub-rvprog">
        <div className="nub-rvprog__top">
          <span>{enResumen ? <b>Resumen</b> : <>Pregunta <b>{i + 1} de {L.length}</b></>} · {pct}% completo</span>
          <span>{faltan ? "Te faltan unos " + minutos + " minuto" + (minutos === 1 ? "" : "s") : "Respondiste todo"}</span>
        </div>
        <div className="nub-rvprog__bar"><i style={{ width: pct + "%" }} /></div>
        <div className="nub-rvprog__secs">
          {rvSecciones().map((sec, k) => {
            const qs = L.filter((x) => x._sec === k);
            const ok = qs.filter((x) => rvCompleta(x, R)).length;
            const cls = qs.length && ok === qs.length ? " is-ok" : (q && q._sec === k ? " is-on" : "");
            return (
              <button key={k} type="button" className={"nub-rvsec" + cls} onClick={() => { const pos = L.findIndex((x) => x._sec === k && !rvCompleta(x, R)); irA(pos >= 0 ? pos : L.findIndex((x) => x._sec === k)); }}>
                {sec.nombre} <small>{ok}/{qs.length}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="nub-tut__card">
        {!enResumen ? (
          <div className="nub-tut__parte nub-fade" key={q.id}>
            <div>
              <div className="nub-tut__k">{rvSecciones()[q._sec]?.nombre}</div>
              <div style={{ fontSize: 12.5, color: T.n600 }}>{rvSecciones()[q._sec]?.desc}</div>
              <div className="nub-qtitle">
                <h2 className="nub-tut__h" style={{ margin: 0 }}>{q.lbl}</h2>
                <InfoTip texto={q.info} />
              </div>
              {q.sub && <p className="nub-tut__p" style={{ marginTop: 10 }}>{q.sub}</p>}
            </div>
            <div style={{ minWidth: 0 }}>
              {q.opts ? (
                <div className={"nub-qopts" + (marcar && !rvRespondida(q, R) ? " nub-falta" : "")} role={q.type === "multi" ? "group" : "radiogroup"}>
                  {opts.map(([v, l]) => {
                    const on = q.type === "multi" ? (R[q.id] || []).includes(v) : R[q.id] === v;
                    return (
                      <button key={v} type="button" role={q.type === "multi" ? "checkbox" : "radio"} aria-checked={on} className={"nub-proc" + (q.type === "radio" ? " nub-proc--radio" : "")} onClick={() => elegir(v)}>
                        <span className={"nub-proc__box" + (q.type === "radio" ? " nub-proc__box--radio" : "")}>{on && q.type === "multi" && <Icon n="check" size={12} stroke={3.2} />}</span>{l}
                      </button>
                    );
                  })}
                </div>
              ) : q.type === "textarea" ? (
                <textarea className={"nub-qta" + (marcar && !rvRespondida(q, R) ? " is-falta" : "")} value={R[q.id] || ""} onChange={(e) => { set(q.id, e.target.value); setMarcar(false); }} placeholder="Escribí tu respuesta" autoFocus />
              ) : (
                <Input value={R[q.id] || ""} onChange={(e) => { set(q.id, e.target.value); setMarcar(false); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); siguiente(); } }} placeholder="Escribí tu respuesta" autoFocus
                  style={marcar && !rvRespondida(q, R) ? { borderColor: "#dc2626", background: "#fef2f2" } : null} />
              )}
              {otroOn && (
                <div style={{ marginTop: 12 }}>
                  <Label>¿Cuál?</Label>
                  <Input value={R[q.id + "Otro"] || ""} onChange={(e) => { set(q.id + "Otro", e.target.value); setMarcar(false); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); siguiente(); } }} autoFocus
                    style={marcar && fd && fd.campo === "otro" ? { borderColor: "#dc2626", background: "#fef2f2" } : null} />
                </div>
              )}
              {det && (
                <div style={{ marginTop: 12 }}>
                  <Label>{det.lbl}</Label>
                  <Input value={R[det.id] || ""} onChange={(e) => { set(det.id, e.target.value); setMarcar(false); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); siguiente(); } }} autoFocus
                    style={marcar && fd && fd.campo === "detalle" ? { borderColor: "#dc2626", background: "#fef2f2" } : null} />
                </div>
              )}
              {falta && <div className="nub-qerr" role="alert">{falta}</div>}
            </div>
          </div>
        ) : (
          <div className="nub-tut__parte nub-fade">
            <div>
              <div className="nub-tut__k">Revisá antes de enviar</div>
              <h2 className="nub-tut__h">{pendientes.length ? "Te quedan " + pendientes.length + " pregunta" + (pendientes.length === 1 ? "" : "s") + " por responder" : "Respondiste todo"}</h2>
              <p className="nub-tut__p">Tocá cualquier respuesta para cambiarla. {pendientes.length ? "Todas las preguntas son obligatorias: completá las marcadas en rojo para poder enviar." : "Revisalas y, cuando estés seguro, enviá el relevamiento."}</p>
              <div className="nub-tut__nota">Después de enviarlo queda cerrado y no se puede editar. Si necesitás cambiar algo, le escribís a tu implementador/a.</div>
            </div>
            <div>
              {verResumenError && pendientes.length > 0 && (
                <div className="nub-qerr" role="alert" style={{ marginTop: 0, marginBottom: 12 }}><b>No se puede enviar todavía.</b> Te falta responder: {pendientes.map((x) => x.lbl).join(" · ")}</div>
              )}
              <div className="nub-sum">
                {L.map((x, k) => {
                  const t = rvTexto(x, R), ok = rvCompleta(x, R);
                  return (
                    <button key={x.id} type="button" className="nub-sum__r nub-sum__r--btn" onClick={() => irA(k)}>
                      <span style={{ textAlign: "left" }}>{x.lbl}</span>
                      {ok ? <b style={{ textAlign: "right" }}>{t}</b> : <span className="nub-pend">{t ? "Falta el detalle" : "Sin responder"}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <div className="nub-tut__bar">
          <Btn variant="ghost" onClick={() => irA(Math.max(0, i - 1))} style={{ visibility: i === 0 ? "hidden" : "visible" }}>Anterior</Btn>
          <span className={"nub-tut__hint" + ((enResumen && pendientes.length) || falta ? " nub-tut__hint--error" : "")}>
            {enResumen
              ? (pendientes.length ? "Completá las " + pendientes.length + " marcadas en rojo para poder enviar." : "Tus respuestas se guardan solas.")
              : (q.type === "radio" ? (conDetalle ? "Completá el detalle y tocá Siguiente." : "Al elegir una opción pasás a la siguiente.") : q.type === "multi" ? "Marcá todas las que correspondan y tocá Siguiente." : "Escribí tu respuesta y tocá Siguiente.")}
          </span>
          {enResumen
            ? <Btn onClick={() => pendientes.length ? setVerResumenError(true) : setConfirmar(true)}>Enviar relevamiento</Btn>
            : <Btn onClick={siguiente} style={{ visibility: mostrarSiguiente ? "visible" : "hidden" }}>{i === L.length - 1 ? "Ver resumen" : "Siguiente"}</Btn>}
        </div>
      </div>

      {confirmar && (
        <div className="nub-overlay nub-modal" role="dialog" aria-modal="true" aria-labelledby="rvConfT" onClick={() => !enviando && setConfirmar(false)}>
          <div className="nub-modal__box" onClick={(e) => e.stopPropagation()}>
            <h2 id="rvConfT" style={{ fontSize: 19, margin: "0 0 8px", color: T.n900 }}>¿Confirmás el envío del relevamiento?</h2>
            <p style={{ fontSize: 14, color: T.n600, margin: "0 0 18px", lineHeight: 1.55 }}>Revisaste todas las respuestas. Una vez enviado, el relevamiento queda cerrado y no vas a poder editarlo. Si después necesitás cambiar algo, lo hablás con tu implementador/a.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Btn variant="ghost" onClick={() => setConfirmar(false)} disabled={enviando}>Volver a revisar</Btn>
              <Btn onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Sí, enviar"}</Btn>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


// ═════════════ Paso de sucursales en modo tutorial ═════════════
const TERMINOS = {
  comercio: "Número de comercio: el código que cada procesadora le asigna a cada uno de tus locales. Aparece en los cupones y en las liquidaciones. Un mismo local puede tener un número distinto en cada procesadora.",
  pdv: "Código de punto de venta: el código con el que tu sistema de ventas identifica a cada local (por ejemplo 014 o PALERMO). Va en cada venta que nos mandás.",
  procesadora: "Procesadora: la empresa que te liquida los cobros con tarjeta, QR o billetera, como Payway, Fiserv o Mercado Pago.",
  cabecera: "Sucursal cabecera: así se llama en Nubceo a cada uno de tus locales. Reúne el nombre, el código de punto de venta y los números de comercio de ese local.",
  huerfano: "Número de comercio sin sucursal (huérfano): un número que Nubceo ya ve en tus liquidaciones pero que todavía no sabe a qué local pertenece.",
  conciliar: "Conciliar: cruzar cada venta con su cobro para confirmar que te pagaron lo que corresponde.",
};
const Termino = ({ k, children }) => (
  <span className="nub-term" tabIndex={0}>{children}<span className="nub-term__tt" role="tooltip">{TERMINOS[k]}</span></span>
);
const EXAMEN_SUC = [
  { q: "Una venta llega con el código de punto de venta 014. ¿Cómo sabe Nubceo que es de Palermo?", o: ["Por el nombre que escribe el cajero", "Porque en la sucursal Palermo está cargado el código 014", "Por el monto de la venta"], ok: 1,
    bien: "Exacto. El código de punto de venta de la sucursal tiene que ser el mismo que usa tu sistema de ventas.", mal: "Nubceo no adivina por nombre ni por monto: usa el código de punto de venta cargado en la sucursal." },
  { q: "¿Qué es un número de comercio?", o: ["El número de factura de cada venta", "El código que cada procesadora le da a cada local", "El CUIT de la empresa"], ok: 1,
    bien: "Correcto. Lo ves en los cupones y en las liquidaciones de cada procesadora.", mal: "El número de comercio lo asigna cada procesadora a cada local. No es la factura ni el CUIT." },
  { q: "Palermo cobra con Payway y con Mercado Pago. ¿Cuántos números de comercio van en esa sucursal?", o: ["Uno solo", "Dos: uno de cada procesadora", "Ninguno, se asocian solos"], ok: 1,
    bien: "Bien. Cada procesadora le da su propio número al local, y todos van a la misma sucursal.", mal: "Cada procesadora tiene su propio número para el local, así que son dos." },
  { q: "En Nubceo ves un número de comercio sin sucursal. ¿Qué hacés?", o: ["Lo dejo así, no afecta", "Lo asigno a la sucursal a la que pertenece", "Lo borro"], ok: 1,
    bien: "Perfecto. Mientras no tenga sucursal, sus cobros no se pueden cruzar con las ventas.", mal: "Si queda sin sucursal, sus cobros no se cruzan con las ventas. Hay que asignarlo a su local." },
];
const GUIA_SUC = {
  masiva: [
    ["Entrá a Nubceo", "Abrí cash.nubceo.com e ingresá con tu usuario.", "login"],
    ["Abrí Mi negocio", "En el menú de la izquierda está todo lo de tu empresa y tus locales.", "inicio"],
    ["Entrá a Sucursales cabecera", "Es donde se crean tus sucursales y se les asignan los números de comercio.", "negocio"],
    ["Tocá Crear masivamente", "Con este botón se cargan todas las sucursales juntas desde una planilla.", "lista-masiva"],
    ["Descargá la planilla de sucursales huérfanas", "Ya trae tus números de comercio, la procesadora, la empresa y el CUIT. Solo te faltan dos columnas.", "masiva-descargar"],
    ["Completá las dos columnas amarillas", "En Excel, completá el código de punto de venta y el nombre de la sucursal de cada número de comercio. Si dos números son del mismo local, repetí el código y el nombre.", "excel"],
    ["Subí la planilla completa", "Volvé a Crear masivamente y subí el archivo. Nubceo crea las sucursales y les asigna los números de comercio.", "masiva-subir"],
    ["Revisá el resultado", "Nubceo te muestra cuántas sucursales creó. Si alguna fila tuvo un problema, corregila y volvé a subir la planilla.", "resultado"],
  ],
  una: [
    ["Entrá a Nubceo", "Abrí cash.nubceo.com e ingresá con tu usuario.", "login"],
    ["Abrí Mi negocio", "En el menú de la izquierda está todo lo de tu empresa y tus locales.", "inicio"],
    ["Entrá a Sucursales cabecera", "Es donde se crean tus sucursales y se les asignan los números de comercio.", "negocio"],
    ["Tocá Crear", "Vas a crear la primera sucursal de tu lista.", "lista-crear"],
    ["Completá los datos de la sucursal", "Escribí el nombre del local y su código de punto de venta, igual que en el portal.", "form"],
    ["Agregá sus números de comercio", "Por cada procesadora, elegí la plataforma y escribí el número de comercio de ese local. Después guardá.", "form2"],
    ["Repetí con cada sucursal", "Cada sucursal aparece en la lista con sus números. Repetí Crear con cada local.", "creadas"],
  ],
};
// Marca el lugar donde hay que hacer clic: resaltado, flecha y cursor animados.
const Clic = ({ children, on, style }) => on
  ? <span className="nub-clic" style={style}>{children}<span className="nub-clic__flecha" aria-hidden="true" /><span className="nub-clic__cursor" aria-hidden="true" /></span>
  : <span style={style}>{children}</span>;

function PantallaNubceo({ scr, sucs }) {
  const sc = sucs.length ? sucs : [{ nombre: "Palermo", codigo: "014" }, { nombre: "Belgrano", codigo: "022" }];
  const marco = (main, menuAct, clicMenu) => (
    <div className="nub-nb">
      <div className="nub-nb__top"><Wordmark height={14} /><span className="nub-nb__url">cash.nubceo.com</span></div>
      <div className="nub-nb__in">
        <div className="nub-nb__side">
          <Clic on={clicMenu}><div className={menuAct ? "is-act" : ""}>Mi negocio</div></Clic>
          <div>Ventas</div><div>Conciliación</div><div>Reportes</div>
        </div>
        <div className="nub-nb__main">{main}</div>
      </div>
      <span className="nub-nb__tag">Pantalla de ejemplo</span>
    </div>
  );
  const cab = (hot) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <b>Sucursales cabecera</b>
      <span style={{ display: "flex", gap: 6 }}><Clic on={hot === "crear"}><span className="nub-nb__btn">Crear</span></Clic><Clic on={hot === "masiva"}><span className="nub-nb__btn">Crear masivamente</span></Clic></span>
    </div>
  );
  if (scr === "login") return (
    <div className="nub-nb"><div className="nub-nb__top"><Wordmark height={14} /><span className="nub-nb__url">cash.nubceo.com/login</span></div>
      <div style={{ padding: "34px 20px", display: "grid", justifyItems: "center", gap: 10, minHeight: 260, alignContent: "center" }}>
        <span className="nub-nb__btn" style={{ width: 230, color: T.n400 }}>usuario@tuempresa.com</span>
        <span className="nub-nb__btn" style={{ width: 230, color: T.n400 }}>contraseña</span>
        <Clic on><span className="nub-nb__btn nub-nb__btn--p" style={{ width: 230, textAlign: "center" }}>Ingresar</span></Clic>
      </div><span className="nub-nb__tag">Pantalla de ejemplo</span></div>
  );
  if (scr === "inicio") return marco(<><b>Inicio</b><div className="nub-nb__ph" /><div className="nub-nb__ph" /></>, false, true);
  if (scr === "negocio") return marco(<><b>Mi negocio</b><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><span className="nub-nb__btn">Empresas</span><Clic on><span className="nub-nb__btn" style={{ display: "block" }}>Sucursales cabecera</span></Clic><span className="nub-nb__btn">Plataformas</span><span className="nub-nb__btn">Usuarios</span></div></>, true);
  if (scr === "lista-masiva" || scr === "lista-crear") return marco(<>{cab(scr === "lista-crear" ? "crear" : "masiva")}<div style={{ marginTop: 12, fontSize: 11.5, color: "#854d0e", fontWeight: 600 }}>Hay números de comercio sin sucursal</div><div className="nub-nb__ph" /></>, true);
  if (scr === "masiva-descargar" || scr === "masiva-subir") return marco(<><b>Crear sucursales masivamente</b><div style={{ marginTop: 10, fontSize: 12, color: T.n600, lineHeight: 1.6 }}>1. Descargá la planilla con tus sucursales huérfanas.<br />2. Completá el código de punto de venta y el nombre.<br />3. Subí el archivo.</div><div style={{ marginTop: 14, display: "flex", gap: 6 }}><Clic on={scr === "masiva-descargar"}><span className="nub-nb__btn">Descargar planilla</span></Clic><Clic on={scr === "masiva-subir"}><span className="nub-nb__btn nub-nb__btn--p">Subir archivo</span></Clic></div></>, true);
  if (scr === "excel") return (
    <div className="nub-nb"><div className="nub-nb__top"><b style={{ color: "#1d6f42", fontSize: 12 }}>Excel</b><span className="nub-nb__url">sucursales_huerfanas.xlsx</span></div>
      <div style={{ padding: 12, overflowX: "auto", minHeight: 240 }}>
        <table className="nub-xl"><thead><tr><th>Nombre de la empresa</th><th>CUIT</th><th>Código de sucursal PDV</th><th>Nombre de sucursal</th><th>Número de comercio</th><th>Código de plataforma</th></tr></thead>
          <tbody>{[["1234567", "prisma_ar", 0], ["7654321", "prisma_ar", 1], ["MP-889201", "mercadopago_ar", 0]].map(([n, c, k], j) => { const x = sc[k % sc.length]; return (
            <tr key={j}><td>Tu empresa</td><td>00-00000000-0</td><td className="y">{j === 0 ? <Clic on>{x.codigo || "(completar)"}</Clic> : (x.codigo || "(completar)")}</td><td className="y">{x.nombre}</td><td>{n}</td><td>{c}</td></tr>); })}</tbody></table>
        <div style={{ fontSize: 11, color: T.n600, marginTop: 8 }}>En amarillo, lo que completás vos. El resto ya viene cargado.</div>
      </div><span className="nub-nb__tag">Ejemplo con tus sucursales</span></div>
  );
  if (scr === "resultado") return marco(<><b>Resultado de la carga</b><Clic on style={{ display: "block", marginTop: 12 }}><div style={{ border: "1px solid #bbe8c9", background: "#f0fdf4", borderRadius: 8, padding: 10, color: "#166534", fontWeight: 600 }}>{sc.length} sucursales creadas con sus números de comercio</div></Clic></>, true);
  if (scr === "form" || scr === "form2") return marco(<>
    <b>Nueva sucursal</b>
    <div className="nub-nb__lbl">Nombre</div><Clic on={scr === "form"} style={{ display: "block" }}><span className="nub-nb__btn" style={{ display: "block", color: T.n900 }}>{sc[0].nombre}</span></Clic>
    <div className="nub-nb__lbl">Código de punto de venta</div><span className="nub-nb__btn" style={{ display: "block", color: T.n900 }}>{sc[0].codigo || "(si lo tenés)"}</span>
    {scr === "form2" && <><div className="nub-nb__lbl">Números de comercio</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><span className="nub-nb__btn">Payway</span><span className="nub-nb__btn">1234567</span><span className="nub-nb__btn">Mercado Pago</span><span className="nub-nb__btn">MP-889201</span></div>
      <div style={{ textAlign: "right", marginTop: 10, display: "flex", gap: 6, justifyContent: "flex-end" }}><span className="nub-nb__btn">Cancelar</span><Clic on><span className="nub-nb__btn nub-nb__btn--p">Guardar</span></Clic></div></>}
  </>, true);
  if (scr === "creadas") return marco(<>{cab("")}<div style={{ marginTop: 10 }}>{sc.map((x, k) => <div key={k} className="nub-nb__row"><b>{x.nombre}</b><span>{x.codigo || "Sin código"}</span><span style={{ color: k === 0 ? "#166534" : T.n400 }}>{k === 0 ? "Creada" : "Por crear"}</span></div>)}</div></>, true);
  return null;
}

function TabSucursalesTut({ data, meta, act, saving, avisar, onSeguir }) {
  const rv = data.relevamiento || {};
  const [resp, setResp] = useState(() => rv.sucursalesExamen ? EXAMEN_SUC.map((q) => q.ok) : EXAMEN_SUC.map(() => -1));
  const [sucs, setSucs] = useState(() => (rv.sucursalesLista && rv.sucursalesLista.length ? rv.sucursalesLista : [{ nombre: "", codigo: "" }]).map((x) => ({ ...x })));
  const [pegar, setPegar] = useState(false), [pegarTx, setPegarTx] = useState("");
  const [flujo, setFlujo] = useState(null), [g, setG] = useState(0);
  const [hecho, setHecho] = useState(!!rv.sucursalesConfirmadas);
  const validas = sucs.filter((x) => x.nombre.trim());
  const flujoAct = flujo || (validas.length > 5 ? "masiva" : "una");
  const guia = GUIA_SUC[flujoAct];
  const errSuc = () => {
    const e = {}, nom = {}, cod = {};
    sucs.forEach((x, k) => {
      const n = x.nombre.trim().toLowerCase(), c = x.codigo.trim();
      if (!n) e[k] = "Escribí el nombre de la sucursal.";
      else if (nom[n] != null) e[k] = "Ya cargaste una sucursal con este nombre.";
      nom[n] = k;
      if (c) { if (cod[c] != null) e[k] = (e[k] ? e[k] + " " : "") + "El código " + c + " está repetido."; cod[c] = k; }
    });
    return e;
  };
  const guardar = async (extra) => !!(await act("guardarSucursales", { lista: validas, ...extra }));
  const malas = resp.filter((r, k) => r !== EXAMEN_SUC[k].ok).length;
  const partes = (marcar) => {
    const e = marcar ? errSuc() : {};
    return [
      { k: "Por qué importan las sucursales", h: "Cada venta tiene que encontrar su cobro",
        texto: <>Tu sistema de ventas identifica cada local con un <Termino k="pdv">código de punto de venta</Termino>. Las <Termino k="procesadora">procesadoras</Termino>, en cambio, te pagan por <Termino k="comercio">número de comercio</Termino>. Para <Termino k="conciliar">conciliar</Termino>, Nubceo necesita saber qué número corresponde a cada local, y esa unión se arma en la <Termino k="cabecera">sucursal cabecera</Termino>.</>,
        contenido: (
          <div className="nub-flow3 nub-aparecen">
            <div className="nub-vb"><b>Venta en tu caja</b>Local <code>014</code><br />Ticket 88213, $ 25.400</div>
            <div className="nub-vm">se unen por<br />la sucursal</div>
            <div className="nub-vb"><b>Cobro de Payway</b>N.º de comercio <code>1234567</code><br />Liquidación del 12/11</div>
            <div className="nub-vres"><b>Sucursal Palermo</b> = código de punto de venta <code>014</code> + comercio de Payway <code>1234567</code> + comercio de Mercado Pago <code>MP-889201</code></div>
          </div>
        ) },
      { k: "Cómo se arma", h: "Una sucursal, varios números de comercio",
        texto: <>Un mismo local puede tener un número distinto en cada procesadora, y todos van a la misma sucursal. Los números que Nubceo ve en tus liquidaciones pero todavía no tienen local aparecen como <Termino k="huerfano">sucursales huérfanas</Termino>.</>,
        nota: "Lo hacés una sola vez. Después solo hay que actualizarlo si abrís, cerrás o mudás un local.",
        contenido: (
          <div className="nub-aparecen" style={{ display: "grid", gap: 10 }}>
            <div className="nub-vb"><b>Sucursal Palermo</b>Código de punto de venta <code>014</code></div>
            <div className="nub-vb" style={{ marginLeft: 24 }}>Payway <code>1234567</code></div>
            <div className="nub-vb" style={{ marginLeft: 24 }}>Mercado Pago <code>MP-889201</code></div>
            <div className="nub-vb" style={{ marginLeft: 24, borderStyle: "dashed", background: "#fff" }}>Fiserv <code>40028812</code> <span style={{ color: "#854d0e", fontWeight: 600 }}>todavía sin sucursal</span></div>
          </div>
        ) },
      { k: "Comprobá que se entendió", h: "Examen rápido", texto: "Cuatro preguntas. Si alguna sale mal, te explicamos por qué y la volvés a intentar. Para seguir, tienen que estar todas bien.",
        nota: (EXAMEN_SUC.length - malas) + " de " + EXAMEN_SUC.length + " correctas",
        faltan: malas ? [malas === 1 ? "responder bien 1 pregunta del examen" : "responder bien " + malas + " preguntas del examen"] : [],
        contenido: (
          <div>
            {EXAMEN_SUC.map((q, k) => (
              <div key={k} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 650, color: T.n900, marginBottom: 8, fontSize: 14.5 }}>{k + 1}. {q.q}</div>
                {q.o.map((o, j) => (
                  <button key={j} type="button" className={"nub-qz" + (resp[k] === j ? (j === q.ok ? " is-ok" : " is-mal") : "")} onClick={() => setResp(resp.map((r, x) => x === k ? j : r))}>{o}</button>
                ))}
                {resp[k] >= 0 && <div className={"nub-qz__fb " + (resp[k] === q.ok ? "is-ok" : "is-mal")}>{resp[k] === q.ok ? q.bien : q.mal + " Probá de nuevo."}</div>}
              </div>
            ))}
          </div>
        ) },
      { k: "Tus locales", h: "Cargá todas tus sucursales",
        texto: <>Escribí el nombre de cada local y, si lo tenés, su <Termino k="pdv">código de punto de venta</Termino>. Con esta lista vas a hacer la carga en Nubceo.</>,
        nota: "El nombre es obligatorio. El código es opcional: si no lo sabés, lo completamos después con tu equipo de sistemas.",
        faltan: !validas.length ? ["cargar al menos una sucursal"] : Object.keys(errSuc()).length ? ["corregir las sucursales marcadas en rojo"] : [],
        contenido: (
          <div>
            <table className="nub-suc"><thead><tr><th style={{ width: "55%" }}>Nombre de la sucursal</th><th>Código de punto de venta (opcional)</th><th /></tr></thead>
              <tbody>{sucs.map((x, k) => (
                <tr key={k}>
                  <td><Input value={x.nombre} placeholder="Ej: Palermo" onChange={(ev) => setSucs(sucs.map((y, j) => j === k ? { ...y, nombre: ev.target.value } : y))} style={e[k] ? { borderColor: "#dc2626", background: "#fef2f2" } : null} />
                    {e[k] && <div style={{ fontSize: 12, color: "#991b1b", marginTop: 3 }}>{e[k]}</div>}</td>
                  <td><Input value={x.codigo} placeholder="Ej: 014" onChange={(ev) => setSucs(sucs.map((y, j) => j === k ? { ...y, codigo: ev.target.value } : y))} /></td>
                  <td>{sucs.length > 1 && <button type="button" className="nub-lnk" style={{ color: T.n400 }} onClick={() => setSucs(sucs.filter((_, j) => j !== k))}>Quitar</button>}</td>
                </tr>
              ))}</tbody></table>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
              <button type="button" className="nub-lnk" onClick={() => setSucs([...sucs, { nombre: "", codigo: "" }])}>Agregar otra sucursal</button>
              <button type="button" className="nub-lnk" onClick={() => setPegar(!pegar)}>Pegar una lista desde Excel</button>
            </div>
            {pegar && (
              <div style={{ marginTop: 10, fontSize: 13, color: T.n600 }}>Pegá dos columnas (nombre y código) copiadas de Excel; una sucursal por renglón.
                <textarea className="nub-qta" style={{ minHeight: 90, marginTop: 6 }} value={pegarTx} onChange={(ev) => setPegarTx(ev.target.value)} />
                <Btn variant="secondary" size="sm" onClick={() => {
                  const nuevas = pegarTx.split(/\n/).map((l) => l.split(/\t|;/)).filter((a) => a[0] && a[0].trim()).map((a) => ({ nombre: a[0].trim(), codigo: (a[1] || "").trim() }));
                  setSucs([...sucs.filter((x) => x.nombre.trim() || x.codigo.trim()), ...nuevas]); setPegarTx(""); setPegar(false);
                  avisar && avisar({ titulo: "Agregaste " + nuevas.length + (nuevas.length === 1 ? " sucursal" : " sucursales") });
                }}>Agregar a la lista</Btn>
              </div>
            )}
          </div>
        ) },
      { k: "Hacelo en Nubceo", h: guia[g][0], texto: guia[g][1],
        // Siguiente y Anterior recorren la guía; al terminarla, Siguiente pasa al cierre del paso.
        alSiguiente: () => { if (g < guia.length - 1) { setG(g + 1); return true; } return false; },
        alAnterior: () => { if (g > 0) { setG(g - 1); return true; } return false; },
        textoSiguiente: g < guia.length - 1 ? "Siguiente paso de la guía" : "Terminé la guía",
        textoAnterior: g > 0 ? "Paso anterior de la guía" : "Anterior",
        hint: "Paso " + (g + 1) + " de " + guia.length + " de la guía",
        nota: <>
          <div className="nub-tut__k" style={{ marginTop: 4 }}>¿Cómo vas a cargarlas?</div>
          <div className="nub-forma" role="radiogroup" aria-label="Forma de carga">
            {[["masiva", "Carga masiva", "Todas juntas con la planilla de sucursales huérfanas.", validas.length > 5], ["una", "Una por una", "Creás cada sucursal desde un formulario.", validas.length <= 5]].map(([f, t, d, rec]) => (
              <button key={f} type="button" role="radio" aria-checked={flujoAct === f} className="nub-forma__op" onClick={() => { setFlujo(f); setG(0); }}>
                <span className="nub-forma__t">{t}{rec && <span className="nub-forma__rec">Recomendada</span>}</span>
                <span className="nub-forma__d">{d}</span>
              </button>
            ))}
          </div>
          <div className="nub-tut__barras" style={{ marginTop: 14, maxWidth: "none" }}>{guia.map((_, k) => <i key={k} className={k < g ? "d" : k === g ? "c" : ""} />)}</div>
        </>,
        contenido: <div key={flujoAct + g} className="nub-fade"><PantallaNubceo scr={guia[g][2]} sucs={validas} /><div className="nub-guia"><b>{g + 1}</b><span>Paso {g + 1} de {guia.length} de la guía: {guia[g][0]}</span></div></div> },
      { k: "Cerrá el paso", h: "¿Ya cargaste tus sucursales en Nubceo?",
        texto: "Cuando estén todas y no te quede ningún número de comercio sin sucursal, marcalo acá. Si preferís hacerlo con ayuda, podés omitir el paso por ahora: tu implementador/a lo retoma con vos.",
        faltan: hecho ? [] : ["marcar que cargaste tus sucursales en Nubceo, u omitir el paso"],
        contenido: (
          <div>
            <div className={marcar && !hecho ? "nub-falta" : undefined}>
              <button type="button" role="checkbox" aria-checked={hecho} className="nub-proc" style={{ width: "100%" }} onClick={() => setHecho(!hecho)}>
                <span className="nub-proc__box">{hecho && <Icon n="check" size={12} stroke={3.2} />}</span>Cargué mis sucursales en Nubceo y no quedan números de comercio sin sucursal.
              </button>
            </div>
            <div className="nub-sum" style={{ marginTop: 12 }}>
              <div className="nub-sum__r"><span>Sucursales cargadas en el portal</span><b>{validas.length}</b></div>
              {validas.map((x, k) => <div key={k} className="nub-sum__r"><span>{x.nombre}</span><span style={{ color: T.n600 }}>{x.codigo ? "Código " + x.codigo : "Sin código"}</span></div>)}
            </div>
            <div style={{ marginTop: 12 }}>
              <Btn variant="ghost" disabled={saving} onClick={async () => { if (await guardar({ examen: true, omitir: true })) { avisar && avisar({ titulo: "Paso omitido por ahora", detalle: "Tu implementador/a ya recibió el aviso. Seguís con Conexión de ventas." }); onSeguir(); } }}>Omitir por ahora y seguir</Btn>
            </div>
          </div>
        ) },
    ];
  };
  return (
    <Tutorial titulo="Sucursales" partes={partes} guardando={saving} completo={!!rv.sucursalesConfirmadas}
      onCompletar={() => guardar({ examen: true, confirmar: true })}
      final={<><h2 className="nub-tut__h">Sucursales listas</h2><p className="nub-tut__p">Cargaste {validas.length} {validas.length === 1 ? "sucursal" : "sucursales"} en Nubceo. Tu implementador/a ya recibió el aviso.</p><Btn onClick={onSeguir}>Seguir con Conexión de ventas</Btn></>} />
  );
}

function ProximoPaso({ meta, data, pasos, completo, unlocked, proximo, completados, tab, setTab, omitioSucursales }) {
  const total = pasos.length;
  const pct = total ? Math.round((completados / total) * 100) : 0;
  const pctVisible = useCuentaRegresiva(pct);
  // Al entrar, el cliente cae directo en el paso que tiene que hacer.
  const yaPosicionado = useRef(false);
  useEffect(() => {
    if (yaPosicionado.current) return;
    yaPosicionado.current = true;
    if (proximo && tab === "procesadoras" && proximo.id !== "procesadoras") setTab(proximo.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const idxProx = proximo ? pasos.findIndex((p) => p.id === proximo.id) : -1;
  const faseNombre = FASES[meta.phase] || FASES[0];
  const [titulo, desc, cta] = proximo ? (PROXIMO_TXT[proximo.id] || [proximo.n, "", "Ir al paso"]) : [];
  const hito = proximo && PASO_A_HITO[proximo.id];
  const plazo = hito ? textoPlazo(data.plazos?.[hito]?.fechaLimite) : null;
  const golive = meta.goLiveEstimado ? new Date(meta.goLiveEstimado + "T00:00:00") : null;
  const semanas = golive ? Math.round(diasHasta(meta.goLiveEstimado) / 7) : null;
  return (
    <section className="nub-np" aria-label="Tu próximo paso">
      <div className="nub-np__main">
        <div className="nub-np__where">
          <span>Estás en <b>{faseNombre}</b>, fase {meta.phase + 1} de {FASES.length} de tu implementación</span>
          <button type="button" className="nub-np__hist" onClick={() => setTab("historial")} aria-pressed={tab === "historial"}>
            <Icon n="history" size={14} /> Historial
          </button>
        </div>
        {proximo ? (
          <>
            <h1 className="nub-np__title">Tu próximo paso: {titulo.charAt(0).toLowerCase() + titulo.slice(1)}</h1>
            <p className="nub-np__desc">{desc}</p>
            {plazo && <div className={"nub-np__due nub-np__due--" + plazo.tono}><Icon n="clock" size={14} /> {plazo.txt}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: plazo ? 0 : 16 }}>
              {tab !== proximo.id
                ? <Btn onClick={() => setTab(proximo.id)}>{cta}</Btn>
                : <span className="nub-np__aqui">Estás en este paso: completalo más abajo.</span>}
            </div>
          </>
        ) : (
          <>
            <h1 className="nub-np__title">Completaste todos tus pasos</h1>
            <p className="nub-np__desc">Ahora el equipo de Nubceo acompaña el go-live y las primeras semanas de uso. Cualquier duda, escribile a tu implementador/a.</p>
          </>
        )}

        {/* Recorrido: solo se nombra el paso en el que está el cliente */}
        <ol className="nub-recorrido" aria-label={"Recorrido: " + completados + " de " + total + " pasos completos"}>
          {pasos.map((p, i) => {
            const ok = completo[p.id], libre = unlocked[p.id], actual = i === idxProx;
            const estado = ok ? "hecho" : actual ? "actual" : libre ? "libre" : "bloqueado";
            const pendiente = p.id === "sucursales" && omitioSucursales;
            return (
              <li key={p.id} className={"nub-recorrido__seg is-" + estado + (tab === p.id ? " is-viendo" : "") + (pendiente ? " is-pendiente" : "")}>
                <button type="button" disabled={!libre} onClick={() => libre && setTab(p.id)}
                  aria-label={"Paso " + (i + 1) + ": " + p.n + (ok ? ", completo" : actual ? ", en curso" : !libre ? ", bloqueado" : "")}
                  title={p.n + (ok ? " (completo)" : !libre ? " (se habilita al completar los anteriores)" : "")}>
                  <i />
                  {actual && <span className="nub-recorrido__lbl">Paso {i + 1} de {total}: {p.n}</span>}
                </button>
              </li>
            );
          })}
        </ol>
        {omitioSucursales && (
          <Alert tone="warning" style={{ marginTop: 14 }}>
            El paso de sucursales quedó <b>pendiente</b>. Podés seguir avanzando, pero lo necesitamos para terminar la implementación.
          </Alert>
        )}
      </div>
      <aside className="nub-np__side">
        <div>
          <div className="nub-np__k">Avance</div>
          <div className="nub-np__big">{pctVisible}%</div>
          <div className="nub-np__k">{completados} de {total} pasos</div>
        </div>
        <div>
          <div className="nub-np__k">Go-live acordado</div>
          <div className="nub-np__v">{golive ? golive.toLocaleDateString("es-AR", { day: "numeric", month: "long" }) : "A definir con tu implementador/a"}</div>
          {semanas !== null && semanas > 0 && <div className="nub-np__k">Faltan {semanas} semana{semanas === 1 ? "" : "s"}</div>}
        </div>
        {meta.implementadorNombre && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar nombre={meta.implementadorNombre} size={34} />
              <div><div className="nub-np__v" style={{ fontSize: 14 }}>{meta.implementadorNombre}</div><div className="nub-np__k">Te acompaña en la implementación</div></div>
            </div>
            {meta.implementadorEmail && (
              <a className="nub-np__mail" href={"mailto:" + meta.implementadorEmail + "?subject=" + encodeURIComponent("Consulta sobre la implementación de " + (meta.name || ""))}>
                <Icon n="mail" size={14} /> Escribirle
              </a>
            )}
          </div>
        )}
      </aside>
    </section>
  );
}

// Cuando un paso pasa a completo, se avisa una sola vez con el siguiente paso.
function AvisoPasoCompletado({ completados, pasos, completo, proximo, implementador, prevRef, mostrar }) {
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = completados;
    if (prev === null || completados <= prev) return;
    const recien = pasos.filter((p) => completo[p.id]).slice(-1)[0];
    mostrar({
      titulo: "Completaste " + (recien ? recien.n : "un paso"),
      detalle: (implementador ? implementador + " ya recibió el aviso." : "Tu implementador/a ya recibió el aviso.") + (proximo ? " Siguiente: " + proximo.n + "." : ""),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completados]);
  return null;
}

function ClientPortal({ session, onLogout }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = useCallback(() => setMenuAbierto(false), []);
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState("procesadoras");
  const [modulo, setModulo] = useState("implementacion"); // implementacion | cronograma | perfil
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [toast, setToast] = useState(null);
  const mostrarToast = useCallback((t) => setToast({ ...t, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.tono === "error" ? 6000 : 4800);
    return () => clearTimeout(id);
  }, [toast]);
  // Los mensajes de guardado se muestran como aviso flotante, no como texto suelto arriba.
  useEffect(() => {
    if (!savedMsg) return;
    const ok = /guardado/i.test(savedMsg);
    if (ok) mostrarToast({ titulo: "Cambios guardados" });
    else mostrarToast({ titulo: "No se pudo completar la acción", detalle: savedMsg, tono: "error" });
  }, [savedMsg, mostrarToast]);
  const completadosPrev = useRef(null);

  const reload = useCallback(async () => {
    try {
      const r = await api("getClient", { sessionCode: session.code, code: session.code });
      setMeta(r.meta); setData(r.data);
    } catch (e) {
      setMeta({ name: session.name, phase: 0 });
      setData({ relevamiento: {}, procesadoras: [], involucrados: [], eventos: [], pruebas: {}, history: [] });
    }
  }, [session.code, session.name]);

  useEffect(() => { reload(); }, [reload]);

  // Primer login: el servidor dispara el alta en Redmine y genera credenciales de API
  useEffect(() => {
    if (!data || !meta || data.redmine) return;
    let cancel = false;
    (async () => {
      try {
        const r = await api("onboarding", { sessionCode: session.code, code: session.code, who: session.who });
        if (!cancel) { setMeta(r.meta); setData(r.data); }
      } catch (e) { /* se reintenta en el próximo ingreso */ }
    })();
    return () => { cancel = true; };
  }, [data, meta, session.code, session.who]);

  const persist = async (partial, logTxt) => {
    setSaving(true);
    try {
      const r = await api("saveClient", { sessionCode: session.code, code: session.code, who: session.who || "Cliente", data: partial, log: logTxt || null });
      setData(r.data); setMeta(r.meta); setSavedMsg("Guardado ✓");
    } catch (e) { setSavedMsg("No se pudo guardar — reintentá"); }
    finally { setSaving(false); setTimeout(() => setSavedMsg(""), 2500); }
  };

  const act = async (action, payload = {}) => {
    setSaving(true);
    try {
      const r = await api(action, { sessionCode: session.code, code: session.code, who: session.who, ...payload });
      setData(r.data); setMeta(r.meta);
      return r;
    } catch (e) { setSavedMsg(e.message); setTimeout(() => setSavedMsg(""), 3000); }
    finally { setSaving(false); }
  };

  if (!data || !meta) return (
    <div role="status" aria-label="Cargando tu implementación" style={{ maxWidth: 900, margin: "0 auto", padding: "26px 20px 60px", display: "grid", gap: 20 }}>
      <Card>
        <Skeleton w={140} h={11} style={{ marginBottom: 12 }} />
        <Skeleton w={280} h={22} style={{ marginBottom: 20, maxWidth: "100%" }} />
        <div style={{ display: "flex", gap: 14, overflow: "hidden" }}>
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} w={30} h={30} r={100} />)}
        </div>
      </Card>
      <Card><SkeletonLineas lineas={4} /></Card>
    </div>
  );

  const rv = data.relevamiento || {};
  const eventos = data.eventos || [];
  const tieneEvento = (tipo, realizado) => eventos.some((e) => e.tipo === tipo && e.estado !== "cancelado" && (!realizado || e.estado === "realizado"));
  const csvOk = !!(data.ventasArchivo && data.ventasArchivo.validacion?.ok);
  // "completo" = el paso está realmente terminado (lo que se muestra);
  // "avanzable" = alcanza para desbloquear el siguiente (sucursales se puede omitir)
  const completo = {
    procesadoras: !!rv.procesadorasConfirmadas || (data.procesadoras || []).some((p) => p.estado === "conectado"),
    empresa: !!rv.empresaConfirmada || !!meta.introLeida,
    introduccion: !!meta.introLeida,
    relevamiento: !!data.relevamientoEnviado,
    sucursales: !!data.sucursalesArchivo || !!rv.sucursalesConfirmadas,
    conexion: rv.conexionLeida ? true : (rv.d1 === "api" ? !!data.apiCreds : rv.d1 === "csv" ? csvOk : rv.d1 === "ambos" ? (!!data.apiCreds && csvOk) : false),
    capacitacion: tieneEvento("capacitacion_conciliador") || tieneEvento("capacitacion_cash"),
    sandbox: tieneEvento("resultados_sandbox", true),
    golive: tieneEvento("golive", true),
  };
  const avanzable = { ...completo, sucursales: completo.sucursales || !!meta.sucursalesOmitido };
  // Si el cliente no usa ambiente de pruebas, ese paso no existe para él.
  const pasosCli = PASOS.filter((p) => p.id !== "sandbox" || meta.usaSandbox !== false);
  // Desbloqueo secuencial (sucursales es omitible)
  const unlocked = {};
  let prevOk = true;
  for (const p of pasosCli) { unlocked[p.id] = prevOk; prevOk = prevOk && avanzable[p.id]; }
  const completados = pasosCli.filter((p) => completo[p.id]).length;
  const omitioSucursales = !!meta.sucursalesOmitido && !data.sucursalesArchivo;
  const idxTab = pasosCli.findIndex((p) => p.id === tab);
  const proximo = pasosCli.find((p) => !completo[p.id] && unlocked[p.id]) || null;

  return (
    <div>
      <Nav name={meta.name} who={session.who} onLogout={onLogout} onMenu={() => setMenuAbierto(true)} implementador={meta.implementadorNombre ? { nombre: meta.implementadorNombre, email: meta.implementadorEmail } : null} />
      <div style={{ display: "flex" }}>
        <ClientSidebar activo={modulo} onCambiar={setModulo} abierto={menuAbierto} onCerrar={cerrarMenu} />
        <div className="nub-main" style={{ flex: 1, minWidth: 0, maxWidth: 900, margin: "0 auto", padding: "26px 20px 60px" }}>

          {modulo === "implementacion" && (
            <>
              <ProximoPaso
                meta={meta} data={data} pasos={pasosCli} completo={completo} unlocked={unlocked}
                proximo={proximo} completados={completados} tab={tab} setTab={setTab}
                omitioSucursales={omitioSucursales}
              />

              <div key={tab} className="nub-fade">
              {tab === "procesadoras" && <TabProcesadorasTut data={data} act={act} saving={saving} avisar={mostrarToast} onSeguir={() => setTab("empresa")} />}
              {tab === "empresa" && <TabEmpresaTut data={data} meta={meta} act={act} saving={saving} avisar={mostrarToast} onSeguir={() => setTab("introduccion")} />}
              {tab === "introduccion" && <TabIntroduccion act={act} meta={meta} saving={saving} />}
              {tab === "relevamiento" && <TabRelevamientoTut data={data} session={session} avisar={mostrarToast} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
              {tab === "sucursales" && <TabSucursalesTut data={data} meta={meta} act={act} saving={saving} avisar={mostrarToast} onSeguir={() => setTab("conexion")} />}
              {tab === "conexion" && <TabConexion data={data} persist={persist} session={session} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
              {tab === "capacitacion" && <TabCapacitacion data={data} session={session} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
              {tab === "sandbox" && <TabPruebasEtapa etapa="sandbox" tipoEvento="resultados_sandbox" data={data} session={session} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
              {tab === "golive" && <TabPruebasEtapa etapa="golive" tipoEvento="golive" data={data} session={session} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
              {tab === "historial" && <TabHistorial history={data.history} />}
              </div>

              {/* Navegación entre pasos: volver atrás para ver/editar, avanzar al completar */}
              {idxTab >= 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
                  {idxTab > 0
                    ? <Btn variant="ghost" onClick={() => setTab(pasosCli[idxTab - 1].id)}>Volver a {pasosCli[idxTab - 1].n}</Btn>
                    : <span />}
                  {idxTab < pasosCli.length - 1 && !["procesadoras", "empresa", "relevamiento", "sucursales"].includes(tab) && (
                    avanzable[tab]
                      ? <Btn onClick={() => setTab(pasosCli[idxTab + 1].id)}>Seguir con {pasosCli[idxTab + 1].n}</Btn>
                      : <span style={{ fontSize: 13, color: T.n400 }}>Completá este paso para pasar al siguiente</span>
                  )}
                </div>
              )}
            </>
          )}

          <AvisoPasoCompletado completados={completados} pasos={pasosCli} completo={completo} proximo={proximo} implementador={meta.implementadorNombre} prevRef={completadosPrev} mostrar={mostrarToast} />
          <Toast toast={toast} />

          {modulo === "cronograma" && <TabCronograma data={data} />}

          {modulo === "perfil" && <TabMiEmpresa data={data} meta={meta} act={act} persist={persist} saving={saving} />}

        </div>
      </div>
    </div>
  );
}

// ── Paso 1: Procesadoras ──
// Cada país trae su lista oficial de conectores + una opción "Otra" con texto libre
// (codigo otro_<país>), para que el cliente nunca se quede sin poder declarar la suya.
function TabProcesadoras({ data, act, saving }) {
  const inicial = {}, inicialOtras = {};
  (data.procesadoras || []).forEach((p) => {
    inicial[p.codigo] = p.estado;
    if ((p.codigo || "").startsWith(PREFIJO_OTRA)) inicialOtras[p.codigo] = (p.nombre || "").replace(/^Otra:\s*/i, "");
  });
  const [sel, setSel] = useState(inicial);
  const [otras, setOtras] = useState(inicialOtras); // codigo otro_xx → texto que escribió el cliente
  const toggle = (code) => setSel((s) => { const n = { ...s }; if (n[code] !== undefined) delete n[code]; else n[code] = "no_conectado"; return n; });
  const setEstado = (code, estado) => setSel((s) => ({ ...s, [code]: estado }));
  const otrasSinTexto = Object.keys(sel).filter((c) => c.startsWith(PREFIJO_OTRA) && !(otras[c] || "").trim());
  const guardar = () => {
    const lista = [];
    for (const [pais, conns] of Object.entries(CONECTORES)) {
      for (const c of conns) if (sel[c.code] !== undefined) lista.push({ codigo: c.code, nombre: c.nombre, pais, estado: sel[c.code] });
      const co = codigoOtra(conns);
      if (sel[co] !== undefined) lista.push({ codigo: co, nombre: "Otra: " + otras[co].trim(), pais, estado: sel[co] });
    }
    act("saveProcesadoras", { lista, log: "Actualizó sus procesadoras (" + lista.length + ") y el estado de conexión de cada una" });
  };
  const cant = Object.keys(sel).length;

  const fila = (code, nombre, esOtra) => {
    const activo = sel[code] !== undefined;
    return (
      <div key={code} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "1px solid " + (activo ? T.primary100 : T.n200), background: activo ? T.primary50 : "#fff" }}>
        <div onClick={() => toggle(code)} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", flex: "1 0 200px" }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid " + (activo ? T.primary : T.n200), background: activo ? T.primary : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{activo ? "✓" : ""}</span>
          <span style={{ fontSize: 14, fontWeight: activo ? 600 : 400, color: activo ? T.primary900 : T.n600 }}>{nombre}</span>
        </div>
        {activo && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ESTADOS_PROCESADORA.map(([v, lbl]) => (
              <span key={v} onClick={() => setEstado(code, v)} style={{
                fontSize: 12, padding: "4px 10px", borderRadius: 100, cursor: "pointer", fontWeight: sel[code] === v ? 700 : 400,
                background: sel[code] === v ? (v === "conectado" ? T.okBg : v === "en_espera" ? T.warnBg : T.errBg) : "#fff",
                color: sel[code] === v ? (v === "conectado" ? T.okTx : v === "en_espera" ? T.warnTx : T.errTx) : T.n400,
                border: "1px solid " + T.n200,
              }}>{lbl}</span>
            ))}
          </div>
        )}
        {esOtra && activo && (
          <input
            value={otras[code] || ""}
            onChange={(e) => setOtras((o) => ({ ...o, [code]: e.target.value }))}
            placeholder="¿Cuál? Ej: Banco Macro, Modo, Payway Link… (si son varias, separalas con coma)"
            style={{ flex: "1 0 100%", fontSize: 13.5, padding: "8px 10px", borderRadius: 8, border: "1px solid " + ((otras[code] || "").trim() ? T.n200 : "#fca5a5"), outline: "none", boxSizing: "border-box" }}
          />
        )}
      </div>
    );
  };

  return (
    <Card>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 6px" }}>¿Con qué procesadoras y plataformas cobran?</h2>
      <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "0 0 18px" }}>
        Marcá todas las que usen y contanos en qué estado está cada conexión. "En espera" significa que ya la pediste pero falta documentación o credenciales. Si usan alguna que no está en la lista, marcá <b>Otra</b> en el país que corresponda y escribí cuál es: tu implementador verifica el conector.
      </p>
      {Object.entries(CONECTORES).map(([pais, conns]) => (
        <div key={pais} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, margin: "0 0 10px", paddingBottom: 6, borderBottom: "1px solid " + T.primary50 }}>{pais}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {conns.map((c) => fila(c.code, c.nombre, false))}
            {fila(codigoOtra(conns), "Otra", true)}
          </div>
        </div>
      ))}
      {otrasSinTexto.length > 0 && (
        <Alert tone="warning" style={{ marginBottom: 12 }}>Indicá cuál es la procesadora en cada opción "Otra" que marcaste para poder guardar.</Alert>
      )}
      <Btn onClick={guardar} disabled={saving || !cant || otrasSinTexto.length > 0}>Guardar ({cant} seleccionada{cant === 1 ? "" : "s"})</Btn>
    </Card>
  );
}

// ── Paso 2: Introducción ──
const INTRO_PASOS = [
  ["Procesadoras", "Nos contás con qué plataformas cobrás y en qué estado está cada conexión. Con eso pedimos los accesos correctos desde el arranque."],
  ["Datos de tu empresa", "Confirmás razones sociales, contactos y sistemas que usan, para que trabajemos con la información correcta."],
  ["Relevamiento", "Un formulario sobre cómo vende y cobra tu negocio, más los involucrados del proyecto. Con tus respuestas armamos el mapa de tu operación y preparamos el workshop, que agendás acá mismo al terminarlo."],
  ["Sucursales", "Cargás tu listado interno de sucursales y el portal lo convierte al formato oficial de Nubceo, validado y listo para subir a la plataforma."],
  ["Conexión API o CSV", "Definimos cómo van a llegar tus ventas a Nubceo. Si es por API, acá tenés tus credenciales, la documentación y la reunión técnica con nuestro equipo. Si es por CSV, el portal valida tu archivo y lo deja en el formato exacto."],
  ["Capacitación", "Acceso a los manuales de Nubceo y agenda de capacitaciones de Conciliador y de Nubceo Cash para tu equipo."],
  ["Pruebas con tus datos", "Probamos la conciliación con tus datos reales en un entorno de pruebas. Te mostramos los resultados en una reunión y dejamos la minuta acá."],
  ["Go-live", "Pasamos todo a producción, repasamos reglas y resultados, y arranca el acompañamiento de hypercare."],
];

function TabIntroduccion({ act, meta, saving }) {
  return (
    <Card>
      <SectionHeader title="¿Cómo es la implementación?" subtitle="La implementación del Conciliador es un trabajo en equipo entre tu empresa y Nubceo. Este portal te acompaña paso a paso: acá completás lo que depende de vos, agendás las reuniones y seguís el avance. Esto es lo que incluye cada paso:" />
      <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
        {INTRO_PASOS.map(([titulo, txt], i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: T.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.n900 }}>{titulo}</div>
              <div style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, marginTop: 2 }}>{txt}</div>
            </div>
          </div>
        ))}
      </div>
      <Alert tone="info">
        En cualquier momento del proceso podés escribirle a tu implementador con el botón de arriba a la derecha — el portal registra todo lo que completás para que el equipo lo vea al instante.
      </Alert>
      <ActionBar>
        {meta.introLeida
          ? <Badge tone="green">Ya leíste la introducción ✓</Badge>
          : <Btn onClick={() => act("marcarIntro")} disabled={saving}>Entendido, empecemos</Btn>}
      </ActionBar>
    </Card>
  );
}

// ── Tab: Relevamiento (formulario ampliado) ──
// type: radio | multi | text | textarea · otro: agrega opción "Otro" con detalle · info: explicación en lenguaje llano
const RV_PREGUNTAS = [
  // Relevamiento en modo tutorial (v1.42): una pregunta por tarjeta, todas obligatorias.
  // Las entradas con detalleDe se muestran dentro de la tarjeta de su pregunta.
  // Las marcadas como legado ya no se preguntan (se responden en los pasos 1 y 2) pero se
  // siguen mostrando al equipo si un relevamiento viejo las tiene respondidas.
  { sec: "Cómo venden", desc: "Canales, cuotas y terminales" },
  { id: "a1", lbl: "¿Por qué canales venden?", sub: "Marcá todos, aunque alguno mueva poco volumen.", type: "multi", otro: true,
    opts: [["fisicas", "Locales físicos"], ["ecommerce", "Tienda online propia"], ["marketplaces", "Marketplaces como Mercado Libre"], ["delivery", "Apps de delivery como PedidosYa o Rappi"], ["telefonica", "Teléfono o WhatsApp"], ["mayorista", "Mayorista o distribuidores"]],
    info: "Cada canal puede tener su propia forma de cobrar y de liquidar, y eso cambia cómo se configura la conciliación." },
  { id: "a3", lbl: "Cuando un cliente paga en cuotas, ¿qué registran en su sistema?", sub: "Ejemplo: una compra de $120.000 en 6 cuotas.", type: "radio",
    opts: [["total", "Una venta de $120.000 (el total)"], ["porcuota", "Seis registros de $20.000 (cada cuota)"], ["depende", "Depende del canal o del medio de pago"]],
    info: "Es uno de los datos más importantes del relevamiento: define cómo se cruzan las ventas con los cobros." },
  { id: "a4", lbl: "¿Qué parte de sus ventas con tarjeta es en cuotas?", sub: "Alcanza con una idea aproximada.", type: "radio",
    opts: [["bajo", "Casi nada, menos del 10%"], ["medio", "Entre 10% y 40%"], ["alto", "Más del 40%"], ["nose", "No sé"]],
    info: "Las cuotas cambian cuándo y cómo les pagan las procesadoras. Saber cuánto pesan nos ayuda a priorizar esa parte de la configuración." },
  { id: "a5", lbl: "¿Las terminales de pago están conectadas al sistema de ventas?", sub: "Si el importe pasa solo al posnet, está conectada. Si el cajero lo tipea, no.", type: "radio",
    opts: [["todas", "Sí, todas"], ["algunas", "Algunas sí y otras no"], ["ninguna", "Ninguna"]],
    info: "Terminal es el dispositivo donde se pasa la tarjeta (Clover, Point, Posnet, Lapos). Las que no están conectadas suelen generar diferencias por errores de tipeo." },
  { id: "a6", lbl: "¿Cobran en moneda extranjera o venden al exterior?", type: "radio", opts: [["no", "No"], ["si", "Sí"]],
    info: "Por ejemplo: cobros en dólares, ventas a turistas con tarjetas del exterior o una tienda online que vende a otros países." },
  { id: "a6detalle", detalleDe: "a6", lbl: "Contanos el detalle", type: "text", showIf: (r) => r.a6 === "si" },

  { sec: "Cómo cobran", desc: "Liquidaciones y acuerdos" },
  { id: "b2", lbl: "¿Cómo les pagan las procesadoras las ventas en cuotas?", sub: "Ejemplo: venden $120.000 en 6 cuotas.", type: "radio", otro: true,
    opts: [["junto", "Todo junto, a las 24 o 48 horas"], ["semanal", "Una vez por semana"], ["cuota", "Cuota a cuota: $20.000 por mes durante 6 meses"], ["nose", "No sé"]],
    info: "Si cambia según la procesadora, elegí Otro y contanos cuál paga de cada forma." },
  { id: "b4", lbl: "¿Tienen promociones o descuentos financiados con bancos o procesadoras?", type: "radio", opts: [["no", "No"], ["si", "Sí"]],
    info: "Por ejemplo: cuotas sin interés de un banco, reintegros de billeteras o descuentos que paga en parte la marca. Cambian los montos que les liquidan." },
  { id: "b4detalle", detalleDe: "b4", lbl: "¿Cuáles y con quién?", type: "text", showIf: (r) => r.b4 === "si" },
  { id: "b5", lbl: "¿Cobran propinas, recargos o redondeos por el posnet?", type: "radio", opts: [["no", "No"], ["si", "Sí"]],
    info: "Es común en gastronomía: la propina pasa por el posnet junto con la venta, pero en el sistema figura otro monto." },
  { id: "b5detalle", detalleDe: "b5", lbl: "Contanos cómo funciona", type: "text", showIf: (r) => r.b5 === "si" },

  { sec: "Tus sucursales", desc: "Locales, comercios y volumen" },
  { id: "c2", lbl: "¿Cuántos locales o puntos de venta activos tienen?", type: "radio",
    opts: [["1", "Uno"], ["2-5", "Entre 2 y 5"], ["6-20", "Entre 6 y 20"], ["21-100", "Entre 21 y 100"], ["100+", "Más de 100"]],
    info: "Cada local termina siendo una sucursal en Nubceo. La cantidad nos sirve para planificar la carga de sucursales y las pruebas." },
  { id: "c3", lbl: "¿Cada local tiene su propio número de comercio en cada procesadora?", sub: "Es el número que aparece en los cupones y en las liquidaciones.", type: "radio", otro: true,
    opts: [["propios", "Sí, cada local tiene el suyo"], ["compartidos", "Hay locales que comparten número"], ["nose", "No sé"]],
    info: "Si varios locales comparten el número, definimos juntos cómo asignar cada cobro a su local." },
  { id: "c4", lbl: "¿Van a abrir, cerrar o mudar locales en los próximos 3 meses?", type: "radio", opts: [["no", "No"], ["si", "Sí"]],
    info: "Un local nuevo, cerrado o mudado cambia sus números de comercio. Si lo sabemos antes, lo dejamos previsto en la configuración." },
  { id: "c4detalle", detalleDe: "c4", lbl: "¿Qué cambia y cuándo?", type: "text", showIf: (r) => r.c4 === "si" },
  { id: "c5", lbl: "¿Cuántas operaciones con tarjeta, QR o billetera hacen por mes en total?", sub: "Sumando todos los locales y canales.", type: "radio",
    opts: [["<5k", "Menos de 5.000"], ["5-20k", "Entre 5.000 y 20.000"], ["20-100k", "Entre 20.000 y 100.000"], ["100k+", "Más de 100.000"], ["nose", "No sé"]],
    info: "Nos sirve para dimensionar los datos de prueba y los tiempos de carga." },

  { sec: "Cómo llegan las ventas", desc: "API o archivo CSV" },
  { id: "d1", lbl: "¿Cómo van a enviarle las ventas a Nubceo?", type: "radio",
    opts: [["api", "Por API: el sistema las envía solo"], ["csv", "Por archivo CSV: lo cargamos cada tanto"], ["indef", "Todavía no lo sabemos"]],
    info: "API requiere un desarrollo, pero después no hay tarea manual. CSV no requiere desarrollo, pero sí una persona que cargue el archivo con regularidad. Si no lo saben, lo charlamos en el workshop." },
  { id: "d2", lbl: "¿Quién va a desarrollar la integración por API?", type: "radio", otro: true, showIf: (r) => r.d1 === "api",
    opts: [["interno", "Nuestro equipo de sistemas"], ["proveedor", "El proveedor del punto de venta o ERP"], ["freelance", "Un desarrollador externo"], ["nubceo", "Nubceo, con un desarrollo cotizado"], ["indef", "No está definido"]],
    info: "Quién desarrolla define los tiempos y a quién le pasamos la documentación técnica y las credenciales." },
  { id: "d3", lbl: "¿El desarrollo de la API está aprobado, con alguien asignado y fecha?", type: "radio", showIf: (r) => r.d1 === "api",
    opts: [["aprobada", "Sí, aprobado y con fecha"], ["eval", "Está en evaluación"], ["no", "No, todavía sin fecha"]],
    info: "Si está en evaluación, conviene arrancar por CSV en paralelo para no frenar la implementación." },
  { id: "d4", lbl: "¿Quién va a cargar el archivo y cada cuánto?", sub: "Ejemplo: Laura, de administración, todos los lunes.", type: "text", showIf: (r) => r.d1 === "csv",
    info: "La carga periódica es lo que mantiene viva la conciliación. Sin una persona definida, es donde más se traban las implementaciones." },

  { sec: "Cómo concilian hoy", desc: "Lo que funciona y lo que no" },
  { id: "e1", lbl: "Hoy, ¿cómo controlan que lo vendido coincida con lo cobrado?", type: "radio", otro: true,
    opts: [["no", "No lo controlamos"], ["excel", "A mano, con Excel"], ["herramienta", "Con otra herramienta"], ["tercero", "Lo hace un estudio o un tercero"]],
    info: "Si hoy no lo hacen, no pasa nada: para eso está el Conciliador." },
  { id: "e1detalle", detalleDe: "e1", lbl: "¿Cuál o quién?", type: "text", showIf: (r) => r.e1 === "herramienta" || r.e1 === "tercero" },
  { id: "e2", lbl: "¿Qué parte les cierra sin diferencias?", type: "radio", showIf: (r) => !!r.e1 && r.e1 !== "no",
    opts: [["<50", "Menos de la mitad"], ["50-80", "Entre 50% y 80%"], ["80-95", "Entre 80% y 95%"], ["95+", "Más del 95%"], ["nose", "No sé"]],
    info: "Es el porcentaje de ventas que hoy encuentran su cobro sin diferencias. Nos sirve como punto de partida para medir la mejora." },
  { id: "e3", lbl: "¿Por qué suelen aparecer diferencias?", sub: "Marcá las que les pasan.", type: "multi", otro: true,
    opts: [["fechas", "La venta y el cobro tienen fechas distintas"], ["comisiones", "El monto cambia por comisiones o impuestos"], ["faltantes", "Hay cupones que no aparecen"], ["contracargos", "Contracargos o desconocimientos"], ["cuotas", "Ventas en cuotas"], ["nose", "No sabemos"]],
    info: "Cada motivo que marquen se transforma en una regla de conciliación. Cuantos más conozcamos, más alto arranca el porcentaje conciliado." },
  { id: "e4", lbl: "Las devoluciones y anulaciones, ¿se registran en el mismo sistema de ventas?", type: "radio",
    opts: [["si", "Sí, en el mismo sistema"], ["otro_sistema", "En otro sistema"], ["no", "No se registran"], ["nose", "No sé"]],
    info: "Si se registran en otro lado o no se registran, lo definimos para que no queden diferencias sin explicar." },

  { sec: "Uso y cierre", desc: "Quiénes, para qué y qué les preocupa" },
  { id: "f4", lbl: "¿Qué áreas van a usar Nubceo?", type: "multi", otro: true,
    opts: [["tesoreria", "Tesorería"], ["administracion", "Administración"], ["finanzas", "Finanzas"], ["contabilidad", "Contabilidad"], ["sistemas", "Sistemas"], ["sucursales", "Gerentes de local"]],
    info: "Nos sirve para armar usuarios y permisos y para saber a quién invitar a la capacitación." },
  { id: "f5", lbl: "¿Qué les gustaría obtener de Nubceo?", type: "multi", otro: true,
    opts: [["diferencias", "Detectar diferencias y cobros faltantes"], ["comisiones", "Controlar comisiones y costos"], ["proyeccion", "Saber cuándo y cuánto van a cobrar"], ["contable", "Exportar asientos al sistema contable"], ["reportes", "Reportes para gerencia"]],
    info: "Así configuramos los reportes y, si hace falta, la exportación a su sistema contable desde el principio." },
  { id: "f3", lbl: "¿Van a cambiar de sistema de ventas, ERP o tienda online en los próximos 6 meses?", type: "radio", opts: [["no", "No"], ["si", "Sí"]],
    info: "Un cambio de sistema en medio de la implementación afecta el envío de ventas. Saberlo ahora ayuda a elegir el mejor momento." },
  { id: "f3detalle", detalleDe: "f3", lbl: "¿Qué y cuándo?", type: "text", showIf: (r) => r.f3 === "si" },
  { id: "f1", lbl: "En una frase: ¿qué tiene que pasar para que esta implementación sea un éxito?", type: "text",
    info: "Es la meta de la implementación en sus palabras. La usamos para revisar juntos, al final, si se cumplió." },
  { id: "f2", lbl: "¿Hay algo de su operación que sea distinto o que les preocupe?", sub: "Un acuerdo con un banco, un local que opera distinto, un sistema viejo por cambiar. Si no hay nada, contanos eso.", type: "textarea",
    info: "Todo lo que en su empresa se resuelve de forma especial conviene saberlo antes del workshop." },

  // ── Legado: ya no se preguntan; se muestran al equipo si estaban respondidas ──
  { id: "a2", legado: true, lbl: "Sistemas de venta por canal (relevamiento anterior)", type: "textarea" },
  { id: "b0", legado: true, lbl: "Medios de pago y plataformas (relevamiento anterior)", type: "multi", otro: true,
    opts: [["prisma", "Prisma / Payway"], ["fiserv", "Fiserv"], ["mercadopago", "Mercado Pago"], ["naranja", "Naranja X"], ["amex", "American Express"], ["getnet", "Getnet"], ["cabal", "Cabal"], ["visanet", "VisaNet"], ["adyen", "Adyen"], ["gocuotas", "Go Cuotas"], ["pedidosya", "PedidosYa"], ["rappi", "Rappi"], ["ubereats", "Uber Eats"], ["didifood", "DiDi Food"], ["efectivo", "Efectivo"], ["transferencia", "Transferencia"]] },
  { id: "c1", legado: true, lbl: "Razones sociales (relevamiento anterior)", type: "radio", opts: [["una", "Una sola"], ["varias", "Más de una"]] },
  { id: "c1detalle", legado: true, lbl: "Detalle de razones sociales (relevamiento anterior)", type: "text" },
  { id: "d5", legado: true, lbl: "Referente técnico (relevamiento anterior)", type: "text" },
  { id: "d6", legado: true, lbl: "Referente del negocio (relevamiento anterior)", type: "text" },
];

function QItem({ q, rv, set, error, readOnly }) {
  const [showInfo, setShowInfo] = useState(false);
  const opts = q.otro ? [...q.opts, ["otro", "Otro"]] : q.opts;
  const val = rv[q.id];
  const otroOn = q.otro && (q.type === "multi" ? (val || []).includes("otro") : val === "otro");
  const lblDe = (v) => (opts.find(([ov]) => ov === v) || [, v])[1];
  return (
    <div id={"q-" + q.id} style={{ marginBottom: 18, padding: error ? "12px 14px" : 0, margin: error ? "0 -14px 18px" : "0 0 18px", borderRadius: error ? 10 : 0, background: error ? T.errBg : "transparent", border: error ? "1px solid " + T.errBorder : "none" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, color: T.n800, lineHeight: 1.45, flex: 1 }}>
          {q.lbl}
          {error && <span style={{ color: T.errTx, fontWeight: 700, marginLeft: 6, fontSize: 12.5 }}>· Falta completar</span>}
        </div>
        {q.info && (
          <div
            onClick={() => setShowInfo(!showInfo)}
            title="¿Qué significa esta pregunta?"
            style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0, cursor: "pointer", userSelect: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, fontStyle: "italic", fontFamily: "Georgia, serif",
              background: showInfo ? T.primary : T.primary50, color: showInfo ? "#fff" : T.primary,
              border: "1px solid " + T.primary100,
            }}
          >i</div>
        )}
      </div>
      {q.info && showInfo && (
        <div style={{ background: T.primary50, border: "1px solid " + T.primary100, borderLeft: "3px solid " + T.primary, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: T.primary900, lineHeight: 1.55, marginBottom: 10 }}>
          {q.info}
        </div>
      )}
      {readOnly ? (
        <div style={{ fontSize: 14, color: val ? T.n800 : T.n400, fontStyle: val ? "normal" : "italic" }}>
          {q.type === "multi"
            ? ((val || []).length ? (val || []).map(lblDe).join(", ") : "Sin respuesta")
            : q.type === "radio"
              ? (val ? lblDe(val) : "Sin respuesta")
              : (val || "Sin respuesta")}
          {otroOn && rv[q.id + "Otro"] && <span> — {rv[q.id + "Otro"]}</span>}
        </div>
      ) : (
        <>
          {q.type === "radio" && <Radio options={opts} value={val} onChange={(v) => set(q.id, v)} />}
          {q.type === "multi" && <Multi options={opts} value={val || []} onChange={(v) => set(q.id, v)} />}
          {q.type === "text" && <Input value={val || ""} onChange={(e) => set(q.id, e.target.value)} style={error ? { borderColor: T.errBorder } : undefined} />}
          {q.type === "textarea" && (
            <textarea
              value={val || ""} onChange={(e) => set(q.id, e.target.value)} rows={3}
              style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid " + (error ? T.errBorder : T.n200), borderRadius: 6, fontSize: 14, fontFamily: "inherit", color: T.n800, resize: "vertical", outline: "none" }}
            />
          )}
          {otroOn && (
            <div style={{ marginTop: 8 }}>
              <Input placeholder={q.otroLbl || "Contanos cuál / detallá"} value={rv[q.id + "Otro"] || ""} onChange={(e) => set(q.id + "Otro", e.target.value)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ValidacionItem({ it }) {
  const tone = { ok: [T.okBg, T.okTx, "✓"], warn: [T.warnBg, T.warnTx, "!"], error: [T.errBg, T.errTx, "✕"], info: [T.primary50, T.primary800, "i"] }[it.tipo];
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8, background: tone[0] }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: tone[1], flexShrink: 0 }}>{tone[2]}</span>
      <span style={{ fontSize: 13, color: tone[1], lineHeight: 1.5 }}>{it.txt}</span>
    </div>
  );
}

function CredRow({ label, value, show, onCopy, copied }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, background: T.n50, border: "1px solid " + T.n200, borderRadius: 6, padding: "10px 12px", overflowX: "auto", whiteSpace: "nowrap", color: T.n800 }}>
          {show ? value : "•".repeat(Math.min(value.length, 40))}
        </div>
        <Btn variant="secondary" size="sm" onClick={onCopy}>{copied ? "Copiado ✓" : "Copiar"}</Btn>
      </div>
    </div>
  );
}

// ── Tab: Historial ──
function TabHistorial({ history }) {
  return (
    <Card>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 16px" }}>Historial de actividad</h2>
      {(!history || !history.length) && <div style={{ color: T.n400, fontSize: 14 }}>Todavía no hay actividad registrada. Todo lo que completes va a quedar acá con fecha y hora.</div>}
      <div style={{ display: "grid", gap: 0 }}>
        {(history || []).map((h, i) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: i < history.length - 1 ? "1px solid " + T.n100 : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: T.n800 }}>{h.txt}</div>
              <div style={{ fontSize: 12, color: T.n400, marginTop: 2 }}>{h.who} · {fmtDate(h.ts)}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Cronograma (Gantt liviano): hitos del proceso con fecha límite y cumplimiento ───
function TabCronograma({ data }) {
  const hitos = data.hitos || [];
  const completos = data.hitosCompletos || {};
  const plazos = data.plazos || {};
  const hoy = new Date().toISOString().slice(0, 10);

  const estadoDe = (h) => {
    const plazo = plazos[h.id];
    const completo = !!completos[h.id];
    if (plazo?.cumplimiento === "cumplido_tiempo") return { label: "Cumplido a tiempo", tone: "green" };
    if (plazo?.cumplimiento === "cumplido_tarde") return { label: "Cumplido con atraso", tone: "amber" };
    if (plazo?.cumplimiento === "incumplido") return { label: "No cumplido", tone: "red" };
    if (completo) return { label: "Completado", tone: "green" };
    if (plazo?.fechaLimite && plazo.fechaLimite < hoy) return { label: "Plazo vencido", tone: "red" };
    if (plazo?.fechaLimite) return { label: "En curso", tone: "blue" };
    return { label: "Sin fecha definida", tone: "gray" };
  };
  const colorPunto = { green: "#22c55e", amber: "#f59e0b", red: "#ef4444", blue: T.primary, gray: T.n200 };

  return (
    <Card>
      <SectionHeader
        title="Cronograma de tu implementación"
        subtitle="Estos son los hitos clave del proceso, con las fechas que coordinamos con tu implementador. Se va actualizando solo a medida que avanza cada etapa."
      />
      {hitos.length === 0 && <div style={{ color: T.n400, fontSize: 14 }}>Todavía no hay hitos para mostrar.</div>}
      <div style={{ display: "grid", gap: 0, marginTop: 6 }}>
        {hitos.map((h, i) => {
          const est = estadoDe(h);
          const plazo = plazos[h.id];
          return (
            <div key={h.id} style={{ display: "flex", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 13, height: 13, borderRadius: "50%", background: colorPunto[est.tone], marginTop: 4, flexShrink: 0, boxShadow: "0 0 0 3px " + T.card }} />
                {i < hitos.length - 1 && <div style={{ width: 2, flex: 1, background: T.n100, minHeight: 32 }} />}
              </div>
              <div style={{ paddingBottom: 22, flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: T.n900 }}>{h.nombre}</div>
                  <Badge tone={est.tone}>{est.label}</Badge>
                </div>
                <div style={{ fontSize: 12.5, color: T.n400, marginTop: 2 }}>
                  Responsable: {h.responsable}{plazo?.fechaLimite ? " · Fecha límite: " + fmtDateSolo(plazo.fechaLimite) : " · Fecha límite a coordinar"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Mi Perfil (cliente): datos de la empresa editables (salvo tenant) + contactos ───
function TabMiEmpresa({ data, meta, act, persist, saving }) {
  const [razonSocial, setRazonSocial] = useState(meta.razonSocial || "");
  const [cuits, setCuits] = useState(meta.cuits || []);
  const [cuitInput, setCuitInput] = useState("");
  const [logo, setLogo] = useState(meta.logo || null);
  const [msg, setMsg] = useState("");
  const [inv, setInv] = useState(data.involucrados || []);
  const [invMsg, setInvMsg] = useState("");

  const guardarEmpresa = async () => {
    const r = await act("setMiEmpresa", { razonSocial, cuits, logo });
    setMsg(r ? "Guardado ✓" : "No se pudo guardar");
    setTimeout(() => setMsg(""), 2500);
  };
  const guardarContactos = async () => {
    await persist({ involucrados: inv }, "Actualizó los contactos de la empresa");
    setInvMsg("Guardado ✓");
    setTimeout(() => setInvMsg(""), 2500);
  };

  return (
    <div style={{ display: "grid", gap: SP.lg }}>
      <Card>
        <SectionHeader title="Datos de la empresa" subtitle="Podés editar todo lo de acá abajo salvo el tenant, que es un dato técnico fijo de tu cuenta y no se puede cambiar desde el portal." />
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
          <ImageUpload value={logo} onChange={setLogo} label="logo de tu empresa" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <Label>Nombre en el portal</Label>
            <div style={{ fontSize: 14, color: T.n600, padding: "10px 0" }}>{meta.name} <span style={{ fontSize: 11.5, color: T.n400 }}>(no editable — escribile a tu implementador si hay que corregirlo)</span></div>
          </div>
          <div>
            <Label>Tenant</Label>
            <div style={{ fontSize: 14, color: T.n600, padding: "10px 0" }}>{meta.tenant || "—"} <span style={{ fontSize: 11.5, color: T.n400 }}>(no editable)</span></div>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Label>Razón social</Label>
          <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="Ej: Freddo S.A." />
        </div>
        <div style={{ marginBottom: 6 }}>
          <Label>CUIT(s)</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={cuitInput} onChange={(e) => setCuitInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (cuitInput.trim()) { setCuits([...cuits, cuitInput.trim()]); setCuitInput(""); } } }}
              placeholder="Ej: 30-12345678-9 (Enter para agregar)" />
            <Btn variant="secondary" size="sm" onClick={() => { if (cuitInput.trim()) { setCuits([...cuits, cuitInput.trim()]); setCuitInput(""); } }}>+ Agregar</Btn>
          </div>
          {cuits.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {cuits.map((c, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: T.primary50, color: T.primary800, border: "1px solid " + T.primary100, borderRadius: 100, padding: "4px 10px" }}>
                  {c} <span onClick={() => setCuits(cuits.filter((_, idx) => idx !== i))} style={{ cursor: "pointer" }}>✕</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <ActionBar>
          <Btn onClick={guardarEmpresa} disabled={saving}>Guardar</Btn>
          {msg && <span style={{ fontSize: 13, fontWeight: 600, color: T.okTx }}>{msg}</span>}
        </ActionBar>
      </Card>

      <Card>
        <SectionHeader title="Contactos" subtitle="Sponsor, key users y demás personas de tu empresa vinculadas a la implementación. Podés agregarlos o editarlos en cualquier momento, esté o no enviado el relevamiento." />
        <Involucrados inv={inv} setInv={setInv} />
        <ActionBar>
          <Btn onClick={guardarContactos} disabled={saving}>Guardar contactos</Btn>
          {invMsg && <span style={{ fontSize: 13, fontWeight: 600, color: T.okTx }}>{invMsg}</span>}
        </ActionBar>
      </Card>
    </div>
  );
}



// ── Paso 3: Relevamiento (con involucrados y agenda de workshop) ──
const ROLES = [["sponsor", "Sponsor"], ["key_user", "Key user"], ["desarrollador", "Desarrollador"], ["otro", "Otro"]];

function Involucrados({ inv, setInv }) {
  const set = (i, k, v) => setInv(inv.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const add = () => setInv([...inv, { nombre: "", cargo: "", email: "", telefono: "", rol: "otro" }]);
  const del = (i) => setInv(inv.filter((_, j) => j !== i));
  return (
    <div style={{ margin: "6px 0 18px" }}>
      <div style={{ fontSize: 14.5, fontWeight: 500, color: T.n800, marginBottom: 4 }}>Involucrados de la implementación</div>
      <div style={{ fontSize: 13, color: T.n600, marginBottom: 10, lineHeight: 1.5 }}>
        Cargá a las personas de tu empresa que participan del proyecto. Necesitamos al menos un <b>Sponsor</b> (quien impulsa y decide) y un <b>Key user</b> (quien va a usar Nubceo en el día a día). El teléfono es opcional. Todos van a ser invitados al workshop.
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {inv.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.3fr 0.9fr auto auto", gap: 8, alignItems: "center" }}>
            <Input placeholder="Nombre y apellido" value={p.nombre} onChange={(e) => set(i, "nombre", e.target.value)} />
            <Input placeholder="Cargo" value={p.cargo} onChange={(e) => set(i, "cargo", e.target.value)} />
            <Input placeholder="Mail" value={p.email} onChange={(e) => set(i, "email", e.target.value)} />
            <Input placeholder="Tel (opc)" value={p.telefono} onChange={(e) => set(i, "telefono", e.target.value)} />
            <select value={p.rol} onChange={(e) => set(i, "rol", e.target.value)} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 8px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Btn variant="ghost" size="sm" onClick={() => del(i)} style={{ padding: "6px 10px" }}>✕</Btn>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}><Btn variant="secondary" size="sm" onClick={add}>+ Agregar persona</Btn></div>
    </div>
  );
}

function TabRelevamiento({ data, persist, saving, rvOK, session, setAll }) {
  const [rv, setRv] = useState(data.relevamiento || {});
  const [inv, setInv] = useState((data.involucrados || []).length ? data.involucrados : [{ nombre: "", cargo: "", email: "", telefono: "", rol: "sponsor" }]);
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const set = (id, v) => setRv((p) => ({ ...p, [id]: v }));
  const contestada = (q) => { const v = rv[q.id]; return Array.isArray(v) ? v.length > 0 : !!v; };
  const preguntasVisibles = RV_PREGUNTAS.filter((q) => q.id && (!q.showIf || q.showIf(rv)));
  const faltantes = preguntasVisibles.filter((q) => !contestada(q));
  const respondidas = preguntasVisibles.filter(contestada).length;
  const visibles = preguntasVisibles.length;
  const invValidos = inv.filter((p) => p.nombre.trim() && p.email.trim());
  const tieneSponsor = invValidos.some((p) => p.rol === "sponsor");
  const tieneKeyUser = invValidos.some((p) => p.rol === "key_user");
  const puedeEnviar = tieneSponsor && tieneKeyUser && faltantes.length === 0;
  const workshop = (data.eventos || []).find((e) => e.tipo === "workshop" && e.estado !== "cancelado");

  const irA = (id) => {
    const el = document.getElementById("q-" + id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const enviar = () => {
    if (!puedeEnviar) { setIntentoEnviar(true); if (faltantes[0]) irA(faltantes[0].id); return; }
    persist(
      { relevamiento: rv, relevamientoEnviado: now(), involucrados: inv },
      "Relevamiento enviado (" + respondidas + "/" + visibles + " respuestas, " + invValidos.length + " involucrados)"
    );
  };
  const guardarBorrador = () => persist({ relevamiento: rv, involucrados: inv }, null);

  return (
    <div style={{ display: "grid", gap: SP.lg }}>
      <Card>
        <SectionHeader
          title="Relevamiento de procesos"
          badge={rvOK ? <Badge tone="green">Enviado el {fmtDate(data.relevamientoEnviado)} · 🔒 Bloqueado</Badge> : <Badge tone="blue">{respondidas} de {visibles} respondidas</Badge>}
          subtitle={rvOK
            ? "Ya está enviado, así que quedó bloqueado para que el equipo trabaje sobre una versión estable — podés revisar tus respuestas abajo, pero no editarlas. Si necesitás corregir algo, escribile a tu implementador con el botón de arriba."
            : <>Completar todo el formulario es necesario para avanzar: con tus respuestas armamos el mapa de tu operación y preparamos el workshop a medida. Al lado de cada pregunta hay un botón <b style={{ fontStyle: "italic", fontFamily: "Georgia, serif" }}>i</b> con la explicación en lenguaje simple. Podés guardar borrador y seguir después, sin necesidad de completar todo todavía.</>}
        />
        {rvOK ? (
          <div style={{ marginBottom: 18 }}>
            <Label>Involucrados enviados</Label>
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {invValidos.map((p, i) => (
                <div key={i} style={{ fontSize: 13.5, color: T.n800 }}>
                  <b>{p.nombre}</b> — {ROLES.find(([v]) => v === p.rol)?.[1] || p.rol} · {p.email}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <Involucrados inv={inv} setInv={setInv} />
            {!tieneSponsor || !tieneKeyUser ? (
              <Alert tone="warning" style={{ marginBottom: 14 }}>Para enviar el relevamiento indicá al menos un Sponsor y un Key user (con nombre y mail).</Alert>
            ) : null}
            {intentoEnviar && faltantes.length > 0 && (
              <Alert tone="error" style={{ marginBottom: 14 }}>
                <div style={{ marginBottom: 6 }}>Te faltan completar {faltantes.length} pregunta{faltantes.length > 1 ? "s" : ""} para poder enviar el relevamiento:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {faltantes.slice(0, 8).map((q) => (
                    <span key={q.id} onClick={() => irA(q.id)} style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}>→ {q.lbl}</span>
                  ))}
                  {faltantes.length > 8 && <span>… y {faltantes.length - 8} más (marcadas en rojo más abajo).</span>}
                </div>
              </Alert>
            )}
          </>
        )}
        {RV_PREGUNTAS.map((q, i) => {
          if (q.sec) return <div key={i} style={{ fontSize: 12, fontWeight: 700, color: T.primary, textTransform: "none", margin: "26px 0 14px", paddingBottom: 8, borderBottom: "1px solid " + T.primary50 }}>{q.sec}</div>;
          if (q.showIf && !q.showIf(rv)) return null;
          return <QItem key={q.id} q={q} rv={rv} set={set} error={intentoEnviar && !contestada(q)} readOnly={rvOK} />;
        })}
        {!rvOK && (
          <ActionBar>
            <Btn variant="secondary" onClick={guardarBorrador} disabled={saving}>Guardar borrador</Btn>
            <Btn onClick={enviar} disabled={saving || (!tieneSponsor || !tieneKeyUser)}>Enviar relevamiento</Btn>
          </ActionBar>
        )}
      </Card>

      {rvOK && (
        <Card>
          <SectionHeader icon="🗓" title="Workshop de relevamiento" />
          {workshop ? (
            <EventoLinea e={workshop} />
          ) : (
            <>
              <Alert tone="info" style={{ marginBottom: 16 }}>
                ¡Gracias por completar el relevamiento! Con tus respuestas ya estamos armando el mapa de tu proceso. El siguiente hito es el <b>workshop</b>: una reunión donde repasamos tu operación, te mostramos Nubceo con tu caso y resolvemos dudas. Elegí un horario — la disponibilidad arranca 3 días después de tu envío para darnos tiempo de preparar todo. Por defecto se invita a todos los involucrados que cargaste arriba, pero podés editar la lista antes de confirmar.
              </Alert>
              <Agendador session={session} tipo="workshop" invitadosDefault={invValidos} onDone={setAll} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Paso 4: Sucursales (archivo interno → template oficial) ──
const EJEMPLO_SUC = [
  ["Numero de comercio", "Procesadora", "PDV", "Nombre sucursal", "CUIT"],
  ["0012345678", "Payway", "SUC-001", "Casa Central", "30-11111111-1"],
  ["0012345679", "Mercado Pago", "SUC-001", "Casa Central", "30-11111111-1"],
  ["0098765432", "Fiserv", "SUC-002", "Sucursal Norte", "30-22222222-2"],
];

function TabSucursales({ data, meta, persist, act, saving }) {
  const [opcionSeleccionada, setOpcionSeleccionada] = useState(null); // "vinculada", "sin_vincular", "manual"
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [errores, setErrores] = useState([]);
  const [datosValidos, setDatosValidos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [archivoDataUrl, setArchivoDataUrl] = useState(null);
  const [msgGuardado, setMsgGuardado] = useState("");
  const yaCargado = data.sucursalesArchivo;

  const COLUMNAS_REQUERIDAS = [
    "Nombre de la empresa",
    "CUIT/RUT de la empresa",
    "Código de sucursal PDV",
    "Nombre de sucursal",
    "Número de comercio",
    "Nombre de comercio",
    "Código de plataforma"
  ];

  // Lista viva de lib/nubceo (incluye los conectores nuevos, ej. Unicobros, Tuya, Bancard)
  const PLATAFORMAS_VALIDAS = PLATFORM_CODES_VALIDOS.map((c) => c.toLowerCase());

  const validarArchivo = async (file) => {
    if (!file) return;
    setCargando(true);
    setErrores([]);
    setDatosValidos([]);
    setArchivoDataUrl(null);
    setMsgGuardado("");

    try {
      const buffer = await file.arrayBuffer();
      // Guardamos el archivo original (si es razonablemente chico) para que el equipo pueda descargarlo
      if (file.size <= 700 * 1024) {
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
        setArchivoDataUrl(dataUrl);
      }
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const datos = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (datos.length === 0) {
        setErrores([{ general: "El archivo está vacío" }]);
        setCargando(false);
        return;
      }

      const erroresDetectados = [];
      const datosValidos_ = [];
      const codigosPDVVistos = new Set();

      datos.forEach((fila, idx) => {
        const nroFila = idx + 2;
        const erroresFila = [];

        COLUMNAS_REQUERIDAS.forEach(col => {
          const valor = (fila[col] || "").toString().trim();

          if (!valor) {
            erroresFila.push({ columna: col, error: "Celda vacía", fila: nroFila });
            return;
          }

          if (col === "Código de sucursal PDV") {
            if (codigosPDVVistos.has(valor)) {
              erroresFila.push({ columna: col, error: "Código PDV duplicado", fila: nroFila });
            } else {
              codigosPDVVistos.add(valor);
            }
          }

          if (col === "Código de plataforma") {
            if (!PLATAFORMAS_VALIDAS.includes(valor.toLowerCase())) {
              erroresFila.push({ columna: col, error: "Código de plataforma inválido: '" + valor + "' (ej. válido: prisma_ar, bancard_py)", fila: nroFila });
            }
          }
        });

        if (erroresFila.length === 0) {
          datosValidos_.push({
            empresa: (fila["Nombre de la empresa"] || "").toString().trim(),
            cuit: (fila["CUIT/RUT de la empresa"] || "").toString().trim(),
            codigopdv: (fila["Código de sucursal PDV"] || "").toString().trim(),
            nombre: (fila["Nombre de sucursal"] || "").toString().trim(),
            numercomercio: (fila["Número de comercio"] || "").toString().trim(),
            nombrecomercio: (fila["Nombre de comercio"] || "").toString().trim(),
            plataforma: (fila["Código de plataforma"] || "").toString().trim().toLowerCase(),
          });
        } else {
          erroresDetectados.push(...erroresFila);
        }
      });

      if (erroresDetectados.length > 0) {
        setErrores(erroresDetectados);
      } else {
        setDatosValidos(datosValidos_);
      }
    } catch (e) {
      setErrores([{ general: "Error al leer archivo: " + e.message }]);
    } finally {
      setCargando(false);
    }
  };

  // Usa act(): manda el código de sesión correcto y refresca data/meta con la respuesta,
  // así el paso queda completo y se habilita "Siguiente" sin recargar.
  const guardarSucursales = async () => {
    setCargando(true);
    const r = await act("guardarSucursalesMasivo", {
      sucursales: datosValidos,
      archivo: archivo ? { name: archivo.name, size: archivo.size, dataUrl: archivoDataUrl } : null,
    });
    setCargando(false);
    if (r) {
      setMsgGuardado(datosValidos.length + " sucursal(es) guardada(s). Ya podés pasar al siguiente paso.");
      setMostrarUpload(false); setArchivo(null); setDatosValidos([]); setArchivoDataUrl(null);
    }
  };

  const marcarManual = async () => {
    if (!window.confirm("¿Confirmás que ya cargaste todas tus sucursales directamente en Nubceo?")) return;
    const r = await act("marcarSucursalesManual", {});
    if (r) setMsgGuardado("Registramos que cargaste las sucursales en Nubceo. Ya podés pasar al siguiente paso.");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {msgGuardado && <Alert tone="success">{msgGuardado}</Alert>}
      {yaCargado && !msgGuardado && (
        <Alert tone="success">
          Paso completo: {yaCargado.validacion?.manual ? "cargaste las sucursales directamente en Nubceo" : <>subiste <b>{yaCargado.name}</b></>} ({new Date(yaCargado.ts).toLocaleDateString("es-AR")}). Si cambió algo, podés volver a subir el archivo.
        </Alert>
      )}
      {!yaCargado && (
        <Card>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: T.n600, flex: "1 1 280px" }}>¿Ya cargaste tus sucursales directamente en Nubceo, o todavía no tenés el archivo?</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn variant="ghost" onClick={marcarManual} disabled={saving}>Ya las cargué en Nubceo</Btn>
              {!meta.sucursalesOmitido && <Btn variant="ghost" onClick={() => act("omitirSucursales", {})} disabled={saving}>Omitir por ahora</Btn>}
            </div>
          </div>
        </Card>
      )}
      
      {/* INTRODUCCIÓN */}
      <Card>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.n900, margin: "0 0 12px 0" }}>📚 Contexto: Carga de Sucursales</h2>
        <p style={{ margin: "0 0 14px 0", fontSize: 13.5, color: T.n600, lineHeight: 1.6 }}>
          La carga de sucursales en Nubceo cumple dos funciones importantes:
        </p>
        <ul style={{ margin: "0 0 14px 20px", fontSize: 13.5, color: T.n600, lineHeight: 1.8 }}>
          <li>Administrar y visualizar tus sucursales en reportes y pantallas del portal</li>
          <li>Realizar una conciliación correcta entre tus ventas y liquidaciones de procesadoras</li>
        </ul>
        
        <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "16px 0 10px 0" }}>El Desafío: Dos Sistemas de Identificación Diferentes</h3>
        
        <div style={{ background: "#eef4ff", padding: 12, borderRadius: 6, marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px 0", fontWeight: 600, fontSize: 13, color: T.primary }}>Sistema de Procesadoras de Pago</p>
          <p style={{ margin: 0, fontSize: 12.5, color: T.n600, lineHeight: 1.6 }}>
            Identifican cada venta por número de comercio, asignando uno distinto para cada plataforma. Ej: 0000001 en Prisma, 0000002 en Mercado Pago
          </p>
        </div>

        <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 6, marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px 0", fontWeight: 600, fontSize: 13, color: "#16a34a" }}>Sistema del Punto de Venta (PDV)</p>
          <p style={{ margin: 0, fontSize: 12.5, color: T.n600, lineHeight: 1.6 }}>
            Identifica cada venta con CUIT de la empresa + código de sucursal (tu código interno)
          </p>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "16px 0 10px 0" }}>El Problema</h3>
        <p style={{ margin: "0 0 14px 0", fontSize: 13.5, color: T.n600, lineHeight: 1.6 }}>
          ¿Cómo sabe Nubceo en qué sucursal se realizó cada venta si las procesadoras y el PDV usan identificadores completamente diferentes?
        </p>
        <p style={{ margin: "0 0 14px 0", fontSize: 13.5, color: T.n600, lineHeight: 1.6, fontWeight: 600 }}>
          Aquí entra la carga de sucursales cabecera. Es el mecanismo que vincula ambos sistemas.
        </p>

        <a 
          href="https://docs.google.com/document/d/1kkFBEYqiOX66KgfjvxGXvzLdDtkbaAS7tWzK1PMjHcg/edit?tab=t.0"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            background: T.primary,
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 13,
            marginTop: 8
          }}
        >
          📖 Ver manual de carga completo
        </a>
        <p style={{ margin: "12px 0 0 0", fontSize: 12, color: T.n400, fontStyle: "italic" }}>
          (Este paso se puede omitir si ya consultaste el manual)
        </p>
      </Card>

      {/* TRES OPCIONES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        
        {/* OPCIÓN 1 */}
        <div
          onClick={() => setOpcionSeleccionada("vinculada")}
          style={{
            border: opcionSeleccionada === "vinculada" ? "2px solid " + T.primary : "1px solid " + T.n200,
            borderRadius: 8,
            padding: 16,
            cursor: "pointer",
            background: opcionSeleccionada === "vinculada" ? "#eef4ff" : "#fff",
            transition: "all 0.2s"
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: T.primary, margin: "0 0 8px 0" }}>✅ Opción 1: Plataformas VINCULADAS</h3>
          <p style={{ fontSize: 12.5, color: T.n600, margin: "0 0 12px 0", lineHeight: 1.6 }}>
            Ya vinculaste tus procesadoras
          </p>
          
          {opcionSeleccionada === "vinculada" && (
            <div style={{ background: "#fff", padding: 12, borderRadius: 6, marginTop: 12, fontSize: 12 }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: 600, color: T.n900 }}>📍 Ruta en Nubceo:</p>
              <p style={{ margin: "0 0 12px 0", fontFamily: "monospace", color: T.n600, fontSize: 11 }}>
                Dashboard → Mi negocio → Sucursales cabecera → Crear masivamente
              </p>
              
              <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: T.n900 }}>📄 Cómo funciona:</p>
              <p style={{ margin: "0 0 12px 0", color: T.n600, lineHeight: 1.5 }}>
                Descargá la plantilla con sucursales huérfanas (tiene los números de comercio, código de procesadora, nombre de empresa y CUIT, solo debes completar código de PDV y nombre de sucursal)
              </p>

              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginBottom: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={{ padding: 6, border: "1px solid " + T.n200, textAlign: "left" }}>Empresa</th>
                    <th style={{ padding: 6, border: "1px solid " + T.n200, textAlign: "left" }}>CUIT</th>
                    <th style={{ padding: 6, border: "1px solid " + T.n200, textAlign: "left" }}>Código PDV</th>
                    <th style={{ padding: 6, border: "1px solid " + T.n200, textAlign: "left" }}>Sucursal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: 6, border: "1px solid " + T.n200 }}>Empresa 1</td>
                    <td style={{ padding: 6, border: "1px solid " + T.n200 }}>30123456789</td>
                    <td style={{ padding: 6, border: "1px solid " + T.n200, color: T.primary, fontWeight: 600 }}>(COMPLETA)</td>
                    <td style={{ padding: 6, border: "1px solid " + T.n200, color: T.primary, fontWeight: 600 }}>(COMPLETA)</td>
                  </tr>
                </tbody>
              </table>

              {!mostrarUpload && (
                <button
                  onClick={() => setMostrarUpload(true)}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: T.primary,
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13
                  }}
                >
                  📤 Usar esta opción
                </button>
              )}
            </div>
          )}
        </div>

        {/* OPCIÓN 2 */}
        <div
          onClick={() => setOpcionSeleccionada("sin_vincular")}
          style={{
            border: opcionSeleccionada === "sin_vincular" ? "2px solid " + T.primary : "1px solid " + T.n200,
            borderRadius: 8,
            padding: 16,
            cursor: "pointer",
            background: opcionSeleccionada === "sin_vincular" ? "#eef4ff" : "#fff",
            transition: "all 0.2s"
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#dc2626", margin: "0 0 8px 0" }}>❌ Opción 2: SIN Plataformas</h3>
          <p style={{ fontSize: 12.5, color: T.n600, margin: "0 0 12px 0", lineHeight: 1.6 }}>
            Aún no vinculaste procesadoras
          </p>
          
          {opcionSeleccionada === "sin_vincular" && (
            <div style={{ background: "#fff", padding: 12, borderRadius: 6, marginTop: 12, fontSize: 12 }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: 600, color: T.n900 }}>📍 Ruta en Nubceo:</p>
              <p style={{ margin: "0 0 12px 0", fontFamily: "monospace", color: T.n600, fontSize: 11 }}>
                Dashboard → Mi negocio → Sucursales cabecera → Crear masivamente
              </p>
              
              <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: T.n900 }}>📄 Cómo funciona:</p>
              <p style={{ margin: "0 0 12px 0", color: T.n600, lineHeight: 1.5 }}>
                Descargá la plantilla vacía (todas las 7 columnas vacías) y completá CON TODA tu información manualmente
              </p>

              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginBottom: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={{ padding: 6, border: "1px solid " + T.n200, textAlign: "left" }}>Empresa</th>
                    <th style={{ padding: 6, border: "1px solid " + T.n200, textAlign: "left" }}>CUIT</th>
                    <th style={{ padding: 6, border: "1px solid " + T.n200, textAlign: "left" }}>PDV</th>
                    <th style={{ padding: 6, border: "1px solid " + T.n200, textAlign: "left" }}>Comercio</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: 6, border: "1px solid " + T.n200, color: T.primary, fontWeight: 600 }}>(COMPLETA)</td>
                    <td style={{ padding: 6, border: "1px solid " + T.n200, color: T.primary, fontWeight: 600 }}>(COMPLETA)</td>
                    <td style={{ padding: 6, border: "1px solid " + T.n200, color: T.primary, fontWeight: 600 }}>(COMPLETA)</td>
                    <td style={{ padding: 6, border: "1px solid " + T.n200, color: T.primary, fontWeight: 600 }}>(COMPLETA)</td>
                  </tr>
                </tbody>
              </table>

              {!mostrarUpload && (
                <button
                  onClick={() => setMostrarUpload(true)}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: T.primary,
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13
                  }}
                >
                  📤 Usar esta opción
                </button>
              )}
            </div>
          )}
        </div>

        {/* OPCIÓN 3 */}
        <div
          onClick={() => setOpcionSeleccionada("manual")}
          style={{
            border: opcionSeleccionada === "manual" ? "2px solid " + T.primary : "1px solid " + T.n200,
            borderRadius: 8,
            padding: 16,
            cursor: "pointer",
            background: opcionSeleccionada === "manual" ? "#eef4ff" : "#fff",
            transition: "all 0.2s"
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#059669", margin: "0 0 8px 0" }}>🎯 Opción 3: Carga MANUAL</h3>
          <p style={{ fontSize: 12.5, color: T.n600, margin: "0 0 12px 0", lineHeight: 1.6 }}>
            Una sucursal a la vez en Nubceo
          </p>
          
          {opcionSeleccionada === "manual" && (
            <div style={{ background: "#fff", padding: 12, borderRadius: 6, marginTop: 12, fontSize: 12 }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: 600, color: T.n900 }}>📍 Ruta en Nubceo:</p>
              <p style={{ margin: "0 0 12px 0", fontFamily: "monospace", color: T.n600, fontSize: 11 }}>
                Dashboard → Mi negocio → Sucursales cabecera → Crear sucursal cabecera
              </p>
              
              <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: T.n900 }}>📄 Cómo funciona:</p>
              <p style={{ margin: "0 0 12px 0", color: T.n600, lineHeight: 1.5 }}>
                Ingresás a Nubceo directamente, clickeás "Crear sucursal cabecera", completás formulario con datos y asignás números de comercio manualmente. Repetís para cada sucursal.
              </p>

              <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#059669", fontWeight: 600 }}>
                ✓ Ventaja: No necesitas Excel. Útil si tienes pocas sucursales.
              </p>

              <a
                href="https://cash.nubceo.com/header-branches/create"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  width: "100%",
                  padding: "10px 16px",
                  background: T.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                  textAlign: "center"
                }}
              >
                🔗 Ir a Nubceo
              </a>
            </div>
          )}
        </div>
      </div>

      {/* UPLOAD CUANDO SELECCIONA OPCIÓN 1 O 2 */}
      {mostrarUpload && (opcionSeleccionada === "vinculada" || opcionSeleccionada === "sin_vincular") && (
        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 16px 0" }}>📤 Subir archivo Excel</h3>
          
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f && /\.(xls|xlsx|csv)$/i.test(f.name)) {
                setArchivo(f);
                validarArchivo(f);
              } else {
                alert("Subí un archivo .xls, .xlsx o .csv");
              }
            }}
            style={{
              border: "2px dashed " + T.primary,
              borderRadius: 8,
              padding: 40,
              textAlign: "center",
              background: "#eef4ff",
              cursor: "pointer",
              marginBottom: 20,
              position: "relative",
              overflow: "hidden"
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: T.primary }}>📁 Arrastra tu archivo aquí</p>
            <p style={{ margin: 0, fontSize: 13, color: T.n400 }}>o hacé click para seleccionar (.xls, .xlsx o .csv)</p>
            <input
              type="file"
              accept=".xls,.xlsx,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setArchivo(f);
                  validarArchivo(f);
                }
              }}
              style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
            />
          </div>

          {archivo && (
            <div style={{ padding: 12, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, marginBottom: 20, fontSize: 13 }}>
              ✓ Archivo: <strong>{archivo.name}</strong>
            </div>
          )}

          {cargando && <p style={{ color: T.n400 }}>Validando archivo...</p>}

          {errores.length > 0 && !cargando && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: "#dc2626", marginBottom: 12, fontSize: 13 }}>❌ Errores detectados:</h4>
              <div style={{ overflowX: "auto", border: "1px solid " + T.n200, borderRadius: 6 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6", borderBottom: "2px solid " + T.n200 }}>
                      <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Fila</th>
                      <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Columna</th>
                      <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errores.map((err, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid " + T.n100 }}>
                        <td style={{ padding: 8 }}>{err.fila}</td>
                        <td style={{ padding: 8 }}>{err.columna || "General"}</td>
                        <td style={{ padding: 8, color: "#dc2626" }}>{err.error || err.general}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {datosValidos.length > 0 && !errores.length && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: "#059669", marginBottom: 12, fontSize: 13 }}>✓ Vista previa:</h4>
              <p style={{ fontSize: 12, color: T.n600, marginBottom: 12 }}><strong>{datosValidos.length} sucursal(es)</strong> válida(s), listas para guardar</p>
              <div style={{ overflowX: "auto", border: "1px solid " + T.n200, borderRadius: 6 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6", borderBottom: "2px solid " + T.n200 }}>
                      <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Empresa</th>
                      <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Sucursal</th>
                      <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Código PDV</th>
                      <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Plataforma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datosValidos.map((d, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid " + T.n100 }}>
                        <td style={{ padding: 8 }}>{d.empresa}</td>
                        <td style={{ padding: 8 }}>{d.nombre}</td>
                        <td style={{ padding: 8, fontWeight: 600, color: T.primary }}>{d.codigopdv}</td>
                        <td style={{ padding: 8 }}>{d.plataforma}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              onClick={() => { setMostrarUpload(false); setArchivo(null); setErrores([]); setDatosValidos([]); }}
              style={{
                padding: "10px 20px",
                background: "#fff",
                border: "1px solid " + T.n200,
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13
              }}
            >
              ← Atrás
            </button>
            <button
              onClick={() => setOpcionSeleccionada(null)}
              style={{
                padding: "10px 20px",
                background: "#fff",
                border: "1px solid " + T.n200,
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13
              }}
            >
              Cerrar
            </button>
            {datosValidos.length > 0 && !errores.length && (
              <button
                onClick={guardarSucursales}
                disabled={cargando}
                style={{
                  padding: "10px 20px",
                  background: cargando ? "#ccc" : "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: cargando ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                {cargando ? "Guardando..." : "✓ Guardar sucursales"}
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════

function TabConexion({ data, persist, session, setAll }) {
  const rv = data.relevamiento || {};
  const via = rv.d1 === "api" || rv.d1 === "csv" || rv.d1 === "ambos" ? rv.d1 : null;
  // Cambiar la vía no pasa por saveClient (que bloquea si el relevamiento ya fue enviado):
  // usa saveTipoConexion, que actualiza solo d1 y deja intacto el resto del relevamiento.
  const elegir = async (v) => {
    if (v === via) return;
    try {
      const r = await api("saveTipoConexion", { sessionCode: session.code, code: session.code, who: session.who || "Cliente", tipoConexion: v });
      setAll(r);
    } catch (e) {
      alert("No se pudo cambiar la vía: " + (e.message || "reintentá"));
    }
  };

  const OPCIONES = [
    ["api", "Por API", "Tus sistemas envían las ventas automáticamente. Requiere un desarrollo (tuyo, de tu proveedor de PDV o cotizado con Nubceo), pero después no hay tarea manual."],
    ["csv", "Por CSV", "Cargás un archivo con las ventas de forma periódica. Sin desarrollo, pero con disciplina de carga. Se puede arrancar así y migrar a API después."],
    ["ambos", "Ambos", "Un punto de venta se conecta por API y otro por CSV. Hacés las dos cosas: credenciales + reunión técnica, y también el armado del archivo."],
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 6px" }}>¿Cómo van a llegar tus ventas a Nubceo?</h2>
        <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "0 0 14px" }}>
          Elegí la vía — podés cambiarla más adelante si tu plan cambia, y el paso se adapta a lo que elijas.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {OPCIONES.map(([v, titulo, desc]) => (
            <div key={v} onClick={() => elegir(v)} style={{
              padding: "14px 16px", borderRadius: 12, cursor: "pointer", lineHeight: 1.5,
              border: "2px solid " + (via === v ? T.primary : T.n200),
              background: via === v ? T.primary50 : "#fff",
            }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: via === v ? T.primary800 : T.n900, marginBottom: 4 }}>
                {via === v ? "● " : "○ "}{titulo}
              </div>
              <div style={{ fontSize: 12.5, color: T.n600 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Card>
      {(via === "api" || via === "ambos") && <SeccionApi data={data} session={session} setAll={setAll} titulo={via === "ambos" ? "Parte 1 — El PDV que va por API" : null} />}
      {(via === "csv" || via === "ambos") && <SeccionCsv data={data} persist={persist} titulo={via === "ambos" ? "Parte 2 — El PDV que va por CSV" : null} />}

      {via && <ConexionLeida data={data} session={session} setAll={setAll} />}
    </div>
  );
}

// Botón para marcar el paso de conexión como leído y poder avanzar en cualquier vía.
function ConexionLeida({ data, session, setAll }) {
  const [guardando, setGuardando] = useState(false);
  const leido = !!(data.relevamiento || {}).conexionLeida;

  const marcar = async (valor) => {
    setGuardando(true);
    try {
      const r = await api("setConexionLeida", { sessionCode: session.code, code: session.code, who: session.who || "Cliente", leido: valor });
      setAll(r);
    } catch (e) {
      alert("No se pudo guardar: " + (e.message || "reintentá"));
    } finally { setGuardando(false); }
  };

  if (leido) {
    return (
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: T.okTx }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: T.okBg, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
            Marcaste este paso como leído — ya podés avanzar.
          </div>
          <Btn variant="ghost" size="sm" onClick={() => marcar(false)} disabled={guardando}>Desmarcar</Btn>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "0 0 12px" }}>
        Cuando hayas revisado este paso, marcalo como leído para avanzar al siguiente.
      </p>
      <Btn onClick={() => marcar(true)} disabled={guardando}>{guardando ? "Guardando…" : "Leí este paso"}</Btn>
    </Card>
  );
}

function SeccionApi({ data, session, setAll, titulo }) {
  const reunion = (data.eventos || []).find((e) => e.tipo === "reunion_tecnica" && e.estado !== "cancelado");
  const involucrados = (data.involucrados || []).filter((p) => (p.nombre || "").trim() && (p.email || "").trim());

  const PASO = { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 };
  const NUM = { width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: T.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 };

  return (
    <>
      {titulo && <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, textTransform: "none", marginBottom: -6 }}>{titulo}</div>}

      {/* Guía para generar credenciales en Nubceo (no se ingresan en el portal) */}
      <Card>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 6px" }}>Generá tus credenciales de API en Nubceo</h2>
        <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "0 0 14px" }}>
          Las credenciales se crean en tu propia cuenta de Nubceo. Este paso lo hace <b>quien va a desarrollar la integración</b>, y las claves se comparten directamente con esa persona — <b>no se cargan en este portal</b>.
        </p>

        <Alert tone="warning" style={{ marginBottom: 16 }}>
          <b>Importante:</b> la <b>API Secret se muestra una sola vez</b>, justo después de crearla — copiala en el momento y guardala en un lugar seguro. Además, <b>si generás una API key nueva, la anterior deja de funcionar</b>. Compartila solo con quien integra.
        </Alert>

        <div style={{ marginBottom: 8 }}>
          <div style={PASO}><span style={NUM}>1</span><div style={{ fontSize: 13.5, color: T.n800, lineHeight: 1.5 }}>En Nubceo, andá al menú de navegación → <b>Mi negocio</b> → <b>API Keys</b>.</div></div>
          <div style={PASO}><span style={NUM}>2</span><div style={{ fontSize: 13.5, color: T.n800, lineHeight: 1.5 }}>Hacé clic en <b>“Crear API key +”</b>.</div></div>
          <div style={PASO}><span style={NUM}>3</span><div style={{ fontSize: 13.5, color: T.n800, lineHeight: 1.5 }}>Poné un <b>nombre</b> para identificar la conexión (por ejemplo, “Integración ventas”).</div></div>
          <div style={PASO}><span style={NUM}>4</span><div style={{ fontSize: 13.5, color: T.n800, lineHeight: 1.5 }}>Vas a ver una advertencia naranja: <i>“Solo podrás ver la clave secreta de la API key una (1) vez, justo después de crearla”</i>. Tenela presente.</div></div>
          <div style={PASO}><span style={NUM}>5</span><div style={{ fontSize: 13.5, color: T.n800, lineHeight: 1.5 }}>Hacé clic en <b>“Crear”</b>.</div></div>
          <div style={PASO}><span style={NUM}>6</span><div style={{ fontSize: 13.5, color: T.n800, lineHeight: 1.5 }}>Copiá la <b>API Key</b> y la <b>API Secret</b> en el momento (la Secret no se vuelve a mostrar) y compartilas de forma segura con quien va a integrar.</div></div>
        </div>

        <div style={{ marginTop: 16 }}>
          <a href={DOCS.apiVentas} target="_blank" rel="noreferrer" style={{ display: "inline-block", fontSize: 14, fontWeight: 600, color: T.primary }}>📘 Documentación de la API de ventas →</a>
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 6px" }}>🗓 Reunión técnica con nuestro equipo</h2>
        {reunion ? <EventoLinea e={reunion} /> : (
          <>
            <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "0 0 14px" }}>
              Coordiná una reunión técnica con Eduardo André o Santiago Suarez para repasar la integración con tu equipo de desarrollo: autenticación, estructura del endpoint de ventas y dudas sobre las pruebas. Antes de confirmar podés sumar a tu desarrollador aunque no esté cargado como involucrado.
            </p>
            <Agendador session={session} tipo="reunion_tecnica" invitadosDefault={involucrados} onDone={setAll} />
          </>
        )}
      </Card>
    </>
  );
}

function SeccionCsv({ data, persist, titulo }) {
  const [valResultado, setValResultado] = useState(null);
  const [fixContable, setFixContable] = useState(true);
  const [fileMsg, setFileMsg] = useState("");

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) { setFileMsg("El archivo tiene que ser CSV (separado por ; y en UTF-8). Desde Excel: Guardar como → CSV UTF-8."); return; }
    const r = new FileReader();
    r.onerror = () => setFileMsg("No pudimos leer el archivo. Probá de nuevo.");
    r.onload = () => { setFileMsg(""); setValResultado(validarVentas(r.result)); };
    r.readAsText(f);
  };

  // Corrige una celda en memoria y revalida toda la tabla al toque — así la preview
  // se actualiza como en una planilla: corregís y el error desaparece si ya está bien.
  const editarCelda = (rowIdx, colName, valor) => {
    setValResultado((prev) => {
      if (!prev || !prev.idx || prev.idx[colName] === undefined) return prev;
      const nuevasRows = prev.rows.map((r, i) => {
        if (i !== rowIdx) return r;
        const nr = r.slice();
        nr[prev.idx[colName]] = valor;
        return nr;
      });
      return validarTabla(prev.header, nuevasRows);
    });
  };

  const exportar = () => {
    const contenido = exportarNubceo(valResultado, fixContable);
    descargar("ventas-nubceo.csv", contenido);
    persist({
      ventasArchivo: { name: "ventas-nubceo.csv", size: contenido.length, ts: now(), dataUrl: aDataUrl(contenido), validacion: { ok: valResultado.ok, items: [{ tipo: valResultado.ok ? "ok" : "warn", txt: valResultado.resumen.total + " filas · " + valResultado.resumen.conError + " con error" + (fixContable && valResultado.resumen.fixContable ? " · Smart Fix contable aplicado a " + valResultado.resumen.fixContable : "") }] } },
    }, "Validó y exportó el CSV de ventas en formato Nubceo (" + valResultado.resumen.total + " filas, " + valResultado.resumen.conError + " con error)");
  };

  const res = valResultado;
  return (
    <>
      {titulo && <Eyebrow>{titulo}</Eyebrow>}
      <Card>
        <SectionHeader
          title="Armá tu CSV de ventas en formato Nubceo"
          subtitle={<>El archivo va <b>separado por punto y coma (;), en UTF-8</b>, con las columnas del formato oficial. Las obligatorias son: <b>{COLUMNAS_OBLIGATORIAS.join(", ")}</b>. Subilo acá: el validador lo revisa fila por fila (fechas, montos, CUIT, tipos de pago, marcas de tarjeta, códigos de plataforma y ventas multipago), te muestra una preview tipo planilla con cada error marcado en su celda, y podés corregir ahí mismo antes de exportar.</>}
        />
        <div style={{ fontSize: 12.5, color: T.n400, marginBottom: 16 }}>Validador basado en la app "Validador CSV Nubceo" de Federico Ciccarone.</div>
        <label style={{ display: "inline-block" }}>
          <input type="file" accept=".csv,.txt" onChange={onFile} style={{ display: "none" }} />
          <span style={{ display: "inline-block", background: T.primary, color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Subir CSV de ventas</span>
        </label>
        {fileMsg && <Alert tone="error" style={{ marginTop: 14 }}>{fileMsg}</Alert>}
        {data.ventasArchivo && !res && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: T.okBg, border: "1px solid " + T.okBorder }}>
            <span style={{ fontSize: 13.5, color: T.okTx, flex: 1 }}>Última versión: <b>{data.ventasArchivo.name}</b> · {fmtDate(data.ventasArchivo.ts)}</span>
            {data.ventasArchivo.dataUrl && <a href={data.ventasArchivo.dataUrl} download={data.ventasArchivo.name} style={{ fontSize: 13, fontWeight: 600, color: T.okTx }}>Descargar</a>}
          </div>
        )}
      </Card>

      {res && res.errores.length > 0 && (
        <Card>
          {res.errores.map((e, i) => <Alert key={i} tone="error" style={{ marginBottom: i < res.errores.length - 1 ? 8 : 0 }}>{e}</Alert>)}
        </Card>
      )}

      {res && res.resumen && (
        <Card>
          <SectionHeader
            title="Preview y corrección"
            badge={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="blue">{res.resumen.total} filas</Badge>
                <Badge tone={res.resumen.conError ? "red" : "green"}>{res.resumen.conError ? res.resumen.conError + " con error" : "Todas OK ✓"}</Badge>
                {res.resumen.fixContable > 0 && <Badge tone="amber">{res.resumen.fixContable} con Smart Fix contable sugerido</Badge>}
              </div>
            }
            subtitle="Hacé clic en cualquier celda para corregirla — las que tienen error quedan en rojo con el detalle al pasar el mouse, y desaparecen de la lista de errores apenas están bien."
          />
          {res.warnings.length > 0 && (
            <Alert tone="warning" style={{ marginBottom: 14 }}>{res.warnings.slice(0, 6).join(" · ")}{res.warnings.length > 6 ? " …" : ""}</Alert>
          )}

          <PreviewVentas resultado={res} onEditCell={editarCelda} />

          {res.resumen.fixContable > 0 && (
            <div onClick={() => setFixContable(!fixContable)} style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer", marginTop: 16, fontSize: 13.5, color: T.n800 }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid " + (fixContable ? T.primary : T.n200), background: fixContable ? T.primary : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{fixContable ? "✓" : ""}</span>
              Aplicar Smart Fix contable: donde Neto = Bruto e Impuestos está vacío, completar Impuestos = 0
            </div>
          )}

          <ActionBar>
            <Btn onClick={exportar} disabled={!res.ok}>Descargar CSV en formato Nubceo y completar el paso</Btn>
            {!res.ok && <span style={{ fontSize: 12.5, color: T.n600 }}>Corregí las celdas marcadas en rojo arriba — el botón se habilita cuando no queden errores.</span>}
          </ActionBar>
        </Card>
      )}
    </>
  );
}

// ── Preview tipo planilla del CSV de ventas: celdas editables, errores resaltados
//    en su columna exacta, y paginado de a 100 filas para no colgar el navegador
//    con archivos grandes. ──
function PreviewVentas({ resultado, onEditCell }) {
  const [pagina, setPagina] = useState(1);
  const [soloErrores, setSoloErrores] = useState(false);
  const POR_PAGINA = 100;

  const cols = (resultado.header || []).filter(Boolean);
  const filas = resultado.filas || [];
  const conError = filas.filter((f) => f.errs.length).length;
  const indices = soloErrores ? filas.filter((f) => f.errs.length).map((f) => f.i) : filas.map((f) => f.i);
  const totalPaginas = Math.max(1, Math.ceil(indices.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);

  useEffect(() => { setPagina(1); }, [soloErrores]);
  useEffect(() => { if (pagina > totalPaginas) setPagina(totalPaginas); }, [totalPaginas]); // eslint-disable-line

  const visibles = indices.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div onClick={() => setSoloErrores(!soloErrores)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: T.n800, userSelect: "none" }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: "2px solid " + (soloErrores ? T.primary : T.n200), background: soloErrores ? T.primary : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{soloErrores ? "✓" : ""}</span>
          Ver solo filas con error ({conError})
        </div>
        <div style={{ fontSize: 12.5, color: T.n400 }}>{indices.length} fila{indices.length !== 1 ? "s" : ""}{soloErrores ? " con error" : " en total"}</div>
      </div>

      {indices.length === 0 ? (
        <div style={{ fontSize: 13.5, color: T.okTx, background: T.okBg, border: "1px solid " + T.okBorder, borderRadius: 10, padding: "14px 16px" }}>No quedan filas con error ✓</div>
      ) : (
        <div style={{ overflow: "auto", maxHeight: 480, border: "1px solid " + T.n200, borderRadius: 10 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", top: 0, left: 0, zIndex: 2, background: T.n800, color: "#fff", padding: "8px 10px", textAlign: "left", fontSize: 11, minWidth: 56 }}>Fila</th>
                {cols.map((c) => (
                  <th key={c} style={{ position: "sticky", top: 0, zIndex: 1, background: T.n800, color: "#fff", padding: "8px 10px", textAlign: "left", fontSize: 11, whiteSpace: "nowrap" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((rowIdx) => {
                const f = filas[rowIdx];
                const fila = resultado.rows[rowIdx] || [];
                const errsPorCol = {}, warnsPorCol = {};
                (f?.errs || []).forEach((e) => { errsPorCol[e.col] = (errsPorCol[e.col] ? errsPorCol[e.col] + " · " : "") + e.msg; });
                (f?.warns || []).forEach((w) => { warnsPorCol[w.col] = (warnsPorCol[w.col] ? warnsPorCol[w.col] + " · " : "") + w.msg; });
                const filaTieneError = !!(f && f.errs.length);
                return (
                  <tr key={rowIdx}>
                    <td style={{ position: "sticky", left: 0, background: filaTieneError ? "#fecaca" : T.n50, color: filaTieneError ? T.errTx : T.n400, fontWeight: 700, padding: "6px 10px", borderBottom: "1px solid " + T.n100, fontSize: 11, whiteSpace: "nowrap" }}>
                      {rowIdx + 2}{filaTieneError ? " ✕" : ""}
                    </td>
                    {cols.map((c) => {
                      const val = fila[resultado.idx[c]] ?? "";
                      const errMsg = errsPorCol[c];
                      const warnMsg = !errMsg && warnsPorCol[c];
                      return (
                        <td key={c} title={errMsg || warnMsg || ""} style={{ padding: 0, borderBottom: "1px solid " + T.n100, background: errMsg ? T.errBg : warnMsg ? T.warnBg : "#fff" }}>
                          <input
                            defaultValue={val}
                            onBlur={(e) => { if (e.target.value !== val) onEditCell(rowIdx, c, e.target.value); }}
                            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                            style={{
                              width: "100%", minWidth: 112, boxSizing: "border-box", border: "none", outline: "none", background: "transparent",
                              padding: "6px 10px", fontSize: 12, fontFamily: "inherit", color: errMsg ? T.errTx : warnMsg ? T.warnTx : T.n800,
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 14 }}>
          <Btn variant="ghost" size="sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaActual === 1}>← Anterior</Btn>
          <span style={{ fontSize: 13, color: T.n600, fontWeight: 600 }}>Página {paginaActual} de {totalPaginas} · 100 filas por página</span>
          <Btn variant="ghost" size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas}>Siguiente →</Btn>
        </div>
      )}
    </div>
  );
}

// ── Paso 6: Capacitación ──
function TabCapacitacion({ data, session, setAll }) {
  const [pedido, setPedido] = useState(null); // 'capacitacion_conciliador' | 'capacitacion_cash'
  const evs = (data.eventos || []).filter((e) => e.tipo.startsWith("capacitacion") && e.estado !== "cancelado");
  const involucrados = (data.involucrados || []).filter((p) => (p.nombre || "").trim() && (p.email || "").trim());
  return (
    <div style={{ display: "grid", gap: SP.lg }}>
      <Card>
        <SectionHeader icon="📚" title="Manuales de Nubceo" subtitle="Toda la documentación del producto está en los manuales oficiales: primeros pasos, carga de datos, reglas y secuencias de conciliación, reportes y más. Es la mejor referencia para consultar entre capacitaciones." />
        <a href={DOCS.conciliador} target="_blank" rel="noreferrer" style={{ display: "inline-block", fontSize: 14, fontWeight: 600, color: T.primary }}>📘 Abrir los manuales del Conciliador →</a>
      </Card>
      <Card>
        <SectionHeader icon="🗓" title="Solicitar una capacitación" subtitle="Las capacitaciones las da Mariana Macri y son para todo tu equipo. Elegí cuál necesitás y un horario disponible — antes de confirmar podés editar a quién se invita." />
        {evs.map((e) => <div key={e.id} style={{ marginBottom: 8 }}><EventoLinea e={e} /></div>)}
        {!pedido ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <Btn onClick={() => setPedido("capacitacion_conciliador")}>Capacitación de Conciliador</Btn>
            <Btn variant="secondary" onClick={() => setPedido("capacitacion_cash")}>Capacitación de Nubceo Cash</Btn>
          </div>
        ) : (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid " + T.n100 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.n800, marginBottom: 10 }}>{pedido === "capacitacion_cash" ? "Nubceo Cash" : "Conciliador"} — elegí horario:</div>
            <Agendador session={session} tipo={pedido} invitadosDefault={involucrados} onDone={(r) => { setPedido(null); setAll(r); }} />
            <div style={{ marginTop: 10 }}><Btn variant="ghost" size="sm" onClick={() => setPedido(null)}>Cancelar</Btn></div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Pasos 7 y 8: Pruebas sandbox y Go-live ──
const STATUS_PRUEBAS_LBL = {
  pendiente: ["Pendiente — todavía no arrancaron", "gray"],
  en_curso: ["En curso — estamos probando con tus datos", "blue"],
  listo_para_mostrar: ["¡Listo! Queremos mostrarte los resultados", "amber"],
  ok: ["Completado ✓", "green"],
};

function TabPruebasEtapa({ etapa, tipoEvento, data, session, setAll }) {
  const p = (data.pruebas || {})[etapa];
  const status = p?.status || "pendiente";
  const [lbl, tone] = STATUS_PRUEBAS_LBL[status] || [status, "gray"];
  const evs = (data.eventos || []).filter((e) => e.tipo === tipoEvento && e.estado !== "cancelado");
  const agendado = evs.find((e) => e.estado === "agendado");
  const realizado = evs.find((e) => e.estado === "realizado");
  const titulo = etapa === "sandbox" ? "Pruebas con tus datos" : "Go-live";
  const involucrados = (data.involucrados || []).filter((p) => (p.nombre || "").trim() && (p.email || "").trim());
  return (
    <div style={{ display: "grid", gap: SP.lg }}>
      <Card>
        <SectionHeader
          title={titulo}
          badge={<Badge tone={tone}>{lbl}</Badge>}
          subtitle={etapa === "sandbox"
            ? "En esta etapa nuestro equipo prueba la conciliación con tus datos reales en el entorno de pruebas: reglas, secuencias y porcentajes de conciliación. Acá vas a ver el avance, y cuando los resultados estén listos te vamos a pedir disponibilidad para mostrártelos."
            : "En el go-live pasamos las reglas y secuencias probadas al entorno productivo, repasamos los resultados con tu equipo y arranca el acompañamiento de hypercare. Cuando esté todo listo, coordinamos el evento de cierre acá."}
        />
        {p?.notas && <Alert tone="info"><b>Notas del equipo:</b> {p.notas}</Alert>}
      </Card>

      {(status === "listo_para_mostrar" || agendado || realizado) && (
        <Card>
          <SectionHeader icon="🗓" title={etapa === "sandbox" ? "Reunión de resultados" : "Evento de go-live"} />
          {evs.map((e) => (
            <div key={e.id} style={{ marginBottom: 10 }}>
              <EventoLinea e={e} />
              {e.minuta && (
                <div style={{ marginTop: 6, fontSize: 13.5, color: T.n800, background: T.n50, border: "1px solid " + T.n200, borderRadius: 8, padding: "10px 12px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  <b>Minuta de la reunión:</b>{"\n"}{e.minuta}
                </div>
              )}
            </div>
          ))}
          {!agendado && !realizado && status === "listo_para_mostrar" && (
            <>
              <Alert tone="success" style={{ marginBottom: 14 }}>¡Los resultados están listos! Elegí un horario para que te los mostremos — por defecto invitamos a todos los involucrados, pero podés editar la lista antes de confirmar.</Alert>
              <Agendador session={session} tipo={tipoEvento} invitadosDefault={involucrados} onDone={setAll} />
            </>
          )}
        </Card>
      )}

      {etapa === "golive" && realizado && (
        <Card>
          <SectionHeader icon="🎉" title="Workshop de cierre" subtitle="Para cerrar la implementación, coordinamos un último workshop de repaso con todo el equipo: CX, desarrollo e implementaciones." />
          {(() => {
            const evsCierre = (data.eventos || []).filter((e) => e.tipo === "workshop_cierre" && e.estado !== "cancelado");
            const yaAgendado = evsCierre.some((e) => e.estado !== "cancelado");
            return yaAgendado
              ? evsCierre.map((e) => <EventoLinea key={e.id} e={e} />)
              : <Agendador session={session} tipo="workshop_cierre" invitadosDefault={involucrados} onDone={setAll} />;
          })()}
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════ PORTAL DEL EQUIPO ══════════════════════════
// ─── Selector de imagen chica (logo de cliente / foto de implementador), a base64 ───
// Nada de Storage: son imágenes chicas (se limita a ~300KB) que van directo en la fila.
const ImageUpload = ({ value, onChange, label, round }) => {
  const [err, setErr] = useState("");
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr("Tiene que ser una imagen"); return; }
    if (f.size > 800 * 1024) { setErr("La imagen pesa mucho — usá una de menos de 800KB"); return; }
    setErr("");
    const r = new FileReader();
    r.onload = () => onChange(r.result);
    r.readAsDataURL(f);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 44, height: 44, borderRadius: round ? "50%" : 8, flexShrink: 0, background: T.n50, border: "1px solid " + T.n200,
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        {value ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, color: T.n400 }}>🖼</span>}
      </div>
      <div>
        <label style={{ cursor: "pointer" }}>
          <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.primary }}>{value ? "Cambiar" : "Subir"}{label ? " " + label : ""}</span>
        </label>
        {value && <span onClick={() => onChange(null)} style={{ marginLeft: 10, fontSize: 12.5, color: T.n400, cursor: "pointer" }}>Quitar</span>}
        {err && <div style={{ fontSize: 11.5, color: T.errTx }}>{err}</div>}
      </div>
    </div>
  );
};

// ─── Tablero tipo agile: columnas = fases del proyecto, tarjetas arrastrables ───
// Estado del contrato del cliente (informativo, editable por el equipo).
const CONTRATO = {
  firmado:       { lbl: "Contrato firmado",      chip: "✓ Contrato",     tone: "green" },
  sin_firmar:    { lbl: "Sin contrato firmado",  chip: "Sin contrato",   tone: "amber" },
  pago_habilita: { lbl: "Pago habilita avance",  chip: "Pago habilita",  tone: "blue" },
};
const contratoInfo = (v) => CONTRATO[v] || CONTRATO.sin_firmar;

// Color del semáforo de seguimiento (gris = sin marcar).
const COLOR_SEG = { verde: "#22c55e", amarillo: "#f59e0b", rojo: "#ef4444" };
const colorSeg = (estado) => COLOR_SEG[estado] || null;

function KanbanBoard({ clientes, onAbrir, onMoverFase, onCambiarColor, onEnviarAvisos, enviandoAvisosDe }) {
  const [arrastrando, setArrastrando] = useState(null); // código del cliente en drag
  const [sobreCol, setSobreCol] = useState(null);
  const scrollRef = useRef(null);
  const desplazar = (dir) => scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        .kanban-scroll::-webkit-scrollbar { height: 12px; }
        .kanban-scroll::-webkit-scrollbar-track { background: ${T.n100}; border-radius: 100px; }
        .kanban-scroll::-webkit-scrollbar-thumb { background: ${T.primary100}; border-radius: 100px; border: 2px solid ${T.n100}; }
        .kanban-scroll::-webkit-scrollbar-thumb:hover { background: ${T.primary}; }
      `}</style>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
        <button type="button" className="nub-btn nub-btn--ghost" onClick={() => desplazar(-1)} aria-label="Ver fases anteriores" title="Ver fases anteriores" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid " + T.n200, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.n600, padding: 0 }}><Icon n="left" size={16} /></button>
        <button type="button" className="nub-btn nub-btn--ghost" onClick={() => desplazar(1)} aria-label="Ver fases siguientes" title="Ver fases siguientes" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid " + T.n200, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.n600, padding: 0 }}><Icon n="right" size={16} /></button>
      </div>
      <div ref={scrollRef} className="kanban-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "thin" }}>
      {FASES.map((faseNombre, faseIdx) => {
        const items = clientes.filter((c) => c.phase === faseIdx);
        const origen = arrastrando && clientes.find((c) => c.code === arrastrando);
        const esDestino = sobreCol === faseIdx && origen && origen.phase !== faseIdx;
        return (
          <div
            key={faseIdx}
            className="nub-kcol"
            aria-label={"Fase " + (faseIdx + 1) + ": " + faseNombre + ", " + items.length + " clientes"}
            onDragOver={(e) => { e.preventDefault(); setSobreCol(faseIdx); }}
            onDragLeave={() => setSobreCol((v) => (v === faseIdx ? null : v))}
            onDrop={(e) => { e.preventDefault(); const code = e.dataTransfer.getData("text/plain"); if (code) onMoverFase(code, faseIdx); setArrastrando(null); setSobreCol(null); }}
            style={{
              minWidth: 240, width: 240, flexShrink: 0, background: sobreCol === faseIdx ? T.primary50 : T.n50,
              border: "1.5px dashed " + (sobreCol === faseIdx ? T.primary : T.n200), borderRadius: 12,
              transition: "background .15s", display: "flex", flexDirection: "column",
              maxHeight: "calc(100vh - 260px)",
            }}
          >
            <div style={{ position: "sticky", top: 0, zIndex: 2, background: sobreCol === faseIdx ? T.primary50 : T.n50, display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 10px 8px", borderRadius: "12px 12px 0 0" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.n800 }}>{faseNombre}</span>
              <span style={{ fontSize: 11.5, color: T.n400, fontWeight: 700 }}>{items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, flex: 1, overflowY: "auto", padding: "0 10px 10px" }}>
              {items.map((cli) => {
                const pct = Math.round((cli.completados / cli.totalPasos) * 100);
                const alertas = detectarAlertas(cli.relevamiento);
                return (
                  <div
                    key={cli.code}
                    draggable
                    role="button"
                    tabIndex={0}
                    aria-label={"Abrir " + cli.name}
                    className={"nub-kcard" + (arrastrando ? " is-dragging" : "")}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", cli.code); setArrastrando(cli.code); }}
                    onDragEnd={() => { setArrastrando(null); setSobreCol(null); }}
                    onClick={() => onAbrir(cli.code)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget) alTeclear(() => onAbrir(cli.code))(e); }}
                    style={{
                      background: "#fff", flexShrink: 0, position: "relative",
                      border: "1px solid " + T.n200, borderRadius: 10, padding: "10px 10px 10px 16px", cursor: "grab", overflow: "hidden",
                      opacity: arrastrando === cli.code ? 0.4 : 1, boxShadow: "0 1px 2px rgba(13,17,32,0.04)",
                    }}
                  >
                    {/* Semáforo de seguimiento: borde izquierdo, clic para ciclar gris → verde → amarillo → rojo. */}
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); onCambiarColor && onCambiarColor(cli.code); }}
                      onDragStart={(e) => e.preventDefault()}
                      aria-label="Cambiar estado de seguimiento"
                      title="Estado de seguimiento: clic para cambiar (gris, verde, amarillo, rojo)"
                      className="nub-semaforo"
                      style={{ background: colorSeg(cli.estadoSeguimiento) || T.n200 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                      <span className="nub-logo nub-logo--kanban">{cli.logo ? <img src={cli.logo} alt="" draggable={false} /> : cli.name.slice(0, 1).toUpperCase()}</span>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.n900, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cli.name}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ height: 4, borderRadius: 100, background: T.n100, overflow: "hidden", flex: 1 }}>
                        <div style={{ width: pct + "%", height: "100%", background: pct === 100 ? "#22c55e" : T.primary, borderRadius: 100 }} />
                      </div>
                      <span style={{ fontSize: 11, color: T.n600 }}>{cli.completados}/{cli.totalPasos}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        {cli.implementadorNombre
                          ? <span style={{ fontSize: 12, fontWeight: 600, color: T.n800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cli.implementadorNombre}</span>
                          : <Badge tone="amber">Sin asignar</Badge>}
                        {cli.desarrolladorNombre && <Avatar nombre={cli.desarrolladorNombre} size={22} tono="gris" />}
                      </span>
                      {(() => {
                        const sg = semaforoGoLive(cli.goLiveEstimado);
                        if (!sg) return <span style={{ fontSize: 11.5, color: T.n400 }}>Sin go-live</span>;
                        const col = sg.tone === "red" ? "#ef4444" : sg.tone === "amber" ? "#f59e0b" : "#22c55e";
                        return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.n600, whiteSpace: "nowrap" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: col }} />{fmtCorta(cli.goLiveEstimado)}</span>;
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                      {(cli.fechaIngreso || cli.createdAt) && <span className="nub-info" title="Fecha de alta del cliente"><Icon n="calendar" size={12} /> Alta {fmtCorta((cli.fechaIngreso || cli.createdAt).slice(0, 10))}</span>}
                      {cli.estadoPago === "con_deuda" && <Badge tone="red">Deuda {diasDesde(cli.deudaDesde)} d</Badge>}
                      {cli.autoimplementacion && <span className="nub-info"><Icon n="rocket" size={12} /> Autoimpl.</span>}
                      {cli.notasCount > 0 && <span className="nub-info"><Icon n="file" size={12} /> {cli.notasCount}</span>}
                    </div>
                  </div>
                );
              })}
              {esDestino && (
                <div aria-hidden="true" style={{ flexShrink: 0, border: "1.5px dashed " + T.primary, background: "#fff", borderRadius: 10, padding: "14px 10px", fontSize: 12, fontWeight: 600, color: T.primary, textAlign: "center" }}>
                  Soltá acá para mover a {faseNombre}
                </div>
              )}
              {items.length === 0 && !esDestino && (
                <EstadoVacio compacto titulo="Nadie en esta fase">
                  Arrastrá una tarjeta acá cuando un cliente llegue a {faseNombre}.
                </EstadoVacio>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ─── Menú lateral del panel de equipo ───
// Multiselect de vendedores (chips): elegís uno o varios de los usuarios tipo Comercial.
function SelectorVendedores({ vendedores, seleccion, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!vendedores.length) {
    return <div style={{ fontSize: 12.5, color: T.n400 }}>No hay vendedores cargados. Creá usuarios de tipo "Comercial" en el módulo Equipo.</div>;
  }
  const toggle = (id) => onChange(seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id]);
  const elegidos = vendedores.filter((v) => seleccion.includes(v.id));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setAbierto((o) => !o)} style={{ minHeight: 38, border: "1px solid " + T.n200, borderRadius: 8, padding: "5px 10px", cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", background: "#fff" }}>
        {elegidos.length === 0
          ? <span style={{ color: T.n400, fontSize: 13.5 }}>Seleccionar…</span>
          : elegidos.map((v) => (
              <span key={v.id} style={{ fontSize: 12, background: T.primary50, color: T.primary800, border: "1px solid " + T.primary100, borderRadius: 100, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}>
                {v.nombre}<span onClick={(e) => { e.stopPropagation(); toggle(v.id); }} style={{ cursor: "pointer" }}>✕</span>
              </span>
            ))}
        <span style={{ marginLeft: "auto", color: T.n400, fontSize: 12 }}>▾</span>
      </div>
      {abierto && (
        <div style={{ position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid " + T.n200, borderRadius: 8, boxShadow: "0 6px 20px rgba(13,17,32,0.12)", maxHeight: 220, overflowY: "auto", padding: 6 }}>
          {vendedores.map((v) => (
            <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 13.5, color: T.n800 }}>
              <input type="checkbox" checked={seleccion.includes(v.id)} onChange={() => toggle(v.id)} style={{ accentColor: T.primary }} />
              {v.nombre}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV_GRUPOS = [
  ["Seguimiento", [["clientes", "folder", "Clientes"], ["tablero", "kanban", "Tablero"], ["notificaciones", "bell", "Notificaciones"]]],
  ["Herramientas", [["autoimp", "rocket", "Autoimplementador"]]],
  ["Administración", [["equipo", "users", "Equipo"], ["config", "sliders", "Configuración"]]],
];
function Sidebar({ activo, onCambiar, noLeidas = 0, abierto, onCerrar, mini, onAlternarMini, who }) {
  useCerrarConEscape(abierto, onCerrar);
  const ir = (id) => { onCambiar(id); onCerrar && onCerrar(); };
  const Item = ({ id, icon, lbl }) => (
    <div role="button" tabIndex={0} aria-current={activo === id ? "page" : undefined} className="nub-nav-item" title={mini ? lbl : undefined}
      onClick={() => ir(id)} onKeyDown={alTeclear(() => ir(id))} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8, cursor: "pointer",
        fontSize: 13.5, fontWeight: activo === id ? 700 : 500, position: "relative",
        background: activo === id ? T.primary50 : "transparent", color: activo === id ? T.primary800 : T.n600,
      }}>
      <Icon n={icon} size={17} /><span className="nub-nav-lbl">{lbl}</span>
      {id === "notificaciones" && noLeidas > 0 && (
        <span className="nub-nav-badge" aria-label={noLeidas + " sin leer"} style={{ marginLeft: "auto", background: T.primary, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 100, padding: "1px 7px", minWidth: 18, textAlign: "center" }}>{noLeidas > 99 ? "99+" : noLeidas}</span>
      )}
    </div>
  );
  return (
    <>
    {abierto && <div className="nub-backdrop" onClick={onCerrar} />}
    <nav aria-label="Secciones del panel" className={"nub-sidebar nub-nav--light" + (abierto ? " is-open" : "") + (mini ? " is-mini" : "")} style={{ width: mini ? 64 : 212, flexShrink: 0, borderRight: "1px solid " + T.n200, background: "#fff", padding: "18px 10px 14px", minHeight: "calc(100vh - 61px)", display: "flex", flexDirection: "column", transition: "width .2s ease" }}>
      {onCerrar && <SidebarCerrar onCerrar={onCerrar} />}
      <div style={{ display: "grid", gap: 2 }}>
        {NAV_GRUPOS.map(([grupo, items]) => (
          <div key={grupo} style={{ display: "grid", gap: 2, marginBottom: 10 }}>
            <div className="nub-nav-grupo">{grupo}</div>
            {items.map(([id, icon, lbl]) => <Item key={id} id={id} icon={icon} lbl={lbl} />)}
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid " + T.n200, display: "grid", gap: 6 }}>
        <div role="button" tabIndex={0} aria-current={activo === "perfil" ? "page" : undefined} className="nub-nav-item nub-nav-yo" title="Mi perfil"
          onClick={() => ir("perfil")} onKeyDown={alTeclear(() => ir("perfil"))}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 8, cursor: "pointer", background: activo === "perfil" ? T.primary50 : "transparent" }}>
          <Avatar nombre={who} size={30} />
          <div className="nub-nav-lbl" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 650, color: T.n900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{who}</div>
            <div style={{ fontSize: 11.5, color: T.n400 }}>Mi perfil</div>
          </div>
        </div>
        {onAlternarMini && (
          <button type="button" className="nub-mini-btn" onClick={onAlternarMini} aria-label={mini ? "Expandir menú" : "Contraer menú"} title={mini ? "Expandir menú" : "Contraer menú"}>
            <Icon n="panel" size={16} /><span className="nub-nav-lbl">{mini ? "Expandir" : "Contraer menú"}</span>
          </button>
        )}
      </div>
    </nav>
    </>
  );
}

// ─── Fila de una persona del equipo, con acciones según tipo de usuario del que mira ───
// ─── Crear tickets en Redmine a demanda para un cliente puntual, sin que entre al portal ───
function TicketsRedmineCard({ sel, sc, session, tieneFeature }) {
  const [plantilla, setPlantilla] = useState("migracion_ventas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [entorno, setEntorno] = useState("sandbox");
  const [usuarios, setUsuarios] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [asignadoId, setAsignadoId] = useState("");
  const [queryType, setQueryType] = useState("Otro");
  const [desarrolladores, setDesarrolladores] = useState([
    { id: 241, nombre: "Eduardo André" }, { id: 254, nombre: "Adrián Quintana" }, { id: 258, nombre: "Santiago Suarez" },
  ]);
  const [queryTypes, setQueryTypes] = useState(["Creación sandbox", "Migración ventas", "Migración reglas y secuencias", "Eliminación de datos", "Credenciales", "Usuarios y permisos", "Flags y configuración", "Actualización de datos", "Otro"]);
  const [creando, setCreando] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!sel) return;
    (async () => {
      try {
        const r = await api("listarTrackersRedmine", { sessionCode: sc, code: sel });
        if (r.desarrolladores?.length) setDesarrolladores(r.desarrolladores);
        if (r.queryTypes?.length) setQueryTypes(r.queryTypes);
      } catch (e) { /* opcional: quedan las listas por defecto */ }
    })();
  }, [sel, sc]);

  const selStyle = { width: "100%", height: 40, borderRadius: 8, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" };
  const taStyle = { width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid " + T.n200, borderRadius: 8, fontSize: 14, fontFamily: "inherit", color: T.n800, resize: "vertical" };

  const crear = async () => {
    setCreando(true); setMsg(null);
    try {
      const body = { sessionCode: sc, code: sel, who: session.who, plantilla, asignadoId: asignadoId ? Number(asignadoId) : undefined };
      if (plantilla === "migracion_ventas") { body.desde = desde; body.hasta = hasta; }
      if (plantilla === "eliminar_pos") { body.entorno = entorno; }
      if (plantilla === "cambio_rol_admin") { body.usuarios = usuarios; }
      if (plantilla === "libre") { body.subject = subject; body.description = description; body.queryType = queryType; }
      const r = await api("crearTicketRedmine", body);
      setMsg({ ok: true, texto: "Solicitud creada" + (r.issueId ? " — #" + r.issueId : "") });
      setDesde(""); setHasta(""); setUsuarios(""); setSubject(""); setDescription("");
    } catch (e) {
      setMsg({ ok: false, texto: e.message });
    } finally { setCreando(false); }
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionHeader title="Crear Solicitud en Redmine" subtitle="Pedidos a IT para este cliente puntual, sin que tenga que entrar al portal — quedan como Solicitud colgada de su Implementación." />
      {!tieneFeature && <Alert tone="warning" style={{ marginBottom: 14 }}>Este cliente todavía no tiene la Implementación creada en Redmine — primero hace falta un alta exitosa (arriba) antes de poder colgarle Solicitudes.</Alert>}

      <div style={{ marginBottom: 14 }}>
        <Label>Plantilla</Label>
        <select value={plantilla} onChange={(e) => setPlantilla(e.target.value)} disabled={!tieneFeature} style={selStyle}>
          <option value="migracion_ventas">Migración de ventas de plataforma (Sales)</option>
          <option value="eliminar_pos">Eliminar pos_sales y pos_payments</option>
          <option value="cambio_rol_admin">Cambio de rol a Administrador</option>
          <option value="libre">Solicitud libre</option>
        </select>
      </div>

      {plantilla === "migracion_ventas" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><Label>Desde</Label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={selStyle} /></div>
          <div><Label>Hasta</Label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={selStyle} /></div>
        </div>
      )}

      {plantilla === "eliminar_pos" && (
        <div style={{ marginBottom: 14, maxWidth: 260 }}>
          <Label>Entorno</Label>
          <select value={entorno} onChange={(e) => setEntorno(e.target.value)} style={selStyle}>
            <option value="sandbox">Sandbox</option>
            <option value="productivo">Producción</option>
          </select>
        </div>
      )}

      {plantilla === "cambio_rol_admin" && (
        <div style={{ marginBottom: 14 }}>
          <Label>Usuarios que deben quedar como administradores</Label>
          <textarea value={usuarios} onChange={(e) => setUsuarios(e.target.value)} rows={2} placeholder="Ej: juan@cliente.com, maria@cliente.com" style={taStyle} />
        </div>
      )}

      {plantilla === "libre" && (
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          <div><Label>Asunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div><Label>Descripción</Label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Qué hacer, sobre qué tenant (sandbox o productivo) y cómo validar que quedó hecho" style={taStyle} /></div>
          <div style={{ maxWidth: 300 }}>
            <Label>Tipo de pedido (Query type)</Label>
            <select value={queryType} onChange={(e) => setQueryType(e.target.value)} style={selStyle}>
              {queryTypes.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14, maxWidth: 300 }}>
        <Label>Asignar a</Label>
        <select value={asignadoId} onChange={(e) => setAsignadoId(e.target.value)} disabled={!tieneFeature} style={selStyle}>
          <option value="">Sin asignar (lo reparte IT)</option>
          {desarrolladores.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>

      {msg && <Alert tone={msg.ok ? "success" : "error"} style={{ marginBottom: 14 }}>{msg.texto}</Alert>}
      <ActionBar>
        <Btn onClick={crear} disabled={!tieneFeature || creando}>{creando ? "Creando…" : "Crear Solicitud"}</Btn>
      </ActionBar>
    </Card>
  );
}

function EquipoLista({ miembros, esSuperuser, onEliminar, onSetTipoUsuario, miCodigo }) {
  if (!miembros.length) return <div style={{ fontSize: 13, color: T.n400 }}>Todavía no hay nadie en este equipo.</div>;
  const etiquetaTipo = (t) => t === "superuser" ? "Superuser" : t === "admin" ? "Admin" : t === "comercial" ? "Comercial" : "Colaborador";
  const colorTipo = (t) => t === "superuser" ? T.primary800 : t === "admin" ? T.okTx : t === "comercial" ? T.warnTx : T.n600;
  const bgTipo = (t) => t === "superuser" ? T.primary50 : t === "admin" ? T.okBg : t === "comercial" ? T.warnBg : T.n100;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {miembros.map((m) => {
        const tipo = m.tipo_usuario || (m.es_superadmin ? "superuser" : "admin");
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid " + T.n200, background: "#fff" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", background: T.n50, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: T.n400 }}>
              {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🙂"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.n800, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {m.nombre}
                <span title={"Tipo de usuario: " + etiquetaTipo(tipo)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: bgTipo(tipo), color: colorTipo(tipo), fontWeight: 600 }}>{etiquetaTipo(tipo)}</span>
                {m.codigo === miCodigo && <span style={{ fontSize: 11.5, color: T.n400 }}>(vos)</span>}
              </div>
              <div style={{ fontSize: 12, color: T.n400 }}>{m.codigo} · {m.email || "sin mail"}</div>
            </div>
            {esSuperuser && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <select value={tipo} onChange={(e) => onSetTipoUsuario(m.id, e.target.value, m.nombre)} style={{ height: 30, borderRadius: 6, border: "1px solid " + T.n200, fontSize: 12.5, background: "#fff", padding: "0 8px", color: T.n800 }}>
                  <option value="colaborador">Colaborador</option>
                  <option value="comercial">Comercial (solo lectura)</option>
                  <option value="admin">Admin</option>
                  <option value="superuser">Superuser</option>
                </select>
                {m.codigo !== miCodigo && <Btn variant="ghost" size="sm" onClick={() => onEliminar(m.id, m.nombre)} style={{ color: T.errTx }}>🗑 Eliminar</Btn>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Columna fija de la ficha: los datos que se consultan todo el tiempo ───
function FichaResumen({ meta, selData, nombreVendedor }) {
  const rv = selData.relevamiento || {};
  const via = { api: "API", csv: "CSV", ambos: "API y CSV", indef: "A definir" }[rv.d1] || "A definir";
  const ahora = Date.now();
  const proxima = (selData.eventos || []).filter((e) => e.estado === "agendado" && new Date(e.fecha).getTime() >= ahora).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))[0];
  const sg = semaforoGoLive(meta.goLiveEstimado);
  const fila = (k, v, extra) => (
    <div className="nub-kv__f"><dt>{k}</dt><dd>{v}{extra}</dd></div>
  );
  return (
    <aside className="nub-ficha-aside" aria-label="Datos clave del cliente">
      <dl className="nub-kv">
        {fila("Go-live acordado", meta.goLiveEstimado ? fmtDateSolo(meta.goLiveEstimado) : "Sin fecha", sg && sg.tone === "red" ? <Badge tone="red">{diasHasta(meta.goLiveEstimado) < 0 ? "Vencido" : "Cerca"}</Badge> : null)}
        {fila("Contrato", contratoInfo(meta.estadoContrato).lbl)}
        {rv.pais && fila("País", rv.pais)}
        {rv.rubro && fila("Rubro", rv.rubro === "Otro" && rv.rubroOtro ? rv.rubroOtro : rv.rubro)}
        {fila("Ambiente de pruebas", meta.usaSandbox === false ? "Sin sandbox, directo en productivo" : "Con sandbox")}
        {fila("Tenant productivo", meta.tenant || "Sin cargar")}
        {fila("Conexión de ventas", via)}
        {fila("Implementación", meta.implementadorNombre || "Sin asignar")}
        {fila("Desarrollo", meta.desarrolladorNombre || "Sin asignar")}
        {(meta.comerciales || []).length > 0 && fila("Comercial", (meta.comerciales || []).map(nombreVendedor).join(", "))}
        {fila("Próxima reunión", proxima ? (EVENTO_NOMBRES[proxima.tipo] || proxima.tipo) + ", " + fmtDate(proxima.fecha) : "Ninguna agendada", proxima && proxima.meet_link ? <BotonMeet e={proxima} chico /> : null)}
        {meta.fechaIngreso && fila("Ingreso", fmtDateSolo(meta.fechaIngreso))}
      </dl>
    </aside>
  );
}

const FICHA_TABS = [["resumen", "Resumen"], ["relevamiento", "Relevamiento"], ["integracion", "Integración"], ["tickets", "Tickets"], ["reuniones", "Reuniones"], ["mails", "Mails"], ["historial", "Historial"]];

function AdminPortal({ session, onLogout }) {
  const [toastEq, setToastEq] = useState(null);
  const aviso = useCallback((titulo, tono) => setToastEq({ titulo, tono, id: Date.now() }), []);
  useEffect(() => {
    if (!toastEq) return;
    const id = setTimeout(() => setToastEq(null), toastEq.tono === "error" ? 6500 : 4500);
    return () => clearTimeout(id);
  }, [toastEq]);
  // Dentro del panel, cada acción que cambia algo se confirma con un aviso.
  const api = async (action, payload) => {
    const r = await apiBase(action, payload);
    if (AVISOS_EQUIPO[action]) aviso(AVISOS_EQUIPO[action]);
    return r;
  };
  const [fTab, setFTab] = useState("resumen");
  const [ordenClientes, setOrdenClientes] = useState("golive"); // golive | fase | nombre
  const [filtroRapido, setFiltroRapido] = useState(""); // "" | golive | sin_asignar | mios
  const [menuMini, setMenuMini] = useState(false);
  useEffect(() => { try { setMenuMini(localStorage.getItem("nubceo_menu_mini") === "1"); } catch (e) {} }, []);
  const alternarMenuMini = () => setMenuMini((v) => { try { localStorage.setItem("nubceo_menu_mini", v ? "0" : "1"); } catch (e) {} return !v; });
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = useCallback(() => setMenuAbierto(false), []);
  const [filtroNotif, setFiltroNotif] = useState("todas"); // todas | sin_leer




  const [sel, setSel] = useState(null); // código del cliente seleccionado
  const [selData, setSelData] = useState(null);
  const [selMeta, setSelMeta] = useState(null);
  const [autoProg, setAutoProg] = useState(null);
  const [clients, setClients] = useState(null); // null = cargando
  const [team, setTeam] = useState([]);
  const [archivados, setArchivados] = useState([]);
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newTenant, setNewTenant] = useState("");
  const [newRazonSocial, setNewRazonSocial] = useState("");
  const [newCuits, setNewCuits] = useState([]);
  const [newCuitInput, setNewCuitInput] = useState("");
  const [newErpPdv, setNewErpPdv] = useState([]);
  const [newErpPdvInput, setNewErpPdvInput] = useState("");
  const [newLogo, setNewLogo] = useState(null);
  const [newImplName, setNewImplName] = useState("");
  const [newImplCode, setNewImplCode] = useState("");
  const [newImplEmail, setNewImplEmail] = useState("");
  const [newImplRol, setNewImplRol] = useState("implementador");
  const [newImplTipo, setNewImplTipo] = useState("colaborador");
  const [newImplFoto, setNewImplFoto] = useState(null);
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState("");
  const [cfg, setCfg] = useState({ url: "", projectId: "" });
  const [apiKeyEnEnv, setApiKeyEnEnv] = useState(false);
  const [avisosAutomaticos, setAvisosAutomaticos] = useState(false);
  const [cfgMsg, setCfgMsg] = useState("");
  const [modulo, setModulo] = useState(() => { try { return localStorage.getItem("nubceo_modulo") || "clientes"; } catch (e) { return "clientes"; } });
  useEffect(() => { try { localStorage.setItem("nubceo_modulo", modulo); } catch (e) {} }, [modulo]);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [confirmaCodigo, setConfirmaCodigo] = useState("");
  const [perfilMsg, setPerfilMsg] = useState("");
  const [miEmail, setMiEmail] = useState("");
  const [miFoto, setMiFoto] = useState("");
  const [calStatus, setCalStatus] = useState(null); // { responsables, conexiones }
  const [calMsg, setCalMsg] = useState("");
  const [editandoInfo, setEditandoInfo] = useState(false);
  const [editRazonSocial, setEditRazonSocial] = useState("");
  const [editCuits, setEditCuits] = useState([]);
  const [editCuitInput, setEditCuitInput] = useState("");
  const [editErpPdv, setEditErpPdv] = useState([]);
  const [editErpPdvInput, setEditErpPdvInput] = useState("");
  const [editLogo, setEditLogo] = useState(null);
  const [editGoLive, setEditGoLive] = useState("");
  const [editNombre, setEditNombre] = useState("");
  const [editCodigo, setEditCodigo] = useState("");
  const [editTenant, setEditTenant] = useState("");
  const [editComercial, setEditComercial] = useState("");
  const [editFechaIngreso, setEditFechaIngreso] = useState("");
  const [editandoFinanzas, setEditandoFinanzas] = useState(false);
  const [finFee, setFinFee] = useState("");
  const [finMoneda, setFinMoneda] = useState("ARS");
  const [finCosto, setFinCosto] = useState("");
  const [finEstado, setFinEstado] = useState("al_dia");
  const [finDeudaDesde, setFinDeudaDesde] = useState("");
  const [finNotas, setFinNotas] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroImpl, setFiltroImpl] = useState("");
  const [filtroDev, setFiltroDev] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [filtroAutoimp, setFiltroAutoimp] = useState("");
  const [newComerciales, setNewComerciales] = useState([]);
  const [editComerciales, setEditComerciales] = useState([]);
  const [newAutoimp, setNewAutoimp] = useState(false);
  const [newUsaSandbox, setNewUsaSandbox] = useState(true);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [newImpl, setNewImpl] = useState(null);
  const [newDev, setNewDev] = useState(null);
  const [editUsaSandbox, setEditUsaSandbox] = useState(true);
  const [editAutoimp, setEditAutoimp] = useState(false);
  const implementadoresTeam = team.filter((m) => m.rol === "implementador");
  const devsTeam = team.filter((m) => m.rol === "desarrollador");
  const vendedoresTeam = team.filter((m) => m.rol === "ventas");
  const soloLectura = session.tipoUsuario === "comercial";
  const nombreVendedor = (id) => (team.find((m) => m.id === id) || {}).nombre || "—";
  const [notifs, setNotifs] = useState([]);
  const [notifNoLeidas, setNotifNoLeidas] = useState(0);
  const [newContactos, setNewContactos] = useState([{ nombre: "", cargo: "", email: "", telefono: "", rol: "sponsor" }]);
  const [newComercial, setNewComercial] = useState("");
  const [newGoLive, setNewGoLive] = useState(""); // formato YYYY-MM-DD
  const [newFechaIngreso, setNewFechaIngreso] = useState(""); // fecha de trato ganado / ingreso
  const [miNombre, setMiNombre] = useState("");
  const [miRedmineKey, setMiRedmineKey] = useState("");
  const [tableroFull, setTableroFull] = useState(false);
  const [panelCliente, setPanelCliente] = useState(null); // código del cliente en el panel lateral del tablero
  const [panelData, setPanelData] = useState(null);
  const tableroRef = useRef(null);
  const sc = session.code;
  // Marca de color por cliente, privada de cada implementador (solo en el listado).
  const { marcas, ciclar } = useMarcas(sc);
  const [filtroMarca, setFiltroMarca] = useState("");

  // Vuelta del OAuth de Google Calendar (?calendar=ok|error|sinpermiso|sinrefresh&responsable=…)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const cal = qs.get("calendar");
    if (!cal) return;
    const resp = qs.get("responsable");
    const TXT = {
      ok: "Calendario de " + (resp || "") + " conectado ✓ — ya se usa para chequear disponibilidad real y enviar invitaciones.",
      error: "No se pudo conectar el calendario. Reintentá desde el botón de abajo.",
      sinpermiso: "Esa conexión de calendario solo la puede hacer el equipo de implementaciones.",
      sinrefresh: "Google no devolvió permiso persistente — desconectá esta cuenta en myaccount.google.com/permissions y volvé a intentar.",
    };
    setCalMsg(TXT[cal] || "");
    window.history.replaceState({}, "", window.location.pathname);
    setTimeout(() => setCalMsg(""), 8000);
  }, []);

  const cargarCalStatus = useCallback(async () => {
    try { setCalStatus(await api("calendarStatus", { sessionCode: sc })); } catch (e) { /* opcional */ }
  }, [sc]);
  useEffect(() => { cargarCalStatus(); }, [cargarCalStatus]);

  const conectarCalendario = async () => {
    try {
      const r = await api("calendarAuthUrl", { sessionCode: sc });
      window.location.href = r.url;
    } catch (e) { setCalMsg(e.message); }
  };
  const desconectarCalendario = async () => {
    try { await api("calendarDisconnect", { sessionCode: sc }); cargarCalStatus(); } catch (e) { setCalMsg(e.message); }
  };

  // Disponibilidad semanal personal
  const [disponibilidad, setDisponibilidad] = useState([]); // [{dia_semana, hora}]
  const [nuevoDia, setNuevoDia] = useState(1);
  const [nuevaHora, setNuevaHora] = useState("10:00");
  const [dispMsg, setDispMsg] = useState("");
  const cargarDisponibilidad = useCallback(async () => {
    if (!session.teamId) return;
    try { const r = await api("getMyAvailability", { sessionCode: sc }); setDisponibilidad(r.slots || []); } catch (e) { /* opcional */ }
  }, [sc, session.teamId]);
  useEffect(() => { cargarDisponibilidad(); }, [cargarDisponibilidad]);

  const agregarSlotDisponibilidad = async () => {
    const ya = disponibilidad.some((s) => s.dia_semana === nuevoDia && s.hora === nuevaHora);
    const nueva = ya ? disponibilidad : [...disponibilidad, { dia_semana: nuevoDia, hora: nuevaHora }];
    setDisponibilidad(nueva);
    try { await api("setMyAvailability", { sessionCode: sc, slots: nueva }); setDispMsg("Guardado ✓"); } catch (e) { setDispMsg(e.message); }
    setTimeout(() => setDispMsg(""), 2500);
  };
  const quitarSlotDisponibilidad = async (dia, hora) => {
    const nueva = disponibilidad.filter((s) => !(s.dia_semana === dia && s.hora === hora));
    setDisponibilidad(nueva);
    try { await api("setMyAvailability", { sessionCode: sc, slots: nueva }); } catch (e) { setDispMsg(e.message); }
  };

  const cargarListado = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        api("listClients", { sessionCode: sc }),
        api("listTeam", { sessionCode: sc }),
      ]);
      setClients(r1.clients);
      setTeam(r2.team);
    } catch (e) {
      setClients([]);
      aviso("No se pudo cargar el listado: " + e.message, "error");
    }
  }, [sc]);

  useEffect(() => { cargarListado(); }, [cargarListado]);

  const cargarNotificaciones = useCallback(async () => {
    try {
      const r = await api("listNotificaciones", { sessionCode: sc });
      setNotifs(r.notificaciones || []);
      setNotifNoLeidas(r.noLeidas || 0);
    } catch (e) { /* opcional */ }
  }, [sc]);
  useEffect(() => {
    cargarNotificaciones();
    const t = setInterval(cargarNotificaciones, 60000); // refresca cada 60s
    return () => clearInterval(t);
  }, [cargarNotificaciones]);

  const marcarNotifLeida = async (id) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    setNotifNoLeidas((prev) => Math.max(0, prev - 1));
    try { await api("marcarNotificacionLeida", { sessionCode: sc, id }); } catch (e) { cargarNotificaciones(); }
  };
  const marcarTodasNotifLeidas = async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
    setNotifNoLeidas(0);
    try { await api("marcarNotificacionesLeidas", { sessionCode: sc }); } catch (e) { cargarNotificaciones(); }
  };

  useEffect(() => {
    if (!session.teamId || !team.length) return;
    const yo = team.find((m) => m.id === session.teamId);
    if (yo) { setMiEmail(yo.email || ""); setMiFoto(yo.foto || null); setMiNombre(yo.nombre || ""); }
  }, [team, session.teamId]);

  useEffect(() => {
    if (!session.teamId) return;
    (async () => {
      try { const r = await api("getMyProfile", { sessionCode: sc }); setMiRedmineKey(r.perfil?.redmine_api_key || ""); } catch (e) { /* opcional */ }
    })();
  }, [sc, session.teamId]);

  const guardarMiPerfil = async (cambios) => {
    try {
      await api("updateTeamEmail", { sessionCode: sc, ...cambios });
      setPerfilMsg("Guardado ✓");
      cargarListado();
    } catch (e) { setPerfilMsg(e.message); }
    setTimeout(() => setPerfilMsg(""), 3000);
  };

  const archivarCliente = async (code, nombre) => {
    if (!window.confirm("¿Archivar el cliente " + nombre + "?\n\nDeja de aparecer en el listado activo. Los datos se conservan y podés restaurarlo cuando quieras desde \"Clientes archivados\" al pie del panel.")) return;
    try {
      await api("archiveClient", { sessionCode: sc, code, who: session.who });
      flash(nombre + " fue archivado. Podés restaurarlo desde 'Clientes archivados'.");
      if (sel === code) cerrarDetalle(); else cargarListado();
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const restaurarCliente = async (code, nombre) => {
    if (!window.confirm("¿Restaurar el cliente " + nombre + "? Vuelve a aparecer en el listado activo.")) return;
    try {
      await api("restoreClient", { sessionCode: sc, code, who: session.who });
      flash(nombre + " fue restaurado.");
      cargarListado();
      cargarArchivados();
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const eliminarCliente = async (code, nombre) => {
    if (!window.confirm("¿ELIMINAR definitivamente a " + nombre + " (código " + code + ")?\n\nEsto borra el cliente y TODOS sus datos (contactos, relevamiento, archivos, reuniones, tickets, notificaciones). Es IRREVERSIBLE y libera el código para reutilizarlo.")) return;
    if (!window.confirm("Confirmá una vez más: se elimina " + nombre + " sin vuelta atrás.")) return;
    try {
      await api("deleteClient", { sessionCode: sc, code, who: session.who });
      flash(nombre + " fue eliminado. El código " + code + " quedó libre.");
      cargarArchivados();
      cargarListado();
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const cargarArchivados = useCallback(async () => {
    if (session.tipoUsuario !== "superuser") return;
    try {
      const r = await api("listArchived", { sessionCode: sc });
      setArchivados(r.archivados);
    } catch (e) { /* silencioso */ }
  }, [sc, session.tipoUsuario]);

  const eliminarMiembro = async (teamId, nombre) => {
    if (!window.confirm("¿Eliminar a " + nombre + " del equipo? Los clientes que tenga asignados quedan sin asignar.")) return;
    try {
      await api("deleteTeamMember", { sessionCode: sc, teamId, who: session.who });
      flash(nombre + " fue eliminado/a del equipo.");
      cargarListado();
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const setTipoUsuario = async (teamId, tipo, nombre) => {
    const etiquetas = { superuser: "Superuser", admin: "Admin", colaborador: "Colaborador" };
    if (!window.confirm("¿Cambiar el tipo de usuario de " + nombre + " a " + etiquetas[tipo] + "?")) return;
    try {
      await api("setTipoUsuario", { sessionCode: sc, teamId, tipo, who: session.who });
      flash("Tipo de usuario actualizado ✓", 3000);
      cargarListado();
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const abrirPanelKanban = async (code) => {
    setPanelCliente(code);
    setPanelData(null);
    try { const r = await api("getClient", { sessionCode: sc, code }); setPanelData(r); } catch (e) { /* opcional */ }
  };

  const toggleFullscreen = () => {
    if (!tableroFull) {
      tableroRef.current?.requestFullscreen?.().catch(() => {});
      setTableroFull(true);
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.();
      setTableroFull(false);
    }
  };
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setTableroFull(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await api("getConfig", { sessionCode: sc });
        setCfg(r.cfg);
        setApiKeyEnEnv(r.apiKeyEnEnv);
      } catch (e) { /* config opcional */ }
    })();
    (async () => {
      try { const r = await api("getAvisosConfig", { sessionCode: sc }); setAvisosAutomaticos(!!r.automatico); } catch (e) { /* opcional */ }
    })();
  }, [sc]);

  const toggleAvisosAutomaticos = async (valor) => {
    setAvisosAutomaticos(valor);
    try { await api("setAvisosConfig", { sessionCode: sc, automatico: valor, who: session.who }); } catch (e) { flash(e.message, 0, "error"); setAvisosAutomaticos(!valor); }
  };

  const [enviandoAvisosDe, setEnviandoAvisosDe] = useState(null); // código del cliente en curso
  const enviarAvisosPendientes = async (code) => {
    setEnviandoAvisosDe(code);
    try {
      const r = await api("enviarAvisosPendientesCliente", { sessionCode: sc, code, who: session.who });
      const { enviados, omitidos, sinPlazos } = r.avisos || {};
      if (sinPlazos) flash(code + ": este cliente todavía no tiene plazos definidos.");
      else if (enviados?.length) flash(code + ": se enviaron " + enviados.length + " aviso(s) — " + enviados.map((e) => e.paso).join(", "));
      else flash(code + ": no había ningún aviso pendiente para mandar ahora.");
      if (sel === code) { setSelMeta(r.meta); setSelData(r.data); }
    } catch (e) { flash(e.message, 0, "error"); }
    finally { setEnviandoAvisosDe(null); }
  };

  const flash = (texto, ms, tono) => aviso(texto, tono);

  const guardarConfig = async () => {
    try {
      await api("saveConfig", { sessionCode: sc, cfg });
      setCfgMsg("Configuración guardada ✓");
    } catch (e) { setCfgMsg(e.message); }
    setTimeout(() => setCfgMsg(""), 3000);
  };

  const abrir = async (code) => {
    try {
      const r = await api("getClient", { sessionCode: sc, code });
      setSelMeta(r.meta);
      setSelData(r.data);
      setSel(code);
      setEditandoInfo(false);
      setEditandoFinanzas(false);
      setAutoProg(null);
      if (r.meta && r.meta.autoimplementacion) {
        try { const ap = await api("getAutoProgreso", { sessionCode: sc, code }); setAutoProg(ap); } catch (e) { /* opcional */ }
      }
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const cerrarDetalle = () => { setSel(null); setSelData(null); setSelMeta(null); setAutoProg(null); cargarListado(); };

  const crearCliente = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    try {
      await api("createClient", {
        sessionCode: sc, nombre: newName, codigo: newCode, tenant: newTenant, razonSocial: newRazonSocial, cuits: newCuits, logo: newLogo,
        comerciales: newComerciales, implementadorId: newImpl, desarrolladorId: newDev, autoimplementacion: newAutoimp, usaSandbox: newUsaSandbox, goLiveEstimado: newGoLive, fechaIngreso: newFechaIngreso || null, erpPdv: newErpPdv, contactos: newContactos.filter((c) => c.nombre.trim()),
      });
      flash("Cliente creado. Compartile el código " + newCode.trim().toUpperCase() + ". Al primer login se dispara el alta en Redmine y sus credenciales de API.", 5000);
      setAltaAbierta(false); setNewImpl(null); setNewDev(null); setNewName(""); setNewCode(""); setNewTenant(""); setNewRazonSocial(""); setNewCuits([]); setNewCuitInput(""); setNewLogo(null);
      setNewComerciales([]); setNewAutoimp(false); setNewUsaSandbox(true); setNewGoLive(""); setNewFechaIngreso(""); setNewErpPdv([]); setNewErpPdvInput(""); setNewContactos([{ nombre: "", cargo: "", email: "", telefono: "", rol: "sponsor" }]);
      cargarListado();
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const crearImplementador = async () => {
    if (!newImplCode.trim() || !newImplName.trim()) return;
    try {
      await api("createTeam", { sessionCode: sc, nombre: newImplName, codigo: newImplCode, email: newImplEmail, rol: newImplRol, foto: newImplFoto, tipoUsuario: newImplTipo });
      const etiquetaTipo = { superuser: "Superuser", admin: "Admin", colaborador: "Colaborador", comercial: "Comercial (solo lectura)" }[newImplTipo] || "Colaborador";
      flash("Persona creada como " + etiquetaTipo + ". Su código de acceso es " + newImplCode.trim().toUpperCase() + ". Compartíselo por un canal seguro.", 5000);
      setNewImplName(""); setNewImplCode(""); setNewImplEmail(""); setNewImplRol("implementador"); setNewImplFoto(null);
      cargarListado();
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const cambiarFase = async (code, phase) => {
    // Optimista: el tablero responde al toque de soltar la tarjeta, sin esperar la vuelta del servidor.
    setClients((prev) => (prev ? prev.map((c) => (c.code === code ? { ...c, phase } : c)) : prev));
    try {
      const r = await api("setPhase", { sessionCode: sc, code, fase: phase, faseNombre: FASES[phase], who: session.who });
      if (sel === code) { setSelMeta(r.meta); setSelData(r.data); }
    } catch (e) {
      flash(e.message, 0, "error");
      cargarListado(); // si falló, recargamos de la base para no dejar el tablero desincronizado
    }
  };

  const asignar = async (code, implementadorId, rol = "implementador") => {
    // Optimista: reflejamos el cambio en la lista al instante (sin recargar todo),
    // así el selector no "vuelve atrás" y no hace falta clickear dos veces.
    const campoId = rol === "desarrollador" ? "desarrolladorId" : "implementadorId";
    const campoNom = rol === "desarrollador" ? "desarrolladorNombre" : "implementadorNombre";
    const nom = (team.find((m) => m.id === implementadorId) || {}).nombre || null;
    setClients((prev) => prev.map((c) => c.code === code ? { ...c, [campoId]: implementadorId, [campoNom]: nom } : c));
    try {
      const r = await api("assignClient", { sessionCode: sc, code, implementadorId, rol, who: session.who });
      if (sel === code) { setSelMeta(r.meta); setSelData(r.data); }
    } catch (e) { flash(e.message, 0, "error"); cargarListado(); }
  };

  // Asignar/quitar vendedores desde la lista, también optimista.
  const setVendedoresCliente = async (code, nuevaLista) => {
    setClients((prev) => prev.map((c) => c.code === code ? { ...c, comerciales: nuevaLista } : c));
    if (sel === code) setSelMeta((m) => (m ? { ...m, comerciales: nuevaLista } : m));
    try {
      await api("setComerciales", { sessionCode: sc, code, comerciales: nuevaLista, who: session.who });
    } catch (e) { flash(e.message, 0, "error"); cargarListado(); }
  };

  // Cambia el color de seguimiento del cliente en el tablero: gris → verde → amarillo → rojo → gris.
  const cambiarColor = async (code) => {
    const ciclo = { gris: "verde", verde: "amarillo", amarillo: "rojo", rojo: "gris" };
    const actual = (clients || []).find((c) => c.code === code)?.estadoSeguimiento || "gris";
    const nuevo = ciclo[actual] || "verde";
    // Optimista: el color cambia al instante sin esperar al servidor.
    setClients((prev) => (prev ? prev.map((c) => (c.code === code ? { ...c, estadoSeguimiento: nuevo } : c)) : prev));
    try {
      await api("setEstadoCliente", { sessionCode: sc, code, estado: nuevo, who: session.who });
    } catch (e) {
      flash(e.message, 0, "error");
      cargarListado(); // si falló, recargamos para no dejar el tablero desincronizado
    }
  };

  const cambiarMiCodigo = async () => {
    if (!nuevoCodigo.trim()) return;
    if (nuevoCodigo.trim().toUpperCase() !== confirmaCodigo.trim().toUpperCase()) { setPerfilMsg("Los códigos no coinciden."); return; }
    try {
      await api("changeMyCode", { sessionCode: sc, nuevoCodigo });
      setPerfilMsg("¡Código actualizado! Guardalo en el navegador — en 3 segundos te llevamos al login para entrar con el nuevo.");
      setTimeout(onLogout, 3000);
    } catch (e) { setPerfilMsg(e.message); }
  };

  const reenviarRedmine = async () => {
    if (!sel) return;
    try {
      const r = await api("retryRedmine", { sessionCode: sc, code: sel, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const [generandoAlta, setGenerandoAlta] = useState(false);
  const generarAltaAhora = async () => {
    if (!sel) return;
    setGenerandoAlta(true);
    try {
      const r = await api("onboarding", { sessionCode: sc, code: sel, who: session.who });
      setSelData(r.data); setSelMeta(r.meta);
      flash("Alta disparada ✓");
    } catch (e) { flash(e.message, 0, "error"); }
    finally { setGenerandoAlta(false); }
  };

  const [vinculando, setVinculando] = useState(false);
  const [featureIdManual, setFeatureIdManual] = useState("");
  const vincularTicket = async () => {
    if (!sel || !featureIdManual.trim()) return;
    setVinculando(true);
    try {
      const r = await api("vincularTicketRedmine", { sessionCode: sc, code: sel, featureIssueId: featureIdManual.trim(), who: session.who });
      setSelData(r.data);
      setFeatureIdManual("");
      flash("Ticket vinculado ✓");
    } catch (e) { flash(e.message, 0, "error"); }
    finally { setVinculando(false); }
  };

  const regenerarCreds = async () => {
    if (!sel) return;
    try {
      const r = await api("regenCreds", { sessionCode: sc, code: sel, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const cambiarEstadoProc = async (codigo, estado) => {
    if (!sel) return;
    try {
      const lista = (selData.procesadoras || []).map((p) => p.codigo === codigo ? { ...p, estado } : p);
      const r = await api("saveProcesadoras", { sessionCode: sc, code: sel, lista, who: session.who, log: "Actualizó el estado de una procesadora: " + codigo + " → " + estado });
      setSelData(r.data);
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const cambiarPrueba = async (etapa, status, notas) => {
    if (!sel) return;
    try {
      const r = await api("setPrueba", { sessionCode: sc, code: sel, etapa, status, notas, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const agregarMeetEvento = async (eventoId) => {
    try {
      const r = await api("agregarMeet", { sessionCode: sc, eventoId });
      setSelData(r.data);
      flash("Link de Meet agregado. Google les avisa a los invitados.");
    } catch (e) { flash(e.message, 0, "error"); }
  };
  const guardarMinuta = async (eventoId, minuta) => {
    if (!sel || !minuta.trim()) return;
    try {
      const r = await api("setMinuta", { sessionCode: sc, code: sel, eventoId, minuta: minuta.trim(), who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const guardarPlazo = async (paso, fechaLimite) => {
    if (!sel || !fechaLimite) return;
    try {
      const r = await api("setPlazo", { sessionCode: sc, code: sel, paso, fechaLimite, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message, 0, "error"); }
  };
  const quitarPlazo = async (paso) => {
    if (!sel) return;
    try {
      const r = await api("quitarPlazo", { sessionCode: sc, code: sel, paso, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message, 0, "error"); }
  };
  const [avisoMsg, setAvisoMsg] = useState("");
  const enviarAvisoAhora = async (paso) => {
    if (!sel) return;
    try {
      const r = await api("enviarAvisoAhora", { sessionCode: sc, code: sel, paso, who: session.who });
      setSelData(r.data);
      setAvisoMsg("Aviso enviado ✓");
    } catch (e) { setAvisoMsg(e.message); }
    setTimeout(() => setAvisoMsg(""), 4000);
  };
  const marcarApiCompleta = async (completo) => {
    if (!sel) return;
    try {
      const r = await api("setApiDesarrolloCompleto", { sessionCode: sc, code: sel, completo, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const cambiarCumplimiento = async (paso, cumplimiento) => {
    if (!sel) return;
    try {
      const r = await api("setCumplimientoPlazo", { sessionCode: sc, code: sel, paso, cumplimiento, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const reabrirRelevamiento = async () => {
    if (!sel) return;
    if (!window.confirm("¿Reabrir el relevamiento para que " + (selMeta?.name || "el cliente") + " lo pueda editar de nuevo?")) return;
    try {
      const r = await api("reabrirRelevamiento", { sessionCode: sc, code: sel, who: session.who });
      setSelMeta(r.meta); setSelData(r.data);
      flash("Relevamiento reabierto ✓");
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const guardarFinanzas = async () => {
    if (!sel) return;
    try {
      const r = await api("setFinanzas", {
        sessionCode: sc, code: sel, who: session.who,
        fee: finFee, moneda: finMoneda, costoImplementacion: finCosto, estadoPago: finEstado, deudaDesde: finDeudaDesde, finanzasNotas: finNotas,
      });
      setSelMeta(r.meta); setSelData(r.data);
      setEditandoFinanzas(false);
      cargarListado();
    } catch (e) { flash(e.message, 0, "error"); }
  };

  const agregarNota = async () => {
    if (!nota.trim() || !sel) return;
    try {
      const r = await api("addNote", { sessionCode: sc, code: sel, texto: nota.trim(), who: session.who });
      setSelData(r.data);
      setNota("");
    } catch (e) { flash(e.message, 0, "error"); }
  };

  // ── Vista detalle de un cliente ──
  if (sel && selData) {
    const meta = selMeta || { name: sel, phase: 0 };
    const alertas = detectarAlertas(selData.relevamiento);
    return (
      <div>
        <Nav name="Panel del equipo" who={session.who} onLogout={onLogout} admin extra={<AyudaMemoria codigo={sc} />} />
        <ChatBot codigo={sc} />
        <Toast toast={toastEq} className="nub-toast--equipo" />
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px 60px" }}>
          <div style={{ position: "sticky", top: 61, zIndex: 5, background: T.bg, marginBottom: 14, padding: "14px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Btn variant="ghost" size="sm" onClick={cerrarDetalle}>← Volver al listado</Btn>
            {session.tipoUsuario === "superuser" && <Btn variant="ghost" size="sm" onClick={() => archivarCliente(sel, meta.name)} style={{ color: T.n600 }}>📥 Archivar cliente</Btn>}
          </div>
          <div className="nub-ficha">
          <div style={{ minWidth: 0 }}>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0, background: T.n50, border: "1px solid " + T.n200, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: T.n400 }}>
                  {meta.logo ? <img src={meta.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : meta.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: T.n900 }}>{meta.name}</div>
                  <div style={{ fontSize: 13, color: T.n400, marginTop: 2 }}>
                    Código de acceso: <b style={{ color: T.n600 }}>{sel}</b>
                    <span onClick={() => { try { navigator.clipboard.writeText(sel); flash("Código copiado ✓", 2000); } catch (e) {} }} style={{ marginLeft: 8, color: T.primary, fontWeight: 600, cursor: "pointer" }}>Copiar</span>
                    {" "}· Alta: {fmtDate(meta.createdAt)}
                  </div>
                  {(meta.razonSocial || (meta.cuits || []).length > 0) && (
                    <div style={{ fontSize: 12.5, color: T.n400, marginTop: 2 }}>
                      {meta.razonSocial}{meta.razonSocial && (meta.cuits || []).length > 0 ? " · " : ""}
                      {(meta.cuits || []).length > 0 && "CUIT: " + meta.cuits.join(", ")}
                    </div>
                  )}
                  {(meta.erpPdv || []).length > 0 && (
                    <div style={{ fontSize: 12.5, color: T.n400, marginTop: 2 }}>
                      ERP/PDV: {meta.erpPdv.join(", ")}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <Badge tone={contratoInfo(meta.estadoContrato).tone}>📄 {contratoInfo(meta.estadoContrato).lbl}</Badge>
                    {meta.autoimplementacion && <span style={{ fontSize: 12, fontWeight: 700, background: "#efe7ff", color: "#6d28d9", border: "1px solid #ddd0fb", borderRadius: 100, padding: "3px 10px" }}>🚀 Autoimplementación</span>}
                    <select
                      value={meta.estadoContrato || "sin_firmar"}
                      onChange={async (e) => {
                        const val = e.target.value;
                        try {
                          const r = await api("setEstadoContrato", { sessionCode: sc, code: sel, estadoContrato: val, who: session.who });
                          setSelMeta(r.meta); setSelData(r.data);
                          flash("Estado de contrato actualizado ✓", 2000);
                        } catch (err) { flash(err.message); }
                      }}
                      style={{ height: 30, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 8px", fontSize: 12.5, fontFamily: "inherit", color: T.n800, cursor: "pointer" }}
                    >
                      <option value="firmado">Contrato firmado</option>
                      <option value="sin_firmar">Sin contrato firmado</option>
                      <option value="pago_habilita">Pago habilita avance</option>
                    </select>
                  </div>
                </div>
              </div>
              {meta.autoimplementacion && (
                <Card style={{ marginTop: 16, borderColor: "#ddd0fb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: 0 }}>🚀 Avances de la autoimplementación</h2>
                    {autoProg && autoProg.existe && (autoProg.habilitado
                      ? <Badge tone="green">Acceso a la guía habilitado</Badge>
                      : <Badge tone="amber">Acceso a la guía deshabilitado</Badge>)}
                  </div>
                  {!autoProg ? <SkeletonLineas lineas={2} style={{ marginTop: 14 }} />
                    : !autoProg.existe ? <div style={{ color: T.n400, fontSize: 14, marginTop: 10 }}>El cliente todavía no ingresó a la guía de autoimplementación.</div>
                    : (<>
                        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", margin: "14px 0" }}>
                          <div><div style={{ fontSize: 12, color: T.n400 }}>Progreso</div><div style={{ fontSize: 15, fontWeight: 700, color: T.n900 }}>{autoProg.hechos} / {autoProg.total} pasos</div></div>
                          <div><div style={{ fontSize: 12, color: T.n400 }}>Origen de ventas</div><div style={{ fontSize: 15, fontWeight: 700, color: T.n900 }}>{autoProg.origen ? String(autoProg.origen).toUpperCase() : "—"}</div></div>
                          <div><div style={{ fontSize: 12, color: T.n400 }}>Consultas usadas</div><div style={{ fontSize: 15, fontWeight: 700, color: T.n900 }}>{autoProg.consultasUsadas} / {autoProg.consultasTotal}</div></div>
                          <div><div style={{ fontSize: 12, color: T.n400 }}>Inició</div><div style={{ fontSize: 15, fontWeight: 700, color: T.n900 }}>{autoProg.iniciado ? fmtDate(autoProg.iniciado) : "—"}</div></div>
                          {autoProg.finalizado && <div><div style={{ fontSize: 12, color: T.n400 }}>Finalizó</div><div style={{ fontSize: 15, fontWeight: 700, color: T.okTx }}>{fmtDate(autoProg.finalizado)}</div></div>}
                        </div>
                        <div style={{ borderTop: "1px solid " + T.n100 }}>
                          {autoProg.pasos.map((p) => (
                            <div key={p.n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid " + T.n100 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: p.hecho ? T.okBg : T.n100, color: p.hecho ? T.okTx : T.n400 }}>{p.hecho ? "✓" : p.n}</span>
                                <span style={{ fontSize: 14, color: p.hecho ? T.n900 : T.n600, fontWeight: p.hecho ? 600 : 500 }}>{p.nombre}</span>
                              </div>
                              <span style={{ fontSize: 12.5, color: p.hecho ? T.n600 : T.n400 }}>{p.hecho ? (p.fecha ? "Completado el " + fmtDate(p.fecha) : "Completado") : "Pendiente"}</span>
                            </div>
                          ))}
                        </div>
                      </>)}
                </Card>
              )}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <Label>Implementador/a</Label>
                  <select value={meta.implementadorId || ""} onChange={(e) => asignar(sel, e.target.value || null, "implementador")} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                    <option value="">Sin asignar</option>
                    {team.filter((m) => m.rol === "implementador").map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Desarrollador/a</Label>
                  <select value={meta.desarrolladorId || ""} onChange={(e) => asignar(sel, e.target.value || null, "desarrollador")} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                    <option value="">Sin asignar</option>
                    {team.filter((m) => m.rol === "desarrollador").map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Fase del proyecto</Label>
                  <select value={meta.phase} onChange={(e) => cambiarFase(sel, Number(e.target.value))} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                    {FASES.map((f, i) => <option key={f} value={i}>{i + 1} · {f}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18 }}><Stepper fase={meta.phase} /></div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid " + T.n100 }}>
              {!editandoInfo ? (
                soloLectura ? null : (<span onClick={() => { setEditNombre(meta.name || ""); setEditCodigo(meta.codigo || ""); setEditTenant(meta.tenant || ""); setEditComerciales(meta.comerciales || []); setEditAutoimp(!!meta.autoimplementacion); setEditUsaSandbox(meta.usaSandbox !== false); setEditFechaIngreso(meta.fechaIngreso || ""); setEditRazonSocial(meta.razonSocial || ""); setEditCuits(meta.cuits || []); setEditErpPdv(meta.erpPdv || []); setEditErpPdvInput(""); setEditLogo(meta.logo || null); setEditGoLive(meta.goLiveEstimado || ""); setEditandoInfo(true); }} style={{ fontSize: 12.5, fontWeight: 600, color: T.primary, cursor: "pointer" }}>
                  ✎ Editar datos del cliente
                </span>)
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <div><Label>Nombre del cliente</Label><Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} /></div>
                    <div>
                      <Label>Código de acceso</Label>
                      <Input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value.toUpperCase())} />
                      <div style={{ fontSize: 11.5, color: "#b45309", marginTop: 4 }}>⚠ Es la credencial de login del cliente. Si lo cambiás, avisale el nuevo código.</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div><Label>Tenant productivo</Label><Input value={editTenant} onChange={(e) => setEditTenant(e.target.value)} /></div>
                    <div><Label>Vendedor/es</Label><SelectorVendedores vendedores={vendedoresTeam} seleccion={editComerciales} onChange={setEditComerciales} /></div>
                    <div><Label>Implementador/a</Label><SelectorMiembro valor={meta.implementadorId} opciones={implementadoresTeam} onChange={(v) => asignar(sel, v, "implementador")} etiqueta="Implementador/a" /></div>
                    <div><Label>Desarrollador/a</Label><SelectorMiembro valor={meta.desarrolladorId} opciones={devsTeam} onChange={(v) => asignar(sel, v, "desarrollador")} etiqueta="Desarrollador/a" /></div>
                    <div><Label>Tipo de onboarding</Label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13.5, color: T.n800 }}>
                        <input type="checkbox" checked={editAutoimp} onChange={(e) => setEditAutoimp(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#6d28d9" }} />
                        {editAutoimp ? "Autoimplementación" : "Implementación estándar"}
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13.5, color: T.n800, marginTop: 8 }}>
                        <input type="checkbox" checked={editUsaSandbox} onChange={(e) => setEditUsaSandbox(e.target.checked)} style={{ width: 16, height: 16, accentColor: T.primary }} />
                        Usa ambiente de pruebas (sandbox)
                      </label>
                    </div>
                    <div><Label>Fecha de ingreso (trato ganado)</Label><Input type="date" value={editFechaIngreso} onChange={(e) => setEditFechaIngreso(e.target.value)} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr", gap: 10 }}>
                    <div><Label>Razón social</Label><Input value={editRazonSocial} onChange={(e) => setEditRazonSocial(e.target.value)} /></div>
                    <div>
                      <Label>CUIT(s)</Label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Input value={editCuitInput} onChange={(e) => setEditCuitInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (editCuitInput.trim()) { setEditCuits([...editCuits, editCuitInput.trim()]); setEditCuitInput(""); } } }}
                          placeholder="Enter para agregar" />
                        <Btn variant="secondary" size="sm" onClick={() => { if (editCuitInput.trim()) { setEditCuits([...editCuits, editCuitInput.trim()]); setEditCuitInput(""); } }}>+</Btn>
                      </div>
                      {editCuits.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {editCuits.map((c, i) => (
                            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: T.primary50, color: T.primary800, border: "1px solid " + T.primary100, borderRadius: 100, padding: "4px 10px" }}>
                              {c} <span onClick={() => setEditCuits(editCuits.filter((_, idx) => idx !== i))} style={{ cursor: "pointer" }}>✕</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ maxWidth: 240 }}>
                    <Label>Fecha estimada de go-live</Label>
                    <Input type="date" value={editGoLive} onChange={(e) => setEditGoLive(e.target.value)} />
                    <div style={{ fontSize: 11.5, color: T.n400, marginTop: 4 }}>Alimenta el semáforo 🎯 del tablero.</div>
                  </div>
                  <div>
                    <Label>ERP / PDV</Label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Input value={editErpPdvInput} onChange={(e) => setEditErpPdvInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (editErpPdvInput.trim()) { setEditErpPdv([...editErpPdv, editErpPdvInput.trim()]); setEditErpPdvInput(""); } } }}
                        placeholder="Ej: Zetti, SAP, Tango — Enter para agregar" />
                      <Btn variant="secondary" size="sm" onClick={() => { if (editErpPdvInput.trim()) { setEditErpPdv([...editErpPdv, editErpPdvInput.trim()]); setEditErpPdvInput(""); } }}>+</Btn>
                    </div>
                    {editErpPdv.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {editErpPdv.map((x, i) => (
                          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: T.primary50, color: T.primary800, border: "1px solid " + T.primary100, borderRadius: 100, padding: "4px 10px" }}>
                            {x} <span onClick={() => setEditErpPdv(editErpPdv.filter((_, idx) => idx !== i))} style={{ cursor: "pointer" }}>✕</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <ImageUpload value={editLogo} onChange={setEditLogo} label="logo" />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn variant="ghost" size="sm" onClick={() => setEditandoInfo(false)}>Cancelar</Btn>
                      <Btn size="sm" onClick={async () => { try { const r = await api("setClientInfo", { sessionCode: sc, code: sel, nombre: editNombre, codigo: editCodigo, tenant: editTenant, comerciales: editComerciales, autoimplementacion: editAutoimp, usaSandbox: editUsaSandbox, fechaIngreso: editFechaIngreso || null, razonSocial: editRazonSocial, cuits: editCuits, erpPdv: editErpPdv, logo: editLogo, goLiveEstimado: editGoLive || null, who: session.who }); setSelMeta(r.meta); setSelData(r.data); if (r.meta && r.meta.codigoNuevo) setSel(r.meta.codigoNuevo); setEditandoInfo(false); cargarListado(); flash("Datos actualizados ✓", 2000); } catch (e) { flash(e.message, 0, "error"); } }}>Guardar</Btn>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div role="tablist" aria-label="Secciones de la ficha" className="nub-tabs">
            {FICHA_TABS.map(([id, lbl]) => (
              <button key={id} type="button" role="tab" aria-selected={fTab === id} className="nub-tab" onClick={() => setFTab(id)}>
                {lbl}
                {id === "relevamiento" && alertas.length > 0 && <span className="nub-tab__n nub-tab__n--alerta">{alertas.length}</span>}
                {id === "reuniones" && (selData.eventos || []).length > 0 && <span className="nub-tab__n">{(selData.eventos || []).length}</span>}
              </button>
            ))}
          </div>

          <div className="nub-fade" key={fTab}>
          {fTab === "resumen" && (<>
          <Card style={{ marginTop: 16 }}>
            <SectionHeader
              title="Plazos y recordatorios"
              subtitle="Ponele fecha límite a los pasos que dependen del cliente. Un día antes del vencimiento se le manda un recordatorio por mail a los involucrados que cargó; si el plazo vence y el paso sigue sin completar, se manda un aviso de incumplimiento. Ambos se disparan solos con el cron diario — acá también podés forzar el envío al toque."
            />
            {avisoMsg && <Alert tone={avisoMsg === "Aviso enviado ✓" ? "success" : "error"} style={{ marginBottom: 12 }}>{avisoMsg}</Alert>}
            <div style={{ display: "grid", gap: 8 }}>
              {(selData.hitos || []).map((h) => (
                <FilaPlazo
                  key={h.id}
                  paso={h}
                  completo={!!selData.hitosCompletos?.[h.id]}
                  plazo={selData.plazos?.[h.id]}
                  onGuardar={(fecha) => guardarPlazo(h.id, fecha)}
                  onQuitar={() => quitarPlazo(h.id)}
                  onEnviarAhora={() => enviarAvisoAhora(h.id)}
                  onToggleManual={h.id === "fin_desarrollo_api" ? marcarApiCompleta : null}
                  onCumplimiento={(valor) => cambiarCumplimiento(h.id, valor)}
                />
              ))}
            </div>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 16 }}>
            <AdminPrueba etapa="sandbox" titulo={meta.usaSandbox !== false ? "Pruebas en sandbox (Fase 5)" : "Pruebas de conciliación (Fase 5)"} prueba={selData.pruebas?.sandbox} onSave={cambiarPrueba} />
            <AdminPrueba etapa="golive" titulo="Pruebas de go-live (Fase 7)" prueba={selData.pruebas?.golive} onSave={cambiarPrueba} />
          </div>
          <div style={{ marginTop: 16 }}>
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              title="💰 Información financiera"
              badge={meta.finanzas?.estadoPago === "con_deuda"
                ? <Badge tone="red">Con deuda{meta.finanzas.deudaDesde ? " desde hace " + diasDesde(meta.finanzas.deudaDesde) + " días" : ""}</Badge>
                : <Badge tone="green">Al día</Badge>}
              subtitle="Fee, costo de implementación y estado de pago — lo carga y actualiza el equipo de Finanzas."
            />
            {!editandoFinanzas ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: T.n400, textTransform: "none" }}>Fee</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.n800 }}>{meta.finanzas?.fee != null ? fmtMoneda(meta.finanzas.fee, meta.finanzas.moneda) : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: T.n400, textTransform: "none" }}>Costo de implementación</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.n800 }}>{meta.finanzas?.costoImplementacion != null ? fmtMoneda(meta.finanzas.costoImplementacion, meta.finanzas.moneda) : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: T.n400, textTransform: "none" }}>Estado de pago</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: meta.finanzas?.estadoPago === "con_deuda" ? T.errTx : T.okTx }}>
                      {meta.finanzas?.estadoPago === "con_deuda" ? "Con deuda" : "Al día"}
                      {meta.finanzas?.estadoPago === "con_deuda" && meta.finanzas.deudaDesde && <span style={{ fontSize: 12, fontWeight: 500, color: T.n400, display: "block" }}>desde {fmtDate(meta.finanzas.deudaDesde)} ({diasDesde(meta.finanzas.deudaDesde)} días)</span>}
                    </div>
                  </div>
                </div>
                {meta.finanzas?.notas && <div style={{ fontSize: 13, color: T.n600, background: T.n50, border: "1px solid " + T.n200, borderRadius: 8, padding: "10px 12px", marginBottom: 12, whiteSpace: "pre-wrap" }}>{meta.finanzas.notas}</div>}
                <span onClick={() => {
                  setFinFee(meta.finanzas?.fee ?? ""); setFinMoneda(meta.finanzas?.moneda || "ARS"); setFinCosto(meta.finanzas?.costoImplementacion ?? "");
                  setFinEstado(meta.finanzas?.estadoPago || "al_dia"); setFinDeudaDesde(meta.finanzas?.deudaDesde || ""); setFinNotas(meta.finanzas?.notas || "");
                  setEditandoFinanzas(true);
                }} style={{ fontSize: 12.5, fontWeight: 600, color: T.primary, cursor: "pointer" }}>✎ Editar datos financieros</span>
              </>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 0.6fr 1fr", gap: 10 }}>
                  <div><Label>Fee</Label><Input type="number" value={finFee} onChange={(e) => setFinFee(e.target.value)} placeholder="0" /></div>
                  <div>
                    <Label>Moneda</Label>
                    <select value={finMoneda} onChange={(e) => setFinMoneda(e.target.value)} style={{ width: "100%", height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div><Label>Costo de implementación</Label><Input type="number" value={finCosto} onChange={(e) => setFinCosto(e.target.value)} placeholder="0" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: finEstado === "con_deuda" ? "1fr 1fr" : "1fr", gap: 10 }}>
                  <div>
                    <Label>Estado de pago</Label>
                    <select value={finEstado} onChange={(e) => setFinEstado(e.target.value)} style={{ width: "100%", height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                      <option value="al_dia">Al día</option>
                      <option value="con_deuda">Con deuda</option>
                    </select>
                  </div>
                  {finEstado === "con_deuda" && (
                    <div><Label>Con deuda desde</Label><input type="date" value={finDeudaDesde} onChange={(e) => setFinDeudaDesde(e.target.value)} style={{ width: "100%", height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800 }} /></div>
                  )}
                </div>
                <div>
                  <Label>Notas de Finanzas</Label>
                  <textarea value={finNotas} onChange={(e) => setFinNotas(e.target.value)} rows={2} style={{ width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid " + T.n200, borderRadius: 6, fontSize: 14, fontFamily: "inherit", color: T.n800, resize: "vertical" }} placeholder="Ej: facturación trimestral, contacto de pagos, acuerdos especiales…" />
                </div>
                <ActionBar>
                  <Btn variant="ghost" onClick={() => setEditandoFinanzas(false)}>Cancelar</Btn>
                  <Btn onClick={guardarFinanzas}>Guardar</Btn>
                </ActionBar>
              </div>
            )}
          </Card>
          </div>
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 8px" }}>Notas internas del equipo</h3>
                {(selData.notas || []).map((n, i) => (
                  <div key={i} style={{ fontSize: 13, color: T.n800, padding: "6px 0", borderBottom: "1px solid " + T.n100 }}>
                    {n.txt}<div style={{ fontSize: 11.5, color: T.n400 }}>{n.who} · {fmtDate(n.ts)}</div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Input placeholder="Nota (el cliente no la ve)" value={nota} onChange={(e) => setNota(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarNota()} style={{ height: 36 }} />
                  <Btn size="sm" variant="secondary" onClick={agregarNota}>Guardar</Btn>
                </div>
              </Card>
          </>)}

          {fTab === "relevamiento" && (<>
          {alertas.length > 0 && (
            <Card style={{ marginBottom: 16, borderColor: "#fca5a5" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.errTx, margin: "0 0 10px" }}>⚠ Casos borde detectados en el relevamiento</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {alertas.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Badge tone={a.nivel === "alta" ? "red" : "amber"}>{a.nivel === "alta" ? "Alta" : "Media"}</Badge>
                    <div style={{ fontSize: 13.5, color: T.n800, lineHeight: 1.5 }}>{a.txt}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 16, alignItems: "start" }}>
            <Card>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 4px" }}>Relevamiento</h3>
              {selData.relevamientoEnviado
                ? <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <Badge tone="green">Enviado {fmtDate(selData.relevamientoEnviado)}</Badge>
                      <span onClick={reabrirRelevamiento} style={{ fontSize: 12, fontWeight: 600, color: T.primary, cursor: "pointer" }}>🔓 Reabrir para que lo edite el cliente</span>
                    </div>
                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                      {RV_PREGUNTAS.filter((q) => q.id && fmtRespuesta(q, selData.relevamiento)).map((q) => (
                        <div key={q.id} style={{ fontSize: 13, lineHeight: 1.45 }}>
                          <span style={{ color: T.n400 }}>{q.lbl}</span><br />
                          <b style={{ color: T.n800 }}>{fmtRespuesta(q, selData.relevamiento)}</b>
                        </div>
                      ))}
                    </div>
                  </>
                : <Badge tone="amber">Pendiente del cliente</Badge>}
            </Card>
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 8px" }}>Involucrados de la implementación</h3>
                {(selData.involucrados || []).length === 0 && <Badge tone="amber">Se completan en el relevamiento</Badge>}
                {(selData.involucrados || []).map((p) => (
                  <div key={p.id} style={{ fontSize: 13, color: T.n800, padding: "6px 0", borderBottom: "1px solid " + T.n100 }}>
                    <b>{p.nombre}</b>{p.cargo ? " · " + p.cargo : ""}{" "}
                    {p.rol === "sponsor" && <Badge tone="blue">Sponsor</Badge>}
                    {p.rol === "key_user" && <Badge tone="green">Key user</Badge>}
                    <div style={{ fontSize: 12, color: T.n400 }}>{p.email}{p.telefono ? " · " + p.telefono : ""}</div>
                  </div>
                ))}
              </Card>
          </div>
          {selData.diagrama && (
            <Card style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 4px" }}>Diagrama del proceso del cliente</h3>
              <p style={{ fontSize: 12.5, color: T.n400, margin: "0 0 10px" }}>Generado automáticamente al enviar el relevamiento — insumo para el workshop de Fase 3.</p>
              <MermaidView code={selData.diagrama} />
            </Card>
          )}
          </>)}

          {fTab === "integracion" && (<>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: 0 }}>Alta en Redmine y credenciales de API</h3>
              {selData.redmine
                ? <Badge tone={selData.redmine.status === "enviado" ? "green" : "amber"}>{selData.redmine.status === "enviado" ? "Tickets creados en Redmine" : "En cola de envío"}</Badge>
                : <Badge tone="gray">Todavía no se disparó</Badge>}
            </div>
            {meta.tenant && <div style={{ fontSize: 13, color: T.n600, marginTop: 6 }}>Tenant productivo: <b style={{ color: T.n800 }}>{meta.tenant}</b></div>}
            {!selData.redmine && (
              <div style={{ marginTop: 12 }}>
                <Btn variant="secondary" size="sm" onClick={generarAltaAhora} disabled={generandoAlta}>{generandoAlta ? "Generando…" : "Generar alta en Redmine ahora"}</Btn>
                <div style={{ fontSize: 12, color: T.n400, marginTop: 6 }}>Normalmente esto se dispara solo cuando el cliente entra por primera vez al portal — este botón lo hace ya, sin esperar a que entre.</div>
              </div>
            )}
            {selData.redmine?.featureIssueId && cfg.url && (
              <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                <a href={cfg.url.replace(/\/+$/, "") + "/issues/" + selData.redmine.featureIssueId} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: T.primary }}>Implementación #{selData.redmine.featureIssueId} →</a>
                {selData.redmine.userStoryIssueId && <a href={cfg.url.replace(/\/+$/, "") + "/issues/" + selData.redmine.userStoryIssueId} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: T.primary }}>Solicitud sandbox #{selData.redmine.userStoryIssueId} →</a>}
              </div>
            )}
            {selData.redmine && !selData.redmine.featureIssueId && (
              <Alert tone="warning" style={{ marginTop: 10 }}>
                <div style={{ marginBottom: 8 }}>Este cliente tiene un alta hecha, pero el portal no guardó el número real del ticket (pasa con altas de antes de esta actualización). Si ya existe en Redmine, pegá acá su número para vincularlo — de paso, si había quedado con el tracker por defecto, se corrige a "Implementación".</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Input value={featureIdManual} onChange={(e) => setFeatureIdManual(e.target.value)} placeholder="Ej: 20450" style={{ maxWidth: 160 }} />
                  <Btn variant="secondary" size="sm" onClick={vincularTicket} disabled={vinculando || !featureIdManual.trim()}>{vinculando ? "Vinculando…" : "Vincular"}</Btn>
                </div>
              </Alert>
            )}
            {selData.redmine && (
              <>
                {selData.redmine.detail && <div style={{ marginTop: 10, background: T.warnBg, color: T.warnTx, fontSize: 13, padding: "9px 12px", borderRadius: 8, lineHeight: 1.5 }}>{selData.redmine.detail}</div>}
                {selData.redmine.payloads?.length > 0 && (
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ fontSize: 13, fontWeight: 600, color: T.primary, cursor: "pointer" }}>Ver payload de los tickets ({selData.redmine.payloads.length})</summary>
                    {selData.redmine.payloads.map((p, i) => (
                      <div key={i} style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.n600, marginBottom: 4 }}>{p.titulo}</div>
                        <pre style={{ background: T.n50, border: "1px solid " + T.n200, borderRadius: 8, padding: 12, fontSize: 12, overflowX: "auto", margin: 0, color: T.n800 }}>{JSON.stringify(p.body, null, 2)}</pre>
                      </div>
                    ))}
                  </details>
                )}
                {selData.redmine.status !== "enviado" && (
                  <div style={{ marginTop: 12 }}>
                    <Btn variant="outline" size="sm" onClick={reenviarRedmine}>Reintentar envío a Redmine</Btn>
                  </div>
                )}
              </>
            )}
            {selData.apiCreds && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid " + T.n100 }}>
                <div style={{ fontSize: 13, color: T.n600, marginBottom: 8 }}>
                  API Key{meta.usaSandbox !== false ? " (sandbox)" : ""}: <b style={{ fontFamily: "ui-monospace, Menlo, monospace", color: T.n800 }}>{selData.apiCreds.key}</b>
                  <span style={{ color: T.n400 }}> · generada {fmtDate(selData.apiCreds.createdAt)}</span>
                </div>
                <Btn variant="ghost" size="sm" onClick={regenerarCreds}>Regenerar credenciales</Btn>
              </div>
            )}
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 16, alignItems: "start" }}>
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 8px" }}>Sucursales ({(selData.sucursales || []).length})</h3>
                {selData.sucursalesArchivo && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: T.okBg, border: "1px solid #bbe8c9", marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.okTx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selData.sucursalesArchivo.name}</div>
                      <div style={{ fontSize: 11.5, color: T.okTx, opacity: 0.8 }}>{fmtDate(selData.sucursalesArchivo.ts)}</div>
                    </div>
                    {selData.sucursalesArchivo.dataUrl && <a href={selData.sucursalesArchivo.dataUrl} download={selData.sucursalesArchivo.name} style={{ fontSize: 12.5, fontWeight: 600, color: T.okTx }}>Descargar</a>}
                  </div>
                )}
                {(selData.sucursales || []).length
                  ? (selData.sucursales || []).map((s, i) => (
                      <div key={i} style={{ fontSize: 13, color: T.n800, padding: "6px 0", borderBottom: "1px solid " + T.n100 }}>
                        <b>{s.nombre}</b>{s.direccion ? " · " + s.direccion : ""}{s.localidad ? " · " + s.localidad : ""}{s.comercio ? " · Nº " + s.comercio : ""}
                      </div>
                    ))
                  : !selData.sucursalesArchivo && <Badge tone="amber">Pendiente del cliente</Badge>}
              </Card>
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 8px" }}>CSV de ventas</h3>
                {selData.ventasArchivo ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: selData.ventasArchivo.validacion?.ok === false ? T.errBg : T.okBg, border: "1px solid " + (selData.ventasArchivo.validacion?.ok === false ? "#fca5a5" : "#bbe8c9"), marginBottom: 10 }}>
                      <span style={{ fontSize: 16 }}>📄</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: selData.ventasArchivo.validacion?.ok === false ? T.errTx : T.okTx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selData.ventasArchivo.name}</div>
                        <div style={{ fontSize: 11.5, color: selData.ventasArchivo.validacion?.ok === false ? T.errTx : T.okTx, opacity: 0.8 }}>{fmtDate(selData.ventasArchivo.ts)}</div>
                      </div>
                      {selData.ventasArchivo.dataUrl && <a href={selData.ventasArchivo.dataUrl} download={selData.ventasArchivo.name} style={{ fontSize: 12.5, fontWeight: 600, color: selData.ventasArchivo.validacion?.ok === false ? T.errTx : T.okTx }}>Descargar</a>}
                    </div>
                    {selData.ventasArchivo.validacion?.items?.map((it, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: it.tipo === "error" ? T.errTx : it.tipo === "warn" ? T.warnTx : T.n600, padding: "3px 0", lineHeight: 1.45 }}>
                        {it.tipo === "error" ? "✕ " : it.tipo === "warn" ? "! " : "· "}{it.txt}
                      </div>
                    ))}
                  </>
                ) : (
                  selData.relevamiento?.d1 === "csv"
                    ? <Badge tone="amber">Pendiente del cliente</Badge>
                    : <Badge tone="gray">No aplica (o relevamiento sin definir)</Badge>
                )}
              </Card>
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 8px" }}>Procesadoras del cliente</h3>
                {(selData.procesadoras || []).length === 0 && <Badge tone="amber">El cliente todavía no marcó sus procesadoras</Badge>}
                {(selData.procesadoras || []).map((p) => (
                  <div key={p.codigo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid " + T.n100 }}>
                    <span style={{ fontSize: 13.5, color: T.n800 }}>{p.nombre} <span style={{ color: T.n400, fontSize: 11.5 }}>({(p.pais || "").replace(/[^\p{L}\s]/gu, "").trim()})</span></span>
                    <select value={p.estado} onChange={(e) => cambiarEstadoProc(p.codigo, e.target.value)} style={{ height: 30, borderRadius: 6, border: "1px solid " + T.n200, fontSize: 12.5, fontFamily: "inherit", color: T.n800, background: "#fff", padding: "0 6px" }}>
                      <option value="no_conectado">No conectado</option>
                      <option value="en_espera">En espera de doc/credenciales</option>
                      <option value="conectado">Conectado</option>
                    </select>
                  </div>
                ))}
              </Card>
          </div>
          </>)}

          {fTab === "tickets" && (<>
          <TicketsRedmineCard sel={sel} sc={sc} session={session} tieneFeature={!!selData.redmine?.featureIssueId} />
          </>)}

          {fTab === "reuniones" && (<>
          <Card style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 10px" }}>Reuniones y eventos</h3>
            {(selData.eventos || []).length === 0 && <div style={{ fontSize: 13.5, color: T.n400 }}>Todavía no hay reuniones agendadas. El cliente agenda workshop, reunión técnica y capacitaciones desde su portal.</div>}
            <div style={{ display: "grid", gap: 12 }}>
              {(selData.eventos || []).map((e) => <AdminEvento key={e.id} e={e} onMinuta={guardarMinuta} onMeet={agregarMeetEvento} />)}
            </div>
          </Card>
          </>)}

          {fTab === "mails" && (<>
          <Card style={{ marginTop: 16 }}>
            <MailsCard
              sessionCode={sc}
              clienteId={selMeta.id}
              clienteNombre={selMeta.name}
              codigoAcceso={selMeta.codigo}
              involucradosIniciales={selData.involucrados || []}
              implementador={{ nombre: selMeta.implementadorNombre, email: selMeta.implementadorEmail }}
              desarrollador={{ nombre: selMeta.desarrolladorNombre, email: selMeta.desarrolladorEmail }}
              esAutoimp={!!selMeta.autoimplementacion}
            />
          </Card>
          </>)}

          {fTab === "historial" && (<>
          <Card style={{ marginTop: 16 }}>
            <TabHistorial history={selData.history} />
          </Card>
          </>)}
          </div>
          </div>

          <FichaResumen meta={meta} selData={selData} nombreVendedor={nombreVendedor} />
          </div>
        </div>
      </div>
    );
  }

  const clientesVisiblesBase = (clients || [])
    .filter((c) => !filtroImpl || c.implementadorId === filtroImpl)
    .filter((c) => !filtroDev || c.desarrolladorId === filtroDev)
    .filter((c) => !filtroVendedor || (c.comerciales || []).includes(filtroVendedor))
    .filter((c) => !filtroAutoimp || (filtroAutoimp === "si" ? c.autoimplementacion : !c.autoimplementacion))
    .filter((c) => !filtroMarca || (filtroMarca === "sin" ? !marcas[c.code] : marcas[c.code] === filtroMarca))
    .filter((c) => !busqueda.trim() || c.name.toLowerCase().includes(busqueda.trim().toLowerCase()) || c.code.toLowerCase().includes(busqueda.trim().toLowerCase()));
  const sinAsignar = (c) => !c.implementadorId;
  const goLiveProximo = (c) => { if (!c.goLiveEstimado) return false; const d = diasHasta(c.goLiveEstimado); return d >= 0 && d <= 30; };
  const esMio = (c) => !!session.teamId && (c.implementadorId === session.teamId || c.desarrolladorId === session.teamId);
  const clientesVisibles = clientesVisiblesBase;
  const clientesTabla = clientesVisiblesBase
    .filter((c) => filtroRapido === "sin_asignar" ? sinAsignar(c) : filtroRapido === "golive" ? goLiveProximo(c) : filtroRapido === "mios" ? esMio(c) : true)
    .slice()
    .sort((a, b) => ordenClientes === "nombre" ? a.name.localeCompare(b.name, "es")
      : ordenClientes === "fase" ? (b.phase - a.phase) || a.name.localeCompare(b.name, "es")
      : ((a.goLiveEstimado || "9999") < (b.goLiveEstimado || "9999") ? -1 : (a.goLiveEstimado || "9999") > (b.goLiveEstimado || "9999") ? 1 : a.name.localeCompare(b.name, "es")));
  const finanzasTeam = team.filter((m) => m.rol === "finanzas");

  return (
    <div>
      <Nav name="Panel del equipo" who={session.who} onLogout={onLogout} admin onMenu={() => setMenuAbierto(true)} extra={<AyudaMemoria codigo={sc} />} />
      <ChatBot codigo={sc} />
      <div style={{ display: "flex" }}>
        <Sidebar activo={modulo} onCambiar={(m) => { setModulo(m); setPanelCliente(null); }} noLeidas={notifNoLeidas} abierto={menuAbierto} onCerrar={cerrarMenu} mini={menuMini} onAlternarMini={alternarMenuMini} who={session.who} />
        <div className="nub-main" style={{ flex: 1, minWidth: 0, padding: "26px 24px 60px", maxWidth: 1180, margin: "0 auto" }}>
          <Toast toast={toastEq} className="nub-toast--equipo" />
          {modulo === "autoimp" && <PanelAutoimp codigo={sc} />}

          {/* ══════════ MÓDULO: CLIENTES ══════════ */}
          {modulo === "clientes" && (
            <>
              <PageHeader crumb="Panel del equipo" title="Clientes"
                desc={clients ? clientesVisibles.length + " clientes activos, " + clientesVisibles.filter(goLiveProximo).length + " con go-live en los próximos 30 días." : "Cargando clientes…"}
                actions={!soloLectura && !altaAbierta ? <Btn size="sm" onClick={() => { setAltaAbierta(true); if (!newImpl && implementadoresTeam.some((m) => m.id === session.teamId)) setNewImpl(session.teamId); }}>Nuevo cliente</Btn> : null} />
              {!soloLectura && altaAbierta && (
              <Card style={{ marginBottom: 16 }} >
                <SectionHeader title="Dar de alta un cliente" badge={<Btn variant="ghost" size="sm" onClick={() => setAltaAbierta(false)}>Cancelar</Btn>} />
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.2fr", gap: 10, marginBottom: 10 }}>
                  <div><Label>Nombre del cliente <span style={{ color: "#dc2626" }}>*</span></Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Freddo" /></div>
                  <div><Label>Código de acceso <span style={{ color: "#dc2626" }}>*</span></Label><Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Ej: FREDDO26" /></div>
                  <div><Label>Tenant productivo</Label><Input value={newTenant} onChange={(e) => setNewTenant(e.target.value)} placeholder="Ej: freddo-prod" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div><Label>Razón social</Label><Input value={newRazonSocial} onChange={(e) => setNewRazonSocial(e.target.value)} placeholder="Ej: Freddo S.A." /></div>
                  <div>
                    <Label>CUIT(s)</Label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Input value={newCuitInput} onChange={(e) => setNewCuitInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newCuitInput.trim()) { setNewCuits([...newCuits, newCuitInput.trim()]); setNewCuitInput(""); } } }}
                        placeholder="Enter para agregar" />
                      <Btn variant="secondary" size="sm" onClick={() => { if (newCuitInput.trim()) { setNewCuits([...newCuits, newCuitInput.trim()]); setNewCuitInput(""); } }}>+</Btn>
                    </div>
                    {newCuits.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {newCuits.map((c, i) => (
                          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: T.primary50, color: T.primary800, border: "1px solid " + T.primary100, borderRadius: 100, padding: "4px 10px" }}>
                            {c} <span onClick={() => setNewCuits(newCuits.filter((_, idx) => idx !== i))} style={{ cursor: "pointer" }}>✕</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14, alignItems: "start" }}>
                  <div><Label>Vendedor/es</Label><SelectorVendedores vendedores={vendedoresTeam} seleccion={newComerciales} onChange={setNewComerciales} /></div>
                  <div><Label>Implementador/a</Label><SelectorMiembro valor={newImpl} opciones={implementadoresTeam} onChange={setNewImpl} etiqueta="Implementador/a" /></div>
                  <div><Label>Desarrollador/a</Label><SelectorMiembro valor={newDev} opciones={devsTeam} onChange={setNewDev} etiqueta="Desarrollador/a" /></div>
                  <div>
                    <Label>Tipo de onboarding</Label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn variant={!newAutoimp ? "primary" : "secondary"} size="sm" onClick={() => setNewAutoimp(false)} style={{ flex: 1 }}>Estándar</Btn>
                      <Btn variant={newAutoimp ? "primary" : "secondary"} size="sm" onClick={() => setNewAutoimp(true)} style={{ flex: 1 }}>Autoimplementación</Btn>
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <Label>¿Usa ambiente de pruebas (sandbox)?</Label>
                  <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
                    <Btn variant={newUsaSandbox ? "primary" : "secondary"} size="sm" onClick={() => setNewUsaSandbox(true)} style={{ flex: 1 }}>Sí, con sandbox</Btn>
                    <Btn variant={!newUsaSandbox ? "primary" : "secondary"} size="sm" onClick={() => setNewUsaSandbox(false)} style={{ flex: 1 }}>No, directo en productivo</Btn>
                  </div>
                  <div style={{ fontSize: 12.5, color: T.n600, marginTop: 6, lineHeight: 1.5 }}>
                    {newUsaSandbox
                      ? "Se pide el tenant sandbox en Redmine y el cliente ve el paso de pruebas con sus datos."
                      : "No se pide tenant sandbox y el cliente no ve el paso de pruebas: pasa de la capacitación al go-live."}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <Label>ERP / PDV (opcional)</Label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Input value={newErpPdvInput} onChange={(e) => setNewErpPdvInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newErpPdvInput.trim()) { setNewErpPdv([...newErpPdv, newErpPdvInput.trim()]); setNewErpPdvInput(""); } } }}
                      placeholder="Ej: Zetti, SAP, Tango — Enter para agregar" />
                    <Btn variant="secondary" size="sm" onClick={() => { if (newErpPdvInput.trim()) { setNewErpPdv([...newErpPdv, newErpPdvInput.trim()]); setNewErpPdvInput(""); } }}>+</Btn>
                  </div>
                  {newErpPdv.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {newErpPdv.map((x, i) => (
                        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: T.primary50, color: T.primary800, border: "1px solid " + T.primary100, borderRadius: 100, padding: "4px 10px" }}>
                          {x} <span onClick={() => setNewErpPdv(newErpPdv.filter((_, idx) => idx !== i))} style={{ cursor: "pointer" }}>✕</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <Label>Fecha estimada de go-live (opcional)</Label>
                    <Input type="date" value={newGoLive} onChange={(e) => setNewGoLive(e.target.value)} />
                  </div>
                  <div>
                    <Label>Fecha de ingreso (trato ganado, opcional)</Label>
                    <Input type="date" value={newFechaIngreso} onChange={(e) => setNewFechaIngreso(e.target.value)} />
                    <div style={{ fontSize: 11.5, color: T.n400, marginTop: 4, lineHeight: 1.4 }}>
                      Es la que se acuerda con el cliente en la reunión de vinculación (típicamente ~2 meses después del alta). Con ella el tablero muestra un semáforo y prioriza los clientes por proximidad.
                    </div>
                  </div>
                </div>

                <Label>Contactos (sponsor, key user, desarrollador del cliente, etc.)</Label>
                <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                  {newContactos.map((c, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr 1.2fr 0.9fr auto", gap: 6 }}>
                      <select value={c.rol} onChange={(e) => setNewContactos(newContactos.map((x, j) => j === i ? { ...x, rol: e.target.value } : x))}
                        style={{ height: 38, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 8px", fontSize: 13, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                        {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <Input placeholder="Nombre" value={c.nombre} onChange={(e) => setNewContactos(newContactos.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} style={{ height: 38 }} />
                      <Input placeholder="Mail" value={c.email} onChange={(e) => setNewContactos(newContactos.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} style={{ height: 38 }} />
                      <Input placeholder="Celular (opcional)" value={c.telefono} onChange={(e) => setNewContactos(newContactos.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x))} style={{ height: 38 }} />
                      <Btn variant="ghost" size="sm" onClick={() => setNewContactos(newContactos.filter((_, j) => j !== i))} style={{ padding: "6px 10px" }}>✕</Btn>
                    </div>
                  ))}
                </div>
                <Btn variant="secondary" size="sm" onClick={() => setNewContactos([...newContactos, { nombre: "", cargo: "", email: "", telefono: "", rol: "sponsor" }])} style={{ marginBottom: 14 }}>+ Agregar contacto</Btn>

                <ActionBar>
                  <ImageUpload value={newLogo} onChange={setNewLogo} label="logo del cliente" />
                  <Btn onClick={crearCliente}>Crear</Btn>
                </ActionBar>
                <div style={{ marginTop: 12, fontSize: 12.5, color: T.n400, lineHeight: 1.5 }}>
                  Al primer login del cliente, el portal dispara el alta en Redmine (Implementación del cliente con su tenant original + Solicitud de tenant sandbox) y genera sus credenciales de API sandbox.
                </div>
              </Card>
              )}

              <Card>
                <SectionHeader title={"Clientes en implementación" + (clients ? " (" + clientesVisibles.length + " de " + clients.length + ")" : "")} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o código…" style={{ maxWidth: 240 }} />
                  <select value={filtroImpl} onChange={(e) => setFiltroImpl(e.target.value)} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                    <option value="">Todos los implementadores</option>
                    {implementadoresTeam.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                  <select value={filtroDev} onChange={(e) => setFiltroDev(e.target.value)} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                    <option value="">Todos los desarrolladores</option>
                    {devsTeam.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                  <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                    <option value="">Todos los vendedores</option>
                    {vendedoresTeam.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                  <select value={filtroAutoimp} onChange={(e) => setFiltroAutoimp(e.target.value)} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                    <option value="">Todo onboarding</option>
                    <option value="si">🚀 Autoimplementación</option>
                    <option value="no">Implementación estándar</option>
                  </select>
                  <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                    <option value="">Todas mis marcas</option>
                    <option value="naranja">🟠 Tengo algo pendiente</option>
                    <option value="rojo">🔴 Trabado o con problema</option>
                    <option value="sin">Sin marca</option>
                  </select>
                  {(busqueda || filtroImpl || filtroDev || filtroVendedor || filtroMarca || filtroAutoimp) && <Btn variant="ghost" size="sm" onClick={() => { setBusqueda(""); setFiltroImpl(""); setFiltroDev(""); setFiltroVendedor(""); setFiltroMarca(""); setFiltroAutoimp(""); }}>Limpiar filtros</Btn>}
                </div>

                {clients && clients.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
                    {[
                      ["Clientes", clientesVisibles.length],
                      ["Sin asignar", clientesVisibles.filter((c) => !c.implementadorId).length],
                      ["Avance promedio", clientesVisibles.length ? Math.round(clientesVisibles.reduce((a, c) => a + c.completados / c.totalPasos, 0) / clientesVisibles.length * 100) + "%" : "—"],
                      ["Con deuda", clientesVisibles.filter((c) => c.estadoPago === "con_deuda").length],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ background: T.primary50, border: "1px solid " + T.primary100, borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: T.primary800 }}>{val}</div>
                        <div style={{ fontSize: 12, color: T.primary800, opacity: 0.75 }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                )}

                {!clients && (
                  <div role="status" aria-label="Cargando clientes" style={{ display: "grid", gap: 10 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} style={{ background: "#fff", border: "1px solid " + T.cardBorder, borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                        <Skeleton w={36} h={36} r={100} />
                        <div style={{ flex: 1, display: "grid", gap: 8 }}>
                          <Skeleton w="40%" h={13} />
                          <Skeleton w="65%" h={10} />
                        </div>
                        <Skeleton w={80} h={20} r={6} />
                      </div>
                    ))}
                  </div>
                )}
                {clients && clients.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    <div className="nub-chips" role="group" aria-label="Filtros rápidos">
                      {[["", "Todos", clientesVisibles.length], ["golive", "Go-live en 30 días", clientesVisibles.filter(goLiveProximo).length], ["sin_asignar", "Sin asignar", clientesVisibles.filter(sinAsignar).length]].concat(session.teamId ? [["mios", "Mis clientes", clientesVisibles.filter(esMio).length]] : []).map(([id, lbl, n]) => (
                        <button key={id || "todos"} type="button" aria-pressed={filtroRapido === id} className={"nub-chip" + (id === "sin_asignar" ? " nub-chip--alerta" : "")} onClick={() => setFiltroRapido(id)}>
                          {lbl} <span className="nub-chip__n">{n}</span>
                        </button>
                      ))}
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.n600 }}>
                      Ordenar por
                      <select value={ordenClientes} onChange={(e) => setOrdenClientes(e.target.value)} style={{ height: 34, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 8px", fontSize: 13, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                        <option value="golive">Go-live más cercano</option>
                        <option value="fase">Fase más avanzada</option>
                        <option value="nombre">Nombre</option>
                      </select>
                    </label>
                  </div>
                )}
                {clients && clientesTabla.length === 0 && (
                  <EstadoVacio titulo={clientesVisibles.length === 0 ? "Ningún cliente coincide con la búsqueda" : "No hay clientes con este filtro"}
                    accion={<Btn variant="ghost" size="sm" onClick={() => { setFiltroRapido(""); setBusqueda(""); setFiltroImpl(""); setFiltroDev(""); setFiltroVendedor(""); setFiltroMarca(""); setFiltroAutoimp(""); }}>Ver todos los clientes</Btn>}>
                    {filtroRapido === "sin_asignar" ? "Todos los clientes tienen implementador/a asignado." : "Probá con otro nombre o sacá los filtros."}
                  </EstadoVacio>
                )}
                {clients && clientesTabla.length > 0 && (
                <div className="nub-tabla-wrap">
                  <table className="nub-tabla">
                    <thead>
                      <tr>
                        <th style={{ width: 22 }}><span className="nub-sr">Marca</span></th>
                        <th>Cliente</th>
                        <th>Fase</th>
                        <th>Avance</th>
                        <th aria-sort={ordenClientes === "golive" ? "ascending" : "none"}>
                          <button type="button" className="nub-th-btn" onClick={() => setOrdenClientes("golive")}>Go-live <Icon n="sort" size={12} /></button>
                        </th>
                        <th>Implementador/a</th>
                        <th>Desarrollador/a</th>
                        <th>Estado</th>
                        <th><span className="nub-sr">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                  {clientesTabla.map((cli) => {
                    const alertas = detectarAlertas(cli.relevamiento);
                    const pendRv = !cli.relevamientoEnviado;
                    const pct = Math.round((cli.completados / cli.totalPasos) * 100);
                    const sg = semaforoGoLive(cli.goLiveEstimado);
                    const dotGl = !sg ? T.n200 : sg.tone === "red" ? "#ef4444" : sg.tone === "amber" ? "#f59e0b" : "#22c55e";
                    return (
                      <tr key={cli.code} onClick={() => abrir(cli.code)} className="nub-tabla__fila">
                        <td onClick={(e) => e.stopPropagation()}>
                          {session.teamId && cli.implementadorId === session.teamId
                            ? <MarcaPunto color={marcas[cli.code]} onClick={() => ciclar(cli.code)} />
                            : <span style={{ width: 13, display: "inline-block" }} />}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <span className="nub-logo">{cli.logo ? <img src={cli.logo} alt="" /> : cli.name.slice(0, 1).toUpperCase()}</span>
                            <div style={{ minWidth: 0 }}>
                              <button type="button" className="nub-link-fila" style={{ whiteSpace: "nowrap" }} onClick={(e) => { e.stopPropagation(); abrir(cli.code); }}>{cli.name}</button>
                              <div style={{ fontSize: 11.5, color: T.n400 }}>{cli.code}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="nub-ph9" aria-hidden="true">{FASES.map((_, i) => <i key={i} className={i < cli.phase ? "d" : i === cli.phase ? "c" : ""} />)}</div>
                          <div style={{ fontSize: 12, color: T.n600, whiteSpace: "nowrap" }}>{FASES[cli.phase]}</div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 70, height: 5, borderRadius: 100, background: T.n100, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: pct === 100 ? "#22c55e" : T.primary }} /></div>
                            <span style={{ fontSize: 12, color: T.n600 }}>{cli.completados}/{cli.totalPasos}</span>
                          </div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.n800 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotGl }} />
                            {cli.goLiveEstimado ? fmtCorta(cli.goLiveEstimado) : "Sin fecha"}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {soloLectura
                            ? (cli.implementadorNombre || <Badge tone="amber">Sin asignar</Badge>)
                            : <SelectorMiembro compacto valor={cli.implementadorId} opciones={implementadoresTeam} onChange={(v) => asignar(cli.code, v, "implementador")} etiqueta={"Implementador/a de " + cli.name} />}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {soloLectura
                            ? (cli.desarrolladorNombre || <span style={{ color: T.n400 }}>Sin asignar</span>)
                            : <SelectorMiembro compacto valor={cli.desarrolladorId} opciones={devsTeam} onChange={(v) => asignar(cli.code, v, "desarrollador")} etiqueta={"Desarrollador/a de " + cli.name} />}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 220 }}>
                            {cli.estadoPago === "con_deuda" && <Badge tone="red">Deuda</Badge>}
                            {alertas.length > 0 && <Badge tone="red">{alertas.length} alerta{alertas.length > 1 ? "s" : ""}</Badge>}
                            {pendRv && <Badge tone="amber">Relevamiento pendiente</Badge>}
                            {cli.omitioSucursales && <Badge tone="amber">Sucursales pendiente</Badge>}
                            {cli.autoimplementacion && <span className="nub-info"><Icon n="rocket" size={12} /> Autoimpl.</span>}
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                          {session.tipoUsuario === "superuser" && <button type="button" className="nub-fila-accion" onClick={() => archivarCliente(cli.code, cli.name)} title="Archivar cliente (se puede restaurar)">Archivar</button>}
                        </td>
                      </tr>
                    );
                  })}
                    </tbody>
                  </table>
                </div>
                )}
              </Card>
            </>
          )}

          {/* ══════════ MÓDULO: TABLERO ══════════ */}
          {modulo === "tablero" && (
            <div ref={tableroRef} style={{ background: tableroFull ? "#fff" : "transparent", padding: tableroFull ? 20 : 0, height: tableroFull ? "100vh" : "auto", overflowY: tableroFull ? "auto" : "visible" }}>
              <PageHeader crumb={tableroFull ? null : "Panel del equipo"} title="Tablero"
                desc={(clients ? clientesVisibles.length + " de " + clients.length + " clientes. " : "") + "La fase avanza sola con los pasos; arrastrá una tarjeta para cambiarla a mano."}
                actions={<Btn variant="ghost" size="sm" onClick={toggleFullscreen}>{tableroFull ? "Salir de pantalla completa" : "Pantalla completa"}</Btn>} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o código…" style={{ maxWidth: 240 }} />
                <select value={filtroImpl} onChange={(e) => setFiltroImpl(e.target.value)} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                  <option value="">Todos los implementadores</option>
                  {implementadoresTeam.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                  <option value="">Todos los vendedores</option>
                  {vendedoresTeam.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <select value={filtroAutoimp} onChange={(e) => setFiltroAutoimp(e.target.value)} style={{ height: 40, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                  <option value="">Todo onboarding</option>
                  <option value="si">🚀 Autoimplementación</option>
                  <option value="no">Implementación estándar</option>
                </select>
                {(busqueda || filtroImpl || filtroVendedor || filtroAutoimp) && <Btn variant="ghost" size="sm" onClick={() => { setBusqueda(""); setFiltroImpl(""); setFiltroVendedor(""); setFiltroAutoimp(""); }}>Limpiar filtros</Btn>}
              </div>
              <KanbanBoard clientes={clientesVisibles} onAbrir={abrirPanelKanban} onMoverFase={(code, fase) => cambiarFase(code, fase)} onCambiarColor={cambiarColor} onEnviarAvisos={enviarAvisosPendientes} enviandoAvisosDe={enviandoAvisosDe} />
        {/* Panel lateral rápido del tablero: se abre al hacer clic en una tarjeta */}
        {panelCliente && (
          <div className="nub-overlay" onClick={() => setPanelCliente(null)} style={{ position: "fixed", inset: 0, background: "rgba(13,17,32,0.4)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
            <div className="nub-panel-in" role="dialog" aria-label="Resumen del cliente" onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: "92vw", height: "100%", background: "#fff", padding: 24, overflowY: "auto", boxShadow: "-8px 0 24px rgba(13,17,32,0.18)" }}>
              {!panelData ? (
                <div role="status" aria-label="Cargando cliente">
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 22 }}>
                    <Skeleton w={44} h={44} r={100} />
                    <div style={{ flex: 1, display: "grid", gap: 8 }}><Skeleton w="70%" h={15} /><Skeleton w="40%" h={10} /></div>
                  </div>
                  <SkeletonLineas lineas={5} />
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10, background: T.n50, border: "1px solid " + T.n200, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: T.n400 }}>
                        {panelData.meta.logo ? <img src={panelData.meta.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : panelData.meta.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: T.n900 }}>{panelData.meta.name}</div>
                        <div style={{ fontSize: 12, color: T.n400 }}>{panelCliente}</div>
                      </div>
                    </div>
                    <span onClick={() => setPanelCliente(null)} style={{ cursor: "pointer", fontSize: 18, color: T.n400 }}>✕</span>
                  </div>

                  <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
                    {[
                      ["Vendedor/es", (panelData.meta.comerciales || []).length ? panelData.meta.comerciales.map(nombreVendedor).join(", ") : "—"],
                      ["Tenant", panelData.meta.tenant || "—"],
                      ["Implementador/a", panelData.meta.implementadorNombre || "Sin asignar"],
                      ["Desarrollador/a", panelData.meta.desarrolladorNombre || "Sin asignar"],
                    ].map(([lbl, val]) => (
                      <div key={lbl}>
                        <div style={{ fontSize: 11, color: T.n400, textTransform: "none" }}>{lbl}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.n800 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid " + T.n100, paddingTop: 14, marginBottom: 18 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.n600, marginBottom: 8 }}>💰 Facturación</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: T.n400, textTransform: "none" }}>Fee</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.n800 }}>{panelData.meta.finanzas?.fee != null ? fmtMoneda(panelData.meta.finanzas.fee, panelData.meta.finanzas.moneda) : "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: T.n400, textTransform: "none" }}>Estado</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: panelData.meta.finanzas?.estadoPago === "con_deuda" ? T.errTx : T.okTx }}>
                          {panelData.meta.finanzas?.estadoPago === "con_deuda" ? "Con deuda" : "Al día"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Btn onClick={() => { if (document.fullscreenElement) document.exitFullscreen?.(); setTableroFull(false); setPanelCliente(null); abrir(panelCliente); }} style={{ width: "100%" }}>Ver ficha completa →</Btn>
                </>
              )}
            </div>
          </div>
        )}
            </div>
          )}

          {/* ══════════ MÓDULO: NOTIFICACIONES ══════════ */}
          {modulo === "notificaciones" && (
            <>
              <PageHeader crumb="Panel del equipo" title="Notificaciones"
                desc={notifNoLeidas > 0 ? "Tenés " + notifNoLeidas + " sin leer. Te avisamos cuando un cliente completa un paso." : "Te avisamos acá cuando un cliente completa un paso de la implementación."}
                actions={<><Btn variant="ghost" size="sm" onClick={cargarNotificaciones}>Actualizar</Btn>{notifNoLeidas > 0 && <Btn size="sm" onClick={marcarTodasNotifLeidas}>Marcar todas como leídas</Btn>}</>} />
              <div role="tablist" aria-label="Filtrar notificaciones" style={{ display: "inline-flex", gap: 4, padding: 4, background: T.n100, borderRadius: 10, marginBottom: 16 }}>
                {[["todas", "Todas", notifs.length], ["sin_leer", "Sin leer", notifNoLeidas]].map(([id, lbl, cant]) => (
                  <button key={id} type="button" role="tab" aria-selected={filtroNotif === id} onClick={() => setFiltroNotif(id)} style={{
                    border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: filtroNotif === id ? 700 : 500,
                    padding: "7px 14px", borderRadius: 7, background: filtroNotif === id ? "#fff" : "transparent",
                    color: filtroNotif === id ? T.n900 : T.n600, boxShadow: filtroNotif === id ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                  }}>
                    {lbl} <span style={{ color: T.n400, fontWeight: 600 }}>{cant}</span>
                  </button>
                ))}
              </div>
              {(() => {
                const lista = filtroNotif === "sin_leer" ? notifs.filter((n) => !n.leida) : notifs;
                if (notifs.length === 0) {
                  return <Card><div style={{ color: T.n600, fontSize: 14, textAlign: "center", padding: 20 }}>Todavía no hay notificaciones. Te avisamos acá cuando un cliente complete un paso.</div></Card>;
                }
                if (lista.length === 0) {
                  return (
                    <Card>
                      <div style={{ color: T.n600, fontSize: 14, textAlign: "center", padding: 16, display: "grid", gap: 12, justifyItems: "center" }}>
                        Estás al día: no quedan notificaciones sin leer.
                        <Btn variant="ghost" size="sm" onClick={() => setFiltroNotif("todas")}>Ver todas</Btn>
                      </div>
                    </Card>
                  );
                }
                // Agrupamos por día para leer rápido qué pasó hoy y qué es más viejo.
                const grupos = [];
                lista.forEach((n) => {
                  const g = grupoDia(n.creadoAt);
                  const ult = grupos[grupos.length - 1];
                  if (ult && ult.titulo === g) ult.items.push(n); else grupos.push({ titulo: g, items: [n] });
                });
                return grupos.map((g) => (
                  <section key={g.titulo} style={{ marginBottom: 18 }}>
                    <h3 style={{ fontSize: 12.5, fontWeight: 700, color: T.n600, margin: "0 0 8px" }}>{g.titulo}</h3>
                    <div style={{ display: "grid", gap: 8 }}>
                      {g.items.map((n) => (
                        <Card key={n.id} style={{ padding: "14px 16px", background: "#fff", borderColor: n.leida ? T.n200 : T.primary100, boxShadow: n.leida ? "none" : "inset 3px 0 0 " + T.primary }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, flex: "1 1 280px" }}>
                              <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: n.leida ? T.n100 : T.primary50, color: n.leida ? T.n400 : T.primary }}>
                                <Icon n="bell" size={16} />
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, color: T.n900, fontWeight: n.leida ? 500 : 700, lineHeight: 1.45 }}>{n.texto}</div>
                                <div style={{ fontSize: 12, color: T.n400, marginTop: 3 }}>
                                  {n.code ? n.code + " · " : ""}<time dateTime={n.creadoAt} title={fmtDate(n.creadoAt)}>{haceCuanto(n.creadoAt)}</time>{!n.leida && <span style={{ color: T.primary, fontWeight: 600 }}> · Sin leer</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                              {n.code && <Btn variant="ghost" size="sm" onClick={() => { if (!n.leida) marcarNotifLeida(n.id); setModulo("clientes"); abrir(n.code); }}>Ver cliente</Btn>}
                              {!n.leida && <Btn variant="ghost" size="sm" onClick={() => marcarNotifLeida(n.id)}>Marcar leída</Btn>}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </section>
                ));
              })()}
            </>
          )}

          {/* ══════════ MÓDULO: EQUIPO ══════════ */}
          {modulo === "equipo" && (
            <>
              <PageHeader crumb="Panel del equipo" title="Equipo" desc="Quién está en cada área y qué puede hacer en el portal." />
              <Card style={{ marginBottom: 16 }}>
                <SectionHeader title="Equipo de Implementación" />
                <EquipoLista miembros={implementadoresTeam} esSuperuser={session.tipoUsuario === "superuser"} onEliminar={eliminarMiembro} onSetTipoUsuario={setTipoUsuario} miCodigo={sc} />
              </Card>
              <Card style={{ marginBottom: 16 }}>
                <SectionHeader title="Equipo de Desarrollo" />
                <EquipoLista miembros={devsTeam} esSuperuser={session.tipoUsuario === "superuser"} onEliminar={eliminarMiembro} onSetTipoUsuario={setTipoUsuario} miCodigo={sc} />
              </Card>
              <Card style={{ marginBottom: 16 }}>
                <SectionHeader title="Equipo de Finanzas" />
                <EquipoLista miembros={finanzasTeam} esSuperuser={session.tipoUsuario === "superuser"} onEliminar={eliminarMiembro} onSetTipoUsuario={setTipoUsuario} miCodigo={sc} />
              </Card>
              <Card style={{ marginBottom: 16 }}>
                <SectionHeader title="Equipo de Ventas" />
                {vendedoresTeam.length === 0 && <div style={{ fontSize: 13, color: T.n400 }}>Todavía no hay nadie en este equipo.</div>}
                <EquipoLista miembros={vendedoresTeam} esSuperuser={session.tipoUsuario === "superuser"} onEliminar={eliminarMiembro} onSetTipoUsuario={setTipoUsuario} miCodigo={sc} />
              </Card>

              <Card>
                <SectionHeader title="Agregar persona al equipo" subtitle="Cada persona entra con su propio código. El «Rol» describe qué hace en el equipo (informativo). El «Tipo de usuario» decide qué puede hacer en el portal: Superuser (todo, incluye eliminar y archivar), Admin (crea clientes y usuarios, no elimina), Colaborador (ve y trabaja, no crea). Solo un Superuser puede cambiar el tipo de usuario de los demás." />
                <div style={{ display: "grid", gridTemplateColumns: session.tipoUsuario === "superuser" ? "1.2fr 1fr 1.2fr 0.8fr 0.9fr" : "1.2fr 1fr 1.2fr 0.8fr", gap: 10, marginBottom: 10 }}>
                  <div><Label>Nombre</Label><Input value={newImplName} onChange={(e) => setNewImplName(e.target.value)} placeholder="Ej: Fernanda" /></div>
                  <div><Label>Código de acceso</Label><Input value={newImplCode} onChange={(e) => setNewImplCode(e.target.value)} placeholder="Ej: FER-IMPL" /></div>
                  <div><Label>Mail (para que el cliente lo contacte)</Label><Input value={newImplEmail} onChange={(e) => setNewImplEmail(e.target.value)} placeholder="Ej: fernanda@nubceo.com" /></div>
                  <div>
                    <Label>Rol</Label>
                    <select value={newImplRol} onChange={(e) => { const v = e.target.value; setNewImplRol(v); if (v === "ventas") setNewImplTipo("comercial"); }} style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                      <option value="implementador">Implementador/a</option>
                      <option value="desarrollador">Desarrollador/a</option>
                      <option value="finanzas">Finanzas</option>
                      <option value="ventas">Ventas (vendedor)</option>
                    </select>
                    {newImplRol === "ventas" && <div style={{ fontSize: 11.5, color: T.n400, marginTop: 4 }}>Se crea como Comercial: ve todo, no edita nada.</div>}
                  </div>
                  {session.tipoUsuario === "superuser" && (
                    <div>
                      <Label>Tipo de usuario</Label>
                      <select value={newImplTipo} onChange={(e) => setNewImplTipo(e.target.value)} style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                        <option value="colaborador">Colaborador</option>
                        <option value="comercial">Comercial (solo lectura)</option>
                        <option value="admin">Admin</option>
                        <option value="superuser">Superuser</option>
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <ImageUpload value={newImplFoto} onChange={setNewImplFoto} label="foto" round />
                  <Btn variant="secondary" onClick={crearImplementador}>Crear</Btn>
                </div>
              </Card>

              {/* ── Sección oculta y colapsable: Clientes archivados (solo Superuser) ── */}
              {session.tipoUsuario === "superuser" && (
                <Card style={{ marginTop: 16 }}>
                  <div onClick={() => { const nuevo = !mostrarArchivados; setMostrarArchivados(nuevo); if (nuevo) cargarArchivados(); }} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n800, margin: 0 }}>📦 Clientes archivados</h3>
                      <div style={{ fontSize: 12, color: T.n400, marginTop: 2 }}>Solo visible para Superuser · Los datos se conservan y se pueden restaurar en cualquier momento.</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.primary }}>{mostrarArchivados ? "Ocultar ▲" : "Ver ▼"}</span>
                  </div>
                  {mostrarArchivados && (
                    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                      {archivados.length === 0 && <div style={{ fontSize: 13, color: T.n400 }}>Sin clientes archivados.</div>}
                      {archivados.map((c) => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid " + T.n200, background: T.n50 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: T.n800 }}>{c.nombre}</div>
                            <div style={{ fontSize: 12, color: T.n400 }}>Código {c.codigo} · Archivado el {fmtDate(c.archivado_at)}</div>
                          </div>
                          <Btn variant="ghost" size="sm" onClick={() => restaurarCliente(c.codigo, c.nombre)}>↩ Restaurar</Btn>
                          {session.tipoUsuario === "superuser" && (
                            <Btn variant="ghost" size="sm" style={{ color: "#b91c1c" }} onClick={() => eliminarCliente(c.codigo, c.nombre)}>🗑 Eliminar</Btn>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </>
          )}

          {/* ══════════ MÓDULO: CONFIGURACIÓN ══════════ */}
          {modulo === "config" && <PageHeader crumb="Panel del equipo" title="Configuración" desc="Integraciones, avisos automáticos y datos compartidos por todo el equipo." />}
          {modulo === "config" && (
            <>
              <Card style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 4px" }}>Integración con Redmine</h2>
                <p style={{ fontSize: 13, color: T.n600, margin: "0 0 12px", lineHeight: 1.5 }}>
                  El servidor crea los tickets directo en Redmine al primer login de cada cliente. Si el envío falla, quedan en cola con el payload exacto en el detalle del cliente, con reintento a un click. La API key vive en la variable de entorno <b>REDMINE_API_KEY</b> del servidor — nunca pasa por el navegador.
                </p>
                <div style={{ marginBottom: 10 }}>
                  {apiKeyEnEnv
                    ? <Badge tone="green">API key configurada en el servidor ✓</Badge>
                    : <Badge tone="amber">Falta REDMINE_API_KEY en las variables de entorno — los tickets quedan en cola</Badge>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div><Label>URL de Redmine</Label><Input value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} placeholder="https://redmine.nubceo.com" /></div>
                  <div><Label>ID de proyecto</Label><Input value={cfg.projectId} onChange={(e) => setCfg({ ...cfg, projectId: e.target.value })} placeholder="nubceo-implementaciones" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                  <div>
                    <Label>Ticket padre por defecto (opcional)</Label>
                    <Input value={cfg.parentIssueId || ""} onChange={(e) => setCfg({ ...cfg, parentIssueId: e.target.value })} placeholder="Ej: 20450" />
                    <div style={{ fontSize: 11.5, color: T.n400, marginTop: 4 }}>
                      Número del ticket que va a quedar como "tarea padre" de las Solicitudes de alta. La Implementación nunca lleva padre (es la raíz en Redmine), así que normalmente esto queda vacío.
                    </div>
                  </div>
                  <Btn variant="secondary" onClick={guardarConfig}>Guardar</Btn>
                </div>
                {cfgMsg && <div style={{ marginTop: 10, fontSize: 13, color: T.okTx, fontWeight: 600 }}>{cfgMsg}</div>}
              </Card>

              <Card>
                <SectionHeader
                  title="Mails automáticos de plazos"
                  subtitle="El cron diario (10:00 AR) manda solo el recordatorio y el aviso de incumplimiento cuando corresponde. Mientras lo estás probando, dejalo apagado y usá el botón ✉️ de la tarjeta de cada cliente (en el tablero) o 'Enviar aviso ahora' en Plazos y recordatorios para mandarlos vos, a demanda."
                />
                <div onClick={() => toggleAvisosAutomaticos(!avisosAutomaticos)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <span style={{
                    width: 40, height: 22, borderRadius: 100, background: avisosAutomaticos ? T.primary : T.n200, position: "relative", transition: "background .15s", flexShrink: 0,
                  }}>
                    <span style={{ position: "absolute", top: 2, left: avisosAutomaticos ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.n800 }}>{avisosAutomaticos ? "Prendido — el cron manda los mails solo, todos los días" : "Apagado — no se manda nada solo, todo es manual"}</span>
                </div>
              </Card>
            </>
          )}

          {/* ══════════ MÓDULO: MI PERFIL ══════════ */}
          {modulo === "perfil" && <PageHeader crumb="Panel del equipo" title="Mi perfil" desc="Tus datos, tu disponibilidad para reuniones y tus credenciales personales." />}
          {modulo === "perfil" && (
            !session.teamId ? (
              <Card>
                <SectionHeader title="Mi perfil" subtitle="Estás conectada con el código maestro del equipo, que no tiene un perfil propio (foto, mail, calendario). Creá tu usuario personal desde el módulo Equipo para tener todo eso, y de paso queda tu nombre en el historial de cada acción en vez de 'Equipo Nubceo'." />
              </Card>
            ) : (
              <Card>
                <SectionHeader title="Mi perfil" subtitle="Tu mail es el que ven tus clientes para contactarte, y tu foto aparece en el equipo." />
                <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid " + T.n100 }}>
                  <ImageUpload value={miFoto} onChange={(v) => { setMiFoto(v); guardarMiPerfil({ foto: v }); }} label="mi foto" round />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Label>Mi nombre</Label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Input value={miNombre} onChange={(e) => setMiNombre(e.target.value)} />
                      <Btn variant="secondary" size="sm" onClick={() => guardarMiPerfil({ nombre: miNombre })}>Guardar</Btn>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <Label>Mi mail de contacto</Label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Input value={miEmail} onChange={(e) => setMiEmail(e.target.value)} placeholder="vos@nubceo.com" />
                      <Btn variant="secondary" size="sm" onClick={() => guardarMiPerfil({ email: miEmail })}>Guardar</Btn>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid " + T.n100 }}>
                  <SectionHeader title="Configuraciones" subtitle="Vinculá tus cuentas personales — todo acá es 100% tuyo, nadie más lo ve ni lo puede tocar." style={{ marginBottom: 12 }} />
                  {calMsg && <Alert tone={calMsg.startsWith("No") || calMsg.startsWith("Esa") || calMsg.startsWith("Google") ? "warning" : "success"} style={{ marginBottom: 10 }}>{calMsg}</Alert>}
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 10, border: "1px solid " + T.n200 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.n800 }}>📅 Mi Google Calendar</div>
                        <div style={{ fontSize: 12, color: T.n400 }}>{calStatus?.conectado ? "Conectado — " + calStatus.conectado.google_email : "No conectado"}</div>
                      </div>
                      {calStatus?.conectado
                        ? <Btn variant="ghost" size="sm" onClick={desconectarCalendario}>Desconectar</Btn>
                        : <Btn variant="secondary" size="sm" onClick={conectarCalendario}>Conectar</Btn>}
                    </div>

                    <div style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + T.n200 }}>
                      <Label>🗓 Mi disponibilidad semanal (opcional)</Label>
                      <div style={{ fontSize: 11.5, color: T.n400, marginBottom: 8 }}>
                        {calStatus?.conectado
                          ? "Con tu Google Calendar conectado, no hace falta cargar nada acá: el portal ya ofrece de 10 a 17hs (lun a vie) descartando automáticamente lo que tengas ocupado en tu calendario real. Cargá esto solo si querés acotar más esos horarios (ej: solo mañanas)."
                          : "Sin el calendario conectado, esto es obligatorio: son los horarios que ven tus clientes al agendar. Conectá tu Google Calendar arriba y te ahorrás cargar esto — se genera solo."}
                      </div>
                      {disponibilidad.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                          {disponibilidad.slice().sort((a, b) => a.dia_semana - b.dia_semana || a.hora.localeCompare(b.hora)).map((s) => (
                            <span key={s.dia_semana + s.hora} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: T.primary50, color: T.primary800, border: "1px solid " + T.primary100, borderRadius: 100, padding: "4px 10px" }}>
                              {DIAS_SEMANA[s.dia_semana]} {s.hora} <span onClick={() => quitarSlotDisponibilidad(s.dia_semana, s.hora)} style={{ cursor: "pointer" }}>✕</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select value={nuevoDia} onChange={(e) => setNuevoDia(Number(e.target.value))} style={{ height: 36, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 8px", fontSize: 13, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                          {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                        <input type="time" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} step={900} style={{ height: 36, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 8px", fontSize: 13, fontFamily: "inherit", color: T.n800 }} />
                        <Btn variant="secondary" size="sm" onClick={agregarSlotDisponibilidad}>+ Agregar</Btn>
                        {dispMsg && <span style={{ fontSize: 12, color: T.okTx, fontWeight: 600 }}>{dispMsg}</span>}
                      </div>
                    </div>

                    <div style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid " + T.n200 }}>
                      <Label>🎫 Mi API key de Redmine (opcional)</Label>
                      <div style={{ fontSize: 11.5, color: T.n400, marginBottom: 6 }}>Si la cargás, los tickets de tus clientes se crean con esta key en vez de la genérica del servidor.</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Input type="password" value={miRedmineKey} onChange={(e) => setMiRedmineKey(e.target.value)} placeholder="Tu API key personal de Redmine" />
                        <Btn variant="secondary" size="sm" onClick={() => guardarMiPerfil({ redmineApiKey: miRedmineKey })}>Guardar</Btn>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: T.n400, lineHeight: 1.5 }}>
                      Gmail personal: todavía no está conectado — por ahora los mails automáticos del portal (recordatorios, invitaciones) salen desde la cuenta general de Nubceo.
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: T.n600, margin: "0 0 12px", lineHeight: 1.5 }}>
                  Cambiá tu código de acceso cuando quieras — por seguridad debe tener <b>al menos 8 caracteres combinando letras y números</b>. Al confirmarlo vas a volver al login para entrar con el nuevo (dejá que el navegador lo guarde).
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <div><Label>Nuevo código</Label><Input type="password" autoComplete="new-password" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} placeholder="Ej: FER-2026-X9" /></div>
                  <div><Label>Repetilo</Label><Input type="password" autoComplete="new-password" value={confirmaCodigo} onChange={(e) => setConfirmaCodigo(e.target.value)} /></div>
                  <Btn variant="secondary" onClick={cambiarMiCodigo}>Cambiar mi código</Btn>
                </div>
                {perfilMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: (perfilMsg.startsWith("¡") || perfilMsg === "Guardado ✓") ? T.okTx : T.errTx }}>{perfilMsg}</div>}
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Fila de "Plazos y recordatorios": fecha límite por paso + estado del aviso ──
function FilaPlazo({ paso, completo, plazo, onGuardar, onQuitar, onEnviarAhora, onToggleManual, onCumplimiento }) {
  const [fecha, setFecha] = useState(plazo?.fechaLimite || "");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { setFecha(plazo?.fechaLimite || ""); }, [plazo?.fechaLimite]);

  const hoy = new Date().toISOString().slice(0, 10);
  const vencido = plazo?.fechaLimite && plazo.fechaLimite < hoy && !completo;

  const guardar = () => { if (fecha) onGuardar(fecha); };
  const enviarAhora = async () => { setEnviando(true); try { await onEnviarAhora(); } finally { setEnviando(false); } };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid " + (vencido ? T.errBorder : T.n200), background: vencido ? T.errBg : completo ? T.okBg : "#fff", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 200px", minWidth: 180 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.n800 }}>{paso.nombre}</div>
        <div style={{ fontSize: 11, color: T.n400, marginBottom: 1 }}>Responsable: {paso.responsable}</div>
        <div style={{ fontSize: 11.5, color: completo ? T.okTx : vencido ? T.errTx : T.n400 }}>
          {completo ? "Completado ✓" : vencido ? "Plazo vencido" : plazo?.fechaLimite ? "Pendiente" : "Sin plazo definido"}
        </div>
      </div>
      {onToggleManual && (
        <div onClick={() => onToggleManual(!completo)} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12, color: T.n600, userSelect: "none" }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: "2px solid " + (completo ? T.primary : T.n200), background: completo ? T.primary : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{completo ? "✓" : ""}</span>
          Marcar completo
        </div>
      )}
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={completo}
        style={{ height: 34, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 8px", fontSize: 12.5, fontFamily: "inherit", color: T.n800, background: completo ? T.n50 : "#fff" }} />
      <Btn size="sm" variant="secondary" onClick={guardar} disabled={completo || !fecha || fecha === plazo?.fechaLimite}>Guardar</Btn>
      {plazo?.fechaLimite && (
        <select value={plazo?.cumplimiento || ""} onChange={(e) => onCumplimiento(e.target.value || null)}
          title="Confirmá si se cumplió el plazo — esto es lo que ve el cliente en su Cronograma"
          style={{ height: 34, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 6px", fontSize: 12, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
          <option value="">Sin confirmar</option>
          <option value="cumplido_tiempo">✓ Cumplido a tiempo</option>
          <option value="cumplido_tarde">◐ Cumplido con atraso</option>
          <option value="incumplido">✕ No cumplido</option>
        </select>
      )}
      {plazo?.fechaLimite && !completo && (
        <>
          <Btn size="sm" variant="ghost" onClick={enviarAhora} disabled={enviando}>{enviando ? "Enviando…" : "Enviar aviso ahora"}</Btn>
          <Btn size="sm" variant="ghost" onClick={onQuitar} style={{ color: T.n400 }}>Quitar plazo</Btn>
        </>
      )}
      {plazo?.recordatorioEnviado && <Badge tone="blue">Recordatorio enviado</Badge>}
      {plazo?.incumplimientoEnviado && <Badge tone="red">Aviso de vencido enviado</Badge>}
    </div>
  );
}

// ── Componentes del panel del equipo: evento con minuta y status de pruebas ──
function AdminEvento({ e, onMinuta, onMeet }) {
  const [generando, setGenerando] = useState(false);
  const [minuta, setMinuta] = useState(e.minuta || "");
  const [editando, setEditando] = useState(false);
  const realizado = e.estado === "realizado";
  return (
    <div style={{ border: "1px solid " + (realizado ? "#bbe8c9" : T.n200), borderRadius: 10, padding: "12px 14px", background: realizado ? T.okBg : "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: realizado ? T.okTx : T.n900 }}>{EVENTO_NOMBRES[e.tipo] || e.tipo}</span>
          <span style={{ fontSize: 12.5, color: T.n400 }}> · {new Date(e.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: TZ_AR })} · {e.responsable}</span>
        </div>
        <Badge tone={realizado ? "green" : "blue"}>{realizado ? "Realizada, con minuta" : "Agendada"}</Badge>
      </div>
      {(e.invitados || []).length > 0 && (
        <div style={{ fontSize: 12, color: T.n400, marginTop: 4 }}>Invitados: {(e.invitados || []).map((p) => p.nombre).join(", ")}</div>
      )}
      {!realizado && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <BotonMeet e={e} chico />
          {!e.meet_link && e.google_event_link && onMeet && (
            <Btn variant="secondary" size="sm" disabled={generando} onClick={async () => { setGenerando(true); try { await onMeet(e.id); } finally { setGenerando(false); } }}>{generando ? "Generando…" : "Agregar link de Meet"}</Btn>
          )}
          {!e.meet_link && !e.google_event_link && <span style={{ fontSize: 12, color: "#92400e" }}>Sin link de Meet: el calendario de {e.responsable} no estaba conectado al agendarla.</span>}
          {e.google_event_link && <a href={e.google_event_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: T.primary }}>Ver en Google Calendar</a>}
        </div>
      )}
      {realizado && e.minuta && !editando && (
        <div style={{ marginTop: 8, fontSize: 13, color: T.n800, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{e.minuta}</div>
      )}
      {(!realizado || editando) ? (
        <div style={{ marginTop: 10 }}>
          <textarea value={minuta} onChange={(ev) => setMinuta(ev.target.value)} placeholder="Minuta de la reunión: temas tratados, acuerdos, próximos pasos…" rows={3}
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid " + T.n200, padding: 10, fontSize: 13, fontFamily: "inherit", color: T.n800, resize: "vertical" }} />
          <div style={{ marginTop: 6 }}>
            <Btn size="sm" variant="secondary" onClick={() => { onMinuta(e.id, minuta); setEditando(false); }}>Guardar minuta y marcar realizada</Btn>
          </div>
        </div>
      ) : realizado && (
        <div style={{ marginTop: 6 }}><Btn size="sm" variant="ghost" onClick={() => setEditando(true)}>Editar minuta</Btn></div>
      )}
    </div>
  );
}

function AdminPrueba({ etapa, titulo, prueba, onSave }) {
  const [status, setStatus] = useState(prueba?.status || "pendiente");
  const [notas, setNotas] = useState(prueba?.notas || "");
  useEffect(() => { setStatus(prueba?.status || "pendiente"); setNotas(prueba?.notas || ""); }, [prueba?.status, prueba?.notas]);
  return (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 4px" }}>{titulo}</h3>
      <p style={{ fontSize: 12.5, color: T.n400, margin: "0 0 10px", lineHeight: 1.5 }}>
        Al pasar a <b>"Listas para mostrar"</b>, el cliente ve en su portal la invitación a agendar la reunión de resultados.
      </p>
      <Label>Status</Label>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", height: 38, borderRadius: 6, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 13.5, fontFamily: "inherit", color: T.n800, background: "#fff", marginBottom: 10 }}>
        <option value="pendiente">Pendiente</option>
        <option value="en_curso">En curso</option>
        <option value="listo_para_mostrar">Listas para mostrar resultados</option>
        <option value="ok">OK — cerradas</option>
      </select>
      <Label>Notas visibles para el cliente</Label>
      <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: probamos reglas de Prisma y MP, falta cubrir cuota a cuota…" rows={2}
        style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid " + T.n200, padding: 10, fontSize: 13, fontFamily: "inherit", color: T.n800, resize: "vertical" }} />
      <div style={{ marginTop: 8 }}>
        <Btn size="sm" variant="secondary" onClick={() => onSave(etapa, status, notas)}>Guardar status</Btn>
      </div>
    </Card>
  );
}
