/**
 * emailService.js — Envoi d'emails via SMTP (nodemailer)
 *
 * Utilise les variables d'environnement :
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Si aucune configuration SMTP n'est présente, on log le contenu de l'email
 * dans la console et on renvoie { sent: false, devLink } pour permettre le
 * développement local.
 */
const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const tx = getTransporter();
  if (!tx) {
    console.warn('[emailService] SMTP non configuré — email non envoyé.');
    console.log(`--- EMAIL (dev) ---\nTo: ${to}\nSubject: ${subject}\n${text || html}\n-------------------`);
    return { sent: false, dev: true };
  }
  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await tx.sendMail({ from, to, subject, html, text });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[emailService] Erreur envoi email:', err.message);
    return { sent: false, error: err.message };
  }
}

function buildHtml({ title, intro, ctaText, ctaUrl, footer }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.15);">
    <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:28px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:22px;">${title}</h1>
    </div>
    <div style="padding:28px;color:#1e293b;line-height:1.6;">
      <p style="margin-top:0;">${intro}</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:bold;">${ctaText}</a>
      </p>
      <p style="font-size:12px;color:#64748b;word-break:break-all;">Si le bouton ne fonctionne pas, copiez ce lien : <br/>${ctaUrl}</p>
      <p style="font-size:12px;color:#64748b;margin-top:24px;">${footer || 'Ce lien expire dans 1 heure. Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email.'}</p>
    </div>
  </div></body></html>`;
}

module.exports = { sendMail, buildHtml };
