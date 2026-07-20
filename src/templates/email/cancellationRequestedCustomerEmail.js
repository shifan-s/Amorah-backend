import { baseEmailTemplate, detailTable } from './baseEmailTemplate.js';
import {
  customerName,
  orderViewUrl,
  paragraph,
  plainHeader,
  safeReason,
  statusLabel,
  supportLine,
} from './orderTemplateUtils.js';

export default function cancellationRequestedCustomerEmail(order) {
  const reason = order.cancellation?.requestReason || order.cancellationRequestReason || '';
  const subject = `Cancellation request received - ${order.orderNumber}`;
  const title = 'Cancellation request received';
  const html = baseEmailTemplate({
    title,
    preview: `Cancellation request received for ${order.orderNumber}.`,
    content: [
      paragraph(`Hello ${customerName(order)}, we have received your cancellation request.`),
      paragraph('Your order is not cancelled yet. The request is waiting for review.'),
      detailTable([
        { label: 'Order number', value: order.orderNumber },
        { label: 'Current status', value: statusLabel(order.orderStatus) },
      ]),
      paragraph(`Reason: ${reason || 'No reason provided.'}`),
    ].join(''),
    cta: { label: 'View Order', url: orderViewUrl(order) },
  });
  const text = `${plainHeader(order, title)}
Your order is not cancelled yet. The request is waiting for review.
Reason: ${reason || 'No reason provided.'}
${supportLine()}`;

  return { subject, html: html.replace(safeReason(reason), safeReason(reason)), text };
}
