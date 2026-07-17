import { useState, useEffect } from 'react';
import ModalAgregarContacto from './ModalAgregarContacto';

// Tokens de marca Nubceo (tema C — Soft, igual a PortalApp)
const T = {
  bg: "#eef4ff",
  card: "#ffffff",
  cardBorder: "#c7dcfd",
  primary: "#0a6bf4",
  primary50: "#e8f1fe",
  primary100: "#b9d2fb",
  primary600: "#0550c0",
  primary800: "#033a8a",
  primary900: "#02265c",
  sky: "#38b6ff",
  n50: "#f7f8fa",
  n100: "#eef0f4",
  n200: "#d8dce6",
  n400: "#8e96a8",
  n600: "#4b5468",
  n800: "#1e2433",
  n900: "#0d1120",
  okBg: "#dcfce7",
  okTx: "#166534",
  warnBg: "#fef9c3",
  warnTx: "#854d0e",
  errBg: "#fee2e2",
  errTx: "#991b1b",
};

export default function MailsCard({ cliente }) {
  const [mails, setMails] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('');
  const [destinatariosSeleccionados, setDestinatariosSeleccionados] = useState({ fernanda: true });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const plantillas = [
    { id: 'bienvenida', nombre: 'Mail de bienvenida' },
    { id: 'recordatorio', nombre: 'Recordatorio de plazo' },
    { id: 'vencido', nombre: 'Plazo vencido' },
    { id: 'workshop', nombre: 'Invitación a workshop' },
    { id: 'golive', nombre: 'Confirmación de go-live' },
  ];

  const equipoNubceo = [
    { id: 'fernanda', nombre: 'Fernanda Acevedo', email: 'fernanda.acevedo@nubceo.com', rol: 'Implementadora', tipo: 'nubceo' },
    { id: 'santiago', nombre: 'Santiago Suarez', email: 'santiago.suarez@nubceo.com', rol: 'Desarrollador', tipo: 'nubceo' },
    { id: 'silvana', nombre: 'Silvana Mascitelli', email: 'silvana.mascitelli@nubceo.com', rol: 'Líder Impl.', tipo: 'nubceo' },
  ];

  useEffect(() => {
    cargarDatos();
  }, [cliente?.id]);

  const cargarDatos = async () => {
    try {
      const response = await fetch(`/api/get-mails?cliente_id=${cliente?.id}`);
      if (!response.ok) throw new Error('Error cargando datos');
      const result = await response.json();
      setMails(result.mails || []);
      setContactos(result.contactos || []);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('No se pudieron cargar los mails');
    }
  };

  const handleAgregarContacto = async (nuevoContacto) => {
    try {
      const response = await fetch('/api/add-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: cliente?.id,
          nombre: nuevoContacto.nombre,
          email: nuevoContacto.email,
          rol: nuevoContacto.rol,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al agregar');

      setContactos([...contactos, result.contact]);
      setDestinatariosSeleccionados(prev => ({
        ...prev,
        [result.contact.id]: true
      }));
      setShowModal(false);
      setSuccess('Contacto agregado correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Error al agregar contacto: ' + err.message);
    }
  };

  const handleEnviarMail = async () => {
    if (!plantillaSeleccionada) {
      setError('Selecciona una plantilla');
      return;
    }

    const destinatarios = [
      ...equipoNubceo.filter(e => destinatariosSeleccionados[e.id]),
      ...contactos.filter(c => destinatariosSeleccionados[c.id])
    ];

    if (destinatarios.length === 0) {
      setError('Selecciona al menos un destinatario');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/send-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: cliente?.id,
          plantilla: plantillaSeleccionada,
          destinatarios: destinatarios.map(d => ({ email: d.email, nombre: d.nombre })),
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Error al enviar');

      setSuccess('Mail enviado correctamente');
      setPlantillaSeleccionada('');
      setDestinatariosSeleccionados({ fernanda: true });
      cargarDatos();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVistaPrevia = async () => {
    if (!plantillaSeleccionada) {
      setError('Selecciona una plantilla');
      return;
    }

    try {
      const response = await fetch('/api/preview-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: cliente?.id,
          plantilla: plantillaSeleccionada,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      const previewWindow = window.open('', '_blank');
      previewWindow.document.write(result.html);
      previewWindow.document.close();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReintentar = async (mailId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/retry-mail?mail_id=${mailId}`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Error al reintentar');

      setSuccess('Mail reenviado');
      cargarDatos();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: `1px solid ${T.n200}`,
      }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: T.n900 }}>📧</span>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: T.n900 }}>Mails</h2>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div style={{
          background: T.errBg,
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
      {success && (
        <div style={{
          background: T.okBg,
          color: T.okTx,
          padding: 12,
          borderRadius: 6,
          marginBottom: 16,
          fontSize: 13,
          border: `1px solid ${T.okTx}22`,
        }}>
          ✓ {success}
        </div>
      )}

      {/* Historial de mails */}
      {mails.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.n400,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 12,
          }}>
            Historial de envíos
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mails.map(mail => (
              <div key={mail.id} style={{
                background: mail.estado === 'error' ? T.errBg : T.primary50,
                border: `1px solid ${mail.estado === 'error' ? T.errTx : T.primary100}`,
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: T.n900, marginBottom: 4 }}>
                      {mail.plantilla || 'Mail'} {mail.estado === 'enviado' ? '✓' : mail.estado === 'error' ? '✕' : '⏳'}
                    </div>
                    <div style={{ fontSize: 12, color: T.n600, marginBottom: 6 }}>
                      {mail.destinatarios?.join(', ') || 'Sin destinatarios'}
                    </div>
                    {mail.error_msg && (
                      <div style={{ fontSize: 12, color: T.errTx, fontStyle: 'italic' }}>
                        Error: {mail.error_msg}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.n400, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {new Date(mail.enviado_at).toLocaleDateString('es-AR')}
                  </div>
                </div>
                {mail.estado === 'error' && (
                  <button
                    onClick={() => handleReintentar(mail.id)}
                    disabled={loading}
                    style={{
                      marginTop: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.primary,
                      background: 'transparent',
                      border: `1px solid ${T.primary}`,
                      padding: '6px 12px',
                      borderRadius: 4,
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    Reintentar envío
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divididor */}
      <div style={{ height: 1, background: T.n200, margin: '24px 0' }} />

      {/* Enviar nuevo mail */}
      <div>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.n400,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 16,
        }}>
          Enviar nuevo mail
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Plantilla */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: T.n900,
              marginBottom: 8,
            }}>
              Plantilla
            </label>
            <select
              value={plantillaSeleccionada}
              onChange={(e) => setPlantillaSeleccionada(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${T.n200}`,
                borderRadius: 6,
                fontSize: 13,
                background: T.card,
                color: T.n800,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <option value="">Seleccionar plantilla...</option>
              {plantillas.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* Destinatarios */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <label style={{
                fontSize: 13,
                fontWeight: 600,
                color: T.n900,
              }}>
                Destinatarios
              </label>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  fontSize: 12,
                  color: T.primary,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                + Agregar contacto
              </button>
            </div>

            <div style={{
              background: T.primary50,
              border: `1px solid ${T.primary100}`,
              borderRadius: 8,
              padding: 14,
              maxHeight: 350,
              overflowY: 'auto',
            }}>
              {/* Equipo Nubceo */}
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.primary800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}>
                  Equipo Nubceo
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {equipoNubceo.map(persona => (
                    <label key={persona.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: destinatariosSeleccionados[persona.id] ? T.primary : 'transparent',
                      border: `1px solid ${T.primary100}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: destinatariosSeleccionados[persona.id] ? '#fff' : T.n800,
                      transition: 'all 0.2s',
                    }}>
                      <input
                        type="checkbox"
                        checked={destinatariosSeleccionados[persona.id] || false}
                        onChange={(e) => setDestinatariosSeleccionados(prev => ({
                          ...prev,
                          [persona.id]: e.target.checked
                        }))}
                        style={{ margin: 0, cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1, fontWeight: 500 }}>{persona.nombre}</span>
                      <span style={{
                        fontSize: 11,
                        opacity: 0.8,
                      }}>
                        ({persona.rol})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Contactos del cliente */}
              {contactos.length > 0 && (
                <div style={{ marginBottom: 14, paddingTop: 10, borderTop: `1px solid ${T.primary100}` }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.primary800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}>
                    Contactos del cliente
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {contactos.map(contacto => (
                      <label key={contacto.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: destinatariosSeleccionados[contacto.id] ? T.sky : 'transparent',
                        border: `1px solid ${T.primary100}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13,
                        color: destinatariosSeleccionados[contacto.id] ? '#fff' : T.n800,
                      }}>
                        <input
                          type="checkbox"
                          checked={destinatariosSeleccionados[contacto.id] || false}
                          onChange={(e) => setDestinatariosSeleccionados(prev => ({
                            ...prev,
                            [contacto.id]: e.target.checked
                          }))}
                          style={{ margin: 0, cursor: 'pointer' }}
                        />
                        <span style={{ flex: 1, fontWeight: 500 }}>{contacto.nombre}</span>
                        <span style={{
                          fontSize: 11,
                          opacity: 0.8,
                          textTransform: 'capitalize',
                        }}>
                          ({contacto.rol})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleVistaPrevia}
              disabled={loading || !plantillaSeleccionada}
              style={{
                flex: 1,
                background: 'transparent',
                border: `1.5px solid ${T.primary}`,
                color: T.primary,
                padding: '10px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading || !plantillaSeleccionada ? 'default' : 'pointer',
                opacity: loading || !plantillaSeleccionada ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              👁 Vista previa
            </button>
            <button
              onClick={handleEnviarMail}
              disabled={loading}
              style={{
                flex: 1,
                background: T.primary,
                color: '#fff',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              {loading ? '⏳ Enviando...' : '✓ Enviar mail'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ModalAgregarContacto
          onAgregar={handleAgregarContacto}
          onCancelar={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
