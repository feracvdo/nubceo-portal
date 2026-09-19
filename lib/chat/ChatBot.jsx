// lib/chat/ChatBot.jsx
//
// Globito abajo a la derecha: preguntas rápidas sobre el estado de los clientes.
// Solo para el equipo. Todo lo resuelve /api/chat, que valida el código y hace
// las consultas; acá no hay nada de lógica de datos.

import { useState, useRef, useEffect } from "react";

const C = {
  primary: "#0a6bf4", primary50: "#e8f1fe", primary100: "#b9d2fb", primary800: "#033a8a",
  navy: "#02265c", n900: "#0d1120", n800: "#1e2433", n600: "#4b5468", n400: "#8e96a8",
  n200: "#d8dce6", n100: "#eef0f4", n50: "#f7f8fa",
};

const SUGERENCIAS = [
  "¿Qué clientes están sin moverse hace más de dos semanas?",
  "¿Cómo viene Farmacias Grassi?",
  "¿Qué reuniones tiene agendadas Aadesa?",
];

export default function ChatBot({ codigo }) {
  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (finRef.current) finRef.current.scrollIntoView({ behavior: "smooth" });
  }, [msgs, pensando]);

  useEffect(() => {
    if (!abierto) return;
    const esc = (e) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", esc);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto]);

  const enviar = async (pregunta) => {
    const q = (pregunta ?? texto).trim();
    if (!q || pensando) return;
    const nuevos = [...msgs, { role: "user", content: q }];
    setMsgs(nuevos);
    setTexto("");
    setPensando(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, mensajes: nuevos }),
      });
      const j = await res.json().catch(() => ({}));
      setMsgs([...nuevos, {
        role: "assistant",
        content: res.ok ? j.respuesta : (j.error || "No pude responder."),
        error: !res.ok,
      }]);
    } catch (e) {
      setMsgs([...nuevos, { role: "assistant", content: "Se cortó la conexión. Probá de nuevo.", error: true }]);
    } finally {
      setPensando(false);
    }
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Preguntale al asistente sobre un cliente"
        style={{
          position: "fixed", bottom: 22, right: 22, zIndex: 70,
          width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer",
          background: C.primary, color: "#fff", fontSize: 22,
          boxShadow: "0 6px 20px rgba(10,107,244,.38)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >💬</button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 22, right: 22, zIndex: 70,
      width: 400, maxWidth: "94vw", height: 560, maxHeight: "82vh",
      background: "#fff", border: "1px solid " + C.n200, borderRadius: 16,
      boxShadow: "0 18px 48px rgba(13,17,32,.2)", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
        background: C.navy, color: "#fff", flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Asistente del equipo</div>
          <div style={{ fontSize: 11.5, opacity: .7 }}>Estado, notas y reuniones de tus clientes</div>
        </div>
        <span onClick={() => setAbierto(false)} title="Cerrar (Esc)"
          style={{ cursor: "pointer", fontSize: 18, opacity: .8, lineHeight: 1, padding: "0 4px" }}>✕</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", background: "#f7f9fd" }}>
        {msgs.length === 0 && (
          <div>
            <p style={{ fontSize: 13.5, color: C.n600, lineHeight: 1.6, margin: "0 0 14px" }}>
              Preguntame por un cliente y te digo en qué está, qué se le pidió y qué tiene agendado.
              Leo el portal, no los mails.
            </p>
            <div style={{ display: "grid", gap: 7 }}>
              {SUGERENCIAS.map((s, i) => (
                <span key={i} onClick={() => enviar(s)} style={{
                  fontSize: 13, color: C.primary800, background: C.primary50,
                  border: "1px solid " + C.primary100, borderRadius: 10, padding: "9px 12px",
                  cursor: "pointer", lineHeight: 1.45,
                }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10,
          }}>
            <div style={{
              maxWidth: "86%", fontSize: 13.5, lineHeight: 1.6, borderRadius: 12,
              padding: "10px 13px", whiteSpace: "pre-wrap",
              background: m.role === "user" ? C.primary : m.error ? "#fee2e2" : "#fff",
              color: m.role === "user" ? "#fff" : m.error ? "#b91c1c" : C.n800,
              border: m.role === "user" ? "none" : "1px solid " + C.n200,
            }}>{m.content}</div>
          </div>
        ))}

        {pensando && (
          <div style={{ fontSize: 13, color: C.n400, padding: "4px 2px" }}>Buscando…</div>
        )}
        <div ref={finRef} />
      </div>

      <div style={{
        display: "flex", gap: 8, padding: "12px 14px", borderTop: "1px solid " + C.n100, flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Preguntá algo…"
          style={{
            flex: 1, height: 40, padding: "0 12px", border: "1px solid " + C.n200, borderRadius: 9,
            fontSize: 13.5, fontFamily: "inherit", color: C.n800, outline: "none",
          }}
        />
        <button type="button" onClick={() => enviar()} disabled={pensando || !texto.trim()}
          style={{
            background: C.primary, color: "#fff", border: "none", borderRadius: 9, padding: "0 16px",
            fontSize: 14, fontWeight: 600, fontFamily: "inherit",
            cursor: pensando || !texto.trim() ? "not-allowed" : "pointer",
            opacity: pensando || !texto.trim() ? .5 : 1,
          }}>→</button>
      </div>
    </div>
  );
}
