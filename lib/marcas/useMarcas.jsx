// lib/marcas/useMarcas.jsx
//
// Marca de color por cliente, privada de cada persona del equipo.
// Se ve solo en el listado de clientes; el tablero sigue con su propio
// semáforo, que es del equipo y no tiene nada que ver con este.
//
// Significado acordado:
//   sin marca  todo bien, nada que hacer de mi lado
//   naranja    tengo algo pendiente que hacer yo
//   rojo       trabado por desarrollo o problema grave

import { useState, useEffect, useCallback } from "react";

export const COLORES = {
  naranja: { hex: "#f59e0b", lbl: "Tengo algo pendiente" },
  rojo: { hex: "#ef4444", lbl: "Trabado o con problema" },
};

// naranja → rojo → sin marca → naranja
const SIGUIENTE = { null: "naranja", naranja: "rojo", rojo: null };

export default function useMarcas(codigo) {
  const [marcas, setMarcas] = useState({});
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!codigo) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/marcas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "listar", codigo }),
        });
        const j = await res.json();
        if (vivo && j.marcas) setMarcas(j.marcas);
      } catch (e) {
        /* si falla, se ven todos sin marca */
      } finally {
        if (vivo) setListo(true);
      }
    })();
    return () => { vivo = false; };
  }, [codigo]);

  // Optimista: el color cambia al instante y se guarda por detrás.
  const ciclar = useCallback((clienteCodigo) => {
    setMarcas((prev) => {
      const actual = prev[clienteCodigo] || null;
      const nuevo = SIGUIENTE[String(actual)];
      const copia = { ...prev };
      if (nuevo) copia[clienteCodigo] = nuevo; else delete copia[clienteCodigo];

      fetch("/api/marcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "marcar", codigo, clienteCodigo, color: nuevo }),
      }).catch(() => {});

      return copia;
    });
  }, [codigo]);

  return { marcas, ciclar, listo };
}

// Círculo clickeable que va al lado del nombre del cliente.
export function MarcaPunto({ color, onClick }) {
  const c = COLORES[color];
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      title={c ? c.lbl + " — clic para cambiar" : "Sin marca — clic para marcar"}
      style={{
        width: 13, height: 13, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
        display: "inline-block", verticalAlign: "middle",
        background: c ? c.hex : "transparent",
        border: c ? "1px solid rgba(0,0,0,.08)" : "1.5px solid #d8dce6",
        boxShadow: c ? "0 0 0 3px " + c.hex + "22" : "none",
      }}
    />
  );
}
