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
  const [fase, setFase] = useState(1); // 1=Guía, 2=Upload, 3=Confirmación
  const [guiaDescargada, setGuiaDescargada] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [errores, setErrores] = useState([]);
  const [datosValidos, setDatosValidos] = useState([]);
  const [cargando, setCargando] = useState(false);

  const descargarGuia = () => {
    const guiaContenido = `GUÍA PARA CARGA DE SUCURSALES EN NUBCEO
=====================================================

CONTEXTO
--------
La carga de sucursales cumple dos funciones:
1. Administrar y visualizar tus sucursales en reportes y pantallas del portal
2. Realizar una conciliación correcta entre ventas y liquidaciones de procesadoras

EL DESAFÍO: Dos Sistemas de Identificación Diferentes
-----------------------------------------------------

Sistema de Procesadoras de Pago:
- Identifican cada venta por NÚMERO DE COMERCIO
- Asignan uno distinto para cada PLATAFORMA DE PAGO y SUCURSAL

Sistema del Punto de Venta (PDV):
- Identifica cada venta con: CUIT + CÓDIGO DE SUCURSAL
- El código es único en tu sistema de gestión

¿EL PROBLEMA?
Nubceo necesita VINCULAR ambos sistemas para saber en qué sucursal se hizo cada venta.

TRES FORMAS DE CARGAR SUCURSALES
================================

OPCIÓN 1: CARGA MASIVA PARA CLIENTES VINCULADOS (Recomendado)
Si ya vinculaste tus procesadoras y estás recibiendo liquidaciones:
1. Ingresa a Nubceo → Mi negocio → Sucursales cabecera → Crear masivamente
2. Descarga el template (incluye sucursales huérfanas)
3. Completa con:
   - Nombre de la sucursal (asociado a cada número de comercio)
   - Código que tu PDV asigna a esa sucursal

OPCIÓN 2: CARGA MASIVA PARA CLIENTES SIN PROCESADORAS VINCULADAS
Si aún no vinculaste procesadoras:
1. Ingresa a Nubceo → Mi negocio → Sucursales cabecera → Crear masivamente
2. Descarga el template vacío
3. Completa manualmente con tu información

OPCIÓN 3: FORMULARIO MANUAL (Para pocas sucursales)
1. Ingresa a Nubceo → Mi negocio → Sucursales cabecera → Crear sucursal cabecera
2. Completa con: Empresa, Nombre, Código
3. Asigna números de comercio manualmente

REQUISITOS OBLIGATORIOS
=======================
✓ Formato: XLS (Excel)
✓ Sin celdas vacías
✓ Códigos PDV únicos (no repetidos entre filas)
✓ Todas las 7 columnas presentes
✓ Todo en formato TEXTO

LAS 7 COLUMNAS REQUERIDAS
=========================
1. Nombre de la empresa
2. CUIT/RUT de la empresa
3. Código de sucursal PDV
4. Nombre de sucursal
5. Número de comercio
6. Nombre de comercio
7. Código de plataforma

CÓDIGOS DE PLATAFORMA VÁLIDOS
=============================
ARGENTINA: accor_ar, amex_ar, bilsantafe_ar, cabal_ar, firstdata_ar, getnet_ar, gocuotas_ar, italcred_ar, mercadopago_ar, naranja_ar, pedidosya_ar, prisma_ar, rappi_ar, tiendanube_ar
COLOMBIA: citi_co, colpatria_co, didi_co, diners_co, mercadopago_co, rappi_co
URUGUAY: amex_uy, anda_uy, cabal_uy, cdirectos_uy, creditel_uy, dlocal_uy, edenred_uy, firstdata_uy, mercadopago_uy, oca_uy, passcard_uy, pedidosya_uy, rappi_uy, visanet_uy

EJEMPLO DE CARGA CORRECTA
=========================
Empresa 1 | 30123456789 | SUC-001 | Casa Central | 0000001 | 0000001 | prisma_ar
Empresa 1 | 30123456789 | SUC-001 | Casa Central | 0000002 | 0000002 | mercadopago_ar
Empresa 1 | 30123456789 | SUC-002 | Sucursal Norte | 0000003 | 0000003 | prisma_ar

PASOS EN EL PORTAL NUBCEO
========================
1. Abrí Nubceo
2. Andá a: Mi negocio → Sucursales cabecera → Crear masivamente
3. Descargá el template (vacío o con huérfanas)
4. Completá en tu Excel local
5. Volvé al portal y subí aquí

AYUDA
====
¿Problemas? Contactá a tu implementador con esta guía.
`;

    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(guiaContenido));
    element.setAttribute("download", "Guia-Carga-Sucursales-Nubceo.txt");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    setGuiaDescargada(true);
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
        {/* FASE 1: GUÍA (OBLIGATORIA) */}
        {fase === 1 && (
          <div style={{ padding: 40 }}>
            <h2 style={{ margin: "0 0 20px 0", color: T.n600 }}>📖 Guía de Carga de Sucursales</h2>

            <div style={{ background: "#fef3c7", border: "2px solid #fbbf24", padding: 20, borderRadius: 8, marginBottom: 30 }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: 600, color: "#854d0e", fontSize: 14 }}>
                ⚠️ IMPORTANTE: Descargá la guía ANTES de continuar
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#854d0e", lineHeight: 1.6 }}>
                La guía contiene toda la información que necesitás: cómo acceder a Nubceo, qué es una sucursal, 
                cómo completar el template, códigos de plataforma válidos y ejemplos.
              </p>
            </div>

            <div style={{ background: "#eef4ff", padding: 20, borderRadius: 8, marginBottom: 30 }}>
              <h3 style={{ margin: "0 0 15px 0", color: T.primary, fontSize: 16 }}>📍 Ruta en Nubceo para descargar template</h3>
              <div style={{
                background: "#fff",
                border: "2px solid " + T.primary,
                padding: 16,
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 14,
                fontFamily: "monospace",
              }}>
                Dashboard 
                <span style={{ color: T.primary, fontWeight: 600 }}> → </span>
                Mi negocio 
                <span style={{ color: T.primary, fontWeight: 600 }}> → </span>
                Sucursales cabecera 
                <span style={{ color: T.primary, fontWeight: 600 }}> → </span>
                Crear masivamente
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
                🔗 Ir a Nubceo
              </a>
            </div>

            <div style={{ marginBottom: 30 }}>
              <h3 style={{ margin: "0 0 15px 0", color: T.n600, fontSize: 16 }}>✓ Qué vas a encontrar en la guía</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: T.n600, fontSize: 13, lineHeight: 2 }}>
                <li>Explicación de qué son las sucursales</li>
                <li>Cómo funcionan los dos sistemas de identificación (Procesadoras vs PDV)</li>
                <li>Las 3 formas de cargar sucursales</li>
                <li>Las 7 columnas requeridas exactamente</li>
                <li>Lista completa de códigos de plataforma válidos</li>
                <li>Ejemplo visual de carga correcta</li>
                <li>Requisitos obligatorios (XLS, sin celdas vacías, PDV únicos)</li>
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
                onClick={descargarGuia}
                style={{
                  padding: "10px 20px",
                  background: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                📥 Descargar guía
              </button>
            </div>

            {guiaDescargada && (
              <div style={{
                marginTop: 20,
                padding: 16,
                background: "#dcfce7",
                border: "1px solid #86efac",
                borderRadius: 6,
              }}>
                <p style={{ margin: "0 0 10px 0", fontWeight: 600, color: "#166534", fontSize: 14 }}>
                  ✓ Guía descargada correctamente
                </p>
                <button
                  onClick={() => setFase(2)}
                  style={{
                    padding: "10px 20px",
                    background: "#059669",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Siguiente → (Subir archivo)
                </button>
              </div>
            )}
          </div>
        )}

        {/* FASE 2: UPLOAD */}
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
                ✓ Archivo: <strong>{archivo.name}</strong>
              </div>
            )}

            {cargando && (
              <div style={{ textAlign: "center", padding: 20 }}>
                <p style={{ color: T.n400 }}>Validando archivo...</p>
              </div>
            )}

            {errores.length > 0 && !cargando && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#dc2626", marginBottom: 12, fontSize: 14 }}>❌ Errores</h3>
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
              ✓ <strong>{datosValidos.length} sucursal(es) válida(s)</strong> para guardar
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
                  </tr>
                </thead>
                <tbody>
                  {datosValidos.map((dato, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid " + T.n100 }}>
                      <td style={{ padding: 12 }}>{dato.empresa}</td>
                      <td style={{ padding: 12 }}>{dato.nombre}</td>
                      <td style={{ padding: 12, fontWeight: 600, color: T.primary }}>{dato.codigopdv}</td>
                      <td style={{ padding: 12 }}>{dato.plataforma}</td>
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
                {cargando ? "Guardando..." : "✓ Guardar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
