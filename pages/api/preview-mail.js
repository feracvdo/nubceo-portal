// pages/api/preview-mail.js

const PLANTILLAS = {
  bienvenida: (cliente) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Mail Bienvenida</title>
</head>
<body style="background:#eef4ff; padding:40px 20px; font-family: Arial, sans-serif;">
  <div style="background:#fff; max-width:600px; margin:0 auto; padding:40px; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="border-bottom:2px solid #0a6bf4; padding-bottom:20px; margin-bottom:30px;">
      <h1 style="margin:0; color:#0a6bf4; font-size:28px;">¡Bienvenido a Nubceo!</h1>
    </div>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      Hola equipo de <strong>${cliente}</strong>,
    </p>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      Es un placer darles la bienvenida al proceso de implementación de <strong>Nubceo</strong>. Estamos muy contentos de empezar este proceso junto a ustedes.
    </p>
    <div style="background:#eef4ff; border-left:4px solid #0a6bf4; padding:20px; border-radius:4px; margin:30px 0;">
      <p style="margin:0; font-size:14px; color:#0a6bf4; font-weight:bold; text-transform:uppercase;">Tu acceso al portal</p>
      <p style="margin:10px 0 0 0; font-size:16px; color:#333;">
        Ingresá a: <a href="https://nubceo-portal.vercel.app" style="color:#0a6bf4; text-decoration:none; font-weight:bold;">nubceo-portal.vercel.app</a>
      </p>
    </div>
    <p style="font-size:14px; color:#999; margin-top:40px; border-top:1px solid #eee; padding-top:20px;">
      Si tenés preguntas, no dudes en contactarnos.<br><br>
      Saludos,<br>
      <strong>El equipo de Nubceo</strong>
    </p>
  </div>
</body>
</html>`,

  recordatorio: (cliente) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recordatorio</title>
</head>
<body style="background:#eef4ff; padding:40px 20px; font-family: Arial, sans-serif;">
  <div style="background:#fff; max-width:600px; margin:0 auto; padding:40px; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="border-bottom:2px solid #ff9800; padding-bottom:20px; margin-bottom:30px;">
      <h1 style="margin:0; color:#ff9800; font-size:28px;">⏰ Recordatorio</h1>
    </div>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      Hola ${cliente},
    </p>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      Este es un recordatorio amable sobre los pendientes en tu implementación. 
      Por favor, completá los formularios pendientes en el portal para seguir adelante con el proceso.
    </p>
    <a href="https://nubceo-portal.vercel.app" style="display:inline-block; background:#ff9800; color:#fff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:bold;">Ver pendientes →</a>
    <p style="font-size:14px; color:#999; margin-top:40px; border-top:1px solid #eee; padding-top:20px;">
      Gracias por tu atención.
    </p>
  </div>
</body>
</html>`,

  vencido: (cliente) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Plazo Vencido</title>
</head>
<body style="background:#eef4ff; padding:40px 20px; font-family: Arial, sans-serif;">
  <div style="background:#fff; max-width:600px; margin:0 auto; padding:40px; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="border-bottom:2px solid #f44; padding-bottom:20px; margin-bottom:30px;">
      <h1 style="margin:0; color:#f44; font-size:28px;">⚠️ Plazo Vencido</h1>
    </div>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      Hola ${cliente},
    </p>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      El plazo para completar los pendientes ha vencido. Por favor, contactanos urgentemente para coordinar los próximos pasos.
    </p>
    <a href="https://nubceo-portal.vercel.app" style="display:inline-block; background:#f44; color:#fff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:bold;">Ir al portal →</a>
    <p style="font-size:14px; color:#999; margin-top:40px; border-top:1px solid #eee; padding-top:20px;">
      Estamos aquí para ayudarte.
    </p>
  </div>
</body>
</html>`,

  workshop: (cliente) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Invitación Workshop</title>
</head>
<body style="background:#eef4ff; padding:40px 20px; font-family: Arial, sans-serif;">
  <div style="background:#fff; max-width:600px; margin:0 auto; padding:40px; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="border-bottom:2px solid #4caf50; padding-bottom:20px; margin-bottom:30px;">
      <h1 style="margin:0; color:#4caf50; font-size:28px;">📅 Workshop de Implementación</h1>
    </div>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      Hola ${cliente},
    </p>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      Te invitamos a nuestro workshop de implementación donde revisaremos juntos el proceso, tus necesidades específicas y los próximos pasos.
    </p>
    <div style="background:#f0f8f0; border-left:4px solid #4caf50; padding:20px; border-radius:4px; margin:30px 0;">
      <p style="margin:0; font-size:14px; font-weight:bold;">Por favor, confirmá tu asistencia desde el portal</p>
    </div>
    <a href="https://nubceo-portal.vercel.app" style="display:inline-block; background:#4caf50; color:#fff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:bold;">Confirmar asistencia →</a>
    <p style="font-size:14px; color:#999; margin-top:40px; border-top:1px solid #eee; padding-top:20px;">
      Nos vemos pronto.
    </p>
  </div>
</body>
</html>`,

  golive: (cliente) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Invitación Go-Live</title>
</head>
<body style="background:#eef4ff; padding:40px 20px; font-family: Arial, sans-serif;">
  <div style="background:#fff; max-width:600px; margin:0 auto; padding:40px; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="border-bottom:2px solid #0a6bf4; padding-bottom:20px; margin-bottom:30px;">
      <h1 style="margin:0; color:#0a6bf4; font-size:28px;">🚀 Go-Live</h1>
    </div>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      Hola ${cliente},
    </p>
    <p style="font-size:16px; line-height:1.6; color:#333; margin-bottom:20px;">
      ¡Estamos listos para el Go-Live! Te invitamos a nuestra sesión final de preparación para el lanzamiento de Nubceo en tu empresa.
    </p>
    <div style="background:#eef4ff; border-left:4px solid #0a6bf4; padding:20px; border-radius:4px; margin:30px 0;">
      <p style="margin:0; font-size:14px; font-weight:bold; color:#0a6bf4;">🎉 ¡Es momento de comenzar!</p>
    </div>
    <a href="https://nubceo-portal.vercel.app" style="display:inline-block; background:#0a6bf4; color:#fff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:bold;">Ir al portal →</a>
    <p style="font-size:14px; color:#999; margin-top:40px; border-top:1px solid #eee; padding-top:20px;">
      ¡Gracias por confiar en Nubceo!
    </p>
  </div>
</body>
</html>`,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { plantilla, cliente } = req.body;

  if (!plantilla || !PLANTILLAS[plantilla]) {
    return res.status(400).json({ error: "Plantilla no válida" });
  }

  try {
    const html = PLANTILLAS[plantilla](cliente || "Cliente");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
