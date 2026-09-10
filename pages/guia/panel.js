// pages/guia/panel.js
//
// Acceso suelto al panel, por si alguien entra directo a /guia/panel sin pasar
// por el portal. El contenido vive en lib/autoimp/PanelAutoimp.jsx, que es el
// mismo que se renderiza dentro del portal.

import { useState, useEffect } from "react";
import PanelAutoimp from "../../lib/autoimp/PanelAutoimp";
import { VERSION } from "../../lib/autoimp/contenido";

async function api(action, payload = {}) {
  const res = await fetch("/api/autoimp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "No pudimos conectarnos.");
  return j;
}

const CSS = `
.pw{--p:#0a6bf4;--n200:#d8dce6;--n400:#8e96a8;--n600:#4b5468;--n800:#1e2433;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:#eef4ff;color:var(--n800);min-height:100vh;font-size:14px;line-height:1.5}
.pw *{box-sizing:border-box;margin:0;padding:0}
.pw-nav{height:58px;background:#fff;border-bottom:1px solid var(--n200);display:flex;align-items:center;
  gap:1.1rem;padding:0 1.75rem;position:sticky;top:0;z-index:20}
.pw-nav img{height:24px}
.pw-nav .tag{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--n400);
  padding-left:1.1rem;border-left:1px solid var(--n200)}
.pw-nav .sp{flex:1}
.pw-btn{font-family:inherit;background:transparent;color:var(--n600);border:1px solid var(--n200);
  border-radius:8px;font-size:14px;font-weight:500;padding:6px 14px;cursor:pointer}
.pw-btn:hover{opacity:.8}
.pw-wrap{max-width:1180px;margin:0 auto;padding:1.75rem}
.pw-card{background:#fff;border:1px solid #c7dcfd;border-radius:14px;padding:1.4rem 1.6rem}
.pw-card h2{font-size:17px;font-weight:600;color:#02265c;margin-bottom:.2rem}
.pw-card .sub{font-size:12.5px;color:var(--n400);margin-bottom:1.1rem}
.pw input{width:100%;padding:11px 12px;border:1px solid var(--n200);border-radius:8px;font-size:15px;
  font-family:inherit;letter-spacing:.04em}
.pw-ver{font-size:10.5px;color:var(--n200);letter-spacing:.04em}
`;

export default function PanelPage() {
  const [codigo, setCodigo] = useState("");
  const [miembro, setMiembro] = useState(null);
  const [activo, setActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const delLink = (url.searchParams.get("c") || "").trim().toUpperCase();
    if (delLink) {
      window.history.replaceState({}, "", "/guia/panel");
      entrar(delLink, true);
      return;
    }
    const c = sessionStorage.getItem("autoimp_panel") || "";
    if (!c) { setCargando(false); return; }
    entrar(c, true);
  }, []);

  async function entrar(c, silencioso) {
    setCargando(true); setError(null);
    try {
      const r = await api("panelEntrar", { codigo: c });
      setMiembro(r.miembro);
      setActivo(c);
      sessionStorage.setItem("autoimp_panel", c);
    } catch (e) {
      if (!silencioso) setError(e.message);
      sessionStorage.removeItem("autoimp_panel");
    } finally { setCargando(false); }
  }

  if (cargando) {
    return (<div className="pw"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ textAlign: "center", padding: "5rem", color: "var(--n400)" }}>Cargando…</div></div>);
  }

  if (!miembro) {
    return (
      <div className="pw">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="pw-nav"><img src="/logo-nubceo.png" alt="Nubceo" />
          <span className="tag">Autoimplementador · interno</span></div>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "3rem 1.5rem" }}>
          <div className="pw-card">
            <h2>Panel del autoimplementador</h2>
            <div className="sub">Entrá con tu código del portal.</div>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") entrar(codigo.trim()); }} placeholder="Tu código" />
            {error && <div style={{ marginTop: ".9rem", color: "#b91c1c", fontSize: 13 }}>{error}</div>}
            <div style={{ marginTop: "1.1rem", display: "flex", alignItems: "center", gap: ".8rem" }}>
              <button className="pw-btn" style={{ background: "var(--p)", color: "#fff", border: "none" }}
                onClick={() => entrar(codigo.trim())}>Entrar</button>
              <span className="pw-ver">v{VERSION}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pw">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pw-nav">
        <img src="/logo-nubceo.png" alt="Nubceo" />
        <span className="tag">Autoimplementador · interno</span>
        <div className="sp" />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{miembro.nombre}</div>
          <div style={{ fontSize: 11.5, color: "var(--n400)" }}>Equipo Nubceo</div>
        </div>
        <button className="pw-btn" onClick={() => { window.location.href = "/"; }}>← Volver al portal</button>
        <button className="pw-btn" onClick={() => { sessionStorage.removeItem("autoimp_panel"); location.reload(); }}>
          Salir
        </button>
      </div>
      <div className="pw-wrap">
        <PanelAutoimp codigo={activo} />
      </div>
    </div>
  );
}
