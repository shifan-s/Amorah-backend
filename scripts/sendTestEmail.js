import env from '../src/config/env.js';
import { getMailer, verifyEmailConnection } from '../src/config/mailer.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  if (!emailPattern.test(env.testEmailTo || '')) {
    console.error('TEST_EMAIL_TO must be set to a valid email address.');
    process.exitCode = 1;
    return;
  }

  const verification = await verifyEmailConnection();

  if (!verification.ok) {
    console.error(verification.reason || 'Email configuration is incomplete.');
    process.exitCode = 1;
    return;
  }

  const mailer = getMailer();
  await mailer.sendMail({
    from: {
      name: env.emailFromName,
      address: env.emailFromAddress,
    },
    to: env.testEmailTo,
    replyTo: env.emailReplyTo || env.supportEmail || undefined,
    subject: 'Amorah SMTP test email',
    text: 'This is a test transactional email from Amorah. No customer order is associated with this message.',
    html:
      '<p>This is a test transactional email from <strong>Amorah</strong>.</p><p>No customer order is associated with this message.</p>',
  });

  mailer.close?.();
  console.log(`Test email sent to ${env.testEmailTo}.`);
}

main().catch((error) => {
  console.error(error?.message || 'Unable to send test email.');
  process.exitCode = 1;
});
