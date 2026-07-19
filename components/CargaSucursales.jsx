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
  const [fase, setFase] = useState(1); // 1=Tutorial, 2=Upload, 3=Confirmación
  const [archivo, setArchivo] = useState(null);
  const [errores, setErrores] = useState([]);
  const [datosValidos, setDatosValidos] = useState([]);
  const [cargando, setCargando] = useState(false);

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
        const nroFila = idx + 2; // +2 porque header es fila 1, datos empiezan en fila 2
        const erroresFila = [];

        // Validar que todas las columnas existan
        const columnasPresentes = Object.keys(fila);
        const columnasF = COLUMNAS_REQUERIDAS.filter(col => !columnasPresentes.includes(col));
        if (columnasF.length > 0 && idx === 0) {
          setErrores([{ general: `Columnas faltantes: ${columnasF.join(", ")}` }]);
          setCargando(false);
          return;
        }

        // Validar cada columna
        COLUMNAS_REQUERIDAS.forEach(col => {
          const valor = (fila[col] || "").toString().trim();

          // 1. Validar que no esté vacío
          if (!valor) {
            erroresFila.push({ columna: col, error: "Celda vacía", fila: nroFila });
            return;
          }

          // 2. Validar formato (todo debe ser texto)
          if (typeof valor !== "string" && isNaN(valor)) {
            erroresFila.push({ columna: col, error: "Debe ser texto", fila: nroFila });
            return;
          }

          // 3. Código PDV debe ser único
          if (col === "Código de sucursal PDV") {
            if (codigosPDVVistos.has(valor)) {
              erroresFila.push({ columna: col, error: "Código PDV duplicado", fila: nroFila });
            } else {
              codigosPDVVistos.add(valor);
            }
          }

          // 4. Plataforma debe estar en lista válida
          if (col === "Código de plataforma") {
            if (!PLATAFORMAS_VALIDAS.includes(valor.toLowerCase())) {
              erroresFila.push({ 
                columna: col, 
                error: `Plataforma inválida. Válidas: ${PLATAFORMAS_VALIDAS.slice(0, 5).join(", ")}...`, 
                fila: nroFila 
              });
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

  const T = {
    primary: "#0a6bf4",
    n100: "#e5e7eb",
    n200: "#d1d5db",
    n400: "#9ca3af",
    n600: "#4b5563",
  };

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 12,
        width: "90%",
        maxWidth: 900,
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: "0 20px 25px rgba(0,0,0,0.15)",
      }}>
        {/* FASE 1: TUTORIAL */}
        {fase === 1 && (
          <div style={{ padding: 40 }}>
            <h2 style={{ margin: "0 0 20px 0", color: T.n600 }}>📋 Cargar Sucursales</h2>
            
            <div style={{ background: "#eef4ff", padding: 20, borderRadius: 8, marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 12px 0", color: T.primary, fontSize: 16 }}>¿Qué son las sucursales?</h3>
              <p style={{ margin: 0, color: T.n600, lineHeight: 1.6, fontSize: 14 }}>
                Las sucursales son los puntos de venta que tienes. Cada sucursal está asociada a números de comercio 
                de diferentes plataformas de pago (Prisma, Mercado Pago, etc). Cargar correctamente las sucursales 
                permite a Nubceo hacer una conciliación precisa de tus ventas.
              </p>
            </div>

            <div style={{ marginBottom: 30 }}>
              <h3 style={{ margin: "0 0 12px 0", color: T.n600, fontSize: 16 }}>📍 Dónde descargar el template</h3>
              <div style={{
                background: "#fef3c7",
                border: "2px solid #fbbf24",
                padding: 16,
                borderRadius: 8,
                marginBottom: 16,
              }}>
                <p style={{ margin: "0 0 8px 0", fontWeight: 600, fontSize: 14 }}>
                  Ruta en Nubceo:
                </p>
                <p style={{ margin: 0, fontSize: 13, color: T.n600 }}>
                  <strong>Dashboard</strong> → <strong>Mi negocio</strong> → <strong>Sucursales cabecera</strong> → <strong>Crear masivamente</strong>
                </p>
              </div>
              <a
                href="https://cash.nubceo.com/header-branches"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  background: T.primary,
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                🔗 Ir a Nubceo para descargar template
              </a>
            </div>

            <div style={{ marginBottom: 30 }}>
              <h3 style={{ margin: "0 0 12px 0", color: T.n600, fontSize: 16 }}>📝 Columnas requeridas</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {COLUMNAS_REQUERIDAS.map((col, idx) => (
                  <div key={idx} style={{
                    padding: 12,
                    background: "#f9fafb",
                    border: "1px solid " + T.n200,
                    borderRadius: 6,
                    fontSize: 13,
                  }}>
                    <strong style={{ color: T.primary }}>{idx + 1}.</strong> {col}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 30 }}>
              <h3 style={{ margin: "0 0 12px 0", color: T.n600, fontSize: 16 }}>✓ Validaciones</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: T.n600, fontSize: 13, lineHeight: 1.8 }}>
                <li>Todas las columnas son obligatorias - sin celdas vacías</li>
                <li>Todos los datos deben estar en formato TEXTO</li>
                <li>El código PDV debe ser único (sin repeticiones)</li>
                <li>Las plataformas deben estar en la lista válida (Prisma, Mercado Pago, etc.)</li>
              </ul>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px",
                  background: "#fff",
                  border: "1px solid " + T.n200,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Cerrar
              </button>
              <button
                onClick={() => setFase(2)}
                style={{
                  padding: "10px 20px",
                  background: T.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Siguiente →
              </button>
              <button
                onClick={() => onClose()}
                style={{
                  padding: "10px 20px",
                  background: "#fff",
                  border: "1px solid " + T.n200,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  color: T.primary,
                }}
              >
                Omitir por ahora
              </button>
            </div>
          </div>
        )}

        {/* FASE 2: UPLOAD & VALIDACIÓN */}
        {fase === 2 && (
          <div style={{ padding: 40 }}>
            <h2 style={{ margin: "0 0 20px 0", color: T.n600 }}>📤 Subir archivo Excel</h2>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && (file.type === "application/vnd.ms-excel" || file.name.endsWith(".xls"))) {
                  setArchivo(file);
                  validarArchivo(file);
                } else {
                  setErrores([{ general: "Por favor sube un archivo .xls válido" }]);
                }
              }}
              style={{
                border: "2px dashed " + T.primary,
                borderRadius: 8,
                padding: 40,
                textAlign: "center",
                background: "#eef4ff",
                cursor: "pointer",
                marginBottom: 20,
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: T.primary }}>
                📁 Arrastra tu archivo aquí
              </p>
              <p style={{ margin: 0, fontSize: 13, color: T.n400 }}>
                o haz click para seleccionar
              </p>
              <input
                type="file"
                accept=".xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setArchivo(file);
                    validarArchivo(file);
                  }
                }}
                style={{
                  position: "absolute",
                  opacity: 0,
                  width: "100%",
                  height: "100%",
                  cursor: "pointer",
                }}
              />
            </div>

            {archivo && (
              <div style={{
                padding: 12,
                background: "#dcfce7",
                border: "1px solid #86efac",
                borderRadius: 6,
                marginBottom: 20,
                fontSize: 13,
              }}>
                ✓ Archivo seleccionado: <strong>{archivo.name}</strong>
              </div>
            )}

            {cargando && (
              <div style={{ textAlign: "center", padding: 20 }}>
                <p style={{ color: T.n400 }}>Validando archivo...</p>
              </div>
            )}

            {errores.length > 0 && !cargando && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#dc2626", marginBottom: 12, fontSize: 14 }}>❌ Errores detectados</h3>
                <div style={{
                  overflowX: "auto",
                  border: "1px solid " + T.n200,
                  borderRadius: 6,
                }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6", borderBottom: "2px solid " + T.n200 }}>
                        <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Fila</th>
                        <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Columna</th>
                        <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errores.map((err, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid " + T.n100 }}>
                          <td style={{ padding: 12 }}>{err.fila || "-"}</td>
                          <td style={{ padding: 12 }}>{err.columna || "General"}</td>
                          <td style={{ padding: 12, color: "#dc2626" }}>{err.error || err.general}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setFase(1)}
                style={{
                  padding: "10px 20px",
                  background: "#fff",
                  border: "1px solid " + T.n200,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                ← Atrás
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px",
                  background: "#fff",
                  border: "1px solid " + T.n200,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* FASE 3: CONFIRMACIÓN */}
        {fase === 3 && (
          <div style={{ padding: 40 }}>
            <h2 style={{ margin: "0 0 20px 0", color: T.n600 }}>✓ Vista previa</h2>

            <div style={{
              padding: 12,
              background: "#dcfce7",
              border: "1px solid #86efac",
              borderRadius: 6,
              marginBottom: 20,
              fontSize: 13,
            }}>
              ✓ Se encontraron <strong>{datosValidos.length} sucursal(es) válida(s)</strong> para guardar
            </div>

            <div style={{
              overflowX: "auto",
              border: "1px solid " + T.n200,
              borderRadius: 6,
              marginBottom: 20,
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", borderBottom: "2px solid " + T.n200 }}>
                    <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Empresa</th>
                    <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Sucursal</th>
                    <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Código PDV</th>
                    <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Plataforma</th>
                    <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Nro. Comercio</th>
                  </tr>
                </thead>
                <tbody>
                  {datosValidos.map((dato, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid " + T.n100 }}>
                      <td style={{ padding: 12 }}>{dato.empresa}</td>
                      <td style={{ padding: 12 }}>{dato.nombre}</td>
                      <td style={{ padding: 12, fontWeight: 600, color: T.primary }}>{dato.codigopdv}</td>
                      <td style={{ padding: 12 }}>{dato.plataforma}</td>
                      <td style={{ padding: 12 }}>{dato.numercomercio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setFase(2)}
                style={{
                  padding: "10px 20px",
                  background: "#fff",
                  border: "1px solid " + T.n200,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                ← Volver
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px",
                  background: "#fff",
                  border: "1px solid " + T.n200,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Omitir
              </button>
              <button
                onClick={handleGuardar}
                disabled={cargando}
                style={{
                  padding: "10px 20px",
                  background: cargando ? "#ccc" : "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: cargando ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {cargando ? "Guardando..." : "✓ Guardar sucursales"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
