import nodemailer from 'nodemailer';
import env from './env.js';

let transporter = null;

export function isEmailConfigured() {
  if (!env.emailEnabled) {
    return false;
  }

  return Boolean(env.smtpHost && env.smtpPort && env.emailFromAddress);
}

export function getMailer() {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      requireTLS: !env.smtpSecure,
      auth: env.smtpUser || env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
      connectionTimeout: env.emailConnectionTimeoutMs,
      greetingTimeout: env.emailConnectionTimeoutMs,
      socketTimeout: env.emailConnectionTimeoutMs,
      tls: {
        rejectUnauthorized: env.nodeEnv === 'production',
      },
    });
  }

  return transporter;
}

export async function verifyEmailConnection() {
  const mailer = getMailer();

  if (!mailer) {
    return {
      ok: false,
      reason: env.emailEnabled ? 'SMTP email is not configured.' : 'Transactional email is disabled.',
    };
  }

  await mailer.verify();
  return { ok: true };
}
