import { useState } from 'react';

// Tokens de marca Nubceo (tema C — Soft)
const T = {
  primary: "#0a6bf4",
  primary50: "#e8f1fe",
  n200: "#d8dce6",
  n400: "#8e96a8",
  n600: "#4b5468",
  n800: "#1e2433",
  n900: "#0d1120",
  errTx: "#991b1b",
};

export default function ModalAgregarContacto({ onAgregar, onCancelar }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('sponsor');
  const [error, setError] = useState(null);

  const roles = [
    { value: 'sponsor', label: 'Sponsor (decisor)' },
    { value: 'key_user', label: 'Key User' },
    { value: 'otro', label: 'Otro' },
  ];

  const handleGuardar = () => {
    if (!nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!email.trim()) {
      setError('El email es requerido');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email inválido');
      return;
    }

    onAgregar({ nombre: nombre.trim(), email: email.trim(), rol });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        width: '90%',
        maxWidth: 400,
        padding: 24,
      }}>
        {/* Header */}
        <div style={{
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: `1px solid ${T.n200}`,
        }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 600,
            margin: 0,
            color: T.n900,
          }}>
            Agregar contacto
          </h2>
          <p style={{
            fontSize: 13,
            color: T.n600,
            margin: '6px 0 0 0',
          }}>
            Suma un nuevo contacto del cliente para que reciba mails
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fee2e2',
            color: T.errTx,
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 13,
            border: `1px solid ${T.errTx}22`,
          }}>
            ❌ {error}
          </div>
        )}

        {/* Formulario */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Nombre */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: T.n900,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan Pérez"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${T.n200}`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = T.primary}
              onBlur={(e) => e.target.style.borderColor = T.n200}
            />
          </div>

          {/* Email */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: T.n900,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@empresa.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${T.n200}`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = T.primary}
              onBlur={(e) => e.target.style.borderColor = T.n200}
            />
          </div>

          {/* Rol */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: T.n900,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Rol
            </label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${T.n200}`,
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
                background: '#fff',
                color: T.n800,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {roles.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Botones */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginTop: 24,
          paddingTop: 16,
          borderTop: `1px solid ${T.n200}`,
        }}>
          <button
            onClick={onCancelar}
            style={{
              flex: 1,
              background: 'transparent',
              border: `1px solid ${T.n200}`,
              color: T.n800,
              padding: '10px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = T.n200 + '22';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            style={{
              flex: 1,
              background: T.primary,
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#0550c0';
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = T.primary;
              e.target.style.transform = 'translateY(0)';
            }}
          >
            ✓ Guardar contacto
          </button>
        </div>
      </div>
    </div>
  );
}
