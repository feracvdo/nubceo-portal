import { useState } from 'react';

export default function ModalAgregarContacto({ onAgregar, onCancelar }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('otro');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Email válido es requerido');
      return;
    }

    if (!rol) {
      setError('Selecciona un rol');
      return;
    }

    setLoading(true);

    try {
      await onAgregar({ nombre, email, rol });
      setNombre('');
      setEmail('');
      setRol('otro');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--surface-2)',
        borderRadius: '12px',
        border: '0.5px solid var(--border)',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 500,
          margin: '0 0 20px 0',
          color: 'var(--text-primary)',
        }}>
          Agregar nuevo contacto
        </h2>

        {error && (
          <div style={{
            background: 'var(--bg-danger)',
            color: 'var(--text-danger)',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '6px',
            }}>
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Carlos Perez"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '0.5px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '6px',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="carlos@freddo.com"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '0.5px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box',
              }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '6px',
            }}>
              Rol
            </label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '0.5px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
              disabled={loading}
            >
              <option value="sponsor">Sponsor</option>
              <option value="key_user">Key User</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '0.5px solid var(--border)',
          }}>
            <button
              type="button"
              onClick={onCancelar}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
                background: 'transparent',
                border: '0.5px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                color: 'var(--text-primary)',
                opacity: loading ? 0.5 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
                background: 'var(--fill-accent)',
                color: 'white',
                border: '0.5px solid var(--border-accent)',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
