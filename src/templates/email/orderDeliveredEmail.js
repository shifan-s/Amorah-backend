import { baseEmailTemplate, detailTable } from './baseEmailTemplate.js';
import {
  customerName,
  formatEmailDate,
  orderViewUrl,
  paragraph,
  plainHeader,
  productSummaryHtml,
  productSummaryText,
  supportLine,
} from './orderTemplateUtils.js';

export default function orderDeliveredEmail(order) {
  const subject = `Your Amorah order has been delivered - ${order.orderNumber}`;
  const title = 'Your order has been delivered';
  const deliveredAt = order.shipment?.deliveredAt || new Date();
  const html = baseEmailTemplate({
    title,
    preview: `Order ${order.orderNumber} has been delivered.`,
    content: [
      paragraph(`Hello ${customerName(order)}, your Amorah order has been marked delivered.`),
      detailTable([{ label: 'Delivered on', value: formatEmailDate(deliveredAt) }]),
      productSummaryHtml(order),
      paragraph('If there is any delivery problem, please contact us and share your order number.'),
    ].join(''),
    cta: { label: 'View Order', url: orderViewUrl(order) },
  });
  const text = `${plainHeader(order, title)}
Delivered on: ${formatEmailDate(deliveredAt)}

${productSummaryText(order)}

${supportLine()}`;

  return { subject, html, text };
}
