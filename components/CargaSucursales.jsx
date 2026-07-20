import { useState } from "react";
import * as XLSX from "xlsx";

const PLATAFORMAS_VALIDAS = [
  "accor_ar", "amex_ar", "bilsantafe_ar", "cabal_ar", "firstdata_ar", "getnet_ar", "gocuotas_ar", 
  "italcred_ar", "mercadopago_ar", "naranja_ar", "pedidosya_ar", "prisma_ar", "rappi_ar", "tiendanube_ar",
  "citi_co", "colpatria_co", "didi_co", "diners_co", "mercadopago_co", "rappi_co",
  "amex_uy", "anda_uy", "cabal_uy", "cdirectos_uy", "creditel_uy", "dlocal_uy", "edenred_uy", 
  "firstdata_uy", "mercadopago_uy", "oca_uy", "passcard_uy", "pedidosya_uy", "rappi_uy", "visanet_uy"
];

const COLUMNAS_REQUERIDAS = [
  "Nombre de la empresa",
  "CUIT/RUT de la empresa",
  "Código de sucursal PDV",
  "Nombre de sucursal",
  "Número de comercio",
  "Nombre de comercio",
  "Código de plataforma"
];

export default function CargaSucursales({ onClose, onGuardar, cliente }) {
  const [fase, setFase] = useState(1);
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [errores, setErrores] = useState([]);
  const [datosValidos, setDatosValidos] = useState([]);
  const [cargando, setCargando] = useState(false);

  const abrirGuia = () => {
    window.open("https://docs.google.com/document/d/1kkFBEYqiOX66KgfjvxGXvzLdDtkbaAS7tWzK1PMjHcg/edit?tab=t.0", "_blank");
    setGuiaAbierta(true);
  };

  const validarArchivo = async (file) => {
    if (!file) return;
    setCargando(true);
    setErrores([]);
    setDatosValidos([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const datos = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (datos.length === 0) {
        setErrores([{ general: "El archivo está vacío" }]);
        setCargando(false);
        return;
      }

      const erroresDetectados = [];
      const datosValidos_ = [];
      const codigosPDVVistos = new Set();

      datos.forEach((fila, idx) => {
        const nroFila = idx + 2;
        const erroresFila = [];

        COLUMNAS_REQUERIDAS.forEach(col => {
          const valor = (fila[col] || "").toString().trim();

          if (!valor) {
            erroresFila.push({ columna: col, error: "Celda vacía", fila: nroFila });
            return;
          }

          if (col === "Código de sucursal PDV") {
            if (codigosPDVVistos.has(valor)) {
              erroresFila.push({ columna: col, error: "Código PDV duplicado", fila: nroFila });
            } else {
              codigosPDVVistos.add(valor);
            }
          }

          if (col === "Código de plataforma") {
            if (!PLATAFORMAS_VALIDAS.includes(valor.toLowerCase())) {
              erroresFila.push({ columna: col, error: "Plataforma inválida", fila: nroFila });
            }
          }
        });

        if (erroresFila.length === 0) {
          datosValidos_.push({
            empresa: (fila["Nombre de la empresa"] || "").toString().trim(),
            cuit: (fila["CUIT/RUT de la empresa"] || "").toString().trim(),
            codigopdv: (fila["Código de sucursal PDV"] || "").toString().trim(),
            nombre: (fila["Nombre de sucursal"] || "").toString().trim(),
            numercomercio: (fila["Número de comercio"] || "").toString().trim(),
            nombrecomercio: (fila["Nombre de comercio"] || "").toString().trim(),
            plataforma: (fila["Código de plataforma"] || "").toString().trim().toLowerCase(),
          });
        } else {
          erroresDetectados.push(...erroresFila);
        }
      });

      if (erroresDetectados.length > 0) {
        setErrores(erroresDetectados);
      } else {
        setDatosValidos(datosValidos_);
        setFase(3);
      }
    } catch (e) {
      setErrores([{ general: "Error al leer archivo: " + e.message }]);
    } finally {
      setCargando(false);
    }
  };

  const handleGuardar = async () => {
    setCargando(true);
    try {
      await onGuardar(datosValidos);
      setCargando(false);
    } catch (e) {
      setErrores([{ general: "Error al guardar: " + e.message }]);
      setCargando(false);
    }
  };

  const T = { primary: "#0a6bf4", n100: "#e5e7eb", n200: "#d1d5db", n400: "#9ca3af", n600: "#4b5563" };

  if (fase === 1) {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
        <div style={{ background: "#fff", borderRadius: 12, width: "90%", maxWidth: 900, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 25px rgba(0,0,0,0.15)", padding: 40 }}>
          <h2 style={{ margin: "0 0 20px 0", color: T.n600 }}>📖 Guía de Carga de Sucursales</h2>
          <div style={{ background: "#fef3c7", border: "2px solid #fbbf24", padding: 20, borderRadius: 8, marginBottom: 30 }}>
            <p style={{ margin: "0 0 10px 0", fontWeight: 600, color: "#854d0e", fontSize: 14 }}>⚠️ IMPORTANTE: Abrí la guía ANTES de continuar</p>
            <p style={{ margin: 0, fontSize: 13, color: "#854d0e", lineHeight: 1.6 }}>La guía contiene toda la información: cómo acceder a Nubceo, qué es una sucursal, cómo completar el template, códigos de plataforma válidos y ejemplos.</p>
          </div>
          <div style={{ background: "#eef4ff", padding: 20, borderRadius: 8, marginBottom: 30 }}>
            <h3 style={{ margin: "0 0 15px 0", color: T.primary, fontSize: 16 }}>📍 Ruta en Nubceo para descargar template</h3>
            <div style={{ background: "#fff", border: "2px solid " + T.primary, padding: 16, borderRadius: 6, marginBottom: 16, fontSize: 14, fontFamily: "monospace" }}>Dashboard → Mi negocio → Sucursales cabecera → Crear masivamente</div>
            <a href="https://cash.nubceo.com/header-branches" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: T.primary, color: "#fff", padding: "10px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>🔗 Ir a Nubceo</a>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "10px 20px", background: "#fff", border: "1px solid " + T.n200, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Cerrar</button>
            <button onClick={abrirGuia} style={{ padding: "10px 20px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>📄 Abrir guía</button>
          </div>
          {guiaAbierta && (
            <div style={{ marginTop: 20, padding: 16, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6 }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: 600, color: "#166534", fontSize: 14 }}>✓ Guía abierta en nueva ventana</p>
              <button onClick={() => setFase(2)} style={{ padding: "10px 20px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Siguiente → (Subir archivo)</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (fase === 2) {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
        <div style={{ background: "#fff", borderRadius: 12, width: "90%", maxWidth: 900, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 25px rgba(0,0,0,0.15)", padding: 40 }}>
          <h2 style={{ margin: "0 0 20px 0", color: T.n600 }}>📤 Subir archivo Excel</h2>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && (f.type === "application/vnd.ms-excel" || f.name.endsWith(".xls"))) { setArchivo(f); validarArchivo(f); } }} style={{ border: "2px dashed " + T.primary, borderRadius: 8, padding: 40, textAlign: "center", background: "#eef4ff", cursor: "pointer", marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: T.primary }}>📁 Arrastra tu archivo aquí</p>
            <input type="file" accept=".xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setArchivo(f); validarArchivo(f); } }} style={{ position: "absolute", opacity: 0 }} />
          </div>
          {archivo && <div style={{ padding: 12, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, marginBottom: 20, fontSize: 13 }}>✓ {archivo.name}</div>}
          {cargando && <p>Validando...</p>}
          {errores.length > 0 && <div style={{ marginBottom: 20 }}><h3 style={{ color: "#dc2626" }}>❌ Errores</h3><table style={{ width: "100%", fontSize: 12 }}><tbody>{errores.map((e, i) => <tr key={i}><td>{e.fila}</td><td>{e.columna}</td><td>{e.error}</td></tr>)}</tbody></table></div>}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}><button onClick={() => setFase(1)} style={{ padding: "10px 20px", background: "#fff", border: "1px solid " + T.n200, borderRadius: 6, cursor: "pointer" }}>← Atrás</button><button onClick={onClose} style={{ padding: "10px 20px", background: "#fff", border: "1px solid " + T.n200, borderRadius: 6, cursor: "pointer" }}>Cerrar</button></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "90%", maxWidth: 900, padding: 40 }}>
        <h2>✓ Vista previa</h2>
        <p>Se guardaron {datosValidos.length} sucursal(es)</p>
        <table style={{ width: "100%", fontSize: 12 }}><tbody>{datosValidos.map((d, i) => <tr key={i}><td>{d.empresa}</td><td>{d.nombre}</td><td>{d.codigopdv}</td><td>{d.plataforma}</td></tr>)}</tbody></table>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}><button onClick={() => setFase(2)}>← Volver</button><button onClick={onClose}>Omitir</button><button onClick={handleGuardar}>✓ Guardar</button></div>
      </div>
    </div>
  );
}
