import { baseEmailTemplate, detailTable } from './baseEmailTemplate.js';
import {
  customerName,
  orderViewUrl,
  paragraph,
  plainHeader,
  statusLabel,
  supportLine,
} from './orderTemplateUtils.js';

export default function cancellationApprovedEmail(order) {
  const response = order.cancellation?.customerResponse || order.cancellationDecisionReason || '';
  const subject = `Cancellation approved - ${order.orderNumber}`;
  const title = 'Cancellation approved';
  const paymentReceived = order.paymentStatus === 'paid';
  const html = baseEmailTemplate({
    title,
    preview: `Cancellation approved for ${order.orderNumber}.`,
    content: [
      paragraph(`Hello ${customerName(order)}, your cancellation request has been approved.`),
      response ? paragraph(response) : '',
      paymentReceived ? paragraph('Refund processing is required and will be updated separately.') : '',
      detailTable([
        { label: 'Order status', value: statusLabel(order.orderStatus) },
        { label: 'Payment status', value: statusLabel(order.paymentStatus) },
      ]),
    ].join(''),
    cta: { label: 'View Order', url: orderViewUrl(order) },
  });
  const text = `${plainHeader(order, title)}
${response || 'Your cancellation request has been approved.'}
${paymentReceived ? 'Refund processing is required and will be updated separately.' : ''}
${supportLine()}`;

  return { subject, html, text };
}
