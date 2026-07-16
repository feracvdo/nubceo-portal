import { useState, useEffect } from 'react';
import ModalAgregarContacto from './ModalAgregarContacto';

export default function MailsCard({ cliente, db }) {
  const [mails, setMails] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('');
  const [destinatariosSeleccionados, setDestinatariosSeleccionados] = useState({});
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

  // Cargar mails y contactos del cliente
  useEffect(() => {
    cargarDatos();
  }, [cliente?.id]);

  // Al cargar, marcar implementadora como checked por defecto
  useEffect(() => {
    if (equipoNubceo.length > 0) {
      setDestinatariosSeleccionados(prev => ({
        ...prev,
        'fernanda': true
      }));
    }
  }, []);

  const cargarDatos = async () => {
    try {
      const { data: mailsData } = await db.from('mailsEnviados').select('*').eq('cliente_id', cliente?.id).order('enviado_at', { ascending: false });
      setMails(mailsData || []);

      const { data: contactosData } = await db.from('involucrados').select('*').eq('cliente_id', cliente?.id);
      setContactos(contactosData || []);
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
  };

  const handleAgregarContacto = async (nuevoContacto) => {
    try {
      const { data, error: err } = await db.from('involucrados').insert({
        cliente_id: cliente?.id,
        nombre: nuevoContacto.nombre,
        email: nuevoContacto.email,
        rol: nuevoContacto.rol,
      }).select();

      if (err) throw err;

      setContactos([...contactos, data[0]]);
      setDestinatariosSeleccionados(prev => ({
        ...prev,
        [data[0].id]: true
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

      // Abrir preview en nueva pestaña
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
    <div style={{
      background: 'var(--surface-2)',
      border: '0.5px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
      marginTop: '24px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '0.5px solid var(--border)',
      }}>
        <i className="ti ti-mail" style={{ fontSize: '20px', color: 'var(--text-primary)' }}></i>
        <h2 style={{ fontSize: '18px', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>Mails</h2>
      </div>

      {/* Mensajes */}
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
      {success && (
        <div style={{
          background: 'var(--bg-success)',
          color: 'var(--text-success)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px',
        }}>
          {success}
        </div>
      )}

      {/* Historial */}
      {mails.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
          }}>
            Historial de envíos
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mails.map(mail => (
              <div key={mail.id} style={{
                background: 'var(--surface-1)',
                border: '0.5px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {plantillas.find(p => p.id === mail.plantilla)?.nombre || mail.plantilla}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginTop: '4px',
                    wordBreak: 'break-word',
                  }}>
                    Enviado a: {mail.destinatarios?.join(', ')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {new Date(mail.enviado_at).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {mail.estado === 'enviado' ? (
                    <span style={{
                      background: 'var(--bg-success)',
                      color: 'var(--text-success)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      ✓ Enviado
                    </span>
                  ) : (
                    <span style={{
                      background: 'var(--bg-danger)',
                      color: 'var(--text-danger)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      Error
                    </span>
                  )}
                  <button
                    onClick={() => mail.estado === 'error' && handleReintentar(mail.id)}
                    style={{
                      background: 'transparent',
                      border: '0.5px solid var(--border)',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: mail.estado === 'error' ? 'pointer' : 'default',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      opacity: mail.estado === 'error' ? 1 : 0.5,
                    }}
                    disabled={mail.estado !== 'error'}
                  >
                    {mail.estado === 'error' ? 'Reintentar' : 'Ver'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enviar nuevo mail */}
      <div style={{ paddingTop: '20px', borderTop: '0.5px solid var(--border)' }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '16px',
        }}>
          Enviar nuevo mail
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Plantilla */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '8px',
            }}>
              Plantilla
            </label>
            <select
              value={plantillaSeleccionada}
              onChange={(e) => setPlantillaSeleccionada(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '0.5px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
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
              marginBottom: '12px',
            }}>
              <label style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}>
                Destinatarios
              </label>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  fontSize: '12px',
                  color: 'var(--text-accent)',
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
              background: 'var(--surface-1)',
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              padding: '14px',
              maxHeight: '350px',
              overflowY: 'auto',
            }}>
              {/* Equipo Nubceo */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                }}>
                  Equipo Nubceo
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {equipoNubceo.map(persona => (
                    <label key={persona.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      background: destinatariosSeleccionados[persona.id] ? 'var(--bg-accent)' : 'var(--surface-2)',
                      border: '0.5px solid var(--border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
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
                      <span style={{ flex: 1 }}>{persona.nombre}</span>
                      <span style={{
                        fontSize: '11px',
                        color: destinatariosSeleccionados[persona.id] ? 'var(--text-accent)' : 'var(--text-secondary)',
                      }}>
                        ({persona.rol})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Contactos del cliente */}
              {contactos.length > 0 && (
                <div style={{ marginBottom: '14px', paddingTop: '10px', borderTop: '0.5px solid var(--border)' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '8px',
                  }}>
                    Contactos del cliente
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {contactos.map(contacto => (
                      <label key={contacto.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        background: 'var(--surface-2)',
                        border: '0.5px solid var(--border)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
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
                        <span style={{ flex: 1 }}>{contacto.nombre}</span>
                        <span style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleVistaPrevia}
              disabled={loading || !plantillaSeleccionada}
              style={{
                flex: 1,
                background: 'transparent',
                border: '0.5px solid var(--border)',
                padding: '10px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                color: 'var(--text-primary)',
                opacity: loading ? 0.5 : 1,
              }}
            >
              Vista previa
            </button>
            <button
              onClick={handleEnviarMail}
              disabled={loading}
              style={{
                flex: 1,
                background: 'var(--fill-accent)',
                color: 'white',
                border: '0.5px solid var(--border-accent)',
                padding: '10px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Enviando...' : 'Enviar mail'}
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
