// lib/autoimp/PanelAutoimp.jsx
//
// Contenido del panel interno, sin barra superior ni pantalla de acceso.
// Se usa desde PortalApp.jsx (como módulo) y desde pages/guia/panel.js.
//
// Tres cosas: quién está habilitado, cómo va cada uno, y qué paso les cuesta.

import { useState, useEffect, Fragment } from "react";
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
.pn-emb{--pnp:#0a6bf4;--pn50:#e8f1fe;--pn100:#b9d2fb;--pn900:#02265c;--pnn50:#f7f8fa;--pnn100:#eef0f4;
  --pnn200:#d8dce6;--pnn400:#8e96a8;--pnn600:#4b5468;--pnn800:#1e2433;
  --pnok:#dcfce7;--pnokt:#166534;--pnw:#fef9c3;--pnwt:#854d0e;--pnb:#fee2e2;--pnbt:#b91c1c;
  font-size:14px;color:var(--pnn800)}
.pn-emb *{box-sizing:border-box}
.pn-emb .pn-card{background:#fff;border:1px solid var(--pnn200);border-radius:14px;padding:1.4rem 1.6rem;margin-bottom:1.4rem}
.pn-emb h2{font-size:17px;font-weight:600;color:var(--pn900);margin:0 0 .2rem}
.pn-emb .sub{font-size:12.5px;color:var(--pnn400);margin-bottom:1.1rem;line-height:1.55}
.pn-emb table{width:100%;border-collapse:collapse}
.pn-emb th{text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;
  color:var(--pnn400);padding:.5rem .6rem;border-bottom:1px solid var(--pnn200)}
.pn-emb td{padding:.7rem .6rem;border-bottom:1px solid var(--pnn100);font-size:13.5px;vertical-align:middle}
.pn-emb tr:last-child td{border-bottom:none}
.pn-emb .cli{font-weight:600}
.pn-emb .cod{font-size:11.5px;color:var(--pnn400);letter-spacing:.04em}
.pn-emb .bar{width:82px;height:7px;background:var(--pnn100);border-radius:100px;overflow:hidden;
  display:inline-block;vertical-align:middle;margin-right:.5rem}
.pn-emb .bar i{display:block;height:100%;background:var(--pnp);border-radius:100px}
.pn-emb .chip{display:inline-block;font-size:11px;font-weight:600;border-radius:100px;padding:2px 9px}
.pn-emb .ok{background:var(--pnok);color:var(--pnokt)}
.pn-emb .warn{background:var(--pnw);color:var(--pnwt)}
.pn-emb .bad{background:var(--pnb);color:var(--pnbt)}
.pn-emb .mut{background:var(--pnn100);color:var(--pnn600)}
.pn-emb .btn{font-family:inherit;font-size:12.5px;border-radius:7px;padding:5px 11px;cursor:pointer;
  background:var(--pn50);color:#033a8a;border:none;font-weight:600;white-space:nowrap}
.pn-emb .btn:hover{background:var(--pn100)}
.pn-emb .btn.r{background:transparent;color:var(--pnbt);border:1px solid #fca5a5}
.pn-emb .btn.r:hover{background:var(--pnbt);color:#fff}
.pn-emb .sw{width:38px;height:21px;border-radius:100px;background:var(--pnn200);position:relative;
  cursor:pointer;display:inline-block;vertical-align:middle;transition:background .15s;flex-shrink:0}
.pn-emb .sw.on{background:#22c55e}
.pn-emb .sw i{position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:#fff;
  transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.pn-emb .sw.on i{left:19px}
.pn-emb input[type=text]{height:36px;padding:0 11px;border:1px solid var(--pnn200);border-radius:8px;
  font-size:13.5px;font-family:inherit;color:var(--pnn800);background:#fff;width:100%}
.pn-emb select{height:36px;padding:0 9px;border:1px solid var(--pnn200);border-radius:8px;
  font-size:13.5px;font-family:inherit;color:var(--pnn800);background:#fff}
.pn-emb .limpiar{font-size:12.5px;color:var(--pnp);cursor:pointer;font-weight:600}
.pn-emb .filtros{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:1rem}
.pn-emb .paso{border:1px solid var(--pnn200);border-radius:11px;padding:.9rem 1.1rem;margin-bottom:.7rem;background:var(--pnn50)}
.pn-emb .paso.alerta{border-color:#fca5a5;background:#fff5f5}
.pn-emb .ph{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.pn-emb .pt{font-size:14px;font-weight:600;flex:1}
.pn-emb .com{font-size:13px;color:var(--pnn600);border-left:2px solid var(--pnn200);
  padding:.35rem 0 .35rem .8rem;margin-top:.6rem}
.pn-emb .com .meta{font-size:11px;color:var(--pnn400);margin-top:.15rem}
.pn-emb .vacio{text-align:center;color:var(--pnn400);padding:2.2rem;font-size:13.5px}
.pn-emb .ver{font-size:10.5px;color:var(--pnn200);letter-spacing:.04em;text-align:right}
.pn-emb .msgbox{margin-top:.8rem;background:var(--pnn50);border:1px solid var(--pnn200);border-radius:10px;padding:.9rem 1rem}
.pn-emb .msgbox pre{margin:0;font-family:inherit;font-size:13px;color:var(--pnn600);white-space:pre-wrap;line-height:1.6}
.pn-emb .msgbox .acc{display:flex;gap:.5rem;margin-top:.8rem;flex-wrap:wrap;align-items:center}
.pn-emb .lnk{font-size:12.5px;color:var(--pnp);word-break:break-all}
`;

const dias = (iso) => (iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null);

const linkDe = (codigo) => {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return base + "/guia?c=" + encodeURIComponent(codigo);
};

const mensajeDe = (cliente) =>
  "Hola,\n\n" +
  "Ya podés arrancar con la puesta en marcha del Conciliador de " + cliente.nombre + ". " +
  "Preparamos una guía con videos cortos: mirás el video y hacés la configuración en Nubceo, a tu ritmo y sin reuniones.\n\n" +
  "Entrá acá: " + linkDe(cliente.codigo) + "\n" +
  "Tu código de acceso es " + cliente.codigo + " por si te lo pide.\n\n" +
  "Son 7 pasos, podés salir y retomar donde lo dejaste. Al pie de cada paso hay un espacio para contarnos cómo te resultó — lo leemos.\n\n" +
  "Cualquier duda, escribime.";

export default function PanelAutoimp({ codigo }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busca, setBusca] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const [filtroImpl, setFiltroImpl] = useState("");
  const [abierto, setAbierto] = useState(null); // código con el mensaje desplegado
  const [copiado, setCopiado] = useState("");
  const [verCom, setVerCom] = useState(null); // null | código del cliente | "__todos"

  const recargar = async () => {
    const d = await api("panelDatos", { codigo });
    setDatos(d);
  };

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

  const copiar = async (texto, id) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado(""), 2000);
    } catch (e) {
      alert("No se pudo copiar. Seleccioná el texto a mano.");
    }
  };

  const cambiarHabilitado = async (cli) => {
    const nuevo = !cli.habilitado;
    if (!nuevo && !confirm("¿Sacarle el acceso a " + cli.nombre + "? No pierde el progreso, pero no va a poder entrar.")) return;
    setDatos((d) => ({ ...d, clientes: d.clientes.map((c) => (c.codigo === cli.codigo ? { ...c, habilitado: nuevo } : c)) }));
    try {
      await api("panelHabilitar", { codigo, clienteCodigo: cli.codigo, habilitado: nuevo });
      if (nuevo) setAbierto(cli.codigo);
    } catch (e) {
      alert(e.message);
      recargar();
    }
  };

  const cambiarCupo = async (cli) => {
    const val = prompt("¿Cuántas consultas al implementador incluye la autoimplementación de " + cli.nombre + "?",
      String(cli.consultasTotal ?? 20));
    if (val === null) return;
    const total = parseInt(val, 10);
    if (isNaN(total) || total < 0) { alert("Poné un número."); return; }
    try {
      await api("panelCupo", { codigo, clienteCodigo: cli.codigo, total });
      await recargar();
    } catch (e) { alert(e.message); }
  };

  const reiniciar = async (cli) => {
    if (!confirm("¿Reiniciar todo el progreso de " + cli.nombre + "? Queda registrado en la bitácora.")) return;
    try {
      await api("panelReset", { codigo, clienteCodigo: cli.codigo });
      await recargar();
    } catch (e) { alert(e.message); }
  };

  if (cargando) return <div className="pn-emb"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="vacio">Cargando…</div></div>;
  if (error) return <div className="pn-emb"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="vacio">{error}</div></div>;

  const todos = (datos && datos.clientes) || [];
  const comentarios = (datos && datos.comentarios) || [];
  const q = busca.trim().toLowerCase();

  const implementadores = [...new Set(todos.map((c) => c.implementador).filter(Boolean))].sort();

  const lista = todos
    .filter((c) => (verTodos ? true : c.habilitado))
    .filter((c) => !filtroImpl || (filtroImpl === "__" ? !c.implementador : c.implementador === filtroImpl))
    .filter((c) => !q || c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.habilitado !== b.habilitado) return a.habilitado ? -1 : 1;
      if (!!a.finalizado !== !!b.finalizado) return a.finalizado ? 1 : -1;
      return (dias(a.actualizado) || 0) < (dias(b.actualizado) || 0) ? 1 : -1;
    });

  const habilitados = todos.filter((c) => c.habilitado).length;
  const comsPorCliente = {};
  comentarios.forEach((c) => { comsPorCliente[c.cliente_codigo] = (comsPorCliente[c.cliente_codigo] || 0) + 1; });
  const vacioTxt = filtroImpl || q
    ? "Ningún cliente coincide con los filtros."
    : "Todavía no habilitaste a nadie. Tildá “ver todos los clientes” para elegir.";

  const comsVisibles = verCom === "__todos"
    ? comentarios
    : verCom ? comentarios.filter((c) => c.cliente_codigo === verCom) : [];

  const porPaso = STEPS.map((s, i) => {
    const cs = comsVisibles.filter((c) => c.paso === i);
    const duros = cs.filter((c) => c.nivel === "costo" || c.nivel === "trabe").length;
    return { i, nav: s.nav, cs, duros };
  }).filter((x) => x.cs.length);

  const nombreDe = (cod) => (todos.find((c) => c.codigo === cod) || {}).nombre || cod;

  return (
    <div className="pn-emb">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="pn-card">
        <h2>Clientes en autoimplementación</h2>
        <div className="sub">
          {habilitados} de {todos.length} clientes con la guía habilitada. Prendé el interruptor para darle
          acceso a alguien y copiá el mensaje con el link para mandárselo por mail. Mientras el botón no esté
          dentro de Nubceo, este link es la única puerta de entrada.
        </div>

        {(() => {
          const sinCupo = todos.filter((c) => c.habilitado && (c.consultasTotal || 0) > 0
            && (c.consultasUsadas || 0) >= c.consultasTotal);
          if (!sinCupo.length) return null;
          return (
            <div style={{ background: "var(--pnb)", border: "1px solid #fca5a5", borderRadius: 10,
              padding: ".8rem 1rem", marginBottom: "1rem", fontSize: 13, color: "var(--pnbt)" }}>
              <b>{sinCupo.length === 1 ? "Un cliente se quedó" : sinCupo.length + " clientes se quedaron"} sin consultas: </b>
              {sinCupo.map((c) => c.nombre).join(", ")}. Siguen viendo tu contacto, pero ya usaron todo el cupo.
            </div>
          );
        })()}

        <div className="filtros">
          <div style={{ flex: "1 1 240px", maxWidth: 300 }}>
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre o código…" />
          </div>
          <select value={filtroImpl} onChange={(e) => setFiltroImpl(e.target.value)}>
            <option value="">Todos los implementadores</option>
            {implementadores.map((n) => <option key={n} value={n}>{n}</option>)}
            <option value="__">— Sin asignar —</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--pnn600)", cursor: "pointer" }}>
            <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} style={{ width: 15, height: 15 }} />
            Ver todos los clientes del portal
          </label>
          {(busca || filtroImpl) && (
            <span className="limpiar" onClick={() => { setBusca(""); setFiltroImpl(""); }}>Limpiar filtros</span>
          )}
        </div>

        {lista.length === 0 ? (
          <div className="vacio">
            {vacioTxt}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Guía</th>
                <th>Cliente</th><th>Avance</th><th>Paso actual</th><th>Origen</th>
                <th>Sin moverse</th><th>Consultas</th><th>Implementador</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const pct = Math.round((c.hechos.length / STEPS.length) * 100);
                const actual = STEPS.findIndex((_, i) => !c.hechos.includes(i));
                const d = dias(c.actualizado);
                const clase = c.finalizado ? "ok" : d >= 10 ? "bad" : d >= 5 ? "warn" : "mut";
                const abrirMsg = abierto === c.codigo;
                return (
                  <Fragment key={c.codigo}>
                    <tr>
                      <td>
                        <span className={"sw" + (c.habilitado ? " on" : "")} onClick={() => cambiarHabilitado(c)}
                          title={c.habilitado ? "Quitar acceso a la guía" : "Dar acceso a la guía"}><i /></span>
                      </td>
                      <td><div className="cli">{c.nombre}</div><div className="cod">{c.codigo}</div></td>
                      <td>
                        {c.habilitado ? (
                          <>
                            <span className="bar"><i style={{ width: pct + "%" }} /></span>
                            <span style={{ fontSize: 12.5, color: "var(--pnn600)" }}>{pct}%</span>
                          </>
                        ) : <span style={{ color: "var(--pnn400)" }}>—</span>}
                      </td>
                      <td>
                        {!c.habilitado ? <span style={{ color: "var(--pnn400)" }}>—</span>
                          : c.finalizado ? <span className="chip ok">Terminó</span>
                          : !c.entro ? <span className="chip mut">No entró</span>
                          : actual === -1 ? "—" : STEPS[actual].nav}
                      </td>
                      <td>
                        {c.origen === "csv" && <span className="chip mut">Archivo</span>}
                        {c.origen === "api" && <span className="chip warn">API · {c.apiDesarrolla || "sin definir"}</span>}
                        {!c.origen && <span style={{ color: "var(--pnn400)" }}>—</span>}
                      </td>
                      <td>
                        {c.habilitado && c.entro && !c.finalizado
                          ? <span className={"chip " + clase}>{d}d</span>
                          : <span style={{ color: "var(--pnn400)" }}>—</span>}
                      </td>
                      <td>
                        {c.habilitado ? (() => {
                          const rest = Math.max(0, (c.consultasTotal || 0) - (c.consultasUsadas || 0));
                          const cl = rest === 0 ? "bad" : rest <= 3 ? "warn" : "mut";
                          return (
                            <span className={"chip " + cl} style={{ cursor: "pointer" }}
                              title="Clic para cambiar el cupo" onClick={() => cambiarCupo(c)}>
                              {rest} de {c.consultasTotal}
                            </span>
                          );
                        })() : <span style={{ color: "var(--pnn400)" }}>—</span>}
                      </td>
                      <td style={{ color: "var(--pnn600)" }}>{c.implementador || "—"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {c.habilitado && (
                          <button className="btn" onClick={() => setAbierto(abrirMsg ? null : c.codigo)}>
                            {abrirMsg ? "Cerrar" : "Acceso"}
                          </button>
                        )}
                        {comsPorCliente[c.codigo] > 0 && (
                          <button className="btn" style={{ marginLeft: 6 }}
                            onClick={() => setVerCom(verCom === c.codigo ? null : c.codigo)}>
                            💬 {comsPorCliente[c.codigo]}
                          </button>
                        )}
                        {c.habilitado && c.entro && (
                          <button className="btn r" style={{ marginLeft: 6 }} onClick={() => reiniciar(c)}>Reiniciar</button>
                        )}
                      </td>
                    </tr>
                    {abrirMsg && (
                      <tr>
                        <td colSpan={9} style={{ background: "#fff" }}>
                          <div className="msgbox">
                            <div className="lnk">{linkDe(c.codigo)}</div>
                            <pre style={{ marginTop: ".7rem" }}>{mensajeDe(c)}</pre>
                            <div className="acc">
                              <button className="btn" onClick={() => copiar(mensajeDe(c), c.codigo + "-m")}>
                                {copiado === c.codigo + "-m" ? "Copiado ✓" : "Copiar mensaje"}
                              </button>
                              <button className="btn" onClick={() => copiar(linkDe(c.codigo), c.codigo + "-l")}>
                                {copiado === c.codigo + "-l" ? "Copiado ✓" : "Copiar solo el link"}
                              </button>
                              <span style={{ fontSize: 11.5, color: "var(--pnn400)" }}>
                                El link lleva el código adentro: mandalo solo a los contactos del cliente.
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {comentarios.length > 0 && !verCom && (
        <div className="pn-card" style={{ display: "flex", alignItems: "center", gap: ".9rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2>Comentarios de los clientes</h2>
            <div className="sub" style={{ marginBottom: 0 }}>
              Hay {comentarios.length} comentario{comentarios.length === 1 ? "" : "s"} cargado{comentarios.length === 1 ? "" : "s"}.
              Tocá el 💬 de un cliente para leer los suyos, o mirá el resumen de todos juntos.
            </div>
          </div>
          <button className="btn" onClick={() => setVerCom("__todos")}>Ver el resumen de todos</button>
        </div>
      )}

      {verCom && (
      <div className="pn-card">
        <div style={{ display: "flex", alignItems: "flex-start", gap: ".9rem" }}>
          <div style={{ flex: 1 }}>
            <h2>{verCom === "__todos" ? "Cómo les resultó cada paso" : "Comentarios de " + nombreDe(verCom)}</h2>
            <div className="sub">
              {verCom === "__todos"
                ? "Agrupado por paso, no por cliente: si varios se traban en el mismo, el problema es del paso."
                : "Lo que dejó este cliente, paso por paso."}
            </div>
          </div>
          <div style={{ display: "flex", gap: ".5rem", flexShrink: 0 }}>
            {verCom !== "__todos" && <button className="btn" onClick={() => setVerCom("__todos")}>Ver todos</button>}
            <button className="btn" onClick={() => setVerCom(null)}>Cerrar</button>
          </div>
        </div>

        {porPaso.length === 0 ? (
          <div className="vacio">Este cliente todavía no dejó comentarios.</div>
        ) : porPaso.map((p) => (
          <div key={p.i} className={"paso" + (p.duros >= 2 ? " alerta" : "")}>
            <div className="ph">
              <span className="pt">{p.i + 1}. {p.nav}</span>
              {NIVELES.map((n) => {
                const cant = p.cs.filter((c) => c.nivel === n.k).length;
                if (!cant) return null;
                const cl = n.k === "trabe" ? "bad" : n.k === "costo" ? "warn" : n.k === "facil" ? "ok" : "mut";
                return <span key={n.k} className={"chip " + cl}>{n.l}: {cant}</span>;
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
      )}

      <div className="ver">Autoimplementador v{VERSION}</div>
    </div>
  );
}
