import { escapeHtml, formatEmailDate } from '../../utils/emailHtml.js';

export default function contactEnquiryEmail(enquiry) {
  const name = escapeHtml(enquiry.name);
  const email = escapeHtml(enquiry.email);
  const phone = escapeHtml(enquiry.phone || 'Not provided');
  const subject = escapeHtml(enquiry.subject);
  const message = escapeHtml(enquiry.message).replace(/\r?\n/g, '<br>');
  const receivedAt = escapeHtml(formatEmailDate());

  return {
    subject: `New Amorah enquiry: ${enquiry.subject}`,
    text: [
      'A new enquiry was submitted on amorah.online.',
      '',
      `Name: ${enquiry.name}`,
      `Email: ${enquiry.email}`,
      `Phone: ${enquiry.phone || 'Not provided'}`,
      `Subject: ${enquiry.subject}`,
      `Received: ${formatEmailDate()}`,
      '',
      'Message:',
      enquiry.message,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#302925;line-height:1.6;max-width:640px">
        <h1 style="color:#672F3B;font-size:24px">New Amorah enquiry</h1>
        <p>A customer submitted the contact form on amorah.online.</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:7px 12px 7px 0;font-weight:bold">Name</td><td>${name}</td></tr>
          <tr><td style="padding:7px 12px 7px 0;font-weight:bold">Email</td><td>${email}</td></tr>
          <tr><td style="padding:7px 12px 7px 0;font-weight:bold">Phone</td><td>${phone}</td></tr>
          <tr><td style="padding:7px 12px 7px 0;font-weight:bold">Subject</td><td>${subject}</td></tr>
          <tr><td style="padding:7px 12px 7px 0;font-weight:bold">Received</td><td>${receivedAt}</td></tr>
        </table>
        <h2 style="color:#672F3B;font-size:18px">Message</h2>
        <p style="background:#FAF6EE;border:1px solid #DED2C5;padding:16px">${message}</p>
      </div>
    `,
  };
}
