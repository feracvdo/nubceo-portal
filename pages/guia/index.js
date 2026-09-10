// pages/guia/index.js
//
// Fase 1 del autoimplementador: la guía navegable, sin token y sin persistencia.
// El progreso vive en memoria y se pierde al recargar — es a propósito, para
// poder desplegar y mirar cómo queda antes de armar las tablas.
//
// No toca ningún archivo del portal. Lo único que comparte es el logo de
// /public/logo-nubceo.png.

import { useState, useEffect } from "react";
import { STEPS, NIVELES } from "../../lib/autoimp/contenido";

// Todo pasa por nuestra API. El navegador nunca toca la base.
async function api(action, payload = {}) {
  const res = await fetch("/api/autoimp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "No pudimos conectarnos. Probá de nuevo.");
  return j;
}

const CSS = `
.ai-root{--primary:#0a6bf4;--primary-50:#e8f1fe;--primary-100:#b9d2fb;--primary-200:#8ab3f8;
  --primary-600:#0550c0;--primary-800:#033a8a;--primary-900:#02265c;--sky:#38b6ff;
  --n50:#f7f8fa;--n100:#eef0f4;--n200:#d8dce6;--n400:#8e96a8;--n600:#4b5468;--n800:#1e2433;--n900:#0d1120;
  --soft-bg:#eef4ff;--soft-border:#c7dcfd;--soft-head:#1e3a8a;
  --ok-bg:#dcfce7;--ok-tx:#166534;--warn-bg:#fef9c3;--warn-tx:#854d0e;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  font-family:var(--font);background:var(--soft-bg);color:var(--n800);font-size:15px;line-height:1.5;
  min-height:100vh}
.ai-root *{box-sizing:border-box;margin:0;padding:0}
.ai-nav{position:sticky;top:0;z-index:50;height:60px;background:#fff;border-bottom:1px solid var(--n200);
  display:flex;align-items:center;gap:1.25rem;padding:0 2rem}
.ai-nav img{height:26px}
.ai-nav .tag{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--n400);
  padding-left:1.25rem;border-left:1px solid var(--n200)}
.ai-nav .spacer{flex:1}
.ai-navprog{display:flex;align-items:center;gap:.6rem;font-size:12px;font-weight:500;color:var(--n600)}
.ai-track{width:120px;height:6px;background:var(--n100);border-radius:100px;overflow:hidden}
.ai-fill{height:100%;background:var(--primary);border-radius:100px;transition:width .35s ease}
.ai-wrap{max-width:1180px;margin:0 auto;padding:1.75rem 2rem 4rem;display:grid;
  grid-template-columns:280px 1fr;gap:1.75rem;align-items:start}
@media(max-width:900px){.ai-wrap{grid-template-columns:1fr;padding:1.25rem}.ai-nav{padding:0 1rem}.ai-nav .tag{display:none}}
.ai-side{background:#fff;border:1px solid var(--soft-border);border-radius:16px;padding:1.25rem;position:sticky;top:84px}
.ai-side h4{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--n400);margin-bottom:.75rem}
.ai-side h4.second{margin-top:1.3rem;padding-top:1.1rem;border-top:1px solid var(--n100)}
.ai-cxlist{list-style:none;display:flex;flex-direction:column;gap:2px}
.ai-cxlist li{display:flex;gap:.65rem;align-items:center;padding:.42rem .55rem;font-size:13px;color:var(--n400)}
.ai-lock{flex:0 0 20px;height:20px;border-radius:50%;background:var(--ok-bg);color:var(--ok-tx);
  display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700}
.ai-steplist{list-style:none;display:flex;flex-direction:column;gap:2px}
.ai-steplist li{display:flex;gap:.65rem;align-items:flex-start;padding:.5rem .55rem;border-radius:8px;
  cursor:pointer;font-size:13.5px;color:var(--n600)}
.ai-steplist li:hover{background:var(--primary-50)}
.ai-steplist li.active{background:var(--primary-50);color:var(--primary-800);font-weight:600}
.ai-bullet{flex:0 0 20px;height:20px;border-radius:50%;border:1.5px solid var(--n200);display:flex;align-items:center;
  justify-content:center;font-size:10.5px;font-weight:600;color:var(--n400);background:#fff;margin-top:1px}
.ai-steplist li.active .ai-bullet{border-color:var(--primary);color:#fff;background:var(--primary)}
.ai-steplist li.done .ai-bullet{border-color:var(--ok-tx);background:var(--ok-bg);color:var(--ok-tx)}
.ai-sidefoot{margin-top:1.1rem;padding-top:1.1rem;border-top:1px solid var(--n100);font-size:12px;color:var(--n400)}
.ai-sidefoot b{color:var(--n600);font-weight:600}
.ai-panel{background:#fff;border:1px solid var(--soft-border);border-radius:16px;padding:2rem 2.25rem 1.5rem;
  animation:aiFade .28s ease}
@keyframes aiFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.ai-kicker{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--primary);margin-bottom:.45rem}
.ai-panel h1{font-size:26px;font-weight:600;color:var(--soft-head);margin-bottom:.5rem;line-height:1.25}
.ai-lead{font-size:15px;color:var(--n600);max-width:64ch}
.ai-panel h3{font-size:15px;font-weight:600;color:var(--n800);margin:1.7rem 0 .7rem}
.ai-muted{color:var(--n600)}
.ai-small{font-size:13px}
.ai-player{margin-top:1.4rem;border:1px solid var(--primary-100);border-radius:14px;overflow:hidden;background:#fff}
.ai-screen{position:relative;aspect-ratio:16/9;background:linear-gradient(135deg,var(--primary-900),var(--primary-600) 55%,var(--sky));
  display:flex;align-items:center;justify-content:center;cursor:pointer}
.ai-screen:hover .ai-play{transform:scale(1.07)}
.ai-play{width:66px;height:66px;border-radius:50%;background:rgba(255,255,255,.94);display:flex;align-items:center;
  justify-content:center;transition:transform .18s ease}
.ai-play::after{content:"";width:0;height:0;border-left:20px solid var(--primary-800);border-top:13px solid transparent;
  border-bottom:13px solid transparent;margin-left:5px}
.ai-screen .lbl{position:absolute;left:1.1rem;bottom:1rem;color:#fff;font-size:13px;font-weight:500;opacity:.92;
  max-width:75%;text-shadow:0 1px 3px rgba(0,0,0,.35)}
.ai-screen .dur{position:absolute;right:1.1rem;bottom:1rem;background:rgba(0,0,0,.45);color:#fff;font-size:11.5px;
  font-weight:600;border-radius:100px;padding:3px 10px}
.ai-plist{display:flex;gap:.5rem;padding:.8rem 1rem;border-top:1px solid var(--n100);flex-wrap:wrap;background:var(--n50)}
.ai-ptab{font-size:12.5px;font-weight:500;color:var(--n600);background:#fff;border:1px solid var(--n200);
  border-radius:100px;padding:5px 13px;cursor:pointer;user-select:none}
.ai-ptab:hover{border-color:var(--primary-200)}
.ai-ptab.on{background:var(--primary);border-color:var(--primary);color:#fff}
.ai-where{margin-top:1.5rem;display:flex;align-items:center;gap:.85rem;flex-wrap:wrap;
  background:var(--primary-50);border:1px solid var(--primary-100);border-radius:12px;padding:.9rem 1.1rem}
.ai-where .wl{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--primary)}
.ai-where .path{font-size:14px;font-weight:600;color:var(--primary-900)}
.ai-where .ai-btn{margin-left:auto}
.ai-todo{list-style:none;margin-top:.3rem}
.ai-todo li{display:flex;gap:.7rem;align-items:flex-start;padding:.55rem .2rem;font-size:14px;color:var(--n600);
  border-bottom:1px solid var(--n100)}
.ai-todo li:last-child{border-bottom:none}
.ai-num{flex:0 0 22px;height:22px;border-radius:6px;background:var(--n100);color:var(--n600);font-size:11.5px;
  font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}
.ai-verify{margin-top:1.4rem;background:var(--ok-bg);border-radius:12px;padding:1rem 1.2rem}
.ai-verify .vl{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ok-tx);margin-bottom:.45rem}
.ai-verify p{font-size:13.5px;color:var(--ok-tx);margin:0}
.ai-triage{margin-top:1.4rem;border:1px solid var(--warn-tx);background:var(--warn-bg);border-radius:12px;padding:1.1rem 1.25rem}
.ai-triage .tl{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--warn-tx);margin-bottom:.7rem}
.ai-triage ol{list-style:none;counter-reset:t}
.ai-triage li{counter-increment:t;display:flex;gap:.7rem;padding:.5rem 0;border-bottom:1px solid rgba(133,77,14,.15)}
.ai-triage li:last-child{border-bottom:none}
.ai-triage li::before{content:counter(t);flex:0 0 20px;height:20px;border-radius:50%;background:var(--warn-tx);color:var(--warn-bg);
  font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px}
.ai-triage .tt{font-size:13.5px;font-weight:600;color:var(--warn-tx)}
.ai-triage .td{font-size:13px;color:var(--warn-tx);opacity:.88;margin-top:.15rem}
.ai-triage .tc{font-size:13px;color:var(--warn-tx);font-weight:600;margin-top:.8rem}
.ai-mark{margin-top:1.5rem;display:flex;align-items:center;gap:.85rem;border:1.5px dashed var(--n200);
  border-radius:12px;padding:1rem 1.15rem;cursor:pointer;user-select:none}
.ai-mark:hover{border-color:var(--primary-200);background:var(--n50)}
.ai-mark.on{border-style:solid;border-color:var(--ok-tx);background:var(--ok-bg)}
.ai-box{flex:0 0 24px;height:24px;border-radius:6px;border:2px solid var(--n200);background:#fff;display:flex;
  align-items:center;justify-content:center;font-size:14px;font-weight:700;color:transparent}
.ai-mark.on .ai-box{background:var(--ok-tx);border-color:var(--ok-tx);color:#fff}
.ai-mark .mt{font-size:14px;font-weight:600;color:var(--n800)}
.ai-mark.on .mt{color:var(--ok-tx)}
.ai-mark .ms{font-size:12.5px;color:var(--n400)}
.ai-fbbox{margin-top:1.5rem;border:1px solid var(--n200);border-radius:12px;padding:1.15rem 1.25rem;background:var(--n50)}
.ai-fbbox.sent{background:var(--ok-bg);border-color:var(--ok-tx)}
.ai-fbl{font-size:14px;font-weight:600;color:var(--n800);margin-bottom:.2rem}
.ai-fbs{font-size:12.5px;color:var(--n400);margin-bottom:.85rem}
.ai-fbchips{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.9rem}
.ai-fchip{font-size:13px;font-weight:500;color:var(--n600);background:#fff;border:1.5px solid var(--n200);
  border-radius:100px;padding:7px 15px;cursor:pointer;user-select:none;transition:all .15s ease}
.ai-fchip:hover{border-color:var(--primary-200)}
.ai-fchip.on{background:var(--primary);border-color:var(--primary);color:#fff}
.ai-fchip.on.warn{background:#ca8a04;border-color:#ca8a04}
.ai-fchip.on.bad{background:#b91c1c;border-color:#b91c1c}
.ai-root textarea{width:100%;min-height:76px;padding:10px 12px;border:1px solid var(--n200);border-radius:8px;
  font-family:var(--font);font-size:13.5px;color:var(--n800);background:#fff;resize:vertical;line-height:1.5}
.ai-root textarea:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(10,107,244,.12)}
.ai-fbfoot{display:flex;align-items:center;gap:.7rem;margin-top:.8rem;flex-wrap:wrap}
.ai-fbthanks{display:flex;align-items:center;gap:.6rem;font-size:14px;font-weight:600;color:var(--ok-tx)}
.ai-forkgrid{display:grid;grid-template-columns:1fr 1fr;gap:.9rem;margin-top:.4rem}
@media(max-width:760px){.ai-forkgrid{grid-template-columns:1fr}}
.ai-forkcard{position:relative;border:2px solid var(--n200);border-radius:12px;padding:1.15rem 3.2rem 1.15rem 1.2rem;
  cursor:pointer;background:#fff;user-select:none;transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease}
.ai-forkcard::before{content:"";position:absolute;top:1.15rem;right:1.15rem;width:22px;height:22px;border-radius:50%;
  border:2px solid var(--n200);background:#fff;transition:border-color .16s ease}
.ai-forkcard::after{content:"Elegir esta opción →";display:block;margin-top:1rem;padding-top:.75rem;
  border-top:1px solid var(--n100);font-size:13.5px;font-weight:600;color:var(--primary)}
.ai-forkcard:hover{border-color:var(--primary);transform:translateY(-2px);box-shadow:0 8px 20px rgba(10,107,244,.14)}
.ai-forkcard:hover::before{border-color:var(--primary);box-shadow:inset 0 0 0 4px var(--primary-100)}
.ai-forkcard.sel{border-color:var(--primary);background:var(--primary-50);padding-right:1.2rem;cursor:default}
.ai-forkcard.sel:hover{transform:none;box-shadow:none}
.ai-forkcard.sel::before,.ai-forkcard.sel::after{display:none}
.ai-pickhint{display:inline-flex;align-items:center;gap:.5rem;font-size:12.5px;font-weight:600;color:var(--primary-800);
  background:var(--primary-50);border:1px solid var(--primary-100);border-radius:100px;padding:6px 14px;margin-bottom:1rem}
.ai-pd{width:8px;height:8px;border-radius:50%;background:var(--primary);animation:aiPulse 1.6s ease-in-out infinite}
@keyframes aiPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.75)}}
.ai-forkcard .ft{font-size:15px;font-weight:600;color:var(--n800);margin-bottom:.3rem}
.ai-forkcard.sel .ft{color:var(--primary-800)}
.ai-forkcard .fd{font-size:13px;color:var(--n600);line-height:1.55}
.ai-fb{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;
  border-radius:100px;padding:3px 10px;margin-bottom:.55rem}
.ai-fb-self{background:var(--ok-bg);color:var(--ok-tx)}
.ai-fb-impl{background:var(--warn-bg);color:var(--warn-tx)}
.ai-link{font-size:13px;color:var(--primary);cursor:pointer;border-bottom:1px dashed var(--primary-200)}
.ai-btn{font-family:var(--font);font-size:14px;font-weight:500;border-radius:8px;padding:10px 20px;cursor:pointer;border:none}
.ai-btn-p{background:var(--primary);color:#fff}
.ai-btn-p:hover{background:var(--primary-600)}
.ai-btn-p:disabled{opacity:.45;cursor:not-allowed}
.ai-btn-s{background:var(--primary-50);color:var(--primary-800)}
.ai-btn-o{background:transparent;color:var(--primary);border:1.5px solid var(--primary)}
.ai-btn-o:disabled{opacity:.45;cursor:not-allowed}
.ai-btn-g{background:transparent;color:var(--n600);border:1px solid var(--n200)}
.ai-btn-g:hover{border-color:var(--n400)}
.ai-btn-sm{font-size:13px;padding:6px 14px}
.ai-btn-out{background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-weight:600}
.ai-btn-out:hover{background:#b91c1c;color:#fff;border-color:#b91c1c}
.ai-badge{display:inline-flex;align-items:center;gap:.35rem;font-size:12px;font-weight:500;padding:3px 10px;border-radius:100px}
.ai-b-green{background:var(--ok-bg);color:var(--ok-tx)}
.ai-b-amber{background:var(--warn-bg);color:var(--warn-tx)}
.ai-callout{background:var(--primary-50);border-left:3px solid var(--primary);border-radius:8px;padding:.8rem 1rem;
  font-size:13.5px;color:var(--primary-900);margin:1.1rem 0}
.ai-callout.warn{background:var(--warn-bg);border-color:#ca8a04;color:var(--warn-tx)}
.ai-pfoot{display:flex;align-items:center;gap:.7rem;margin-top:1.8rem;padding-top:1.2rem;border-top:1px solid var(--n100);flex-wrap:wrap}
.ai-help{margin-left:auto;font-size:13px;color:var(--n600);border-bottom:1px dashed var(--n200);cursor:pointer}
.ai-help:hover{color:var(--primary);border-color:var(--primary-200)}
.ai-boundary{display:grid;grid-template-columns:1fr auto 1fr;gap:1rem;margin-top:1.5rem}
@media(max-width:760px){.ai-boundary{grid-template-columns:1fr}.ai-arrow{display:none}}
.ai-bcol{border-radius:12px;padding:1rem 1.15rem}
.ai-bcol.cx{background:var(--n50);border:1px solid var(--n200)}
.ai-bcol.self{background:var(--primary-50);border:1px solid var(--primary-100)}
.ai-bcol .bt{font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.5rem}
.ai-bcol.cx .bt{color:var(--n400)}
.ai-bcol.self .bt{color:var(--primary)}
.ai-bcol ul{list-style:none;font-size:13px;line-height:1.75}
.ai-bcol.cx ul{color:var(--n600)}
.ai-bcol.self ul{color:var(--primary-900)}
.ai-arrow{display:flex;align-items:center;justify-content:center;color:var(--n200);font-size:22px}
.ai-hero{text-align:center;padding:1.5rem 0 .5rem}
.ai-circ{width:64px;height:64px;border-radius:50%;background:var(--ok-bg);color:var(--ok-tx);display:flex;
  align-items:center;justify-content:center;font-size:30px;margin:0 auto 1rem}
.ai-chk{list-style:none;font-size:13.5px}
.ai-chk li{padding:.4rem 0;color:var(--n600);display:flex;gap:.55rem;align-items:center}
`;

const nuevoFb = () => STEPS.map(() => ({ nivel: null, texto: "", enviado: false }));

export default function Guia() {
  const [cur, setCur] = useState(0);
  const [done, setDone] = useState(() => STEPS.map(() => false));
  const [vidIdx, setVidIdx] = useState(0);
  const [srcPath, setSrcPath] = useState(null); // null | 'csv' | 'api'
  const [apiPath, setApiPath] = useState(null); // null | 'propio' | 'nubceo'
  const [fb, setFb] = useState(nuevoFb);

  const [codigo, setCodigo] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(true);
  const [errorLogin, setErrorLogin] = useState(null);
  const [inputCodigo, setInputCodigo] = useState("");
  const [inputEmail, setInputEmail] = useState("");

  // El código puede venir en el link (?c=XXX) o de la última vez que entró
  // desde este navegador. Si no hay ninguno, se pide.
  // La sesión guardada en el navegador dura una hora desde el último ingreso.
  // El código que viene en el link siempre gana, aunque la sesión haya vencido.
  useEffect(() => {
    const url = new URL(window.location.href);
    const delLink = (url.searchParams.get("c") || "").trim().toUpperCase();

    const vence = Number(localStorage.getItem("autoimp_vence") || 0);
    const vigente = vence > Date.now();
    if (!vigente) limpiarSesion();

    const guardado = vigente ? (localStorage.getItem("autoimp_codigo") || "") : "";
    const mail = vigente ? (localStorage.getItem("autoimp_email") || "") : "";
    const c = delLink || guardado.trim().toUpperCase();

    setEmail(mail);
    setInputEmail(mail);
    if (!c) { setCargando(false); return; }
    entrar(c, mail, true);
  }, []);

  function limpiarSesion() {
    localStorage.removeItem("autoimp_codigo");
    localStorage.removeItem("autoimp_email");
    localStorage.removeItem("autoimp_vence");
  }

  const UNA_HORA = 60 * 60 * 1000;

  async function entrar(c, mail, silencioso) {
    setCargando(true);
    setErrorLogin(null);
    try {
      const r = await api("entrar", { codigo: c, email: mail || "" });
      setCliente(r.cliente);
      setCodigo(c);
      setEmail(mail || "");
      localStorage.setItem("autoimp_codigo", c);
      localStorage.setItem("autoimp_vence", String(Date.now() + UNA_HORA));
      if (mail) localStorage.setItem("autoimp_email", mail);
      const pasos = (r.progreso && r.progreso.pasos) || {};
      setDone(STEPS.map((_, i) => !!(pasos[i] && pasos[i].hecho)));
      setSrcPath((r.progreso && r.progreso.origen) || null);
      setApiPath((r.progreso && r.progreso.api_desarrolla) || null);
      const base = nuevoFb();
      (r.comentarios || []).forEach((c2) => {
        if (base[c2.paso]) base[c2.paso] = { nivel: c2.nivel, texto: c2.comentario || "", enviado: true };
      });
      setFb(base);
    } catch (e) {
      if (!silencioso) setErrorLogin(e.message);
      limpiarSesion();
    } finally {
      setCargando(false);
    }
  }

  const salir = () => {
    limpiarSesion();
    window.location.href = "/guia";
  };

  // Guardado optimista: la pantalla no espera al servidor.
  const guardar = (patch) => {
    if (!codigo) return;
    localStorage.setItem("autoimp_vence", String(Date.now() + UNA_HORA));
    api("guardar", { codigo, email, totalPasos: STEPS.length, ...patch }).catch(() => {});
  };

  const total = STEPS.length;
  const hechos = done.filter(Boolean).length;
  const pct = Math.round((hechos / total) * 100);

  const go = (n) => {
    setCur(Math.max(0, Math.min(total + 1, n)));
    setVidIdx(0);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggleDone = (i) => {
    const nuevo = done.map((v, k) => (k === i ? !v : v));
    setDone(nuevo);
    guardar({ paso: i, hecho: nuevo[i] });
  };
  const patchFb = (i, campo, valor) => setFb((f) => f.map((x, k) => (k === i ? { ...x, [campo]: valor } : x)));
  const elegirSrc = (k) => {
    setSrcPath(k); setApiPath(null); setVidIdx(0);
    guardar({ origen: k, apiDesarrolla: null });
  };
  const elegirApi = (k) => { setApiPath(k); guardar({ apiDesarrolla: k }); };

  // Placeholders de fase 1. En fase 2 estos avisan al implementador de verdad.
  const playVideo = () => alert("Acá va el video embebido. Todavía no están grabados.");
  const abrirNubceo = (p) => alert("Abre Nubceo en:\n\n" + p + "\n\n(Pendiente: las rutas reales las define producto.)");
  const pedirAyuda = () => alert("Acá se abre el contacto con tu implementador de Nubceo.");
  const delegar = () => alert("Comparte el link de este paso con otra persona de tu equipo.");

  const renderVideo = (videos) => {
    const v = videos[Math.min(vidIdx, videos.length - 1)];
    return (
      <div className="ai-player">
        <div className="ai-screen" onClick={playVideo}>
          <div className="ai-play" />
          <div className="lbl">{v.t}</div>
          <div className="dur">{v.d}</div>
        </div>
        {videos.length > 1 && (
          <div className="ai-plist">
            {videos.map((x, k) => (
              <span key={k} className={"ai-ptab" + (k === vidIdx ? " on" : "")} onClick={() => setVidIdx(k)}>
                {k + 1}. {x.t}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFeedback = (i) => {
    const f = fb[i];
    if (f.enviado) {
      const n = NIVELES.find((x) => x.k === f.nivel);
      return (
        <div className="ai-fbbox sent">
          <div className="ai-fbthanks">✓ Gracias, lo registramos</div>
          <p className="ai-small" style={{ color: "var(--ok-tx)", margin: ".5rem 0 0" }}>
            Nos dijiste que este paso te resultó <b>{n ? n.l.toLowerCase() : "sin calificar"}</b>. Tu implementador lo
            va a ver y nos sirve para mejorar la guía.{" "}
            <span className="ai-link" style={{ color: "var(--ok-tx)", borderColor: "var(--ok-tx)" }}
              onClick={() => patchFb(i, "enviado", false)}>Editar</span>
          </p>
        </div>
      );
    }
    return (
      <div className="ai-fbbox">
        <div className="ai-fbl">¿Cómo te resultó este paso?</div>
        <div className="ai-fbs">Nos ayuda a saber qué explicar mejor. Lo lee tu implementador de Nubceo.</div>
        <div className="ai-fbchips">
          {NIVELES.map((n) => (
            <span key={n.k}
              className={"ai-fchip" + (f.nivel === n.k ? " on " + n.c : "")}
              onClick={() => patchFb(i, "nivel", f.nivel === n.k ? null : n.k)}>
              {n.l}
            </span>
          ))}
        </div>
        <textarea
          placeholder="¿Algo te confundió o faltó explicar? Contanos con tus palabras (opcional)"
          value={f.texto}
          onChange={(e) => patchFb(i, "texto", e.target.value)}
        />
        <div className="ai-fbfoot">
          <button className="ai-btn ai-btn-o ai-btn-sm" disabled={!f.nivel} onClick={() => {
            patchFb(i, "enviado", true);
            api("comentario", { codigo, email, paso: i, nivel: f.nivel, comentario: f.texto }).catch(() => {});
          }}>
            Enviar comentario
          </button>
          {!f.nivel && <span className="ai-small ai-muted">Elegí una opción para poder enviarlo.</span>}
        </div>
      </div>
    );
  };

  const renderFork = (s) => {
    if (srcPath === null) {
      return (
        <>
          <h3>{s.fork.q}</h3>
          <div className="ai-pickhint"><span className="ai-pd" /> Elegí una opción para continuar</div>
          <div className="ai-forkgrid">
            {["csv", "api"].map((k) => (
              <div key={k} className="ai-forkcard" onClick={() => elegirSrc(k)}>
                <span className={"ai-fb " + (k === "csv" ? "ai-fb-self" : "ai-fb-impl")}>{s.fork[k].b}</span>
                <div className="ft">{s.fork[k].t}</div>
                <div className="fd">{s.fork[k].d}</div>
              </div>
            ))}
          </div>
          <p className="ai-small ai-muted" style={{ marginTop: ".9rem" }}>
            ¿No sabés cuál es tu caso? Consultalo con quien maneja tu sistema de gestión, o{" "}
            <span className="ai-link" onClick={pedirAyuda}>preguntale a tu implementador</span>.
          </p>
        </>
      );
    }
    const c = s.fork[srcPath];
    return (
      <div className="ai-forkcard sel" style={{ marginTop: "1.2rem" }}>
        <span className={"ai-fb " + (srcPath === "csv" ? "ai-fb-self" : "ai-fb-impl")}>{c.b}</span>
        <div className="ft">✓ {c.t}</div>
        <p className="ai-small ai-muted" style={{ margin: ".5rem 0 0" }}>
          <span className="ai-link" onClick={() => elegirSrc(null)}>Elegí otra opción</span>
        </p>
      </div>
    );
  };

  const renderRamaApi = () => {
    const intro = (
      <div className="ai-callout warn" style={{ marginTop: "1.4rem" }}>
        <b>La integración por API la hacemos juntos.</b> Implica desarrollo, especificación técnica y pruebas conjuntas
        antes de salir a producción. No es algo que se resuelva con un video, así que acá la guía hace una pausa.
      </div>
    );
    if (apiPath === null) {
      return (
        <>
          {intro}
          <h3>¿Quién desarrolla la integración?</h3>
          <div className="ai-pickhint"><span className="ai-pd" /> Elegí una opción para continuar</div>
          <div className="ai-forkgrid">
            <div className="ai-forkcard" onClick={() => elegirApi("propio")}>
              <span className="ai-fb ai-fb-self">Sin costo de desarrollo</span>
              <div className="ft">La desarrolla mi equipo o mi punto de venta</div>
              <div className="fd">Te entregamos la especificación técnica y acompañamos las pruebas. El desarrollo lo
                hace tu equipo de sistemas o el proveedor de tu punto de venta.</div>
            </div>
            <div className="ai-forkcard" onClick={() => elegirApi("nubceo")}>
              <span className="ai-fb ai-fb-impl">Con cotización</span>
              <div className="ft">Que la desarrolle Nubceo</div>
              <div className="fd">Nos encargamos nosotros. Necesitamos un relevamiento técnico previo para entender cómo
                expone los datos tu sistema, y con eso te pasamos una cotización antes de arrancar.</div>
            </div>
          </div>
        </>
      );
    }
    const propio = apiPath === "propio";
    const pasos = propio
      ? ["Coordinás una reunión con un implementador de Nubceo.",
         "Te entregamos la especificación técnica para tu equipo o tu proveedor.",
         "Tu equipo desarrolla la integración con nuestro acompañamiento.",
         "Hacemos pruebas en conjunto hasta validar que las ventas entran bien.",
         "Retomás esta guía desde el paso 5."]
      : ["Hacemos un relevamiento técnico para ver cómo expone los datos tu sistema.",
         "Con eso armamos una cotización del desarrollo y te la pasamos.",
         "Si la aprobás, desarrollamos la integración de nuestro lado.",
         "Probamos juntos hasta validar que las ventas entran bien.",
         "Retomás esta guía desde el paso 5."];
    const llevar = propio
      ? ["Qué sistema de gestión o punto de venta usás, y de qué proveedor es.",
         "Quién va a hacer el desarrollo: tu equipo interno o el proveedor.",
         "Un contacto técnico con quien podamos hablar directamente."]
      : ["Qué sistema de gestión o punto de venta usás, y su versión.",
         "Si tu sistema ya tiene una API o si se puede acceder a su base de datos.",
         "Cuántas ventas hacés por día, aproximadamente.",
         "Un contacto técnico del proveedor de tu sistema."];
    return (
      <>
        {intro}
        <h3>{propio ? "Lo desarrolla tu equipo o tu punto de venta" : "La desarrollamos nosotros"}</h3>
        <ul className="ai-todo">
          {pasos.map((t, k) => (<li key={k}><span className="ai-num">{k + 1}</span><span>{t}</span></li>))}
        </ul>
        {!propio && (
          <div className="ai-callout"><b>El relevamiento no tiene costo.</b> La cotización depende de qué sistema uses y
            de cómo permita acceder a los datos, así que no podemos darte un número antes de mirarlo.</div>
        )}
        <h3>{propio ? "Para aprovechar la reunión, tené a mano" : "Para el relevamiento, tené a mano"}</h3>
        <ul className="ai-todo">
          {llevar.map((t, k) => (<li key={k}><span className="ai-num">·</span><span>{t}</span></li>))}
        </ul>
        <div className="ai-verify">
          <div className="vl">✓ Mientras tanto no te quedes parado</div>
          <p>Podés avanzar igual con el <b>paso 5</b> (reglas y secuencias) y el <b>paso 7</b> (tu rutina). El paso 6 lo
            vas a hacer cuando la integración esté lista y entren tus primeras ventas.</p>
        </div>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: ".7rem", flexWrap: "wrap" }}>
          <button className="ai-btn ai-btn-p" onClick={pedirAyuda}>
            {propio ? "Coordinar reunión con un implementador" : "Pedir el relevamiento y la cotización"}
          </button>
          <button className="ai-btn ai-btn-g" onClick={pedirAyuda}>Tengo dudas antes de avanzar</button>
        </div>
        <p className="ai-small ai-muted" style={{ marginTop: "1.2rem" }}>
          <span className="ai-link" onClick={() => elegirApi(null)}>Elegí la otra opción</span>
        </p>
      </>
    );
  };

  const renderBienvenida = () => (
    <section className="ai-panel">
      <div className="ai-kicker">Bienvenida</div>
      <h1>Tu cuenta ya está creada. Te enseñamos a configurarla.</h1>
      <p className="ai-lead">Esta guía te acompaña con videos cortos mientras configurás tu Conciliador dentro de
        Nubceo. Mirás el video, hacés el paso en la plataforma, lo marcás como hecho y seguís. A tu ritmo, sin
        reuniones.</p>

      <div className="ai-boundary">
        <div className="ai-bcol cx">
          <div className="bt">Listo — lo hizo tu referente</div>
          <ul><li>✓ Empresa y datos fiscales</li><li>✓ Credenciales de procesadoras</li></ul>
        </div>
        <div className="ai-arrow">→</div>
        <div className="ai-bcol self">
          <div className="bt">Ahora — lo hacés vos en Nubceo</div>
          <ul>{STEPS.map((s, i) => (<li key={i}>{i + 1}. {s.nav}</li>))}</ul>
        </div>
      </div>

      <div className="ai-callout"><b>Esta guía configura tu Conciliador transaccional</b> — el cruce de las ventas de tu
        sistema contra lo que te liquidan las procesadoras.</div>
      <div className="ai-callout"><b>Tiempo estimado: un mes o menos.</b> No es una sola sentada: avanzá a tu ritmo,
        salí y retomá donde lo dejaste.</div>

      <div className="ai-pfoot">
        <button className="ai-btn ai-btn-p" onClick={() => go(1)}>Empezar →</button>
        <span className="ai-help" onClick={pedirAyuda}>Prefiero hacerlo acompañado</span>
      </div>
    </section>
  );

  const renderPaso = (i) => {
    const s = STEPS[i];
    const soloFork = s.fork && srcPath === null;
    const esApi = s.fork && srcPath === "api";
    return (
      <section className="ai-panel">
        <div className="ai-kicker">{s.kicker} · {s.nav}</div>
        <h1>{s.title}</h1>
        <p className="ai-lead">{s.lead}</p>

        {s.fork && renderFork(s)}
        {esApi && renderRamaApi()}

        {!soloFork && !esApi && (
          <>
            {renderVideo(s.videos)}

            <div className="ai-where">
              <span className="wl">Dónde hacerlo</span>
              <span className="path">{s.path}</span>
              <button className="ai-btn ai-btn-p ai-btn-sm" onClick={() => abrirNubceo(s.path)}>Abrir en Nubceo ↗</button>
            </div>

            {s.nota && srcPath && (
              <div className="ai-callout">{s.nota[srcPath]}</div>
            )}

            <h3>Los pasos, en orden</h3>
            <ul className="ai-todo">
              {s.todo.map((t, k) => (<li key={k}><span className="ai-num">{k + 1}</span><span>{t}</span></li>))}
            </ul>

            <div className="ai-verify">
              <div className="vl">✓ Cómo saber que salió bien</div>
              <p dangerouslySetInnerHTML={{ __html: s.verify }} />
            </div>

            {s.triage && (
              <div className="ai-triage">
                <div className="tl">⚠ {s.triage.titulo}</div>
                <ol>
                  {s.triage.items.map(([t, d], k) => (
                    <li key={k}><div><div className="tt">{t}</div><div className="td">{d}</div></div></li>
                  ))}
                </ol>
                <div className="tc">{s.triage.cierre}</div>
              </div>
            )}

            <div className={"ai-mark" + (done[i] ? " on" : "")} onClick={() => toggleDone(i)}>
              <span className="ai-box">✓</span>
              <span>
                <span className="mt">{done[i] ? "Paso completado" : "Ya lo hice en Nubceo"}</span><br />
                <span className="ms">{done[i] ? "Podés desmarcarlo si necesitás volver." : "Marcalo cuando termines para llevar tu progreso."}</span>
              </span>
            </div>

            {renderFeedback(i)}
          </>
        )}

        <div className="ai-pfoot">
          <button className="ai-btn ai-btn-g" onClick={() => go(i)}>← Atrás</button>
          <button className="ai-btn ai-btn-p" onClick={() => go(i + 2)}>Siguiente →</button>
          {!soloFork && !esApi && (
            <button className="ai-btn ai-btn-s ai-btn-sm" onClick={delegar}>Este paso lo hace otra persona</button>
          )}
          <span className="ai-help" onClick={pedirAyuda}>Tengo una duda de este paso</span>
        </div>
      </section>
    );
  };

  const renderCierre = () => (
    <section className="ai-panel">
      <div className="ai-hero">
        <div className="ai-circ">✓</div>
        <h1>Terminaste tu puesta en marcha</h1>
        <p className="ai-lead" style={{ margin: "0 auto" }}>Configuraste tu Conciliador por tu cuenta y ya sabés
          operarlo. Desde acá, lo importante es sostener la rutina.</p>
      </div>

      <h3>Tu progreso</h3>
      <ul className="ai-chk">
        {STEPS.map((s, i) => (
          <li key={i}>
            {s.nav}
            <span className={"ai-badge " + (done[i] ? "ai-b-green" : "ai-b-amber")}>{done[i] ? "Hecho" : "Pendiente"}</span>
          </li>
        ))}
      </ul>
      <p className="ai-small ai-muted" style={{ marginTop: ".6rem" }}>{hechos} de {total} pasos completados.</p>

      <div className="ai-callout">Tu implementador va a <b>revisar tu configuración dentro de las próximas 48 horas</b>.
        Te escribe solo si encuentra algo para mejorar.</div>

      <div className="ai-pfoot">
        <button className="ai-btn ai-btn-p" onClick={() => abrirNubceo("Inicio")}>Ir a Nubceo →</button>
        <button className="ai-btn ai-btn-g" onClick={() => go(0)}>Volver al inicio</button>
      </div>
    </section>
  );

  if (cargando) {
    return (
      <div className="ai-root">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ padding: "5rem 2rem", textAlign: "center", color: "var(--n400)" }}>Cargando tu guía…</div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="ai-root">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="ai-nav">
          <img src="/logo-nubceo.png" alt="Nubceo" />
          <span className="tag">Guía de puesta en marcha · Conciliador</span>
        </div>
        <div style={{ maxWidth: 460, margin: "0 auto", padding: "3rem 1.5rem" }}>
          <section className="ai-panel">
            <div className="ai-kicker">Acceso</div>
            <h1>Entrá a tu guía</h1>
            <p className="ai-lead">Usá el mismo código que te compartió tu referente de Nubceo.</p>

            <div style={{ marginTop: "1.5rem" }}>
              <label className="ai-fbl" htmlFor="ai-cod">Tu código de acceso</label>
              <input
                id="ai-cod"
                value={inputCodigo}
                onChange={(e) => setInputCodigo(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") entrar(inputCodigo.trim(), inputEmail.trim().toLowerCase()); }}
                placeholder="Por ejemplo: DEMO123"
                style={{ width: "100%", padding: "11px 12px", marginTop: ".4rem", border: "1px solid var(--n200)",
                  borderRadius: 8, fontSize: 15, fontFamily: "var(--font)", letterSpacing: ".04em" }}
              />
            </div>

            <div style={{ marginTop: "1rem" }}>
              <label className="ai-fbl" htmlFor="ai-mail">Tu correo</label>
              <div className="ai-fbs">Para que tu equipo y tu implementador sepan quién hizo cada paso.</div>
              <input
                id="ai-mail"
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") entrar(inputCodigo.trim(), inputEmail.trim().toLowerCase()); }}
                placeholder="nombre@tuempresa.com"
                style={{ width: "100%", padding: "11px 12px", marginTop: ".4rem", border: "1px solid var(--n200)",
                  borderRadius: 8, fontSize: 15, fontFamily: "var(--font)" }}
              />
            </div>

            {errorLogin && (
              <div className="ai-callout warn" style={{ marginTop: "1.1rem" }}>{errorLogin}</div>
            )}

            <div className="ai-pfoot">
              <button className="ai-btn ai-btn-p" disabled={!inputCodigo.trim()}
                onClick={() => entrar(inputCodigo.trim().toUpperCase(), inputEmail.trim().toLowerCase())}>
                Entrar →
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const navs = ["Bienvenida", ...STEPS.map((s) => s.nav), "Listo"];

  return (
    <div className="ai-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ai-nav">
        <img src="/logo-nubceo.png" alt="Nubceo" />
        <span className="tag">Guía de puesta en marcha · Conciliador</span>
        <div className="spacer" />
        <div className="ai-navprog">
          <span>{pct}% completado</span>
          <div className="ai-track"><div className="ai-fill" style={{ width: pct + "%" }} /></div>
        </div>
        <button className="ai-btn ai-btn-out ai-btn-sm" style={{ marginLeft: "1.25rem" }} onClick={salir}>
          Salir
        </button>
      </div>

      <div className="ai-wrap">
        <aside className="ai-side">
          <h4>Ya configurado por Nubceo</h4>
          <ul className="ai-cxlist">
            <li><span className="ai-lock">✓</span> Datos de la empresa</li>
            <li><span className="ai-lock">✓</span> Procesadoras vinculadas</li>
          </ul>
          <h4 className="second">Tu puesta en marcha</h4>
          <ul className="ai-steplist">
            {navs.map((n, i) => {
              const hecho = i > 0 && i <= total && done[i - 1];
              const cls = i === cur ? "active" : hecho ? "done" : "";
              const marca = hecho ? "✓" : i === 0 ? "·" : i > total ? "★" : i;
              return (
                <li key={i} className={cls} onClick={() => go(i)}>
                  <span className="ai-bullet">{marca}</span><span>{n}</span>
                </li>
              );
            })}
          </ul>
          <div className="ai-sidefoot">
            Empresa: <b>{cliente.nombre}</b><br />
            {cliente.implementador && (<>Te acompaña: <b>{cliente.implementador}</b><br /></>)}
            Alcance: <b>Conciliador transaccional</b>
            {cliente.implementadorEmail && (
              <div style={{ marginTop: ".7rem" }}>
                <a className="ai-link" href={"mailto:" + cliente.implementadorEmail + "?subject=Consulta%20sobre%20la%20gu%C3%ADa%20de%20puesta%20en%20marcha"}>
                  Escribirle
                </a>
              </div>
            )}
            {email && (<div style={{ marginTop: ".7rem" }}>Entraste como <b>{email}</b></div>)}
          </div>
        </aside>

        <main>
          {cur === 0 ? renderBienvenida() : cur === total + 1 ? renderCierre() : renderPaso(cur - 1)}
        </main>
      </div>
    </div>
  );
}
