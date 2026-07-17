import { useState, useEffect } from "react";
import ModalAgregarContacto from "./ModalAgregarContacto";

export default function MailsCard({ cliente }) {
  const [mails, setMails] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [plantilla, setPlantilla] = useState("bienvenida");
  const [previewHtml, setPreviewHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // Carga mails y contactos al montar
  useEffect(() => {
    console.log("[MailsCard] useEffect triggered, cliente:", cliente);
    if (!cliente?.id) {
      console.log("[MailsCard] ERROR: cliente or cliente.id is missing", cliente);
      setError("Cliente no identificado");
      setLoading(false);
      return;
    }
    cargarDatos();
  }, [cliente?.id]);

  const cargarDatos = async () => {
    console.log("[cargarDatos] Starting with cliente.id:", cliente?.id);
    if (!cliente?.id) {
      console.error("[cargarDatos] cliente.id is undefined!");
      setError("Cliente no identificado");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const url = `/api/get-mails?cliente_id=${cliente.id}`;
      console.log("[cargarDatos] Fetching:", url);

      const resp = await fetch(url);
      console.log("[cargarDatos] Response status:", resp.status);

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("[cargarDatos] Response error:", errText);
        throw new Error(`Error ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      console.log("[cargarDatos] Data received:", data);

      setMails(data.mails || []);
      setContactos(data.contactos || []);

      // Pre-selecciona a Fernanda
      const fernanda = data.contactos?.find((c) => c.nombre?.includes("Fernanda"));
      if (fernanda) {
        console.log("[cargarDatos] Pre-selecting Fernanda:", fernanda);
        setSelectedContacts([fernanda.id]);
      }
    } catch (e) {
      console.error("[cargarDatos] Error:", e);
      setError("Error cargando datos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVistaPrevia = async () => {
    if (!plantilla) {
      setError("Seleccioná una plantilla");
      return;
    }
    try {
      setError(null);
      console.log("[preview] Fetching preview for plantilla:", plantilla);
      const resp = await fetch("/api/preview-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantilla, cliente: cliente.nombre }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("[preview] Error:", errText);
        throw new Error(`Error ${resp.status}`);
      }

      const html = await resp.text();
      console.log("[preview] HTML received, length:", html.length);
      setPreviewHtml(html);
    } catch (e) {
      console.error("[preview] Error:", e);
      setError("Error cargando vista previa: " + e.message);
    }
  };

  const handleEnviarMail = async () => {
    if (!plantilla) {
      setError("Seleccioná una plantilla");
      return;
    }
    if (selectedContacts.length === 0) {
      setError("Seleccioná al menos un contacto");
      return;
    }

    try {
      setEnviando(true);
      setError(null);

      const destinatarios = contactos
        .filter((c) => selectedContacts.includes(c.id))
        .map((c) => c.email)
        .filter(Boolean);

      console.log("[send] Destinatarios:", destinatarios);

      if (destinatarios.length === 0) {
        setError("Los contactos seleccionados no tienen email");
        return;
      }

      const respPreview = await fetch("/api/preview-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantilla, cliente: cliente.nombre }),
      });
      const contenido = await respPreview.text();

      console.log("[send] Sending mail to cliente:", cliente.id);
      const respSend = await fetch("/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: cliente.id,
          plantilla,
          asunto: `Nubceo - ${plantilla}`,
          destinatarios,
          contenido,
        }),
      });

      if (!respSend.ok) {
        const errData = await respSend.json();
        console.error("[send] Error response:", errData);
        throw new Error(errData.error || `Error ${respSend.status}`);
      }

      const result = await respSend.json();
      console.log("[send] Success:", result);
      alert("Mail enviado exitosamente a " + destinatarios.length + " persona(s)");
      setSelectedContacts([]);
      setPreviewHtml(null);
      await cargarDatos();
    } catch (e) {
      console.error("[send] Error:", e);
      setError("Error enviando mail: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleAgregarContacto = async (nuevoContacto) => {
    try {
      setError(null);
      console.log("[add-contact] Adding:", nuevoContacto);
      const resp = await fetch("/api/add-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: cliente.id,
          nombre: nuevoContacto.nombre,
          email: nuevoContacto.email,
          rol: nuevoContacto.rol || "otro",
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json();
        console.error("[add-contact] Error:", errData);
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      console.log("[add-contact] Success");
      setShowModal(false);
      await cargarDatos();
      alert("Contacto agregado exitosamente");
    } catch (e) {
      console.error("[add-contact] Error:", e);
      setError("Error agregando contacto: " + e.message);
    }
  };

  const toggleContacto = (contactoId) => {
    setSelectedContacts((prev) =>
      prev.includes(contactoId)
        ? prev.filter((id) => id !== contactoId)
        : [...prev, contactoId]
    );
  };

  if (loading) {
    return (
      <div style={{ padding: "20px" }}>
        <p>⏳ Cargando mails y contactos...</p>
        {error && <p style={{ color: "red" }}>Error: {error}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      {error && (
        <div
          style={{
            marginBottom: "15px",
            padding: "12px",
            backgroundColor: "#fee",
            borderLeft: "4px solid #f44",
            borderRadius: "4px",
            color: "#c00",
            fontSize: "14px",
          }}
        >
          ✕ {error}
        </div>
      )}

      <div style={{ marginBottom: "30px" }}>
        <h3>📧 Enviar nuevo mail</h3>

        <label style={{ display: "block", marginBottom: "15px" }}>
          <strong>Plantilla</strong>
          <select
            value={plantilla}
            onChange={(e) => setPlantilla(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "5px",
              borderRadius: "4px",
              border: "1px solid #c7dcfd",
              fontSize: "14px",
            }}
          >
            <option value="bienvenida">Mail de bienvenida</option>
            <option value="recordatorio">Recordatorio</option>
            <option value="vencido">Plazo vencido</option>
            <option value="workshop">Invitación Workshop</option>
            <option value="golive">Invitación Go-Live</option>
          </select>
        </label>

        <label style={{ display: "block", marginBottom: "15px" }}>
          <strong>Destinatarios ({contactos.length} disponibles)</strong>
          <div
            style={{
              marginTop: "8px",
              padding: "12px",
              backgroundColor: "#eef4ff",
              borderRadius: "4px",
              border: "1px solid #c7dcfd",
              maxHeight: "250px",
              overflowY: "auto",
            }}
          >
            {contactos.length === 0 ? (
              <p style={{ color: "#999", fontSize: "13px" }}>Sin contactos cargados</p>
            ) : (
              <>
                <div style={{ marginBottom: "10px", fontSize: "13px", color: "#666" }}>
                  <strong>Todos los contactos:</strong>
                </div>
                {contactos.map((c) => (
                  <label key={c.id} style={{ display: "block", marginBottom: "6px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(c.id)}
                      onChange={() => toggleContacto(c.id)}
                      style={{ marginRight: "8px", accentColor: "#0a6bf4" }}
                    />
                    <span style={{ fontSize: "14px" }}>
                      {c.nombre} {c.email && <span style={{ color: "#999", fontSize: "12px" }}>({c.email})</span>}
                    </span>
                  </label>
                ))}
              </>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              marginTop: "10px",
              padding: "6px 12px",
              fontSize: "13px",
              backgroundColor: "#fff",
              border: "1px solid #0a6bf4",
              color: "#0a6bf4",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            + Agregar contacto
          </button>
        </label>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleVistaPrevia}
            disabled={enviando}
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: "#fff",
              border: "1px solid #0a6bf4",
              color: "#0a6bf4",
              borderRadius: "4px",
              cursor: enviando ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            👁️ Vista previa
          </button>
          <button
            onClick={handleEnviarMail}
            disabled={enviando || selectedContacts.length === 0}
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: enviando || selectedContacts.length === 0 ? "#ccc" : "#0a6bf4",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: enviando || selectedContacts.length === 0 ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            {enviando ? "Enviando..." : "✓ Enviar mail"}
          </button>
        </div>
      </div>

      {previewHtml && (
        <div style={{ marginBottom: "30px" }}>
          <h3>Vista previa</h3>
          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: "4px",
              overflow: "auto",
              maxHeight: "500px",
              backgroundColor: "#f9f9f9",
            }}
          >
            <iframe
              srcDoc={previewHtml}
              style={{ width: "100%", height: "400px", border: "none" }}
              title="Vista previa"
            />
          </div>
        </div>
      )}

      {mails.length > 0 && (
        <div>
          <h3>📋 Historial de mails</h3>
          {mails.map((mail) => (
            <div
              key={mail.id}
              style={{
                marginBottom: "12px",
                padding: "12px",
                backgroundColor: mail.estado === "enviado" ? "#efe" : "#fee",
                border: `1px solid ${mail.estado === "enviado" ? "#6d6" : "#f99"}`,
                borderRadius: "4px",
                fontSize: "13px",
              }}
            >
              <div>
                <strong>{mail.asunto}</strong>{" "}
                <span style={{ color: "#666", fontSize: "12px" }}>
                  {new Date(mail.enviado_at).toLocaleString("es-AR")}
                </span>
              </div>
              <div style={{ color: "#666", fontSize: "12px", marginTop: "4px" }}>
                A: {mail.destinatarios.join(", ")}
              </div>
              {mail.estado === "error" && <div style={{ color: "#c00" }}>Error: {mail.error_msg}</div>}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModalAgregarContacto
          onClose={() => setShowModal(false)}
          onGuardar={handleAgregarContacto}
        />
      )}
    </div>
  );
}
