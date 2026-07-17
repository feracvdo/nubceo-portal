import { useState } from "react";

export default function ModalAgregarContacto({ onClose, onGuardar }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("otro");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleGuardar = async () => {
    setError("");
    if (!nombre.trim()) {
      setError("El nombre es requerido");
      return;
    }
    if (!email.trim()) {
      setError("El email es requerido");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email inválido");
      return;
    }

    setCargando(true);
    try {
      await onGuardar({ nombre, email, rol });
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "24px",
          borderRadius: "8px",
          maxWidth: "400px",
          width: "90%",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: "16px" }}>Agregar contacto</h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "16px" }}>
          Suma un nuevo contacto del cliente para que reciba mails
        </p>

        {error && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              backgroundColor: "#fee",
              border: "1px solid #f99",
              borderRadius: "4px",
              color: "#c00",
              fontSize: "13px",
            }}
          >
            ✕ {error}
          </div>
        )}

        <label style={{ display: "block", marginBottom: "12px" }}>
          <strong style={{ fontSize: "13px" }}>Nombre</strong>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Fernando García"
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "4px",
              border: "1px solid #c7dcfd",
              borderRadius: "4px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "12px" }}>
          <strong style={{ fontSize: "13px" }}>Email</strong>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ej: fernando@empresa.com"
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "4px",
              border: "1px solid #c7dcfd",
              borderRadius: "4px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "16px" }}>
          <strong style={{ fontSize: "13px" }}>Rol</strong>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "4px",
              border: "1px solid #c7dcfd",
              borderRadius: "4px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          >
            <option value="sponsor">Sponsor (decisor)</option>
            <option value="key_user">Key User</option>
            <option value="desarrollador">Desarrollador</option>
            <option value="otro">Otro</option>
          </select>
        </label>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={cargando}
            style={{
              padding: "8px 16px",
              backgroundColor: "#fff",
              border: "1px solid #c7dcfd",
              borderRadius: "4px",
              cursor: cargando ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={cargando}
            style={{
              padding: "8px 16px",
              backgroundColor: cargando ? "#ccc" : "#0a6bf4",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: cargando ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            {cargando ? "Guardando..." : "✓ Guardar contacto"}
          </button>
        </div>
      </div>
    </div>
  );
}
