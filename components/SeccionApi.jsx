import { useState } from "react";
import { DOCS } from "../lib/nubceo";

// Token de tema (reutiliza T del PortalApp)
const T = {
  bg: "#eef4ff",
  card: "#ffffff",
  cardBorder: "#c7dcfd",
  primary: "#0a6bf4",
  primary50: "#e8f1fe",
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
  okBg: "#dcfce7",
  okTx: "#166534",
  okBorder: "#bbe8c9",
  warnBg: "#fef9c3",
  warnTx: "#854d0e",
  warnBorder: "#fde68a",
  errBg: "#fee2e2",
  errTx: "#991b1b",
  errBorder: "#fca5a5",
  infoBg: "#eef6ff",
  infoTx: "#0550c0",
  infoBorder: "#b9d2fb",
};

const SP = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 44 };

// Helpers (reutiliza de PortalApp.jsx)
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }) +
    " " +
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  );
};

/**
 * SeccionApi Mejorada
 * 
 * Flujo:
 * 1. Si NO hay credenciales (o son placeholder) → mostrar guía paso a paso
 * 2. Si SÍ hay credenciales válidas → mostrar credenciales + opción de cambiar
 * 3. Validación client-side básica (must start with "nub_sbx_", secret min 40 chars)
 * 4. Backend guarda y audita
 */
function SeccionApi({ data, session, setAll, titulo }) {
  const [copied, setCopied] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const [isLoadingCreds, setIsLoadingCreds] = useState(false);
  const [credsError, setCredsError] = useState("");
  const [credsSuccess, setCredsSuccess] = useState("");

  // Inputs para pegar credenciales
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiSecretInput, setApiSecretInput] = useState("");

  const copy = async (label, val) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const c = data.apiCreds;
  const esPlaceholder = !c || c.origen === "placeholder";
  const tieneCredsValidas = c && c.origen !== "placeholder";

  // Handler para guardar credenciales
  const guardarCredenciales = async () => {
    setCredsError("");
    setCredsSuccess("");

    // Validaciones client-side
    if (!apiKeyInput.trim()) {
      setCredsError("La API Key no puede estar vacía");
      return;
    }
    if (!apiSecretInput.trim()) {
      setCredsError("El Secret no puede estar vacío");
      return;
    }
    if (!apiKeyInput.startsWith("nub_sbx_")) {
      setCredsError("La API Key debe empezar con 'nub_sbx_'");
      return;
    }
    if (apiSecretInput.length < 40) {
      setCredsError("El Secret parece muy corto (mínimo 40 caracteres)");
      return;
    }

    setIsLoadingCreds(true);
    try {
      // Llamada a API backend
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "guardarCredenciales",
          clienteId: data.id,
          key: apiKeyInput.trim(),
          secret: apiSecretInput.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setCredsError(json.error || "Error al guardar credenciales");
        return;
      }

      setCredsSuccess("✓ Credenciales guardadas correctamente");
      setApiKeyInput("");
      setApiSecretInput("");

      // Re-fetch datos del cliente para mostrar las nuevas credenciales
      setTimeout(() => {
        setAll({});
      }, 1500);
    } catch (err) {
      setCredsError("Error de conexión: " + err.message);
    } finally {
      setIsLoadingCreds(false);
    }
  };

  return (
    <>
      {titulo && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.primary,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: -6,
          }}
        >
          {titulo}
        </div>
      )}

      {/* ────── CASO 1: No hay credenciales o son placeholder ────── */}
      {esPlaceholder && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>🔑</span>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: 0 }}>
                Obtené tus credenciales de API Nubceo
              </h2>
              <p style={{ fontSize: 13, color: T.n600, margin: "4px 0 0" }}>
                Las claves se generan en tu cuenta Nubceo, no aquí
              </p>
            </div>
          </div>

          <Alert tone="info">
            <p style={{ margin: 0 }}>
              <b>¿Por qué?</b> Así mantenés el control total de tus credenciales. El portal
              de implementación solo los guarda para referencia de tu equipo.
            </p>
          </Alert>

          <div style={{ marginTop: SP.lg }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: T.n900,
                margin: "0 0 12px",
              }}
            >
              Pasos para obtener tus claves:
            </h3>
            <ol
              style={{
                margin: 0,
                paddingLeft: 24,
                color: T.n700,
                lineHeight: 1.7,
                fontSize: 14,
              }}
            >
              <li>Abrí tu cuenta en Nubceo: {" "}
                <a
                  href="https://app.nubceo.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: T.primary, fontWeight: 500 }}
                >
                  app.nubceo.com
                </a>
              </li>
              <li>
                Andá a <b>Configuración</b> (icono de engranaje arriba a la derecha)
              </li>
              <li>
                Buscá la sección <b>Integraciones</b> o <b>API Keys</b>
              </li>
              <li>
                Hacé click en <b>+ Crear nueva API Key</b> (elegí{" "}
                <u>sandbox</u> para pruebas)
              </li>
              <li>
                Dale un nombre descriptivo, ej: <i>"Portal de Implementación"</i>
              </li>
              <li>
                Copiá el <b>API Key</b> (empieza con{" "}
                <code style={{ fontFamily: "monospace", background: T.n100 }}>
                  nub_sbx_
                </code>
                )
              </li>
              <li>
                Copiá el <b>Secret</b> (una cadena larga de caracteres)
              </li>
              <li style={{ fontWeight: 600, color: T.primary }}>
                Pegá ambos en la sección de abajo
              </li>
            </ol>
          </div>

          {/* Input para pegar credenciales */}
          <div
            style={{
              marginTop: SP.xl,
              padding: SP.md,
              borderRadius: 10,
              border: `2px solid ${T.infoBorder}`,
              background: T.infoBg,
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: T.infoTx,
                margin: "0 0 14px",
              }}
            >
              Pegá tus credenciales aquí
            </h3>

            {credsError && <Alert tone="error" style={{ marginBottom: 12 }}>{credsError}</Alert>}
            {credsSuccess && (
              <Alert tone="ok" style={{ marginBottom: 12 }}>
                {credsSuccess}
              </Alert>
            )}

            <input
              type="text"
              placeholder="API Key (empieza con nub_sbx_...)"
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setCredsError("");
              }}
              disabled={isLoadingCreds}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${apiKeyInput ? T.primary : T.n200}`,
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                marginBottom: 10,
                boxSizing: "border-box",
                opacity: isLoadingCreds ? 0.6 : 1,
                cursor: isLoadingCreds ? "not-allowed" : "text",
              }}
            />

            <input
              type="password"
              placeholder="Secret (48+ caracteres)"
              value={apiSecretInput}
              onChange={(e) => {
                setApiSecretInput(e.target.value);
                setCredsError("");
              }}
              disabled={isLoadingCreds}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 8,
                border: `1px solid ${apiSecretInput ? T.primary : T.n200}`,
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                marginBottom: 14,
                boxSizing: "border-box",
                opacity: isLoadingCreds ? 0.6 : 1,
                cursor: isLoadingCreds ? "not-allowed" : "text",
              }}
            />

            <button
              onClick={guardarCredenciales}
              disabled={
                isLoadingCreds ||
                !apiKeyInput.startsWith("nub_sbx_") ||
                apiSecretInput.length < 40
              }
              style={{
                padding: "12px 24px",
                background:
                  apiKeyInput.startsWith("nub_sbx_") && apiSecretInput.length >= 40
                    ? T.primary
                    : T.n200,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor:
                  apiKeyInput.startsWith("nub_sbx_") && apiSecretInput.length >= 40
                    ? "pointer"
                    : "not-allowed",
                opacity: isLoadingCreds ? 0.7 : 1,
              }}
            >
              {isLoadingCreds ? "Guardando..." : "Guardar credenciales"}
            </button>

            <p style={{ fontSize: 12, color: T.infoTx, marginTop: 12, margin: "12px 0 0" }}>
              🔒 <b>Privacidad:</b> Las credenciales se guardan encriptadas en nuestra base de
              datos. Solo la ven el implementador y tu equipo.
            </p>
          </div>

          {/* Link a documentación */}
          <div style={{ marginTop: SP.lg }}>
            <a
              href={DOCS.apiVentas}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                fontSize: 14,
                fontWeight: 600,
                color: T.primary,
              }}
            >
              📘 Documentación completa de la API →
            </a>
          </div>
        </Card>
      )}

      {/* ────── CASO 2: Hay credenciales válidas ────── */}
      {tieneCredsValidas && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: T.n900, margin: 0 }}>
              Tus credenciales de API — entorno sandbox
            </h2>
            {c && (
              <Badge tone={c.origen === "usuario" ? "info" : "green"}>
                {c.origen === "usuario"
                  ? `Ingresadas ${fmtDate(c.ingresado_at)}`
                  : `Generadas ${fmtDate(c.createdAt)}`}
              </Badge>
            )}
          </div>

          <p style={{ fontSize: 13.5, color: T.n600, lineHeight: 1.55, margin: "8px 0 16px" }}>
            Con estas credenciales se integra el envío de ventas contra el entorno de pruebas.{" "}
            <b>Pasale estas credenciales a tu desarrollador junto con la documentación de la API</b> (link
            abajo). Trátalas como una contraseña.
          </p>

          <>
            <CredRow
              label="API Key"
              value={c.key}
              show={showCreds}
              copied={copied === "key"}
              onCopy={() => copy("key", c.key)}
            />
            <CredRow
              label="API Secret"
              value={c.secret}
              show={showCreds}
              copied={copied === "secret"}
              onCopy={() => copy("secret", c.secret)}
            />
            <button
              onClick={() => setShowCreds(!showCreds)}
              style={{
                background: "transparent",
                color: T.primary,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                padding: "8px 0",
              }}
            >
              {showCreds ? "Ocultar valores" : "Mostrar valores"}
            </button>
          </>

          <div style={{ marginTop: 16 }}>
            <a
              href={DOCS.apiVentas}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                fontSize: 14,
                fontWeight: 600,
                color: T.primary,
              }}
            >
              📘 Documentación de la API de ventas →
            </a>
          </div>

          {c.origen === "usuario" && (
            <p style={{ fontSize: 12, color: T.n400, marginTop: 12 }}>
              💡 ¿Necesitás actualizar las credenciales? Generá una nueva en Nubceo y
              pegála aquí de nuevo.
            </p>
          )}
        </Card>
      )}
    </>
  );
}

// Componentes helper (extraídos de PortalApp.jsx)
function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: T.card,
        borderRadius: 12,
        border: `1px solid ${T.cardBorder}`,
        padding: SP.lg,
        marginBottom: SP.md,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Alert({ tone = "info", children, style = {} }) {
  const tones = {
    info: { bg: T.infoBg, tx: T.infoTx, border: T.infoBorder },
    warning: { bg: T.warnBg, tx: T.warnTx, border: T.warnBorder },
    error: { bg: T.errBg, tx: T.errTx, border: T.errBorder },
    ok: { bg: T.okBg, tx: T.okTx, border: T.okBorder },
  };
  const t = tones[tone];
  return (
    <div
      style={{
        padding: SP.md,
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.tx,
        fontSize: 14,
        lineHeight: 1.55,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ tone = "gray", children }) {
  const tones = {
    green: { bg: T.okBg, tx: T.okTx },
    blue: { bg: T.primary50, tx: T.primary600 },
    warning: { bg: T.warnBg, tx: T.warnTx },
    info: { bg: T.infoBg, tx: T.infoTx },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: 20,
        background: t.bg,
        color: t.tx,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function CredRow({ label, value, show, copied, onCopy }) {
  return (
    <div style={{ marginBottom: SP.md, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.n600, marginBottom: 4 }}>
          {label}
        </div>
        <code
          style={{
            display: "block",
            fontSize: 13,
            fontFamily: "ui-monospace, monospace",
            background: T.n50,
            padding: "8px 12px",
            borderRadius: 6,
            border: `1px solid ${T.n200}`,
            color: show ? T.n900 : T.n400,
            wordBreak: "break-all",
            maxWidth: 400,
          }}
        >
          {show ? value : "•".repeat(Math.min(value.length, 40))}
        </code>
      </div>
      <button
        onClick={onCopy}
        style={{
          background: copied === label ? T.okBg : T.primary50,
          color: copied === label ? T.okTx : T.primary600,
          border: "none",
          borderRadius: 6,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {copied === label ? "✓ Copiado" : "Copiar"}
      </button>
    </div>
  );
}

export default SeccionApi;
