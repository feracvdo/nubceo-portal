import { useState, useEffect } from "react";
import ModalAgregarContacto from "./ModalAgregarContacto";

// Recibe datos del cliente por props (el detalle del cliente ya los tiene cargados):
//   clienteId, clienteNombre, codigoAcceso, involucradosIniciales, implementador, desarrollador, lider
export default function MailsCard({
  clienteId,
  clienteNombre,
  codigoAcceso,
  involucradosIniciales = [],
  implementador,
  desarrollador,
  lider,
}) {
  const [mails, setMails] = useState([]);
  const [contactos, setContactos] = useState(involucradosIniciales || []);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [plantilla, setPlantilla] = useState("bienvenida");
  const [previewHtml, setPreviewHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  useEffect(() => {
    if (!clienteId) { setError("Cliente no identificado"); setLoading(false); return; }
    cargarDatos();
  }, [clienteId]);

  // datos que consumen las plantillas (preview y envío)
  const datosPlantilla = () => ({
    clienteNombre,
    codigoAcceso,
    implementador: implementador && implementador.nombre ? implementador : null,
    desarrollador: desarrollador && desarrollador.nombre ? desarrollador : null,
    lider: lider && lider.nombre ? lider : undefined, // undefined => usa el líder por defecto (Silvana)
  });

  const cargarDatos = async () => {
    if (!clienteId) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch(`/api/get-mails?cliente_id=${clienteId}`);
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const data = await resp.json();
      setMails(data.mails || []);
      // Preferimos los contactos de la base (alta + relevamiento); si no hay, los iniciales.
      const lista = (data.contactos && data.contactos.length ? data.contactos : involucradosIniciales) || [];
      setContactos(lista);
      // Preseleccionamos todos los contactos del cliente que tengan email.
      setSelectedContacts(lista.filter((c) => c.email).map((c) => c.id));
    } catch (e) {
      // Si get-mails falla, al menos usamos los contactos que ya vinieron por props.
      const lista = involucradosIniciales || [];
      setContactos(lista);
      setSelectedContacts(lista.filter((c) => c.email).map((c) => c.id));
      setError("No se pudo cargar el historial de mails: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVistaPrevia = async () => {
    try {
      setError(null);
      const resp = await fetch("/api/preview-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantilla, datos: datosPlantilla() }),
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      setPreviewHtml(await resp.text());
    } catch (e) {
      setError("Error cargando vista previa: " + e.message);
    }
  };

  const handleEnviarMail = async () => {
    if (selectedContacts.length === 0) { setError("Seleccioná al menos un destinatario"); return; }
    try {
      setEnviando(true);
      setError(null);
      setOkMsg(null);

      const destinatarios = contactos
        .filter((c) => selectedContacts.includes(c.id))
        .map((c) => c.email)
        .filter(Boolean);

      if (destinatarios.length === 0) { setError("Los contactos seleccionados no tienen email"); return; }

      const respSend = await fetch("/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, plantilla, datos: datosPlantilla(), destinatarios }),
      });

      if (!respSend.ok) {
        const errData = await respSend.json();
        throw new Error(errData.error || `Error ${respSend.status}`);
      }

      setOkMsg("Mail enviado a " + destinatarios.length + " destinatario(s).");
      setPreviewHtml(null);
      await cargarDatos();
    } catch (e) {
      setError("Error enviando mail: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleAgregarContacto = async (nuevoContacto) => {
    try {
      setError(null);
      const resp = await fetch("/api/add-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          nombre: nuevoContacto.nombre,
          email: nuevoContacto.email,
          rol: nuevoContacto.rol || "otro",
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || `Error ${resp.status}`);
      }
      const { contacto } = await resp.json();
      setShowModal(false);
      // Sumamos el contacto nuevo a la lista y lo dejamos seleccionado.
      if (contacto && contacto.id) {
        setContactos((prev) => [...prev, contacto]);
        setSelectedContacts((prev) => [...prev, contacto.id]);
      } else {
        await cargarDatos();
      }
    } catch (e) {
      setError("Error agregando contacto: " + e.message);
    }
  };

  const toggleContacto = (id) =>
    setSelectedContacts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const quitarContacto = (id) => {
    setContactos((prev) => prev.filter((c) => c.id !== id));
    setSelectedContacts((prev) => prev.filter((x) => x !== id));
  };

  if (loading) return <div style={{ padding: 20 }}><p>Cargando mails y contactos…</p></div>;

  return (
    <div style={{ padding: 4 }}>
      {error && (
        <div style={{ marginBottom: 15, padding: 12, backgroundColor: "#fee2e2", borderLeft: "4px solid #ef4444", borderRadius: 4, color: "#991b1b", fontSize: 14 }}>✕ {error}</div>
      )}
      {okMsg && (
        <div style={{ marginBottom: 15, padding: 12, backgroundColor: "#dcfce7", borderLeft: "4px solid #22c55e", borderRadius: 4, color: "#166534", fontSize: 14 }}>✓ {okMsg}</div>
      )}

      <div style={{ marginBottom: 30 }}>
        <h3 style={{ marginTop: 0 }}>📧 Enviar nuevo mail</h3>

        <label style={{ display: "block", marginBottom: 15 }}>
          <strong>Plantilla</strong>
          <select value={plantilla} onChange={(e) => setPlantilla(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 5, borderRadius: 4, border: "1px solid #c7dcfd", fontSize: 14 }}>
            <option value="bienvenida">Mail de bienvenida</option>
            <option value="recordatorio">Recordatorio</option>
            <option value="vencido">Plazo vencido</option>
            <option value="workshop">Invitación a workshop</option>
            <option value="golive">Coordinación de go-live</option>
          </select>
        </label>

        <div style={{ marginBottom: 15 }}>
          <strong>Destinatarios ({contactos.length} cargado{contactos.length === 1 ? "" : "s"})</strong>
          <div style={{ marginTop: 8, padding: 12, backgroundColor: "#eef4ff", borderRadius: 4, border: "1px solid #c7dcfd", maxHeight: 250, overflowY: "auto" }}>
            {contactos.length === 0 ? (
              <p style={{ color: "#8e96a8", fontSize: 13, margin: 0 }}>Sin contactos cargados. Agregá uno con el botón de abajo.</p>
            ) : (
              contactos.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", cursor: "pointer", flex: 1, minWidth: 0 }}>
                    <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={() => toggleContacto(c.id)} style={{ marginRight: 8, accentColor: "#0a6bf4" }} />
                    <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.nombre}{c.rol ? <span style={{ color: "#8e96a8", fontSize: 12 }}> · {c.rol}</span> : null}{c.email ? <span style={{ color: "#8e96a8", fontSize: 12 }}> ({c.email})</span> : <span style={{ color: "#ef4444", fontSize: 12 }}> (sin email)</span>}
                    </span>
                  </label>
                  <span onClick={() => quitarContacto(c.id)} title="Quitar de la lista" style={{ cursor: "pointer", color: "#8e96a8", fontSize: 16, padding: "0 6px", flexShrink: 0 }}>✕</span>
                </div>
              ))
            )}
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ marginTop: 10, padding: "6px 12px", fontSize: 13, backgroundColor: "#fff", border: "1px solid #0a6bf4", color: "#0a6bf4", borderRadius: 4, cursor: "pointer", fontWeight: 500 }}>
            + Agregar contacto
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleVistaPrevia} disabled={enviando}
            style={{ flex: 1, padding: 10, backgroundColor: "#fff", border: "1px solid #0a6bf4", color: "#0a6bf4", borderRadius: 4, cursor: enviando ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 }}>
            👁 Vista previa
          </button>
          <button onClick={handleEnviarMail} disabled={enviando || selectedContacts.length === 0}
            style={{ flex: 1, padding: 10, backgroundColor: enviando || selectedContacts.length === 0 ? "#ccc" : "#0a6bf4", color: "#fff", border: "none", borderRadius: 4, cursor: enviando || selectedContacts.length === 0 ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 }}>
            {enviando ? "Enviando…" : "✓ Enviar mail"}
          </button>
        </div>
      </div>

      {previewHtml && (
        <div style={{ marginBottom: 30 }}>
          <h3>Vista previa</h3>
          <div style={{ border: "1px solid #ccc", borderRadius: 4, overflow: "auto", maxHeight: 500, backgroundColor: "#f9f9f9" }}>
            <iframe srcDoc={previewHtml} style={{ width: "100%", height: 500, border: "none" }} title="Vista previa" />
          </div>
        </div>
      )}

      {mails.length > 0 && (
        <div>
          <h3>📋 Historial de mails</h3>
          {mails.map((mail) => (
            <div key={mail.id} style={{ marginBottom: 12, padding: 12, backgroundColor: mail.estado === "enviado" ? "#dcfce7" : "#fee2e2", border: `1px solid ${mail.estado === "enviado" ? "#22c55e" : "#ef4444"}`, borderRadius: 4, fontSize: 13 }}>
              <div><strong>{mail.asunto}</strong> <span style={{ color: "#666", fontSize: 12 }}>{mail.enviado_at ? new Date(mail.enviado_at).toLocaleString("es-AR") : ""}</span></div>
              <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>A: {(mail.destinatarios || []).join(", ")}</div>
              {mail.estado === "error" && <div style={{ color: "#c00" }}>Error: {mail.error_msg}</div>}
            </div>
          ))}
        </div>
      )}

      {showModal && <ModalAgregarContacto onClose={() => setShowModal(false)} onGuardar={handleAgregarContacto} />}
    </div>
  );
}
