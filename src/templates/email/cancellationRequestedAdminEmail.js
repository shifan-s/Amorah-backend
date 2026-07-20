import env from '../../config/env.js';
import { baseEmailTemplate, detailTable } from './baseEmailTemplate.js';
import {
  adminOrderUrl,
  customerName,
  paragraph,
  plainHeader,
  statusLabel,
} from './orderTemplateUtils.js';

export default function cancellationRequestedAdminEmail(order) {
  const reason = order.cancellation?.requestReason || order.cancellationRequestReason || '';
  const subject = `Cancellation request requires review - ${order.orderNumber}`;
  const title = 'Cancellation request requires review';
  const html = baseEmailTemplate({
    title,
    preview: `Cancellation review needed for ${order.orderNumber}.`,
    content: [
      paragraph('A customer cancellation request needs admin review.'),
      detailTable([
        { label: 'Order number', value: order.orderNumber },
        { label: 'Customer', value: customerName(order) },
        { label: 'Customer email', value: order.customer?.email || '' },
        { label: 'Customer mobile', value: order.customer?.mobile || '' },
        { label: 'Fulfilment status', value: statusLabel(order.orderStatus) },
        { label: 'Payment status', value: statusLabel(order.paymentStatus) },
        { label: 'Reason', value: reason || 'No reason provided.' },
      ]),
    ].join(''),
    cta: { label: 'Review Order', url: adminOrderUrl(order) },
    footerNote: `Sent to ${env.adminOrderEmail || 'admin order email'}.`,
  });
  const text = `${plainHeader(order, title)}
Customer: ${customerName(order)}
Email: ${order.customer?.email || ''}
Mobile: ${order.customer?.mobile || ''}
Reason: ${reason || 'No reason provided.'}
Admin order: ${adminOrderUrl(order)}`;

  return { subject, html, text };
}
