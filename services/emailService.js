/**
 * emailService.js — Envoi d'emails via SMTP (nodemailer)
 *
 * Configuration via variables d'environnement (server/.env ou Render dashboard) :
 *
 *   SMTP_HOST      ex: smtp.gmail.com | smtp-relay.brevo.com | smtp.sendgrid.net
 *   SMTP_PORT      587 (STARTTLS) ou 465 (SSL)
 *   SMTP_USER      votre login SMTP
 *   SMTP_PASS      votre mot de passe / app password / API key SMTP
 *   SMTP_FROM      (optionnel) adresse d'expéditeur affichée
 *                  défaut : nepasrepondre@server-gestion-ventes.onrender.com
 *   SMTP_FROM_NAME (optionnel) nom affiché, défaut : "Ne pas répondre"
 *
 * ⚠️ Render (comme la plupart des PaaS) bloque le port SMTP sortant 25.
 * Utilisez impérativement un relai SMTP (Gmail App Password, Brevo,
 * SendGrid, Mailgun, Resend SMTP, OVH…) sur le port 587 ou 465.
 * Il n'est pas possible d'auto-héberger un vrai serveur SMTP sur Render.
 *
 * En l'absence de configuration SMTP, l'email n'est PAS envoyé et
 * la fonction renvoie { sent: false, reason: 'smtp_not_configured' }.
 * Aucun lien sensible n'est loggué dans la console.
 */
const nodemailer = require('nodemailer');

const DEFAULT_FROM_EMAIL = 'nepasrepondre@server-gestion-ventes.onrender.com';
const DEFAULT_FROM_NAME = 'Ne pas répondre';

let transporter = null;
let transporterError = null;

function getTransporter() {
  if (transporter) return transporter;
  if (transporterError) return null;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[emailService] SMTP non configuré (SMTP_HOST/SMTP_USER/SMTP_PASS manquants).');
    transporterError = 'smtp_not_configured';
    return null;
  }

  const port = Number(SMTP_PORT || 587);
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465, // true pour 465, false pour 587 (STARTTLS)
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });
    // Vérif asynchrone non bloquante
    transporter.verify().then(
      () => console.log(`[emailService] SMTP prêt (${SMTP_HOST}:${port}, user=${SMTP_USER})`),
      (err) => console.error('[emailService] SMTP verify KO:', err.message)
    );
    return transporter;
  } catch (err) {
    console.error('[emailService] Impossible de créer le transporteur SMTP:', err.message);
    transporterError = err.message;
    return null;
  }
}

function buildFrom() {
  const email = process.env.SMTP_FROM || DEFAULT_FROM_EMAIL;
  const name = process.env.SMTP_FROM_NAME || DEFAULT_FROM_NAME;
  return `"${name}" <${email}>`;
}

async function sendMail({ to, subject, html, text, replyTo }) {
  const tx = getTransporter();
  if (!tx) {
    // NE PAS logger le contenu ni les liens : on remonte juste la raison.
    return { sent: false, reason: transporterError || 'smtp_not_configured' };
  }
  try {
    const info = await tx.sendMail({
      from: buildFrom(),
      to,
      subject,
      html,
      text,
      replyTo: replyTo || undefined,
    });
    console.log(`[emailService] Email envoyé à ${to} (id=${info.messageId})`);
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
