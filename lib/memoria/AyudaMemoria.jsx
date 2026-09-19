// lib/memoria/AyudaMemoria.jsx
//
// Botón chico en la barra superior que abre un bloc de notas flotante a la
// derecha. Es para lo que no pertenece a ningún cliente.
//
// Se guarda solo mientras escribís, con un respiro de un segundo para no
// pegarle a la base en cada tecla. El panel no tapa la pantalla: podés seguir
// leyendo el portal mientras anotás.

import { useState, useEffect, useRef } from "react";

const C = {
  primary: "#0a6bf4", primary50: "#e8f1fe", primary800: "#033a8a", n900: "#0d1120",
  n800: "#1e2433", n600: "#4b5468", n400: "#8e96a8", n200: "#d8dce6", n100: "#eef0f4",
  okTx: "#166534",
};

async function api(action, payload) {
  const res = await fetch("/api/memoria", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "No pudimos conectarnos.");
  return j;
}

export default function AyudaMemoria({ codigo }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [cargado, setCargado] = useState(false);
  const [estado, setEstado] = useState(""); // "" | "guardando" | "guardado" | "error"
  const [actualizado, setActualizado] = useState(null);
  const timer = useRef(null);
  const areaRef = useRef(null);

  // Se carga una sola vez, al entrar, para que el puntito del botón sepa si hay algo.
  useEffect(() => {
    if (!codigo) return;
    let vivo = true;
    (async () => {
      try {
        const r = await api("leer", { codigo });
        if (vivo) { setTexto(r.texto || ""); setActualizado(r.actualizado); }
      } catch (e) {
        /* si falla, arranca vacío */
      } finally {
        if (vivo) setCargado(true);
      }
    })();
    return () => { vivo = false; };
  }, [codigo]);

  useEffect(() => {
    if (!abierto) return;
    const esc = (e) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", esc);
    setTimeout(() => areaRef.current && areaRef.current.focus(), 60);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto]);

  // Guardado con respiro: se dispara un segundo después de la última tecla.
  const escribir = (valor) => {
    setTexto(valor);
    setEstado("guardando");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await api("guardar", { codigo, texto: valor });
        setActualizado(r.actualizado);
        setEstado("guardado");
        setTimeout(() => setEstado((e) => (e === "guardado" ? "" : e)), 2500);
      } catch (e) {
        setEstado("error");
      }
    }, 1000);
  };

  // Guarda lo pendiente al cerrar, sin esperar el respiro.
  const cerrar = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (estado === "guardando") {
      try { const r = await api("guardar", { codigo, texto }); setActualizado(r.actualizado); setEstado(""); }
      catch (e) { setEstado("error"); }
    }
    setAbierto(false);
  };

  const conContenido = cargado && texto.trim().length > 0;
  const fecha = actualizado
    ? new Date(actualizado).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) +
      " " + new Date(actualizado).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        title="Tus notas sueltas, las que no son de ningún cliente"
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 7,
          background: abierto ? C.primary50 : "transparent",
          color: abierto ? C.primary800 : C.n600,
          border: "1px solid " + (abierto ? C.primary : C.n200),
          borderRadius: 8, padding: "6px 12px", fontSize: 13.5, fontWeight: 500,
          fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        📝 Ayuda memoria
        {conContenido && !abierto && (
          <span style={{
            position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: "50%",
            background: C.primary, border: "2px solid #fff",
          }} />
        )}
      </button>

      {abierto && (
        <div style={{
          position: "fixed", top: 0, right: 0, height: "100vh", width: 400, maxWidth: "92vw",
          background: "#fff", borderLeft: "1px solid " + C.n200, zIndex: 60,
          boxShadow: "-10px 0 30px rgba(13,17,32,.12)", display: "flex", flexDirection: "column",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "16px 18px",
            borderBottom: "1px solid " + C.n100, flexShrink: 0,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.n900 }}>Ayuda memoria</div>
              <div style={{ fontSize: 11.5, color: C.n400, marginTop: 1 }}>
                Privado: solo lo ves vos.{fecha ? " Última edición: " + fecha : ""}
              </div>
            </div>
            <span onClick={cerrar} title="Cerrar (Esc)" style={{
              cursor: "pointer", fontSize: 18, color: C.n400, padding: "0 4px", lineHeight: 1,
            }}>✕</span>
          </div>

          <textarea
            ref={areaRef}
            value={texto}
            onChange={(e) => escribir(e.target.value)}
            placeholder={"Anotá lo que necesites…\n\nPendientes que no son de un cliente, ideas, cosas para preguntar, lo que sea. Se guarda solo."}
            style={{
              flex: 1, width: "100%", border: "none", outline: "none", resize: "none",
              padding: "16px 18px", fontSize: 14, lineHeight: 1.7, fontFamily: "inherit",
              color: C.n800, background: "#fff",
            }}
          />

          <div style={{
            padding: "10px 18px", borderTop: "1px solid " + C.n100, fontSize: 12,
            color: estado === "error" ? "#b91c1c" : estado === "guardado" ? C.okTx : C.n400,
            flexShrink: 0, minHeight: 38, display: "flex", alignItems: "center",
          }}>
            {estado === "guardando" ? "Guardando…"
              : estado === "guardado" ? "Guardado ✓"
              : estado === "error" ? "No se pudo guardar — revisá la conexión"
              : texto.length + " caracteres"}
          </div>
        </div>
      )}
    </>
  );
}
