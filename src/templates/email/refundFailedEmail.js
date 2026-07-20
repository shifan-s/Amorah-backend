import { baseEmailTemplate, detailTable } from './baseEmailTemplate.js';
import {
  customerName,
  formatEmailCurrency,
  orderViewUrl,
  paragraph,
  plainHeader,
  supportLine,
} from './orderTemplateUtils.js';

export default function refundFailedEmail(order) {
  const subject = `Refund update - ${order.orderNumber}`;
  const title = 'Refund needs assistance';
  const amount = order.refundSummary?.amount || order.total;
  const html = baseEmailTemplate({
    title,
    preview: `Refund update for ${order.orderNumber}.`,
    content: [
      paragraph(`Hello ${customerName(order)}, we could not complete your refund automatically.`),
      paragraph('Amorah support will assist you. Please share your order number if you contact us.'),
      detailTable([
        { label: 'Order number', value: order.orderNumber },
        { label: 'Refund amount', value: formatEmailCurrency(amount) },
      ]),
    ].join(''),
    cta: { label: 'View Order', url: orderViewUrl(order) },
  });
  const text = `${plainHeader(order, title)}
We could not complete your refund automatically. Amorah support will assist you.
Refund amount: ${formatEmailCurrency(amount)}
${supportLine()}
View order: ${orderViewUrl(order)}`;

  return { subject, html, text };
}
