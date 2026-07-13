import { useState, useEffect, useCallback, useRef } from "react";
import { CONECTORES, ESTADOS_PROCESADORA, DOCS, COLUMNAS_OBLIGATORIAS, TEMPLATE_SUCURSALES } from "../lib/nubceo";
import { validarVentas, validarTabla, exportarNubceo } from "../lib/validadorVentas";
import { convertirSucursales, exportarTemplateSucursales } from "../lib/sucursalesTemplate";

// ─── Tokens de marca Nubceo (tema C — Soft, portal de usuario) ───
const T = {
  bg: "#eef4ff",
  card: "#ffffff",
  cardBorder: "#c7dcfd",
  primary: "#0a6bf4",
  primary50: "#e8f1fe",
  primary100: "#b9d2fb",
  primary600: "#0550c0",
  primary800: "#033a8a",
  primary900: "#02265c",
  sky: "#38b6ff",
  n50: "#f7f8fa",
  n100: "#eef0f4",
  n200: "#d8dce6",
  n400: "#8e96a8",
  n600: "#4b5468",
  n800: "#1e2433",
  n900: "#0d1120",
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
const APP_VERSION = "1.10.4";
const APP_VERSION_FECHA = "2026-07-13";

const FASES = [
  "Vinculación",
  "Arranque",
  "Relevamiento y workshop",
  "Datos de prueba",
  "Reglas y configuración",
  "Capacitación",
  "Go-live",
  "Hypercare",
];


// ─── Capa de datos: todo pasa por /api/portal (el navegador nunca toca la base) ───
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
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
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
const Btn = ({ children, onClick, variant = "primary", size = "md", disabled, style, type = "button" }) => {
  const base = {
    primary: { background: T.primary, color: "#fff", border: "none" },
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
      style={{
        ...base, padding: pad, borderRadius: 8, fontSize: 14, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit", transition: "opacity .15s", ...style,
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
    <span style={{ background: c[0], color: c[1], fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 100, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
};

const Card = ({ children, style }) => (
  <div style={{ background: T.card, border: "1px solid " + T.cardBorder, borderRadius: 16, padding: "1.75rem", ...style }}>
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
    info: [T.infoBg, T.infoTx, T.infoBorder, "💡"],
    warning: [T.warnBg, T.warnTx, T.warnBorder, "⚠️"],
    error: [T.errBg, T.errTx, T.errBorder, "✕"],
    success: [T.okBg, T.okTx, T.okBorder, "✓"],
  }[tone];
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start", background: c[0], color: c[1],
      border: "1px solid " + c[2], borderRadius: 10, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.55, ...style,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon || c[3]}</span>
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
  <div style={{ fontSize: 11.5, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
    {children}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    style={{
      height: 40, padding: "0 12px", border: "1px solid " + T.n200, borderRadius: 6,
      fontSize: 14, width: "100%", boxSizing: "border-box", fontFamily: "inherit",
      outline: "none", color: T.n800, background: "#fff", ...props.style,
    }}
    onFocus={(e) => { e.target.style.border = "1px solid " + T.primary; e.target.style.boxShadow = "0 0 0 3px rgba(10,107,244,0.12)"; }}
    onBlur={(e) => { e.target.style.border = "1px solid " + T.n200; e.target.style.boxShadow = "none"; }}
  />
);

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: T.n400, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
    {children}
  </div>
);

const Radio = ({ options, value, onChange }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    {options.map(([v, lbl]) => (
      <div
        key={v}
        onClick={() => onChange(v)}
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
            onClick={() => toggle(v)}
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
            }}>{on ? "✓" : ""}</span>
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
const Stepper = ({ fase }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
    {FASES.map((f, i) => {
      const done = i < fase, current = i === fase;
      return (
        <div key={f} style={{ display: "flex", alignItems: "flex-start", flex: "1 0 auto", minWidth: 86 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 6 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
              background: done ? T.primary : current ? T.card : T.n100,
              color: done ? "#fff" : current ? T.primary : T.n400,
              border: current ? "2.5px solid " + T.primary : "2.5px solid transparent",
              boxShadow: current ? "0 0 0 4px rgba(10,107,244,0.15)" : "none",
            }}>
              {done ? "✓" : i + 1}
            </div>
            <div style={{ fontSize: 11, fontWeight: current ? 700 : 500, color: current ? T.primary800 : done ? T.n600 : T.n400, textAlign: "center", lineHeight: 1.25, maxWidth: 90 }}>
              {f}
            </div>
          </div>
          {i < FASES.length - 1 && (
            <div style={{ height: 2.5, background: i < fase ? T.primary : T.n200, flex: "1 0 12px", marginTop: 14, borderRadius: 2 }} />
          )}
        </div>
      );
    })}
  </div>
);

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
        setSession({ code: c, name: r.name, who });
        setScreen("client");
      }
    } catch (e) {
      setErr(e.message === "Código no encontrado" ? "Código no encontrado. Verificá el código que te envió tu implementador." : e.message);
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: T.n800 }}>
      {screen === "login" && <Login onLogin={login} err={err} loggingIn={loggingIn} />}
      {screen === "client" && <ClientPortal session={session} onLogout={() => { setSession(null); setScreen("login"); }} />}
      {screen === "admin" && <AdminPortal session={session} onLogout={() => { setSession(null); setScreen("login"); }} />}
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
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "9vh 20px 40px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: SP.xl }}>
        <Wordmark height={32} />
      </div>
      <Card>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.n900, margin: "0 0 6px" }}>Portal de implementación</h1>
        <p style={{ fontSize: 14, color: T.n600, margin: "0 0 24px", lineHeight: 1.55 }}>
          Acompañá tu implementación del Conciliador: completá los pasos pendientes y seguí en qué instancia está tu proyecto.
        </p>
        {/* Formulario real: así el navegador ofrece guardar y autocompletar las credenciales */}
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <Label>Tu nombre</Label>
            <Input name="username" autoComplete="username" placeholder="Para el registro de actividad" value={who} onChange={(e) => setWho(e.target.value)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <Label>Código de acceso</Label>
            <div style={{ position: "relative" }}>
              <Input name="password" type={verCodigo ? "text" : "password"} autoComplete="current-password" placeholder="El código que te envió tu implementador" value={code} onChange={(e) => setCode(e.target.value)} style={{ paddingRight: 74 }} />
              <span onClick={() => setVerCodigo(!verCodigo)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12.5, fontWeight: 600, color: T.primary, cursor: "pointer", userSelect: "none" }}>{verCodigo ? "Ocultar" : "Mostrar"}</span>
            </div>
          </div>
          {err && <Alert tone="error" style={{ marginBottom: 16 }}>{err}</Alert>}
          <Btn type="submit" disabled={loggingIn} style={{ width: "100%" }}>{loggingIn ? "Entrando…" : "Entrar"}</Btn>
        </form>
        <ActionBar style={{ marginTop: 20, paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: T.n400, lineHeight: 1.55 }}>
            Ingresá con el código que te compartió tu implementador — el navegador te va a ofrecer recordarlo. ¿Sos del equipo de Nubceo? Usá tu código de implementador.
          </div>
        </ActionBar>
      </Card>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 11.5, color: T.n400 }}>
        Portal de Implementaciones · v{APP_VERSION} · {new Date(APP_VERSION_FECHA + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
      </div>
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

const Nav = ({ name, who, onLogout, admin, implementador }) => (
  <div style={{ background: "#fff", borderBottom: "1px solid " + T.n200, minHeight: 60, display: "flex", alignItems: "center", padding: "10px 24px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, gap: 12, flexWrap: "wrap" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <Wordmark />
      <span title={"Versión " + APP_VERSION} style={{ fontSize: 10.5, color: T.n400, fontWeight: 600 }}>v{APP_VERSION}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      {implementador && <ContactoImplementador nombre={implementador.nombre} email={implementador.email} cliente={name} />}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.n800 }}>{name}</div>
        {who && <div style={{ fontSize: 11.5, color: T.n400 }}>{who}{admin ? " · Equipo Nubceo" : ""}</div>}
      </div>
      <Btn variant="ghost" size="sm" onClick={onLogout}>Salir</Btn>
    </div>
  </div>
);

// ══════════════════════════ PORTAL DEL CLIENTE ══════════════════════════

const PASOS = [
  { id: "procesadoras", n: "Procesadoras" },
  { id: "introduccion", n: "Introducción" },
  { id: "relevamiento", n: "Relevamiento" },
  { id: "sucursales", n: "Sucursales" },
  { id: "conexion", n: "Conexión API / CSV" },
  { id: "capacitacion", n: "Capacitación" },
  { id: "sandbox", n: "Pruebas sandbox" },
  { id: "golive", n: "Go-live" },
];

const EVENTO_NOMBRES = {
  workshop: "Workshop de relevamiento",
  reunion_tecnica: "Reunión técnica de API",
  capacitacion_conciliador: "Capacitación Conciliador",
  capacitacion_cash: "Capacitación Nubceo Cash",
  resultados_sandbox: "Presentación de resultados sandbox",
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
          <b>{new Date(elegido.fecha).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</b>
          {" a las "}<b>{new Date(elegido.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs</b> con {elegido.responsable}
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
  slots.forEach((s) => { const d = new Date(s.fecha).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" }); (porDia[d] = porDia[d] || []).push(s); });
  return (
    <div>
      {nota && <div style={{ fontSize: 13, color: T.n600, marginBottom: 10, lineHeight: 1.5 }}>{nota}</div>}
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
                  {new Date(s.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs · {s.responsable}{s.calendarioReal ? " 📅" : ""}
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
      {e.google_event_link && (
        <a href={e.google_event_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: T.primary, marginTop: 4, display: "inline-block" }}>
          📅 Ver en Google Calendar →
        </a>
      )}
    </div>
    <Badge tone={e.estado === "realizado" ? "green" : "blue"}>{e.estado === "realizado" ? "Realizada" : "Agendada"}</Badge>
  </div>
);

function ClientPortal({ session, onLogout }) {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState("procesadoras");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

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

  if (!data || !meta) return <div style={{ padding: 60, textAlign: "center", color: T.n400 }}>Cargando…</div>;

  const rv = data.relevamiento || {};
  const eventos = data.eventos || [];
  const tieneEvento = (tipo, realizado) => eventos.some((e) => e.tipo === tipo && e.estado !== "cancelado" && (!realizado || e.estado === "realizado"));
  const csvOk = !!(data.ventasArchivo && data.ventasArchivo.validacion?.ok);
  // "completo" = el paso está realmente terminado (lo que se muestra);
  // "avanzable" = alcanza para desbloquear el siguiente (sucursales se puede omitir)
  const completo = {
    procesadoras: (data.procesadoras || []).length > 0,
    introduccion: !!meta.introLeida,
    relevamiento: !!data.relevamientoEnviado,
    sucursales: !!data.sucursalesArchivo,
    conexion: rv.d1 === "api" ? !!data.apiCreds : rv.d1 === "csv" ? csvOk : rv.d1 === "ambos" ? (!!data.apiCreds && csvOk) : false,
    capacitacion: tieneEvento("capacitacion_conciliador") || tieneEvento("capacitacion_cash"),
    sandbox: tieneEvento("resultados_sandbox", true),
    golive: tieneEvento("golive", true),
  };
  const avanzable = { ...completo, sucursales: completo.sucursales || !!meta.sucursalesOmitido };
  // Desbloqueo secuencial (sucursales es omitible)
  const unlocked = {};
  let prevOk = true;
  for (const p of PASOS) { unlocked[p.id] = prevOk; prevOk = prevOk && avanzable[p.id]; }
  const completados = PASOS.filter((p) => completo[p.id]).length;
  const omitioSucursales = !!meta.sucursalesOmitido && !data.sucursalesArchivo;
  const idxTab = PASOS.findIndex((p) => p.id === tab);

  return (
    <div>
      <Nav name={meta.name} who={session.who} onLogout={onLogout} implementador={meta.implementadorNombre ? { nombre: meta.implementadorNombre, email: meta.implementadorEmail } : null} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "26px 20px 60px" }}>
        <Card style={{ marginBottom: SP.lg }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
            <div>
              <Label>Tu implementación</Label>
              <div style={{ fontSize: 21, fontWeight: 700, color: T.n900 }}>{completados} de {PASOS.length} pasos completados</div>
            </div>
            <div style={{ fontSize: 13, color: T.okTx, fontWeight: 700, minHeight: 18 }}>{savedMsg}</div>
          </div>
          <div style={{ height: 6, borderRadius: 100, background: T.n100, overflow: "hidden", marginBottom: 16, maxWidth: 320 }}>
            <div style={{ width: Math.round((completados / PASOS.length) * 100) + "%", height: "100%", background: completados === PASOS.length ? "#22c55e" : T.primary, borderRadius: 100, transition: "width .3s" }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PASOS.map((p, i) => {
              const activo = tab === p.id, ok = completo[p.id], libre = unlocked[p.id];
              const pendiente = p.id === "sucursales" && omitioSucursales;
              return (
                <div key={p.id} onClick={() => libre && setTab(p.id)} title={libre ? (ok ? "Completado — podés volver a ver y editar" : "") : "Completá los pasos anteriores para desbloquear"} style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 100, fontSize: 13,
                  cursor: libre ? "pointer" : "not-allowed", opacity: libre ? 1 : 0.45,
                  fontWeight: activo ? 700 : 500,
                  background: activo ? T.primary : ok ? T.okBg : pendiente ? T.warnBg : "#fff",
                  color: activo ? "#fff" : ok ? T.okTx : pendiente ? T.warnTx : T.n600,
                  border: "1px solid " + (activo ? T.primary : ok ? "#bbe8c9" : pendiente ? "#fde68a" : T.n200),
                }}>
                  <span style={{ fontWeight: 700 }}>{ok ? "✓" : pendiente ? "!" : !libre ? "🔒" : ""}</span> {i + 1}. {p.n}{pendiente ? " (pendiente)" : ""}
                </div>
              );
            })}
            <div onClick={() => setTab("historial")} style={{ padding: "8px 13px", borderRadius: 100, fontSize: 13, cursor: "pointer", fontWeight: tab === "historial" ? 700 : 500, background: tab === "historial" ? T.primary : "transparent", color: tab === "historial" ? "#fff" : T.n400, border: "1px solid " + (tab === "historial" ? T.primary : T.n200) }}>Historial</div>
          </div>
          {omitioSucursales && (
            <Alert tone="warning" style={{ marginTop: 14 }}>
              El paso 4 (Sucursales) quedó <b>pendiente</b>. Podés seguir avanzando, pero es necesario completarlo para terminar la implementación — volvé cuando tengas el archivo.
            </Alert>
          )}
        </Card>

        {tab === "procesadoras" && <TabProcesadoras data={data} act={act} saving={saving} />}
        {tab === "introduccion" && <TabIntroduccion act={act} meta={meta} saving={saving} />}
        {tab === "relevamiento" && <TabRelevamiento data={data} persist={persist} saving={saving} rvOK={!!data.relevamientoEnviado} session={session} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
        {tab === "sucursales" && <TabSucursales data={data} meta={meta} persist={persist} act={act} saving={saving} />}
        {tab === "conexion" && <TabConexion data={data} persist={persist} session={session} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
        {tab === "capacitacion" && <TabCapacitacion data={data} session={session} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
        {tab === "sandbox" && <TabPruebasEtapa etapa="sandbox" tipoEvento="resultados_sandbox" data={data} session={session} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
        {tab === "golive" && <TabPruebasEtapa etapa="golive" tipoEvento="golive" data={data} session={session} setAll={(r) => { setData(r.data); setMeta(r.meta); }} />}
        {tab === "historial" && <TabHistorial history={data.history} />}

        {/* Navegación entre pasos: volver atrás para ver/editar, avanzar al completar */}
        {idxTab >= 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            {idxTab > 0
              ? <Btn variant="ghost" onClick={() => setTab(PASOS[idxTab - 1].id)}>← Paso {idxTab}: {PASOS[idxTab - 1].n}</Btn>
              : <span />}
            {idxTab < PASOS.length - 1 && (
              avanzable[tab]
                ? <Btn onClick={() => setTab(PASOS[idxTab + 1].id)}>Siguiente — Paso {idxTab + 2}: {PASOS[idxTab + 1].n} →</Btn>
                : <span style={{ fontSize: 13, color: T.n400 }}>Completá este paso para pasar al siguiente</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Paso 1: Procesadoras ──
function TabProcesadoras({ data, act, saving }) {
  const inicial = {};
  (data.procesadoras || []).forEach((p) => { inicial[p.codigo] = p.estado; });
  const [sel, setSel] = useState(inicial);
  const toggle = (code) => setSel((s) => { const n = { ...s }; if (n[code] !== undefined) delete n[code]; else n[code] = "no_conectado"; return n; });
  const setEstado = (code, estado) => setSel((s) => ({ ...s, [code]: estado }));
  const guardar = () => {
    const lista = [];
    for (const [pais, conns] of Object.entries(CONECTORES)) {
      for (const c of conns) if (sel[c.code] !== undefined) lista.push({ codigo: c.code, nombre: c.nombre, pais, estado: sel[c.code] });
    }
    act("saveProcesadoras", { lista, log: "Actualizó sus procesadoras (" + lista.length + ") y el estado de conexión de cada una" });
  };
  const cant = Object.keys(sel).length;
  return (
    <Card>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 6px" }}>¿Con qué procesadoras y plataformas cobran?</h2>
      <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "0 0 18px" }}>
        Marcá todas las que usen y contanos en qué estado está cada conexión. "En espera" significa que ya la pediste pero falta documentación o credenciales. Si usan alguna que no está en la lista, avisale a tu implementador para verificar el conector.
      </p>
      {Object.entries(CONECTORES).map(([pais, conns]) => (
        <div key={pais} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, margin: "0 0 10px", paddingBottom: 6, borderBottom: "1px solid " + T.primary50 }}>{pais}</div>
          <div style={{ display: "grid", gap: 8 }}>
            {conns.map((c) => {
              const activo = sel[c.code] !== undefined;
              return (
                <div key={c.code} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "1px solid " + (activo ? T.primary100 : T.n200), background: activo ? T.primary50 : "#fff" }}>
                  <div onClick={() => toggle(c.code)} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", flex: "1 0 200px" }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, border: "2px solid " + (activo ? T.primary : T.n200), background: activo ? T.primary : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{activo ? "✓" : ""}</span>
                    <span style={{ fontSize: 14, fontWeight: activo ? 600 : 400, color: activo ? T.primary900 : T.n600 }}>{c.nombre}</span>
                  </div>
                  {activo && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ESTADOS_PROCESADORA.map(([v, lbl]) => (
                        <span key={v} onClick={() => setEstado(c.code, v)} style={{
                          fontSize: 12, padding: "4px 10px", borderRadius: 100, cursor: "pointer", fontWeight: sel[c.code] === v ? 700 : 400,
                          background: sel[c.code] === v ? (v === "conectado" ? T.okBg : v === "en_espera" ? T.warnBg : T.errBg) : "#fff",
                          color: sel[c.code] === v ? (v === "conectado" ? T.okTx : v === "en_espera" ? T.warnTx : T.errTx) : T.n400,
                          border: "1px solid " + T.n200,
                        }}>{lbl}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Btn onClick={guardar} disabled={saving || !cant}>Guardar ({cant} seleccionada{cant === 1 ? "" : "s"})</Btn>
    </Card>
  );
}

// ── Paso 2: Introducción ──
const INTRO_PASOS = [
  ["Procesadoras", "Nos contás con qué plataformas cobrás y en qué estado está cada conexión. Con eso pedimos los accesos correctos desde el arranque."],
  ["Relevamiento", "Un formulario sobre cómo vende y cobra tu negocio, más los involucrados del proyecto. Con tus respuestas armamos el mapa de tu operación y preparamos el workshop, que agendás acá mismo al terminarlo."],
  ["Sucursales", "Cargás tu listado interno de sucursales y el portal lo convierte al formato oficial de Nubceo, validado y listo para subir a la plataforma."],
  ["Conexión API o CSV", "Definimos cómo van a llegar tus ventas a Nubceo. Si es por API, acá tenés tus credenciales, la documentación y la reunión técnica con nuestro equipo. Si es por CSV, el portal valida tu archivo y lo deja en el formato exacto."],
  ["Capacitación", "Acceso a los manuales de Nubceo y agenda de capacitaciones de Conciliador y de Nubceo Cash para tu equipo."],
  ["Pruebas sandbox", "Probamos la conciliación con tus datos reales en un entorno de pruebas. Te mostramos los resultados en una reunión y dejamos la minuta acá."],
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
  { sec: "A · Cómo venden" },
  { id: "a1", lbl: "¿Qué canales de venta tienen activos? (marcá todos)", type: "multi", otro: true,
    opts: [["fisicas", "Tiendas físicas"], ["ecommerce", "E-commerce propio"], ["marketplaces", "Marketplaces (Mercado Libre, etc.)"], ["delivery", "Apps de delivery (PedidosYa, Rappi…)"], ["telefonica", "Venta telefónica / WhatsApp"], ["mayorista", "Mayorista / distribuidores"]],
    info: "Un canal de venta es cada vía por la que le venden a sus clientes. Marcá todos los que usen aunque muevan poco volumen: cada canal puede tener su propia forma de cobrar y de liquidar, y eso cambia cómo se configura la conciliación." },
  { id: "a2", lbl: "¿Qué sistema usan para registrar las ventas en cada canal? (PDV y/o ERP, con nombre y versión si la saben)", type: "textarea",
    info: "El PDV (punto de venta) es el sistema donde se registra cada ticket o factura en el local (ej: Zetti, Maersoft, Neo). El ERP es el sistema de gestión general de la empresa (ej: SAP, Tango, Bejerman). Si usan sistemas distintos según el canal, aclaralo: por ejemplo 'locales con Neo, web con VTEX'." },
  { id: "a3", lbl: "¿Registran siempre el total de la venta, aunque el cliente pague en cuotas?", type: "radio", otro: true,
    opts: [["total", "Sí, siempre el total"], ["porcuota", "Registramos cada cuota"], ["depende", "Depende"]],
    info: "Ejemplo: un cliente compra por $120.000 en 6 cuotas. Si en su sistema figura una venta de $120.000, registran el total. Si figuran 6 registros de $20.000, registran por cuota. Este dato es clave para armar el cruce entre ventas y cobros." },
  { id: "a4", lbl: "¿Qué porcentaje aproximado de sus ventas con tarjeta es en cuotas?", type: "radio",
    opts: [["bajo", "Casi nada (<10%)"], ["medio", "10% a 40%"], ["alto", "Más del 40%"], ["nose", "No sé"]],
    info: "No hace falta un número exacto, alcanza con el orden de magnitud. Nos sirve para saber cuánto peso van a tener las cuotas en la conciliación." },
  { id: "a5", lbl: "¿Todas las terminales de pago están integradas al sistema de ventas?", type: "radio", otro: true,
    opts: [["todas", "Sí, todas"], ["algunas", "Algunas sin integrar"], ["ninguna", "Ninguna integrada"]],
    info: "Terminal de pagos: el dispositivo donde se pasa o apoya la tarjeta (Clover, Mercado Pago Point, Posnet, Lapos, etc.). Está integrada cuando la terminal se conecta con el sistema de ventas y el importe pasa solo, sin que el cajero lo tipee a mano. Las terminales sin integrar suelen generar diferencias por errores de tipeo, y conviene saberlo de antemano." },
  { id: "a6", lbl: "¿Aceptan pagos en moneda extranjera o venden desde el exterior?", type: "radio",
    opts: [["no", "No"], ["si", "Sí"]],
    info: "Por ejemplo: cobros en dólares, ventas a turistas con tarjetas del exterior, o un e-commerce que vende a otros países. Cambia cómo llegan los montos en las liquidaciones." },
  { id: "a6detalle", lbl: "Si sí: contanos el detalle", type: "text", showIf: (r) => r.a6 === "si" },

  { sec: "B · Cómo cobran" },
  { id: "b0", lbl: "¿Qué medios de pago y plataformas de cobro usan? (marcá todos)", type: "multi", otro: true,
    otroLbl: "¿Usan otras? Escribilas acá, separadas por coma",
    opts: [["prisma", "Prisma / Payway"], ["fiserv", "Fiserv"], ["mercadopago", "Mercado Pago"], ["naranja", "Naranja X"], ["amex", "American Express"], ["getnet", "Getnet"], ["cabal", "Cabal"], ["visanet", "VisaNet"], ["adyen", "Adyen"], ["gocuotas", "Go Cuotas"], ["pedidosya", "PedidosYa"], ["rappi", "Rappi"], ["ubereats", "Uber Eats"], ["didifood", "DiDi Food"], ["efectivo", "Efectivo"], ["transferencia", "Transferencia"]],
    info: "Marcá todas las plataformas por las que reciben cobros: Nubceo tiene conectores directos para éstas y más. Si usan alguna que no está en la lista — sobre todo tarjetas regionales o provinciales (Sucrédito, Única, Sol…) o billeteras locales — marcá 'Otro' y escribilas: suelen ser justo las que necesitan configuración especial y conviene saberlo desde el inicio." },
  { id: "b2", lbl: "¿Cómo les liquidan las ventas en cuotas?", type: "radio", otro: true,
    opts: [["junto", "Todo junto (24/48hs)"], ["semanal", "Semanal"], ["cuota", "Cuota a cuota (cada mes, el valor de esa cuota)"], ["nose", "No sé"]],
    info: "La liquidación es cuando la procesadora les deposita el dinero. Ejemplo de 'cuota a cuota': venden $120.000 en 6 cuotas y cobran $20.000 por mes durante 6 meses. Ejemplo de 'todo junto': cobran los $120.000 (menos comisiones) a las 48hs. Si cambia según la procesadora, elegí 'Otro' y detallá." },
  { id: "b4", lbl: "¿Tienen promociones, acuerdos comerciales o descuentos financiados con procesadoras o bancos?", type: "radio",
    opts: [["no", "No"], ["si", "Sí"]],
    info: "Por ejemplo: cuotas sin interés bancarizadas, reintegros de billeteras, descuentos que financia en parte el banco o la marca. Estos acuerdos modifican los montos que les liquidan y hay que contemplarlos en las reglas." },
  { id: "b4detalle", lbl: "Si sí: ¿cuáles y con quién?", type: "text", showIf: (r) => r.b4 === "si" },
  { id: "b5", lbl: "¿Cobran propinas, recargos por servicio o redondeos a través de las terminales?", type: "radio",
    opts: [["no", "No"], ["si", "Sí"]],
    info: "Es común en gastronomía: la propina pasa por el posnet junto con la venta, pero en el sistema de ventas figura otro monto. Si pasa, lo contemplamos para que no genere diferencias." },
  { id: "b5detalle", lbl: "Si sí: contanos cómo funciona", type: "text", showIf: (r) => r.b5 === "si" },

  { sec: "C · Cómo está armado el negocio" },
  { id: "c1", lbl: "¿Con cuántas razones sociales (CUIT) operan las ventas a conciliar?", type: "radio",
    opts: [["una", "Una sola"], ["varias", "Más de una"]],
    info: "Una razón social es cada empresa con CUIT propio que factura ventas. Si operan con más de una (por ejemplo, una para locales y otra para el e-commerce), la estructura en Nubceo se arma distinto desde el inicio." },
  { id: "c1detalle", lbl: "Si son varias: ¿cuáles y qué vende cada una?", type: "text", showIf: (r) => r.c1 === "varias" },
  { id: "c2", lbl: "¿Cuántas sucursales o puntos de venta activos tienen?", type: "text" },
  { id: "c3", lbl: "¿Cada sucursal tiene su propio número de comercio en cada procesadora?", type: "radio", otro: true,
    opts: [["propios", "Cada una el suyo"], ["compartidos", "Hay compartidos"], ["nose", "No sé"]],
    info: "El número de comercio (o 'número de establecimiento') es el código que cada procesadora le asigna a cada local; aparece en los cupones y en las liquidaciones. Si varias sucursales comparten el mismo número, definimos juntos cómo atribuir cada cobro a su sucursal." },
  { id: "c4", lbl: "¿Está previsto abrir, cerrar o mudar sucursales en los próximos 3 meses?", type: "radio",
    opts: [["no", "No"], ["si", "Sí"]] },
  { id: "c4detalle", lbl: "Si sí: ¿qué cambia y cuándo?", type: "text", showIf: (r) => r.c4 === "si" },
  { id: "c5", lbl: "Volumen aproximado: ¿cuántas transacciones por mes en total?", type: "text",
    info: "Un número aproximado alcanza (ej: '15.000 por mes'). Nos sirve para dimensionar los datos de prueba y los tiempos de carga." },

  { sec: "D · Cómo van a llegar los datos a Nubceo" },
  { id: "d1", lbl: "Para enviar las ventas a Nubceo, ¿van por API o por archivo (CSV)?", type: "radio",
    opts: [["api", "API"], ["csv", "CSV"], ["indef", "No está definido"]],
    info: "API: sus sistemas envían las ventas a Nubceo automáticamente; requiere un desarrollo del lado de ustedes (o cotizado con Nubceo), pero después no hay tarea manual. CSV: cargan un archivo con las ventas de forma periódica; no requiere desarrollo, pero sí disciplina de carga. Si no está definido, lo charlamos en el workshop." },
  { id: "d2", lbl: "Si van por API: ¿quién desarrolla la integración?", type: "radio", otro: true, showIf: (r) => r.d1 === "api",
    opts: [["interno", "Nuestro equipo de sistemas"], ["proveedor", "El proveedor del PDV/ERP"], ["freelance", "Un desarrollador externo"], ["nubceo", "Nubceo (desarrollo cotizado)"], ["indef", "No está definido"]] },
  { id: "d3", lbl: "Si van por API: ¿el desarrollo está aprobado, con recursos y fecha?", type: "radio", showIf: (r) => r.d1 === "api",
    opts: [["aprobada", "Aprobado y con fecha"], ["eval", "En evaluación"], ["no", "No / sin fecha"]],
    info: "Con 'aprobado' nos referimos a que el proyecto tiene el OK interno y alguien asignado para hacerlo. Es la pregunta más importante para armar un cronograma realista: si todavía está en evaluación, conviene arrancar por CSV en paralelo para no frenar la implementación." },
  { id: "d4", lbl: "Si van por CSV: ¿quién arma y carga el archivo, y con qué frecuencia?", type: "text", showIf: (r) => r.d1 === "csv",
    info: "Necesitamos nombre y rol de la persona concreta (ej: 'Laura, de administración, carga semanal'). La carga periódica del CSV es lo que mantiene viva la conciliación: sin un responsable definido, es el punto donde más implementaciones se traban." },
  { id: "d5", lbl: "¿Quién es el referente técnico? (nombre, rol, mail y teléfono)", type: "text",
    info: "Es la persona a la que le vamos a escribir por credenciales, API o archivos. Puede ser de sistemas propio o del proveedor del PDV." },
  { id: "d6", lbl: "¿Y el referente del negocio u operación? (nombre, rol y mail)", type: "text",
    info: "Quien va a usar la conciliación en el día a día: tesorería, administración, medios de pago. Idealmente una persona distinta del referente técnico, así siempre hay dos contactos activos." },

  { sec: "E · Cómo concilian hoy" },
  { id: "e1", lbl: "¿Cómo concilian ventas contra cobros actualmente?", type: "radio", otro: true,
    opts: [["no", "No conciliamos"], ["excel", "A mano con Excel"], ["herramienta", "Con otra herramienta"], ["tercero", "Lo hace un tercero / estudio"]],
    info: "Conciliar es cruzar lo que vendieron contra lo que efectivamente les pagaron las procesadoras, para detectar diferencias. Si hoy no lo hacen, no pasa nada: justamente para eso está el Conciliador." },
  { id: "e1detalle", lbl: "Si usan una herramienta o un tercero: ¿cuál?", type: "text", showIf: (r) => r.e1 === "herramienta" || r.e1 === "tercero" },
  { id: "e2", lbl: "Si concilian: ¿qué porcentaje aproximado les cierra sin diferencias?", type: "text" },
  { id: "e3", lbl: "¿Cuáles son hoy los principales motivos de diferencias o de transacciones que no pueden cruzar?", type: "textarea",
    info: "Ejemplos frecuentes: la venta figura un día y el cobro otro (fechas corridas); el monto difiere por comisiones o impuestos; cupones que no aparecen; interpretación de bines por tokenización; contracargos (cuando el banco les debita una venta que el cliente desconoció). Todo lo que menciones acá lo contemplamos directamente en las reglas." },
  { id: "e4", lbl: "¿Cómo manejan devoluciones, anulaciones y contracargos? ¿Se registran en el mismo sistema de ventas?", type: "textarea",
    info: "Una devolución es cuando le reintegran la compra al cliente; una anulación, cuando se cancela la venta el mismo día; un contracargo, cuando el banco les debita una venta desconocida. Si estos movimientos se registran en otro sistema (o no se registran), lo definimos para que no queden puntas sueltas." },

  { sec: "F · Usuarios, informes y cierre" },
  { id: "f4", lbl: "¿Quiénes van a usar Nubceo en el día a día? (áreas y roles)", type: "text",
    info: "Por ejemplo: tesorería, administración, finanzas, sistemas, gerentes de sucursal. Nos sirve para armar los usuarios y permisos, y para saber a quién invitar a la capacitación." },
  { id: "f5", lbl: "¿Qué informes o información necesitan obtener? ¿Necesitan exportar datos a otro sistema?", type: "textarea",
    info: "Por ejemplo: control de comisiones y costos por acuerdos comerciales, análisis de bancos y planes de cuotas elegidos por sus clientes, exportar asientos al sistema contable. Si necesitan integrar con un ERP o contable (SAP, Bejerman, Tango…), mencionalo acá." },
  { id: "f1", lbl: "En una frase: ¿qué tiene que pasar para que consideren esta implementación un éxito?", type: "text" },
  { id: "f3", lbl: "¿Están migrando o por migrar de PDV, ERP o e-commerce en los próximos 6 meses?", type: "radio",
    opts: [["no", "No"], ["si", "Sí"]],
    info: "Cambiar de sistema en medio de la implementación afecta directamente el envío de datos a Nubceo. Si hay una migración prevista, conviene saberlo ahora para elegir el mejor momento de cada paso — no es un problema, es planificación." },
  { id: "f3detalle", lbl: "Si sí: ¿qué y cuándo?", type: "text", showIf: (r) => r.f3 === "si" },
  { id: "f2", lbl: "¿Hay algo de su operación que sea distinto de lo habitual o que les preocupe que no funcione? Vale cualquier cosa.", type: "textarea",
    info: "Acuerdos especiales con un banco, una sucursal que opera distinto, un sistema viejo por cambiar, cobros que van a una cuenta particular… Todo lo que en su empresa se resuelve 'de una forma especial' nos interesa conocerlo antes del workshop." },
];

function QItem({ q, rv, set, error }) {
  const [showInfo, setShowInfo] = useState(false);
  const opts = q.otro ? [...q.opts, ["otro", "Otro"]] : q.opts;
  const val = rv[q.id];
  const otroOn = q.otro && (q.type === "multi" ? (val || []).includes("otro") : val === "otro");
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

// __CLIENT_B__ (se ensambla después de RV_PREGUNTAS y QItem)

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
          badge={rvOK ? <Badge tone="green">Enviado el {fmtDate(data.relevamientoEnviado)}</Badge> : <Badge tone="blue">{respondidas} de {visibles} respondidas</Badge>}
          subtitle={<>Completar todo el formulario es necesario para avanzar: con tus respuestas armamos el mapa de tu operación y preparamos el workshop a medida. Al lado de cada pregunta hay un botón <b style={{ fontStyle: "italic", fontFamily: "Georgia, serif" }}>i</b> con la explicación en lenguaje simple. Podés guardar borrador y seguir después, sin necesidad de completar todo todavía.</>}
        />
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
        {RV_PREGUNTAS.map((q, i) => {
          if (q.sec) return <div key={i} style={{ fontSize: 12, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.07em", margin: "26px 0 14px", paddingBottom: 8, borderBottom: "1px solid " + T.primary50 }}>{q.sec}</div>;
          if (q.showIf && !q.showIf(rv)) return null;
          return <QItem key={q.id} q={q} rv={rv} set={set} error={intentoEnviar && !contestada(q)} />;
        })}
        <ActionBar>
          <Btn variant="secondary" onClick={guardarBorrador} disabled={saving}>Guardar borrador</Btn>
          <Btn onClick={enviar} disabled={saving || (!tieneSponsor || !tieneKeyUser)}>{rvOK ? "Reenviar actualizado" : "Enviar relevamiento"}</Btn>
        </ActionBar>
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
  const [resultado, setResultado] = useState(null);
  const [cuitUnico, setCuitUnico] = useState("");
  const [fileMsg, setFileMsg] = useState("");
  const arch = data.sucursalesArchivo;

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) { setFileMsg("Subí el archivo como CSV o TXT (desde Excel: Guardar como → CSV). Si solo tenés Excel, avisale a tu implementador."); return; }
    const r = new FileReader();
    r.onerror = () => setFileMsg("No pudimos leer el archivo. Probá de nuevo.");
    r.onload = () => { setFileMsg(""); setResultado(convertirSucursales(r.result, cuitUnico.trim())); };
    r.readAsText(f);
  };

  const confirmar = () => {
    const contenido = exportarTemplateSucursales(resultado.salida);
    descargar("sucursales-cabecera-nubceo.csv", contenido);
    persist({
      sucursalesArchivo: { name: "sucursales-cabecera-nubceo.csv", size: contenido.length, ts: now(), dataUrl: aDataUrl(contenido), validacion: { ok: true, items: [{ tipo: "ok", txt: resultado.salida.length + " sucursales en formato template" + (resultado.noIdentificadas ? " · " + resultado.noIdentificadas + " como 'No identificada'" : "") }] } },
      sucursales: resultado.salida.map((s) => ({ nombre: s.name, direccion: "", localidad: "", comercio: s.platformBranchReference })),
    }, "Generó el template de sucursales validado (" + resultado.salida.length + " filas" + (resultado.noIdentificadas ? ", " + resultado.noIdentificadas + " no identificadas" : "") + ")");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 6px" }}>Cargá tu listado interno de sucursales</h2>
        <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "0 0 14px" }}>
          No hace falta que armes el template de Nubceo a mano: subí el listado como lo tengas internamente y el portal lo convierte y valida. Tu archivo tiene que tener estas columnas (los nombres pueden variar, las detectamos solas): <b>número de comercio</b> (el que asigna cada procesadora), <b>procesadora</b>, <b>identificador del punto de venta</b> (tu código interno de PDV), <b>nombre de la sucursal</b> y, si tenés más de un CUIT, <b>a qué empresa corresponde</b>.
        </p>
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
            <tbody>
              {EJEMPLO_SUC.map((fila, i) => (
                <tr key={i}>
                  {fila.map((c, j) => (
                    <td key={j} style={{ border: "1px solid " + T.n200, padding: "6px 10px", background: i === 0 ? T.primary50 : "#fff", fontWeight: i === 0 ? 700 : 400, color: i === 0 ? T.primary900 : T.n800 }}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 13, color: T.n600, lineHeight: 1.55, background: T.primary50, border: "1px solid " + T.primary100, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
          Fijate en el ejemplo: una misma sucursal (Casa Central) aparece una vez <b>por cada procesadora</b> con la que cobra, siempre con el mismo PDV. Las reglas que validamos: <b>sin celdas vacías</b>, <b>los códigos de PDV no pueden repetirse entre sucursales distintas</b>, <b>sin filas duplicadas</b>, y si hay números de comercio cuya procesadora no se identifica, van a una sucursal temporaria llamada <b>"No identificada"</b> para revisar con tu implementador.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: 4 }}>
          <div>
            <Label>Si toda tu operación es de un solo CUIT, cargalo acá (opcional)</Label>
            <Input placeholder="Ej: 30-11111111-1 — se completa en todas las filas" value={cuitUnico} onChange={(e) => setCuitUnico(e.target.value)} />
          </div>
          <label style={{ display: "inline-block" }}>
            <input type="file" accept=".csv,.txt" onChange={onFile} style={{ display: "none" }} />
            <span style={{ display: "inline-block", background: T.primary, color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Subir mi listado</span>
          </label>
        </div>
        {fileMsg && <div style={{ marginTop: 10, background: T.errBg, color: T.errTx, fontSize: 13, padding: "9px 12px", borderRadius: 8 }}>{fileMsg}</div>}
      </Card>

      {resultado && (
        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 10px" }}>Resultado de la conversión</h3>
          {resultado.errores.map((e, i) => <div key={i} style={{ fontSize: 13, color: T.errTx, background: T.errBg, padding: "7px 10px", borderRadius: 8, marginBottom: 6 }}>✕ {e}</div>)}
          {resultado.avisos.map((a, i) => <div key={i} style={{ fontSize: 13, color: T.warnTx, background: T.warnBg, padding: "7px 10px", borderRadius: 8, marginBottom: 6 }}>! {a}</div>)}
          {resultado.ok && (
            <>
              <div style={{ fontSize: 13, color: T.okTx, background: T.okBg, padding: "7px 10px", borderRadius: 8, marginBottom: 12 }}>✓ {resultado.salida.length} sucursales convertidas al template oficial ({TEMPLATE_SUCURSALES.join(", ")}).</div>
              <div style={{ overflowX: "auto", marginBottom: 14 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 620 }}>
                  <tbody>
                    <tr>{TEMPLATE_SUCURSALES.map((c) => <td key={c} style={{ border: "1px solid " + T.n200, padding: "5px 8px", background: T.primary50, fontWeight: 700, color: T.primary900 }}>{c}</td>)}</tr>
                    {resultado.salida.slice(0, 6).map((s, i) => (
                      <tr key={i}>{TEMPLATE_SUCURSALES.map((c) => <td key={c} style={{ border: "1px solid " + T.n200, padding: "5px 8px", color: T.n800 }}>{s[c]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
                {resultado.salida.length > 6 && <div style={{ fontSize: 12, color: T.n400, marginTop: 4 }}>… y {resultado.salida.length - 6} filas más.</div>}
              </div>
              <Btn onClick={confirmar} disabled={saving}>Descargar template validado y completar el paso</Btn>
            </>
          )}
          {!resultado.ok && <div style={{ fontSize: 13, color: T.n600, marginTop: 6 }}>Corregí los puntos marcados con ✕ en tu archivo y volvé a subirlo.</div>}
        </Card>
      )}

      {arch && (
        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 10px" }}>📄 Tu template está listo — último paso en Nubceo</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: T.okBg, border: "1px solid #bbe8c9", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.okTx }}>{arch.name}</div>
              <div style={{ fontSize: 12, color: T.okTx, opacity: 0.8 }}>Generado el {fmtDate(arch.ts)}</div>
            </div>
            {arch.dataUrl && <a href={arch.dataUrl} download={arch.name} style={{ fontSize: 13, fontWeight: 600, color: T.okTx }}>Volver a descargar</a>}
          </div>
          <div style={{ fontSize: 13.5, color: T.n800, lineHeight: 1.65, background: T.primary50, border: "1px solid " + T.primary100, borderRadius: 8, padding: "12px 14px" }}>
            Para completar la carga, entrá a Nubceo y andá a <b>Mi negocio → Sucursales cabecera → Crear masivamente</b>, y subí ahí este archivo. Si te aparece algún error o algo no coincide, <b>contactá a tu implementador</b> — para eso estamos.
          </div>
        </Card>
      )}

      {!arch && !meta.sucursalesOmitido && (
        <div style={{ textAlign: "right" }}>
          <Btn variant="ghost" size="sm" onClick={() => act("omitirSucursales")}>Omitir este paso por ahora →</Btn>
        </div>
      )}
    </div>
  );
}

// ── Paso 5: Conexión API o CSV ──
function TabConexion({ data, persist, session, setAll }) {
  const rv = data.relevamiento || {};
  const via = rv.d1 === "api" || rv.d1 === "csv" || rv.d1 === "ambos" ? rv.d1 : null;
  const elegir = (v) => v !== via && persist({ relevamiento: { ...rv, d1: v } }, "Definió la vía de conexión: " + (v === "ambos" ? "AMBOS (un PDV por API y otro por CSV)" : v.toUpperCase()));

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
    </div>
  );
}

function SeccionApi({ data, session, setAll, titulo }) {
  const [copied, setCopied] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const copy = async (label, val) => { try { await navigator.clipboard.writeText(val); setCopied(label); setTimeout(() => setCopied(""), 2000); } catch (e) { } };
  const reunion = (data.eventos || []).find((e) => e.tipo === "reunion_tecnica" && e.estado !== "cancelado");
  const c = data.apiCreds;
  const involucrados = (data.involucrados || []).filter((p) => (p.nombre || "").trim() && (p.email || "").trim());
  return (
    <>
      {titulo && <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: -6 }}>{titulo}</div>}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: 0 }}>Tus credenciales de API — entorno sandbox</h2>
          {c && <Badge tone="green">Generadas el {fmtDate(c.createdAt)}</Badge>}
        </div>
        <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "8px 0 16px" }}>
          Con estas credenciales se integra el envío de ventas contra el entorno de pruebas. <b>Si el desarrollo no lo hace Nubceo, pasale estas credenciales a tu desarrollador junto con la documentación de la API</b> (link abajo). Tratalas como una contraseña.
        </p>
        {c ? (
          <>
            <CredRow label="API Key" value={c.key} show={showCreds} copied={copied === "key"} onCopy={() => copy("key", c.key)} />
            <CredRow label="API Secret" value={c.secret} show={showCreds} copied={copied === "secret"} onCopy={() => copy("secret", c.secret)} />
            <Btn variant="ghost" size="sm" onClick={() => setShowCreds(!showCreds)}>{showCreds ? "Ocultar valores" : "Mostrar valores"}</Btn>
          </>
        ) : <div style={{ color: T.n400, fontSize: 14 }}>Generando credenciales…</div>}
        <div style={{ marginTop: 16 }}>
          <a href={DOCS.apiVentas} target="_blank" rel="noreferrer" style={{ display: "inline-block", fontSize: 14, fontWeight: 600, color: T.primary }}>📘 Documentación de la API de ventas →</a>
        </div>
      </Card>
      <Card>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 6px" }}>🗓 Reunión técnica con nuestro equipo</h2>
        {reunion ? <EventoLinea e={reunion} /> : (
          <>
            <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "0 0 14px" }}>
              Coordiná una reunión técnica con Eduardo André o Santiago Suarez para repasar la integración con tu equipo de desarrollo: autenticación, estructura del endpoint de ventas y dudas del sandbox. Antes de confirmar podés sumar a tu desarrollador aunque no esté cargado como involucrado.
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
  const titulo = etapa === "sandbox" ? "Pruebas en sandbox" : "Go-live";
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
function KanbanBoard({ clientes, onAbrir, onMoverFase }) {
  const [arrastrando, setArrastrando] = useState(null); // código del cliente en drag
  const [sobreCol, setSobreCol] = useState(null);

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
      {FASES.map((faseNombre, faseIdx) => {
        const items = clientes.filter((c) => c.phase === faseIdx);
        return (
          <div
            key={faseIdx}
            onDragOver={(e) => { e.preventDefault(); setSobreCol(faseIdx); }}
            onDragLeave={() => setSobreCol((v) => (v === faseIdx ? null : v))}
            onDrop={(e) => { e.preventDefault(); const code = e.dataTransfer.getData("text/plain"); if (code) onMoverFase(code, faseIdx); setArrastrando(null); setSobreCol(null); }}
            style={{
              minWidth: 240, width: 240, flexShrink: 0, background: sobreCol === faseIdx ? T.primary50 : T.n50,
              border: "1.5px dashed " + (sobreCol === faseIdx ? T.primary : T.n200), borderRadius: 12, padding: 10,
              transition: "background .15s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "2px 4px 10px" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.n800 }}>{faseIdx + 1} · {faseNombre}</span>
              <span style={{ fontSize: 11.5, color: T.n400, fontWeight: 700 }}>{items.length}</span>
            </div>
            <div style={{ display: "grid", gap: 8, minHeight: 40 }}>
              {items.map((cli) => {
                const pct = Math.round((cli.completados / cli.totalPasos) * 100);
                const alertas = detectarAlertas(cli.relevamiento);
                return (
                  <div
                    key={cli.code}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", cli.code); setArrastrando(cli.code); }}
                    onDragEnd={() => setArrastrando(null)}
                    onClick={() => onAbrir(cli.code)}
                    style={{
                      background: "#fff", border: "1px solid " + T.n200, borderRadius: 10, padding: 10, cursor: "grab",
                      opacity: arrastrando === cli.code ? 0.4 : 1, boxShadow: "0 1px 2px rgba(13,17,32,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, background: T.n50, border: "1px solid " + T.n200, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: T.n400 }}>
                        {cli.logo ? <img src={cli.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : cli.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.n900, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cli.name}</div>
                    </div>
                    <div style={{ height: 4, borderRadius: 100, background: T.n100, overflow: "hidden", marginBottom: 7 }}>
                      <div style={{ width: pct + "%", height: "100%", background: pct === 100 ? "#22c55e" : T.primary, borderRadius: 100 }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: T.n400, marginBottom: 6 }}>
                      {cli.implementadorNombre || "Sin implementador/a"}{cli.desarrolladorNombre ? " · " + cli.desarrolladorNombre + " (dev)" : ""}
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {(() => { const sg = semaforoGoLive(cli.goLiveEstimado); return sg ? <Badge tone={sg.tone}>🎯 {sg.txt}</Badge> : null; })()}
                      {!cli.implementadorId && <Badge tone="amber">Sin asignar</Badge>}
                      {cli.estadoPago === "con_deuda" && <Badge tone="red">💰 Deuda {diasDesde(cli.deudaDesde)}d</Badge>}
                      {alertas.length > 0 && <Badge tone="red">{alertas.length} alerta{alertas.length > 1 ? "s" : ""}</Badge>}
                      {cli.notasCount > 0 && <Badge tone="gray">📝 {cli.notasCount}</Badge>}
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <div style={{ fontSize: 11.5, color: T.n400, textAlign: "center", padding: "10px 0" }}>Sin clientes</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Menú lateral del panel de equipo ───
const NAV_ITEMS = [
  ["clientes", "🗂", "Clientes"],
  ["tablero", "▦", "Tablero"],
  ["equipo", "👥", "Equipo"],
  ["config", "⚙", "Configuración"],
  ["perfil", "🙂", "Mi perfil"],
];
function Sidebar({ activo, onCambiar }) {
  return (
    <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid " + T.n200, background: "#fff", padding: "20px 12px", minHeight: "calc(100vh - 61px)" }}>
      <div style={{ display: "grid", gap: 3 }}>
        {NAV_ITEMS.map(([id, icon, lbl]) => (
          <div key={id} onClick={() => onCambiar(id)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer",
            fontSize: 13.5, fontWeight: activo === id ? 700 : 500,
            background: activo === id ? T.primary50 : "transparent", color: activo === id ? T.primary800 : T.n600,
          }}>
            <span style={{ fontSize: 15 }}>{icon}</span>{lbl}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Fila de una persona del equipo, con acciones según tipo de usuario del que mira ───
function EquipoLista({ miembros, esSuperuser, onEliminar, onSetTipoUsuario, miCodigo }) {
  if (!miembros.length) return <div style={{ fontSize: 13, color: T.n400 }}>Todavía no hay nadie en este equipo.</div>;
  const etiquetaTipo = (t) => t === "superuser" ? "Superuser" : t === "admin" ? "Admin" : "Colaborador";
  const colorTipo = (t) => t === "superuser" ? T.primary800 : t === "admin" ? T.okTx : T.n600;
  const bgTipo = (t) => t === "superuser" ? T.primary50 : t === "admin" ? T.okBg : T.n100;
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

function AdminPortal({ session, onLogout }) {




  const [sel, setSel] = useState(null); // código del cliente seleccionado
  const [selData, setSelData] = useState(null);
  const [selMeta, setSelMeta] = useState(null);
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
  const [cfgMsg, setCfgMsg] = useState("");
  const [modulo, setModulo] = useState("clientes"); // clientes | tablero | perfil | equipo | config
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
  const [editLogo, setEditLogo] = useState(null);
  const [editGoLive, setEditGoLive] = useState("");
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
  const [newContactos, setNewContactos] = useState([{ nombre: "", cargo: "", email: "", telefono: "", rol: "sponsor" }]);
  const [newComercial, setNewComercial] = useState("");
  const [newGoLive, setNewGoLive] = useState(""); // formato YYYY-MM-DD
  const [miNombre, setMiNombre] = useState("");
  const [miRedmineKey, setMiRedmineKey] = useState("");
  const [tableroFull, setTableroFull] = useState(false);
  const [panelCliente, setPanelCliente] = useState(null); // código del cliente en el panel lateral del tablero
  const [panelData, setPanelData] = useState(null);
  const tableroRef = useRef(null);
  const sc = session.code;

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
      setMsg("No se pudo cargar el listado: " + e.message);
    }
  }, [sc]);

  useEffect(() => { cargarListado(); }, [cargarListado]);

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
    } catch (e) { flash(e.message); }
  };

  const restaurarCliente = async (code, nombre) => {
    if (!window.confirm("¿Restaurar el cliente " + nombre + "? Vuelve a aparecer en el listado activo.")) return;
    try {
      await api("restoreClient", { sessionCode: sc, code, who: session.who });
      flash(nombre + " fue restaurado.");
      cargarListado();
      cargarArchivados();
    } catch (e) { flash(e.message); }
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
    } catch (e) { flash(e.message); }
  };

  const setTipoUsuario = async (teamId, tipo, nombre) => {
    const etiquetas = { superuser: "Superuser", admin: "Admin", colaborador: "Colaborador" };
    if (!window.confirm("¿Cambiar el tipo de usuario de " + nombre + " a " + etiquetas[tipo] + "?")) return;
    try {
      await api("setTipoUsuario", { sessionCode: sc, teamId, tipo, who: session.who });
      flash("Tipo de usuario actualizado ✓", 3000);
      cargarListado();
    } catch (e) { flash(e.message, 5000); }
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
  }, [sc]);

  const flash = (texto, ms = 4000) => { setMsg(texto); setTimeout(() => setMsg(""), ms); };

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
    } catch (e) { flash(e.message); }
  };

  const cerrarDetalle = () => { setSel(null); setSelData(null); setSelMeta(null); cargarListado(); };

  const crearCliente = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    try {
      await api("createClient", {
        sessionCode: sc, nombre: newName, codigo: newCode, tenant: newTenant, razonSocial: newRazonSocial, cuits: newCuits, logo: newLogo,
        comercial: newComercial, goLiveEstimado: newGoLive, contactos: newContactos.filter((c) => c.nombre.trim()),
      });
      flash("Cliente creado. Compartile el código " + newCode.trim().toUpperCase() + ". Al primer login se dispara el alta en Redmine y sus credenciales de API.", 5000);
      setNewName(""); setNewCode(""); setNewTenant(""); setNewRazonSocial(""); setNewCuits([]); setNewCuitInput(""); setNewLogo(null);
      setNewComercial(""); setNewGoLive(""); setNewContactos([{ nombre: "", cargo: "", email: "", telefono: "", rol: "sponsor" }]);
      cargarListado();
    } catch (e) { flash(e.message); }
  };

  const crearImplementador = async () => {
    if (!newImplCode.trim() || !newImplName.trim()) return;
    try {
      await api("createTeam", { sessionCode: sc, nombre: newImplName, codigo: newImplCode, email: newImplEmail, rol: newImplRol, foto: newImplFoto, tipoUsuario: newImplTipo });
      const etiquetaTipo = { superuser: "Superuser", admin: "Admin", colaborador: "Colaborador" }[newImplTipo] || "Colaborador";
      flash("Persona creada como " + etiquetaTipo + ". Su código de acceso es " + newImplCode.trim().toUpperCase() + ". Compartíselo por un canal seguro.", 5000);
      setNewImplName(""); setNewImplCode(""); setNewImplEmail(""); setNewImplRol("implementador"); setNewImplFoto(null);
      cargarListado();
    } catch (e) { flash(e.message); }
  };

  const cambiarFase = async (code, phase) => {
    try {
      const r = await api("setPhase", { sessionCode: sc, code, fase: phase, faseNombre: FASES[phase], who: session.who });
      if (sel === code) { setSelMeta(r.meta); setSelData(r.data); }
    } catch (e) { flash(e.message); }
  };

  const asignar = async (code, implementadorId, rol = "implementador") => {
    try {
      const r = await api("assignClient", { sessionCode: sc, code, implementadorId, rol, who: session.who });
      if (sel === code) { setSelMeta(r.meta); setSelData(r.data); }
      cargarListado();
    } catch (e) { flash(e.message); }
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
    } catch (e) { flash(e.message); }
  };

  const regenerarCreds = async () => {
    if (!sel) return;
    try {
      const r = await api("regenCreds", { sessionCode: sc, code: sel, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message); }
  };

  const cambiarEstadoProc = async (codigo, estado) => {
    if (!sel) return;
    try {
      const lista = (selData.procesadoras || []).map((p) => p.codigo === codigo ? { ...p, estado } : p);
      const r = await api("saveProcesadoras", { sessionCode: sc, code: sel, lista, who: session.who, log: "Actualizó el estado de una procesadora: " + codigo + " → " + estado });
      setSelData(r.data);
    } catch (e) { flash(e.message); }
  };

  const cambiarPrueba = async (etapa, status, notas) => {
    if (!sel) return;
    try {
      const r = await api("setPrueba", { sessionCode: sc, code: sel, etapa, status, notas, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message); }
  };

  const guardarMinuta = async (eventoId, minuta) => {
    if (!sel || !minuta.trim()) return;
    try {
      const r = await api("setMinuta", { sessionCode: sc, code: sel, eventoId, minuta: minuta.trim(), who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message); }
  };

  const guardarPlazo = async (paso, fechaLimite) => {
    if (!sel || !fechaLimite) return;
    try {
      const r = await api("setPlazo", { sessionCode: sc, code: sel, paso, fechaLimite, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message); }
  };
  const quitarPlazo = async (paso) => {
    if (!sel) return;
    try {
      const r = await api("quitarPlazo", { sessionCode: sc, code: sel, paso, who: session.who });
      setSelData(r.data);
    } catch (e) { flash(e.message); }
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
    } catch (e) { flash(e.message); }
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
    } catch (e) { flash(e.message); }
  };

  const agregarNota = async () => {
    if (!nota.trim() || !sel) return;
    try {
      const r = await api("addNote", { sessionCode: sc, code: sel, texto: nota.trim(), who: session.who });
      setSelData(r.data);
      setNota("");
    } catch (e) { flash(e.message); }
  };

  // ── Vista detalle de un cliente ──
  if (sel && selData) {
    const meta = selMeta || { name: sel, phase: 0 };
    const alertas = detectarAlertas(selData.relevamiento);
    return (
      <div>
        <Nav name="Panel del equipo" who={session.who} onLogout={onLogout} admin />
        <div style={{ maxWidth: 940, margin: "0 auto", padding: "26px 20px 60px" }}>
          <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Btn variant="ghost" size="sm" onClick={cerrarDetalle}>← Volver al listado</Btn>
            {session.tipoUsuario === "superuser" && <Btn variant="ghost" size="sm" onClick={() => archivarCliente(sel, meta.name)} style={{ color: T.n600 }}>📥 Archivar cliente</Btn>}
          </div>
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
                </div>
              </div>
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
                <span onClick={() => { setEditRazonSocial(meta.razonSocial || ""); setEditCuits(meta.cuits || []); setEditLogo(meta.logo || null); setEditGoLive(meta.goLiveEstimado || ""); setEditandoInfo(true); }} style={{ fontSize: 12.5, fontWeight: 600, color: T.primary, cursor: "pointer" }}>
                  ✎ Editar razón social / CUITs / logo / fecha de go-live
                </span>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <ImageUpload value={editLogo} onChange={setEditLogo} label="logo" />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn variant="ghost" size="sm" onClick={() => setEditandoInfo(false)}>Cancelar</Btn>
                      <Btn size="sm" onClick={async () => { try { const r = await api("setClientInfo", { sessionCode: sc, code: sel, razonSocial: editRazonSocial, cuits: editCuits, logo: editLogo, goLiveEstimado: editGoLive || null, who: session.who }); setSelMeta(r.meta); setSelData(r.data); setEditandoInfo(false); } catch (e) { flash(e.message); } }}>Guardar</Btn>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

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
                    <div style={{ fontSize: 11.5, color: T.n400, textTransform: "uppercase", letterSpacing: "0.04em" }}>Fee</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.n800 }}>{meta.finanzas?.fee != null ? fmtMoneda(meta.finanzas.fee, meta.finanzas.moneda) : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: T.n400, textTransform: "uppercase", letterSpacing: "0.04em" }}>Costo de implementación</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.n800 }}>{meta.finanzas?.costoImplementacion != null ? fmtMoneda(meta.finanzas.costoImplementacion, meta.finanzas.moneda) : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: T.n400, textTransform: "uppercase", letterSpacing: "0.04em" }}>Estado de pago</div>
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

          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: 0 }}>Alta en Redmine y credenciales de API</h3>
              {selData.redmine
                ? <Badge tone={selData.redmine.status === "enviado" ? "green" : "amber"}>{selData.redmine.status === "enviado" ? "Tickets creados en Redmine" : "En cola de envío"}</Badge>
                : <Badge tone="gray">Se dispara con el primer login del cliente</Badge>}
            </div>
            {meta.tenant && <div style={{ fontSize: 13, color: T.n600, marginTop: 6 }}>Tenant productivo: <b style={{ color: T.n800 }}>{meta.tenant}</b></div>}
            {selData.redmine && (
              <>
                {selData.redmine.detail && <div style={{ marginTop: 10, background: T.warnBg, color: T.warnTx, fontSize: 13, padding: "9px 12px", borderRadius: 8, lineHeight: 1.5 }}>{selData.redmine.detail}</div>}
                <details style={{ marginTop: 12 }}>
                  <summary style={{ fontSize: 13, fontWeight: 600, color: T.primary, cursor: "pointer" }}>Ver payload de los tickets ({selData.redmine.payloads.length})</summary>
                  {selData.redmine.payloads.map((p, i) => (
                    <div key={i} style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.n600, marginBottom: 4 }}>{p.titulo}</div>
                      <pre style={{ background: T.n50, border: "1px solid " + T.n200, borderRadius: 8, padding: 12, fontSize: 12, overflowX: "auto", margin: 0, color: T.n800 }}>{JSON.stringify(p.body, null, 2)}</pre>
                    </div>
                  ))}
                </details>
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
                  API Key sandbox: <b style={{ fontFamily: "ui-monospace, Menlo, monospace", color: T.n800 }}>{selData.apiCreds.key}</b>
                  <span style={{ color: T.n400 }}> · generada {fmtDate(selData.apiCreds.createdAt)}</span>
                </div>
                <Btn variant="ghost" size="sm" onClick={regenerarCreds}>Regenerar credenciales</Btn>
              </div>
            )}
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <Card>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 4px" }}>Relevamiento</h3>
              {selData.relevamientoEnviado
                ? <>
                    <Badge tone="green">Enviado {fmtDate(selData.relevamientoEnviado)}</Badge>
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
            <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 8px" }}>Sucursales ({(selData.sucursales || []).length})</h3>
                {selData.sucursalesArchivo && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: T.okBg, border: "1px solid #bbe8c9", marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.okTx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selData.sucursalesArchivo.name}</div>
                      <div style={{ fontSize: 11.5, color: T.okTx, opacity: 0.8 }}>{fmtDate(selData.sucursalesArchivo.ts)}</div>
                    </div>
                    <a href={selData.sucursalesArchivo.dataUrl} download={selData.sucursalesArchivo.name} style={{ fontSize: 12.5, fontWeight: 600, color: T.okTx }}>Descargar</a>
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
                    <span style={{ fontSize: 13.5, color: T.n800 }}>{p.nombre} <span style={{ color: T.n400, fontSize: 11.5 }}>({p.pais})</span></span>
                    <select value={p.estado} onChange={(e) => cambiarEstadoProc(p.codigo, e.target.value)} style={{ height: 30, borderRadius: 6, border: "1px solid " + T.n200, fontSize: 12.5, fontFamily: "inherit", color: T.n800, background: "#fff", padding: "0 6px" }}>
                      <option value="no_conectado">No conectado</option>
                      <option value="en_espera">En espera de doc/credenciales</option>
                      <option value="conectado">Conectado</option>
                    </select>
                  </div>
                ))}
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
            </div>
          </div>

          {selData.diagrama && (
            <Card style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 4px" }}>Diagrama del proceso del cliente</h3>
              <p style={{ fontSize: 12.5, color: T.n400, margin: "0 0 10px" }}>Generado automáticamente al enviar el relevamiento — insumo para el workshop de Fase 3.</p>
              <MermaidView code={selData.diagrama} />
            </Card>
          )}

          <Card style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: T.n900, margin: "0 0 10px" }}>Reuniones y eventos</h3>
            {(selData.eventos || []).length === 0 && <div style={{ fontSize: 13.5, color: T.n400 }}>Todavía no hay reuniones agendadas. El cliente agenda workshop, reunión técnica y capacitaciones desde su portal.</div>}
            <div style={{ display: "grid", gap: 12 }}>
              {(selData.eventos || []).map((e) => <AdminEvento key={e.id} e={e} onMinuta={guardarMinuta} />)}
            </div>
          </Card>

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
                />
              ))}
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 16 }}>
            <AdminPrueba etapa="sandbox" titulo="Pruebas en sandbox (Fase 5)" prueba={selData.pruebas?.sandbox} onSave={cambiarPrueba} />
            <AdminPrueba etapa="golive" titulo="Pruebas de go-live (Fase 7)" prueba={selData.pruebas?.golive} onSave={cambiarPrueba} />
          </div>

          <Card style={{ marginTop: 16 }}>
            <TabHistorial history={selData.history} />
          </Card>
        </div>
      </div>
    );
  }

  const clientesVisibles = (clients || [])
    .filter((c) => !filtroImpl || c.implementadorId === filtroImpl)
    .filter((c) => !filtroDev || c.desarrolladorId === filtroDev)
    .filter((c) => !busqueda.trim() || c.name.toLowerCase().includes(busqueda.trim().toLowerCase()) || c.code.toLowerCase().includes(busqueda.trim().toLowerCase()));
  const implementadoresTeam = team.filter((m) => m.rol === "implementador");
  const devsTeam = team.filter((m) => m.rol === "desarrollador");
  const finanzasTeam = team.filter((m) => m.rol === "finanzas");

  return (
    <div>
      <Nav name="Panel del equipo" who={session.who} onLogout={onLogout} admin />
      <div style={{ display: "flex" }}>
        <Sidebar activo={modulo} onCambiar={(m) => { setModulo(m); setPanelCliente(null); }} />
        <div style={{ flex: 1, minWidth: 0, padding: "26px 24px 60px", maxWidth: 1180, margin: "0 auto" }}>
          {msg && <Alert tone="success" style={{ marginBottom: 16 }}>{msg}</Alert>}

          {/* ══════════ MÓDULO: CLIENTES ══════════ */}
          {modulo === "clientes" && (
            <>
              <Card style={{ marginBottom: 16 }}>
                <SectionHeader title="Dar de alta un cliente" />
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.2fr", gap: 10, marginBottom: 10 }}>
                  <div><Label>Nombre del cliente</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Freddo" /></div>
                  <div><Label>Código de acceso</Label><Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Ej: FREDDO26" /></div>
                  <div><Label>Tenant productivo</Label><Input value={newTenant} onChange={(e) => setNewTenant(e.target.value)} placeholder="Ej: freddo-prod" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 1fr", gap: 10, marginBottom: 14 }}>
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
                  <div><Label>Comercial de la cuenta</Label><Input value={newComercial} onChange={(e) => setNewComercial(e.target.value)} placeholder="Nombre del ejecutivo" /></div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <Label>Fecha estimada de go-live (opcional)</Label>
                    <Input type="date" value={newGoLive} onChange={(e) => setNewGoLive(e.target.value)} />
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
                  Al primer login del cliente, el portal dispara el alta en Redmine (Feature del cliente con su tenant original + US de tenant sandbox) y genera sus credenciales de API sandbox.
                </div>
              </Card>

              <Card>
                <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: "0 0 14px" }}>
                  Clientes en implementación{clients ? " (" + clientesVisibles.length + " de " + clients.length + ")" : ""}
                </h2>
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
                  {(busqueda || filtroImpl || filtroDev) && <Btn variant="ghost" size="sm" onClick={() => { setBusqueda(""); setFiltroImpl(""); setFiltroDev(""); }}>Limpiar filtros</Btn>}
                </div>

                {clients && clients.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
                    {[
                      ["Clientes", clients.length],
                      ["Sin asignar", clients.filter((c) => !c.implementadorId).length],
                      ["Avance promedio", Math.round(clients.reduce((a, c) => a + c.completados / c.totalPasos, 0) / clients.length * 100) + "%"],
                      ["Con deuda", clients.filter((c) => c.estadoPago === "con_deuda").length],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ background: T.primary50, border: "1px solid " + T.primary100, borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: T.primary800 }}>{val}</div>
                        <div style={{ fontSize: 12, color: T.primary800, opacity: 0.75 }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                )}

                {!clients && <div style={{ color: T.n400, fontSize: 14 }}>Cargando clientes…</div>}
                {clients && clientesVisibles.length === 0 && <div style={{ color: T.n400, fontSize: 14 }}>Ningún cliente coincide con la búsqueda/filtro.</div>}
                <div style={{ display: "grid", gap: 10 }}>
                  {clientesVisibles.map((cli) => {
                    const alertas = detectarAlertas(cli.relevamiento);
                    const pendRv = !cli.relevamientoEnviado;
                    const pct = Math.round((cli.completados / cli.totalPasos) * 100);
                    return (
                      <div key={cli.code} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, border: "1px solid " + T.n200, background: "#fff" }}>
                        <div onClick={() => abrir(cli.code)} style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0, cursor: "pointer", background: T.n50, border: "1px solid " + T.n200, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: T.n400 }}>
                          {cli.logo ? <img src={cli.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : cli.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div onClick={() => abrir(cli.code)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                          <div style={{ fontSize: 15.5, fontWeight: 600, color: T.n900 }}>
                            {cli.name} <span style={{ fontSize: 12, fontWeight: 500, color: T.n400 }}>· código {cli.code}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: T.n400, marginTop: 2 }}>Última actividad: {cli.ultimaActividad ? fmtDate(cli.ultimaActividad) : "sin actividad"}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                            <div style={{ flex: 1, maxWidth: 220, height: 6, borderRadius: 100, background: T.n100, overflow: "hidden" }}>
                              <div style={{ width: pct + "%", height: "100%", background: pct === 100 ? "#22c55e" : T.primary, borderRadius: 100 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: T.n600 }}>{cli.completados}/{cli.totalPasos} pasos</span>
                          </div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <select value={cli.implementadorId || ""} onChange={(e) => asignar(cli.code, e.target.value || null, "implementador")}
                            style={{ fontSize: 12, borderRadius: 6, border: "1px solid " + T.n200, padding: "4px 6px", color: cli.implementadorId ? T.n800 : T.n400, background: "#fff", maxWidth: 150 }}>
                            <option value="">Sin implementador/a</option>
                            {implementadoresTeam.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                          </select>
                          <select value={cli.desarrolladorId || ""} onChange={(e) => asignar(cli.code, e.target.value || null, "desarrollador")}
                            style={{ fontSize: 12, borderRadius: 6, border: "1px solid " + T.n200, padding: "4px 6px", color: cli.desarrolladorId ? T.n800 : T.n400, background: "#fff", maxWidth: 150 }}>
                            <option value="">Sin desarrollador/a</option>
                            {devsTeam.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                          </select>
                        </div>
                        <div onClick={() => abrir(cli.code)} style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", cursor: "pointer", maxWidth: 180 }}>
                          <Badge tone="blue">Fase {cli.phase + 1} · {FASES[cli.phase]}</Badge>
                          {!cli.implementadorId && <Badge tone="amber">Sin asignar</Badge>}
                          {pendRv && <Badge tone="amber">Relevamiento pendiente</Badge>}
                          {cli.omitioSucursales && <Badge tone="amber">Sucursales pendiente</Badge>}
                          {cli.estadoPago === "con_deuda" && <Badge tone="red">💰 Con deuda</Badge>}
                          {alertas.length > 0 && <Badge tone="red">{alertas.length} alerta{alertas.length > 1 ? "s" : ""}</Badge>}
                        </div>
                        {session.tipoUsuario === "superuser" && <span onClick={(e) => { e.stopPropagation(); archivarCliente(cli.code, cli.name); }} title="Archivar cliente (se puede restaurar)" style={{ cursor: "pointer", color: T.n400, fontSize: 14, padding: 4 }}>📥</span>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}

          {/* ══════════ MÓDULO: TABLERO ══════════ */}
          {modulo === "tablero" && (
            <div ref={tableroRef} style={{ background: tableroFull ? "#fff" : "transparent", padding: tableroFull ? 20 : 0, minHeight: tableroFull ? "100vh" : "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: 0 }}>Tablero de implementación</h2>
                  <p style={{ fontSize: 12.5, color: T.n400, margin: "4px 0 0" }}>La fase avanza sola a medida que se completan los pasos — arrastrá una tarjeta para pisarlo a mano.</p>
                </div>
                <Btn variant="secondary" size="sm" onClick={toggleFullscreen}>{tableroFull ? "✕ Salir de pantalla completa" : "⛶ Pantalla completa (para reuniones)"}</Btn>
              </div>
              <KanbanBoard clientes={clientesVisibles} onAbrir={abrirPanelKanban} onMoverFase={(code, fase) => cambiarFase(code, fase)} />
            </div>
          )}

          {/* ══════════ MÓDULO: EQUIPO ══════════ */}
          {modulo === "equipo" && (
            <>
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

              <Card>
                <SectionHeader title="Agregar persona al equipo" subtitle="Cada persona entra con su propio código. El «Rol» describe qué hace en el equipo (informativo). El «Tipo de usuario» decide qué puede hacer en el portal: Superuser (todo, incluye eliminar y archivar), Admin (crea clientes y usuarios, no elimina), Colaborador (ve y trabaja, no crea). Solo un Superuser puede cambiar el tipo de usuario de los demás." />
                <div style={{ display: "grid", gridTemplateColumns: session.tipoUsuario === "superuser" ? "1.2fr 1fr 1.2fr 0.8fr 0.9fr" : "1.2fr 1fr 1.2fr 0.8fr", gap: 10, marginBottom: 10 }}>
                  <div><Label>Nombre</Label><Input value={newImplName} onChange={(e) => setNewImplName(e.target.value)} placeholder="Ej: Fernanda" /></div>
                  <div><Label>Código de acceso</Label><Input value={newImplCode} onChange={(e) => setNewImplCode(e.target.value)} placeholder="Ej: FER-IMPL" /></div>
                  <div><Label>Mail (para que el cliente lo contacte)</Label><Input value={newImplEmail} onChange={(e) => setNewImplEmail(e.target.value)} placeholder="Ej: fernanda@nubceo.com" /></div>
                  <div>
                    <Label>Rol</Label>
                    <select value={newImplRol} onChange={(e) => setNewImplRol(e.target.value)} style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                      <option value="implementador">Implementador/a</option>
                      <option value="desarrollador">Desarrollador/a</option>
                      <option value="finanzas">Finanzas</option>
                    </select>
                  </div>
                  {session.tipoUsuario === "superuser" && (
                    <div>
                      <Label>Tipo de usuario</Label>
                      <select value={newImplTipo} onChange={(e) => setNewImplTipo(e.target.value)} style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid " + T.n200, padding: "0 10px", fontSize: 14, fontFamily: "inherit", color: T.n800, background: "#fff" }}>
                        <option value="colaborador">Colaborador</option>
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
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </>
          )}

          {/* ══════════ MÓDULO: CONFIGURACIÓN ══════════ */}
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
                      Número del ticket que va a quedar como "tarea padre" de la Feature de alta (y por lo tanto de toda la cadena). Cargalo solo si tu Redmine exige tarea padre en el tracker raíz — si no, dejalo vacío.
                    </div>
                  </div>
                  <Btn variant="secondary" onClick={guardarConfig}>Guardar</Btn>
                </div>
                {cfgMsg && <div style={{ marginTop: 10, fontSize: 13, color: T.okTx, fontWeight: 600 }}>{cfgMsg}</div>}
              </Card>
            </>
          )}

          {/* ══════════ MÓDULO: MI PERFIL ══════════ */}
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
                      <Label>🗓 Mi disponibilidad semanal</Label>
                      <div style={{ fontSize: 11.5, color: T.n400, marginBottom: 8 }}>Estos son los horarios que ven tus clientes al agendar workshop, reunión técnica, capacitación, etc. Si no cargás nada acá, no te van a poder agendar nada.</div>
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

        {/* Panel lateral rápido del tablero: se abre al hacer clic en una tarjeta */}
        {panelCliente && (
          <div onClick={() => setPanelCliente(null)} style={{ position: "fixed", inset: 0, background: "rgba(13,17,32,0.4)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: "92vw", height: "100%", background: "#fff", padding: 24, overflowY: "auto", boxShadow: "-8px 0 24px rgba(13,17,32,0.18)" }}>
              {!panelData ? (
                <div style={{ color: T.n400, fontSize: 14 }}>Cargando…</div>
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
                      ["Comercial de la cuenta", panelData.meta.comercial || "—"],
                      ["Tenant", panelData.meta.tenant || "—"],
                      ["Implementador/a", panelData.meta.implementadorNombre || "Sin asignar"],
                      ["Desarrollador/a", panelData.meta.desarrolladorNombre || "Sin asignar"],
                    ].map(([lbl, val]) => (
                      <div key={lbl}>
                        <div style={{ fontSize: 11, color: T.n400, textTransform: "uppercase", letterSpacing: "0.04em" }}>{lbl}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.n800 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid " + T.n100, paddingTop: 14, marginBottom: 18 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.n600, marginBottom: 8 }}>💰 Facturación</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: T.n400, textTransform: "uppercase" }}>Fee</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.n800 }}>{panelData.meta.finanzas?.fee != null ? fmtMoneda(panelData.meta.finanzas.fee, panelData.meta.finanzas.moneda) : "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: T.n400, textTransform: "uppercase" }}>Estado</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: panelData.meta.finanzas?.estadoPago === "con_deuda" ? T.errTx : T.okTx }}>
                          {panelData.meta.finanzas?.estadoPago === "con_deuda" ? "Con deuda" : "Al día"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Btn onClick={() => { setPanelCliente(null); abrir(panelCliente); }} style={{ width: "100%" }}>Ver ficha completa →</Btn>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fila de "Plazos y recordatorios": fecha límite por paso + estado del aviso ──
function FilaPlazo({ paso, completo, plazo, onGuardar, onQuitar, onEnviarAhora, onToggleManual }) {
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
function AdminEvento({ e, onMinuta }) {
  const [minuta, setMinuta] = useState(e.minuta || "");
  const [editando, setEditando] = useState(false);
  const realizado = e.estado === "realizado";
  return (
    <div style={{ border: "1px solid " + (realizado ? "#bbe8c9" : T.n200), borderRadius: 10, padding: "12px 14px", background: realizado ? T.okBg : "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: realizado ? T.okTx : T.n900 }}>{EVENTO_NOMBRES[e.tipo] || e.tipo}</span>
          <span style={{ fontSize: 12.5, color: T.n400 }}> · {new Date(e.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })} · {e.responsable}</span>
        </div>
        <Badge tone={realizado ? "green" : "blue"}>{realizado ? "Realizada, con minuta" : "Agendada"}</Badge>
      </div>
      {(e.invitados || []).length > 0 && (
        <div style={{ fontSize: 12, color: T.n400, marginTop: 4 }}>Invitados: {(e.invitados || []).map((p) => p.nombre).join(", ")}</div>
      )}
      {e.google_event_link && (
        <a href={e.google_event_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: T.primary, marginTop: 4, display: "inline-block" }}>📅 Ver en Google Calendar →</a>
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
