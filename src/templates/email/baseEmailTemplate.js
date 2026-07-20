import env from '../../config/env.js';
import { escapeHtml } from '../../utils/emailHtml.js';

const colors = {
  ivory: '#FAF6EE',
  white: '#FFFDF8',
  maroon: '#672F3B',
  brown: '#302925',
  muted: '#6F6259',
  border: '#DED2C5',
  beige: '#F3ECE3',
};

export function baseEmailTemplate({ title, preview = '', content, cta, footerNote = '' }) {
  const logo = env.emailLogoUrl
    ? `<img src="${escapeHtml(env.emailLogoUrl)}" alt="Amorah by N-ZAN Designs" style="max-width:150px;height:auto;display:block;" />`
    : `<div style="font-size:28px;letter-spacing:5px;color:${colors.maroon};font-weight:700;">AMORAH</div>
       <div style="font-size:12px;letter-spacing:2px;color:${colors.muted};margin-top:4px;">By N-ZAN Designs</div>`;
  const supportEmail = env.supportEmail || env.emailReplyTo || env.emailFromAddress || '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:${colors.ivory};font-family:Arial,Helvetica,sans-serif;color:${colors.brown};">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${colors.ivory};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;background:${colors.white};border:1px solid ${colors.border};">
            <tr>
              <td style="padding:28px 28px 18px;border-bottom:1px solid ${colors.border};">${logo}</td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:${colors.maroon};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(title)}</h1>
                ${content}
                ${
                  cta
                    ? `<p style="margin:28px 0 0;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${colors.maroon};color:#ffffff;text-decoration:none;padding:13px 20px;font-weight:700;letter-spacing:1px;">${escapeHtml(cta.label)}</a></p>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px;background:${colors.beige};border-top:1px solid ${colors.border};font-size:13px;line-height:1.7;color:${colors.muted};">
                ${footerNote ? `<p style="margin:0 0 10px;">${escapeHtml(footerNote)}</p>` : ''}
                <p style="margin:0;">This email was sent regarding your Amorah order.${supportEmail ? ` For help, contact ${escapeHtml(supportEmail)}.` : ''}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function paragraph(value) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:${colors.brown};">${escapeHtml(value)}</p>`;
}

export function detailTable(rows) {
  const htmlRows = rows
    .filter((row) => row.value !== undefined && row.value !== null && row.value !== '')
    .map(
      (row) => `<tr>
        <td style="padding:9px 0;color:${colors.muted};font-size:14px;">${escapeHtml(row.label)}</td>
        <td style="padding:9px 0;color:${colors.brown};font-size:14px;font-weight:700;text-align:right;">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join('');

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid ${colors.border};border-bottom:1px solid ${colors.border};margin:20px 0;">${htmlRows}</table>`;
}

export function productList(order) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-top:1px solid ${colors.border};">
    ${(order.items || [])
      .map(
        (item) => `<tr>
          <td style="padding:14px 0;border-bottom:1px solid ${colors.border};">
            <div style="font-weight:700;color:${colors.brown};">${escapeHtml(item.productName)}</div>
            <div style="font-size:13px;color:${colors.muted};margin-top:4px;">${escapeHtml(item.colourName)} / Size ${escapeHtml(item.size)} / Qty ${escapeHtml(item.quantity)}</div>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid ${colors.border};text-align:right;font-weight:700;color:${colors.brown};">${escapeHtml(item.lineTotalFormatted || '')}</td>
        </tr>`,
      )
      .join('')}
  </table>`;
}
