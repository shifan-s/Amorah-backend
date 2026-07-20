import PDFDocument from 'pdfkit';
import env from '../config/env.js';

const colors = {
  maroon: '#672F3B',
  terracotta: '#B9684B',
  charcoal: '#302925',
  brown: '#6F6259',
  beige: '#DED2C5',
  warmWhite: '#FFFDF8',
  soft: '#FAF6EE',
};

const maxPdfBytes = 5 * 1024 * 1024;

function text(value = '') {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function statusLabel(value = '') {
  return text(value)
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatINR(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function addressLines(address = {}) {
  return [
    address.fullName,
    address.mobile ? `+91 ${address.mobile}` : '',
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ]
    .map(text)
    .filter(Boolean);
}

function ensurePage(doc, requiredHeight = 70, onNewPage = null) {
  if (doc.y + requiredHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    if (onNewPage) onNewPage();
  }
}

function line(doc, y = doc.y) {
  doc
    .save()
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(colors.beige)
    .lineWidth(0.7)
    .stroke()
    .restore();
}

function sectionTitle(doc, title) {
  ensurePage(doc, 32);
  doc.moveDown(0.7).font('Helvetica-Bold').fontSize(12).fillColor(colors.maroon).text(title.toUpperCase());
  doc.moveDown(0.35);
}

function detailRow(doc, label, value, x, y, width) {
  doc.font('Helvetica').fontSize(8).fillColor(colors.brown).text(label, x, y, { width });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.charcoal).text(value || '-', x, y + 12, { width });
}

function drawBrandFallback(doc, business) {
  doc.font('Times-Roman').fontSize(23).fillColor(colors.maroon).text(text(business.displayName || 'AMORAH').toUpperCase(), 45, 42);
  doc.font('Helvetica').fontSize(7).fillColor(colors.brown).text(text(business.brandLine || 'BY N-ZAN DESIGNS'), 46, 68, {
    characterSpacing: 1.2,
  });
}

function isHttpUrl(value = '') {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

async function fetchLogoBuffer(url) {
  if (!isHttpUrl(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const type = response.headers.get('content-type') || '';

    if (!response.ok || !type.startsWith('image/')) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length <= 1024 * 1024 ? buffer : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function drawHeader(doc, data) {
  doc.rect(0, 0, doc.page.width, 112).fill(colors.warmWhite);

  const logo = await fetchLogoBuffer(data.business.logoUrl);
  if (logo) {
    try {
      doc.image(logo, 45, 36, { fit: [110, 48] });
    } catch {
      drawBrandFallback(doc, data.business);
    }
  } else {
    drawBrandFallback(doc, data.business);
  }

  doc.font('Helvetica-Bold').fontSize(20).fillColor(colors.maroon).text(data.business.heading, 340, 38, {
    width: 210,
    align: 'right',
  });

  if (data.refund.refunded) {
    doc
      .roundedRect(465, 72, 85, 22, 2)
      .fill(colors.maroon)
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#FFFFFF')
      .text('REFUNDED', 465, 79, { width: 85, align: 'center' });
  }

  doc.y = 132;
}

function drawDocumentMeta(doc, data) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.rect(left, doc.y, width, 62).fill(colors.soft);
  const y = doc.y + 12;
  detailRow(doc, 'Invoice number', data.order.invoice.number, left + 14, y, 150);
  detailRow(doc, 'Order number', data.order.orderNumber, left + 178, y, 120);
  detailRow(doc, 'Invoice date', formatDate(data.order.invoice.issuedAt), left + 312, y, 90);
  detailRow(doc, 'Order date', formatDate(data.order.createdAt), left + 416, y, 76);
  doc.y += 78;
}

function drawBusinessDetails(doc, business) {
  const lines = [
    business.legalName || business.displayName,
    business.address.line1,
    business.address.line2,
    [business.address.city, business.address.state, business.address.postalCode].filter(Boolean).join(', '),
    business.address.country,
    business.email ? `Email: ${business.email}` : '',
    business.phone ? `Phone: ${business.phone}` : '',
    business.website ? `Website: ${business.website}` : '',
    business.gstin ? `GSTIN: ${business.gstin}` : '',
    business.pan ? `PAN: ${business.pan}` : '',
  ].map(text).filter(Boolean);

  sectionTitle(doc, 'Sold By');
  doc.font('Helvetica').fontSize(9).fillColor(colors.charcoal).text(lines.join('\n'), { lineGap: 3 });
}

function drawAddresses(doc, data) {
  sectionTitle(doc, 'Customer Details');
  const x = doc.page.margins.left;
  const y = doc.y;
  const boxWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 18) / 2;
  const billing = addressLines(data.customer.billingAddress).join('\n');
  const shipping = addressLines(data.customer.shippingAddress).join('\n');
  const billingHeight = doc.heightOfString(billing, { width: boxWidth - 20, lineGap: 3 });
  const shippingHeight = doc.heightOfString(shipping, { width: boxWidth - 20, lineGap: 3 });
  const height = Math.max(86, billingHeight, shippingHeight) + 38;

  ensurePage(doc, height + 10);
  doc.rect(x, y, boxWidth, height).strokeColor(colors.beige).stroke();
  doc.rect(x + boxWidth + 18, y, boxWidth, height).strokeColor(colors.beige).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.maroon).text('Bill To', x + 10, y + 10);
  doc.font('Helvetica').fontSize(9).fillColor(colors.charcoal).text(billing, x + 10, y + 30, { width: boxWidth - 20, lineGap: 3 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.maroon).text('Ship To', x + boxWidth + 28, y + 10);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(colors.charcoal)
    .text(shipping, x + boxWidth + 28, y + 30, { width: boxWidth - 20, lineGap: 3 });
  doc.y = y + height + 6;
}

function drawPayment(doc, data) {
  sectionTitle(doc, 'Payment Information');
  const status =
    data.refund.status === 'pending' || data.refund.status === 'initiating'
      ? 'Refund Processing'
      : data.order.paymentStatus === 'refunded'
        ? 'Refunded'
        : statusLabel(data.order.paymentStatus);
  doc.font('Helvetica').fontSize(9).fillColor(colors.charcoal);
  doc.text('Payment Method: Secure Online Payment via Razorpay');
  doc.text(`Payment Status: ${status}`);
  doc.text(`Order Status: ${statusLabel(data.order.orderStatus)}`);
}

function tableHeader(doc, y) {
  const x = doc.page.margins.left;
  const columns = [
    ['Item', 0, 150, 'left'],
    ['SKU', 156, 58, 'left'],
    ['Colour', 220, 58, 'left'],
    ['Size', 284, 36, 'left'],
    ['Qty', 326, 32, 'right'],
    ['Unit Price', 364, 66, 'right'],
    ['Total', 436, 69, 'right'],
  ];

  doc.rect(x, y, 505, 22).fill(colors.maroon);
  columns.forEach(([label, offset, width, align]) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF').text(label, x + offset + 4, y + 7, { width, align });
  });
  doc.y = y + 28;
}

function drawItems(doc, items) {
  sectionTitle(doc, 'Purchased Items');
  tableHeader(doc, doc.y);

  items.forEach((item) => {
    const x = doc.page.margins.left;
    const itemHeight = doc.heightOfString(item.productName || '-', { width: 150, lineGap: 2 });
    const rowHeight = Math.max(34, itemHeight + 16);

    ensurePage(doc, rowHeight + 24, () => tableHeader(doc, doc.page.margins.top));

    const y = doc.y;
    doc.rect(x, y - 4, 505, rowHeight).strokeColor(colors.beige).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(colors.charcoal);
    doc.text(item.productName || '-', x + 4, y + 5, { width: 150, lineGap: 2 });
    doc.text(item.sku || '-', x + 160, y + 5, { width: 58 });
    doc.text(item.colourName || '-', x + 224, y + 5, { width: 58 });
    doc.text(item.size || '-', x + 288, y + 5, { width: 36 });
    doc.text(String(item.quantity), x + 330, y + 5, { width: 32, align: 'right' });
    doc.text(formatINR(item.unitPrice), x + 368, y + 5, { width: 66, align: 'right' });
    doc.text(formatINR(item.lineTotal), x + 440, y + 5, { width: 65, align: 'right' });
    doc.y = y + rowHeight + 4;
  });
}

function drawTotals(doc, totals) {
  ensurePage(doc, 120);
  const x = 350;
  const y = doc.y + 8;
  const rows = [
    ['Item subtotal', formatINR(totals.subtotal)],
    ['Shipping charge', Number(totals.shippingCharge) === 0 ? formatINR(0) : formatINR(totals.shippingCharge)],
    ['Tax', formatINR(totals.tax)],
    ['Grand total', formatINR(totals.total)],
  ];

  rows.forEach(([label, value], index) => {
    const rowY = y + index * 20;
    if (index === rows.length - 1) line(doc, rowY - 5);
    doc.font(index === rows.length - 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(index === rows.length - 1 ? 11 : 9);
    doc.fillColor(index === rows.length - 1 ? colors.maroon : colors.charcoal).text(label, x, rowY, { width: 90 });
    doc.text(value, x + 96, rowY, { width: 110, align: 'right' });
  });

  doc.y = y + rows.length * 20 + 8;
}

function drawRefund(doc, refund) {
  if (!refund.applicable) return;

  sectionTitle(doc, 'Refund Information');
  doc.font('Helvetica').fontSize(9).fillColor(colors.charcoal);
  doc.text(`Status: ${statusLabel(refund.status)}`);
  doc.text(`Refunded amount: ${formatINR(refund.amount)}`);
  if (refund.initiatedAt) doc.text(`Initiated on: ${formatDate(refund.initiatedAt)}`);
  if (refund.processedAt) doc.text(`Processed on: ${formatDate(refund.processedAt)}`);
  if (refund.acquirerReference) doc.text(`Bank reference: ${refund.acquirerReference}`);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8).fillColor(colors.brown).text('Formal credit-note generation requires a separate tax and accounting implementation.');
}

function drawFooter(doc, data) {
  ensurePage(doc, 70);
  doc.moveDown(1);
  line(doc);
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.maroon).text('Customer Support');
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(colors.brown)
    .text([data.business.email ? `Email: ${data.business.email}` : '', data.business.phone ? `Phone: ${data.business.phone}` : ''].filter(Boolean).join('  |  ') || 'Our support team is here to help.');
  if (data.business.footerText) {
    doc.moveDown(0.8).font('Helvetica').fontSize(8).fillColor(colors.brown).text(data.business.footerText, { align: 'center' });
  }
}

export function createInvoiceFilename(invoiceNumber) {
  const safeNumber = text(invoiceNumber).replace(/[^A-Za-z0-9-]/g, '-');
  return `Amorah-Invoice-${safeNumber || 'Order'}.pdf`;
}

export async function generateInvoicePdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true, info: { Title: data.order.invoice.number } });
  const chunks = [];
  let totalBytes = 0;

  doc.on('data', (chunk) => {
    totalBytes += chunk.length;
    if (totalBytes > maxPdfBytes) {
      doc.destroy(new Error('Generated invoice PDF is too large.'));
      return;
    }
    chunks.push(chunk);
  });

  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  await drawHeader(doc, data);
  drawDocumentMeta(doc, data);
  drawBusinessDetails(doc, data.business);
  drawAddresses(doc, data);
  drawPayment(doc, data);
  drawItems(doc, data.items);
  drawTotals(doc, data.totals);
  drawRefund(doc, data.refund);
  drawFooter(doc, data);
  doc.end();

  return done;
}

export async function streamInvoicePdf(res, data) {
  const buffer = await generateInvoicePdf(data);
  const filename = createInvoiceFilename(data.order.invoice.number);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length,
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(buffer);
}

export { formatINR as formatInvoiceCurrency };

