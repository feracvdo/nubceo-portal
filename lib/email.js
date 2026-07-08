// lib/email.js
// Envío de mail vía Resend (https://resend.com) por REST — sin SDK, para no sumar
// dependencias. Solo se importa desde rutas de API (servidor).
export async function enviarMail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Falta la variable de entorno RESEND_API_KEY");
  const from = process.env.MAIL_FROM || "Nubceo <notificaciones@nubceo.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error("Resend rechazó el envío: " + (await res.text()));
  return res.json();
}
