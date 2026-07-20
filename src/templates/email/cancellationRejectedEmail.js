import { baseEmailTemplate, detailTable } from './baseEmailTemplate.js';
import {
  customerName,
  orderViewUrl,
  paragraph,
  plainHeader,
  statusLabel,
  supportLine,
} from './orderTemplateUtils.js';

export default function cancellationRejectedEmail(order) {
  const response = order.cancellation?.customerResponse || order.cancellationDecisionReason || '';
  const subject = `Cancellation request update - ${order.orderNumber}`;
  const title = 'Cancellation request update';
  const html = baseEmailTemplate({
    title,
    preview: `Cancellation update for ${order.orderNumber}.`,
    content: [
      paragraph(`Hello ${customerName(order)}, your cancellation request has been reviewed.`),
      response ? paragraph(response) : '',
      detailTable([{ label: 'Current fulfilment status', value: statusLabel(order.orderStatus) }]),
    ].join(''),
    cta: { label: 'View Order', url: orderViewUrl(order) },
  });
  const text = `${plainHeader(order, title)}
${response || 'Your cancellation request has been reviewed.'}
Current status: ${statusLabel(order.orderStatus)}
${supportLine()}
View order: ${orderViewUrl(order)}`;

  return { subject, html, text };
}
