import { baseEmailTemplate, detailTable } from './baseEmailTemplate.js';
import { canGenerateInvoice } from '../../utils/invoiceEligibility.js';
import {
  addressHtml,
  addressText,
  customerName,
  formatEmailDate,
  orderViewUrl,
  paragraph,
  plainHeader,
  productSummaryHtml,
  productSummaryText,
  supportLine,
  totalsTable,
} from './orderTemplateUtils.js';

export default function orderConfirmationEmail(order) {
  const subject = `Order confirmed - ${order.orderNumber}`;
  const title = 'Your Amorah order is confirmed';
  const invoiceAvailable = canGenerateInvoice(order);
  const html = baseEmailTemplate({
    title,
    preview: `Order ${order.orderNumber} has been confirmed.`,
    content: [
      paragraph(`Hello ${customerName(order)}, your payment has been verified and your order is confirmed.`),
      detailTable([
        { label: 'Order number', value: order.orderNumber },
        { label: 'Order date', value: formatEmailDate(order.createdAt) },
        { label: 'Payment method', value: 'Secure Online Payment' },
      ]),
      productSummaryHtml(order),
      totalsTable(order),
      paragraph('Shipping address'),
      addressHtml(order.shippingAddress),
      invoiceAvailable ? paragraph('Your invoice can be downloaded securely from your order details page.') : '',
    ].join(''),
    cta: { label: invoiceAvailable ? 'Download Invoice' : 'View Order', url: orderViewUrl(order) },
  });
  const text = `${plainHeader(order, title)}
Hello ${customerName(order)}, your payment has been verified and your order is confirmed.

${productSummaryText(order)}

Subtotal: ${order.subtotal}
Shipping: ${order.shippingCharge}
Tax: ${order.tax}
Total: ${order.total}

Shipping address:
${addressText(order.shippingAddress)}

${supportLine()}
${invoiceAvailable ? 'Download invoice' : 'View order'}: ${orderViewUrl(order)}`;

  return { subject, html, text };
}
