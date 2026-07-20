import { baseEmailTemplate, detailTable } from './baseEmailTemplate.js';
import {
  customerName,
  formatEmailCurrency,
  formatEmailDate,
  orderViewUrl,
  paragraph,
  plainHeader,
  supportLine,
} from './orderTemplateUtils.js';

export default function refundProcessedEmail(order) {
  const subject = `Refund processed - ${order.orderNumber}`;
  const title = 'Your refund has been processed';
  const amount = order.refundSummary?.amount || order.total;
  const reference = order.refundSummary?.acquirerReference || '';
  const html = baseEmailTemplate({
    title,
    preview: `Refund processed for ${order.orderNumber}.`,
    content: [
      paragraph(`Hello ${customerName(order)}, your Amorah refund has been processed successfully.`),
      detailTable([
        { label: 'Order number', value: order.orderNumber },
        { label: 'Refund amount', value: formatEmailCurrency(amount) },
        { label: 'Processed on', value: formatEmailDate(order.refundSummary?.processedAt || new Date()) },
        { label: 'Bank reference', value: reference },
      ]),
    ].join(''),
    cta: { label: 'View Order', url: orderViewUrl(order) },
  });
  const text = `${plainHeader(order, title)}
Refund amount: ${formatEmailCurrency(amount)}
Processed on: ${formatEmailDate(order.refundSummary?.processedAt || new Date())}
${reference ? `Bank reference: ${reference}` : ''}
${supportLine()}
View order: ${orderViewUrl(order)}`;

  return { subject, html, text };
}
