// lib/autoimp/PanelAutoimp.jsx
//
// El contenido del panel interno, sin barra superior ni pantalla de acceso.
// Se usa desde dos lugares:
//   - PortalApp.jsx, como un módulo más del portal (no recarga la página, así
//     que la sesión del portal no se pierde).
//   - pages/guia/panel.js, como página suelta con su propio acceso.
//
// Recibe el código del miembro del equipo ya validado.

import { useState, useEffect } from "react";
import { STEPS, NIVELES, VERSION } from "./contenido";

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
.pn-emb{--pnp:#0a6bf4;--pn50:#e8f1fe;--pn900:#02265c;--pnn50:#f7f8fa;--pnn100:#eef0f4;--pnn200:#d8dce6;
  --pnn400:#8e96a8;--pnn600:#4b5468;--pnn800:#1e2433;
  --pnok:#dcfce7;--pnokt:#166534;--pnw:#fef9c3;--pnwt:#854d0e;--pnb:#fee2e2;--pnbt:#b91c1c;
  font-size:14px;color:var(--pnn800)}
.pn-emb *{box-sizing:border-box}
.pn-emb .pn-card{background:#fff;border:1px solid var(--pnn200);border-radius:14px;padding:1.4rem 1.6rem;margin-bottom:1.4rem}
.pn-emb h2{font-size:17px;font-weight:600;color:var(--pn900);margin:0 0 .2rem}
.pn-emb .sub{font-size:12.5px;color:var(--pnn400);margin-bottom:1.1rem}
.pn-emb table{width:100%;border-collapse:collapse}
.pn-emb th{text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;
  color:var(--pnn400);padding:.5rem .6rem;border-bottom:1px solid var(--pnn200)}
.pn-emb td{padding:.7rem .6rem;border-bottom:1px solid var(--pnn100);font-size:13.5px;vertical-align:middle}
.pn-emb tr:last-child td{border-bottom:none}
.pn-emb .cli{font-weight:600}
.pn-emb .cod{font-size:11.5px;color:var(--pnn400);letter-spacing:.04em}
.pn-emb .bar{width:92px;height:7px;background:var(--pnn100);border-radius:100px;overflow:hidden;
  display:inline-block;vertical-align:middle;margin-right:.5rem}
.pn-emb .bar i{display:block;height:100%;background:var(--pnp);border-radius:100px}
.pn-emb .chip{display:inline-block;font-size:11px;font-weight:600;border-radius:100px;padding:2px 9px}
.pn-emb .ok{background:var(--pnok);color:var(--pnokt)}
.pn-emb .warn{background:var(--pnw);color:var(--pnwt)}
.pn-emb .bad{background:var(--pnb);color:var(--pnbt)}
.pn-emb .mut{background:var(--pnn100);color:var(--pnn600)}
.pn-emb .rbtn{font-family:inherit;font-size:13px;border-radius:8px;padding:6px 14px;cursor:pointer;
  background:transparent;color:var(--pnbt);border:1px solid #fca5a5;font-weight:500}
.pn-emb .rbtn:hover{background:var(--pnbt);color:#fff}
.pn-emb .paso{border:1px solid var(--pnn200);border-radius:11px;padding:.9rem 1.1rem;margin-bottom:.7rem;background:var(--pnn50)}
.pn-emb .paso.alerta{border-color:#fca5a5;background:#fff5f5}
.pn-emb .ph{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.pn-emb .pt{font-size:14px;font-weight:600;flex:1}
.pn-emb .com{font-size:13px;color:var(--pnn600);border-left:2px solid var(--pnn200);
  padding:.35rem 0 .35rem .8rem;margin-top:.6rem}
.pn-emb .com .meta{font-size:11px;color:var(--pnn400);margin-top:.15rem}
.pn-emb .vacio{text-align:center;color:var(--pnn400);padding:2.2rem;font-size:13.5px}
.pn-emb .ver{font-size:10.5px;color:var(--pnn200);letter-spacing:.04em;text-align:right}
`;

const dias = (iso) => (iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null);

export default function PanelAutoimp({ codigo }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const d = await api("panelDatos", { codigo });
        if (vivo) setDatos(d);
      } catch (e) {
        if (vivo) setError(e.message);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [codigo]);

  async function reiniciar(clienteCodigo) {
    if (!confirm("¿Reiniciar todo el progreso de " + clienteCodigo + "? Queda registrado en la bitácora.")) return;
    try {
      await api("panelReset", { codigo, clienteCodigo });
      setDatos(await api("panelDatos", { codigo }));
    } catch (e) { alert(e.message); }
  }

  if (cargando) return <div className="pn-emb"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="vacio">Cargando…</div></div>;
  if (error) return <div className="pn-emb"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="vacio">{error}</div></div>;

  const clientes = (datos && datos.clientes) || [];
  const comentarios = (datos && datos.comentarios) || [];

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
    <div className="pn-emb">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="pn-card">
        <h2>Clientes en autoimplementación</h2>
        <div className="sub">Ordenados por días sin movimiento. Los terminados van al final.</div>

        {orden.length === 0 ? (
          <div className="vacio">Todavía no entró ningún cliente a la guía.</div>
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
                const clase = c.finalizado ? "ok" : d >= 10 ? "bad" : d >= 5 ? "warn" : "mut";
                return (
                  <tr key={c.codigo}>
                    <td><div className="cli">{c.nombre}</div><div className="cod">{c.codigo}</div></td>
                    <td>
                      <span className="bar"><i style={{ width: pct + "%" }} /></span>
                      <span style={{ fontSize: 12.5, color: "var(--pnn600)" }}>{pct}%</span>
                    </td>
                    <td>{c.finalizado ? <span className="chip ok">Terminó</span>
                      : actual === -1 ? "—" : STEPS[actual].nav}</td>
                    <td>
                      {c.origen === "csv" && <span className="chip mut">Archivo</span>}
                      {c.origen === "api" && <span className="chip warn">API · {c.apiDesarrolla || "sin definir"}</span>}
                      {!c.origen && <span style={{ color: "var(--pnn400)" }}>—</span>}
                    </td>
                    <td><span className={"chip " + clase}>{c.finalizado ? "—" : d + "d"}</span></td>
                    <td style={{ color: "var(--pnn600)" }}>{c.implementador || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="rbtn" onClick={() => reiniciar(c.codigo)}>Reiniciar</button>
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
          <div className="vacio">Todavía no hay comentarios.</div>
        ) : porPaso.map((p) => (
          <div key={p.i} className={"paso" + (p.duros >= 2 ? " alerta" : "")}>
            <div className="ph">
              <span className="pt">{p.i + 1}. {p.nav}</span>
              {NIVELES.map((n) => {
                const q = p.cs.filter((c) => c.nivel === n.k).length;
                if (!q) return null;
                const cl = n.k === "trabe" ? "bad" : n.k === "costo" ? "warn" : n.k === "facil" ? "ok" : "mut";
                return <span key={n.k} className={"chip " + cl}>{n.l}: {q}</span>;
              })}
            </div>
            {p.duros >= 2 && (
              <div style={{ fontSize: 12.5, color: "var(--pnbt)", marginTop: ".5rem", fontWeight: 600 }}>
                Dos o más clientes se trabaron acá. Conviene rehacer el paso, no responder consultas.
              </div>
            )}
            {p.cs.filter((c) => c.comentario).map((c) => (
              <div key={c.id} className="com">
                {c.comentario}
                <div className="meta">
                  {c.cliente_codigo}{c.email ? " · " + c.email : ""} · {new Date(c.creado_at).toLocaleDateString("es-AR")}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="ver">Autoimplementador v{VERSION}</div>
    </div>
  );
}
