// pages/guia/panel.js
//
// Vista interna del autoimplementador. Entra el equipo de Nubceo con su código
// del portal; los clientes no llegan acá.
//
// Lo que importa mirar: quién está trabado, hace cuánto, y qué paso está
// costando de forma sistemática. Si varios clientes reportan dificultad en el
// mismo paso, no es un problema de soporte, es un defecto de diseño del paso.

import { useState, useEffect } from "react";
import { STEPS, NIVELES, VERSION } from "../../lib/autoimp/contenido";

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
.pn{--primary:#0a6bf4;--primary-50:#e8f1fe;--primary-100:#b9d2fb;--primary-800:#033a8a;--primary-900:#02265c;
  --n50:#f7f8fa;--n100:#eef0f4;--n200:#d8dce6;--n400:#8e96a8;--n600:#4b5468;--n800:#1e2433;
  --ok-bg:#dcfce7;--ok-tx:#166534;--warn-bg:#fef9c3;--warn-tx:#854d0e;--bad-bg:#fee2e2;--bad-tx:#b91c1c;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  font-family:var(--font);background:#eef4ff;color:var(--n800);font-size:14px;line-height:1.5;min-height:100vh}
.pn *{box-sizing:border-box;margin:0;padding:0}
.pn-nav{height:58px;background:#fff;border-bottom:1px solid var(--n200);display:flex;align-items:center;
  gap:1.1rem;padding:0 1.75rem;position:sticky;top:0;z-index:20}
.pn-nav img{height:24px}
.pn-nav .tag{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--n400);
  padding-left:1.1rem;border-left:1px solid var(--n200)}
.pn-nav .sp{flex:1}
.pn-wrap{max-width:1180px;margin:0 auto;padding:1.75rem}
.pn-card{background:#fff;border:1px solid #c7dcfd;border-radius:14px;padding:1.4rem 1.6rem;margin-bottom:1.4rem}
.pn-card h2{font-size:17px;font-weight:600;color:var(--primary-900);margin-bottom:.2rem}
.pn-card .sub{font-size:12.5px;color:var(--n400);margin-bottom:1.1rem}
.pn table{width:100%;border-collapse:collapse}
.pn th{text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;
  color:var(--n400);padding:.5rem .6rem;border-bottom:1px solid var(--n200)}
.pn td{padding:.7rem .6rem;border-bottom:1px solid var(--n100);font-size:13.5px;vertical-align:middle}
.pn tr:last-child td{border-bottom:none}
.pn-cli{font-weight:600;color:var(--n800)}
.pn-cod{font-size:11.5px;color:var(--n400);letter-spacing:.04em}
.pn-bar{width:92px;height:7px;background:var(--n100);border-radius:100px;overflow:hidden;display:inline-block;
  vertical-align:middle;margin-right:.5rem}
.pn-bar i{display:block;height:100%;background:var(--primary);border-radius:100px}
.pn-chip{display:inline-block;font-size:11px;font-weight:600;border-radius:100px;padding:2px 9px}
.pn-ok{background:var(--ok-bg);color:var(--ok-tx)}
.pn-warn{background:var(--warn-bg);color:var(--warn-tx)}
.pn-bad{background:var(--bad-bg);color:var(--bad-tx)}
.pn-mut{background:var(--n100);color:var(--n600)}
.pn-btn{font-family:var(--font);font-size:13px;border-radius:7px;padding:6px 13px;cursor:pointer;border:none;
  background:var(--primary);color:#fff;font-weight:500}
.pn-btn.g{background:transparent;color:var(--n600);border:1px solid var(--n200)}
.pn-btn.r{background:transparent;color:var(--bad-tx);border:1px solid #fca5a5}
.pn-btn.r:hover{background:var(--bad-tx);color:#fff}
.pn-paso{border:1px solid var(--n200);border-radius:11px;padding:.9rem 1.1rem;margin-bottom:.7rem;background:var(--n50)}
.pn-paso.alerta{border-color:#fca5a5;background:#fff5f5}
.pn-ph{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.pn-pt{font-size:14px;font-weight:600;color:var(--n800);flex:1}
.pn-com{font-size:13px;color:var(--n600);border-left:2px solid var(--n200);padding:.35rem 0 .35rem .8rem;margin-top:.6rem}
.pn-com .meta{font-size:11px;color:var(--n400);margin-top:.15rem}
.pn-empty{text-align:center;color:var(--n400);padding:2.2rem;font-size:13.5px}
.pn input{width:100%;padding:11px 12px;border:1px solid var(--n200);border-radius:8px;font-size:15px;
  font-family:var(--font);letter-spacing:.04em}
.pn-ver{font-size:10.5px;color:var(--n200);letter-spacing:.04em}
`;

const dias = (iso) => (iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null);

export default function Panel() {
  const [codigo, setCodigo] = useState("");
  const [miembro, setMiembro] = useState(null);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // El código puede venir del link (así entra desde la solapa del portal, sin
  // tipear nada) o de la sesión de esta pestaña.
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
      sessionStorage.setItem("autoimp_panel", c);
      setCodigo(c);
      const d = await api("panelDatos", { codigo: c });
      setDatos(d);
    } catch (e) {
      if (!silencioso) setError(e.message);
      sessionStorage.removeItem("autoimp_panel");
    } finally { setCargando(false); }
  }

  async function reiniciar(clienteCodigo, paso) {
    const que = paso === undefined ? "todo el progreso" : "el paso " + (paso + 1);
    if (!confirm("¿Reiniciar " + que + " de " + clienteCodigo + "? Queda registrado en la bitácora.")) return;
    try {
      await api("panelReset", { codigo, clienteCodigo, ...(paso === undefined ? {} : { paso }) });
      setDatos(await api("panelDatos", { codigo }));
    } catch (e) { alert(e.message); }
  }

  if (cargando) {
    return (<div className="pn"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pn-empty" style={{ paddingTop: "5rem" }}>Cargando…</div></div>);
  }

  if (!miembro) {
    return (
      <div className="pn">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="pn-nav"><img src="/logo-nubceo.png" alt="Nubceo" />
          <span className="tag">Autoimplementador · interno</span></div>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "3rem 1.5rem" }}>
          <div className="pn-card">
            <h2>Panel del autoimplementador</h2>
            <div className="sub">Entrá con tu código del portal.</div>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") entrar(codigo.trim()); }} placeholder="Tu código" />
            {error && <div style={{ marginTop: ".9rem", color: "var(--bad-tx)", fontSize: 13 }}>{error}</div>}
            <div style={{ marginTop: "1.1rem", display: "flex", alignItems: "center", gap: ".8rem" }}>
              <button className="pn-btn" onClick={() => entrar(codigo.trim())}>Entrar</button>
              <span className="pn-ver">v{VERSION}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const clientes = (datos && datos.clientes) || [];
  const comentarios = (datos && datos.comentarios) || [];

  // Trabados primero: más días sin movimiento y sin terminar.
  const orden = [...clientes].sort((a, b) => {
    if (!!a.finalizado !== !!b.finalizado) return a.finalizado ? 1 : -1;
    return (dias(a.actualizado) || 0) < (dias(b.actualizado) || 0) ? 1 : -1;
  });

  const porPaso = STEPS.map((s, i) => {
    const cs = comentarios.filter((c) => c.paso === i);
    const duros = cs.filter((c) => c.nivel === "costo" || c.nivel === "trabe").length;
    return { i, nav: s.nav, cs, duros };
  }).filter((x) => x.cs.length);

  return (
    <div className="pn">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pn-nav">
        <img src="/logo-nubceo.png" alt="Nubceo" />
        <span className="tag">Autoimplementador · interno</span>
        <div className="sp" />
        <span style={{ fontSize: 13, color: "var(--n600)" }}>{miembro.nombre}</span>
        <button className="pn-btn g" onClick={() => { sessionStorage.removeItem("autoimp_panel"); location.reload(); }}>
          Salir
        </button>
      </div>

      <div className="pn-wrap">
        <div className="pn-card">
          <h2>Clientes en autoimplementación</h2>
          <div className="sub">Ordenados por días sin movimiento. Los terminados van al final.</div>

          {orden.length === 0 ? (
            <div className="pn-empty">Todavía no entró ningún cliente a la guía.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th><th>Avance</th><th>Paso actual</th><th>Origen</th>
                  <th>Sin moverse</th><th>Implementador</th><th></th>
                </tr>
              </thead>
              <tbody>
                {orden.map((c) => {
                  const pct = Math.round((c.hechos.length / STEPS.length) * 100);
                  const actual = STEPS.findIndex((_, i) => !c.hechos.includes(i));
                  const d = dias(c.actualizado);
                  const clase = c.finalizado ? "pn-ok" : d >= 10 ? "pn-bad" : d >= 5 ? "pn-warn" : "pn-mut";
                  return (
                    <tr key={c.codigo}>
                      <td>
                        <div className="pn-cli">{c.nombre}</div>
                        <div className="pn-cod">{c.codigo}</div>
                      </td>
                      <td>
                        <span className="pn-bar"><i style={{ width: pct + "%" }} /></span>
                        <span style={{ fontSize: 12.5, color: "var(--n600)" }}>{pct}%</span>
                      </td>
                      <td>{c.finalizado ? <span className="pn-chip pn-ok">Terminó</span>
                        : actual === -1 ? "—" : STEPS[actual].nav}</td>
                      <td>
                        {c.origen === "csv" && <span className="pn-chip pn-mut">Archivo</span>}
                        {c.origen === "api" && <span className="pn-chip pn-warn">API · {c.apiDesarrolla || "sin definir"}</span>}
                        {!c.origen && <span style={{ color: "var(--n400)" }}>—</span>}
                      </td>
                      <td><span className={"pn-chip " + clase}>{c.finalizado ? "—" : d + "d"}</span></td>
                      <td style={{ color: "var(--n600)" }}>{c.implementador || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="pn-btn r" onClick={() => reiniciar(c.codigo)}>Reiniciar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="pn-card">
          <h2>Cómo les resultó cada paso</h2>
          <div className="sub">
            Agrupado por paso, no por cliente: si varios se traban en el mismo, el problema es del paso.
          </div>

          {porPaso.length === 0 ? (
            <div className="pn-empty">Todavía no hay comentarios.</div>
          ) : porPaso.map((p) => (
            <div key={p.i} className={"pn-paso" + (p.duros >= 2 ? " alerta" : "")}>
              <div className="pn-ph">
                <span className="pn-pt">{p.i + 1}. {p.nav}</span>
                {NIVELES.map((n) => {
                  const q = p.cs.filter((c) => c.nivel === n.k).length;
                  if (!q) return null;
                  const cl = n.k === "trabe" ? "pn-bad" : n.k === "costo" ? "pn-warn" : n.k === "facil" ? "pn-ok" : "pn-mut";
                  return <span key={n.k} className={"pn-chip " + cl}>{n.l}: {q}</span>;
                })}
              </div>
              {p.duros >= 2 && (
                <div style={{ fontSize: 12.5, color: "var(--bad-tx)", marginTop: ".5rem", fontWeight: 600 }}>
                  Dos o más clientes se trabaron acá. Conviene rehacer el paso, no responder consultas.
                </div>
              )}
              {p.cs.filter((c) => c.comentario).map((c) => (
                <div key={c.id} className="pn-com">
                  {c.comentario}
                  <div className="meta">
                    {c.cliente_codigo}{c.email ? " · " + c.email : ""} · {new Date(c.creado_at).toLocaleDateString("es-AR")}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="pn-ver" style={{ textAlign: "right" }}>Autoimplementador v{VERSION}</div>
      </div>
    </div>
  );
}
