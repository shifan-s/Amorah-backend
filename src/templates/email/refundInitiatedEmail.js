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

export default function refundInitiatedEmail(order) {
  const subject = `Refund initiated - ${order.orderNumber}`;
  const title = 'Your refund has been initiated';
  const amount = order.refundSummary?.amount || order.total;
  const html = baseEmailTemplate({
    title,
    preview: `Refund initiated for ${order.orderNumber}.`,
    content: [
      paragraph(`Hello ${customerName(order)}, your full-order refund has been initiated.`),
      paragraph('Processing time depends on the bank or payment network. We will update your order when Razorpay confirms completion.'),
      detailTable([
        { label: 'Order number', value: order.orderNumber },
        { label: 'Refund amount', value: formatEmailCurrency(amount) },
        { label: 'Initiated on', value: formatEmailDate(order.refundSummary?.initiatedAt || new Date()) },
      ]),
    ].join(''),
    cta: { label: 'View Order', url: orderViewUrl(order) },
  });
  const text = `${plainHeader(order, title)}
Refund amount: ${formatEmailCurrency(amount)}
Initiated on: ${formatEmailDate(order.refundSummary?.initiatedAt || new Date())}
Processing time depends on the bank or payment network.
${supportLine()}
View order: ${orderViewUrl(order)}`;

  return { subject, html, text };
}
