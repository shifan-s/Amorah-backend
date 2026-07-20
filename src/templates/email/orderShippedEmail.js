import { baseEmailTemplate } from './baseEmailTemplate.js';
import {
  customerName,
  orderViewUrl,
  paragraph,
  plainHeader,
  productSummaryHtml,
  productSummaryText,
  shipmentCta,
  shipmentRows,
  supportLine,
} from './orderTemplateUtils.js';

export default function orderShippedEmail(order) {
  const subject = `Your Amorah order has been shipped - ${order.orderNumber}`;
  const title = 'Your order has been shipped';
  const html = baseEmailTemplate({
    title,
    preview: `Order ${order.orderNumber} is on its way.`,
    content: [
      paragraph(`Hello ${customerName(order)}, your Amorah order is now with the courier.`),
      shipmentRows(order),
      productSummaryHtml(order),
    ].join(''),
    cta: shipmentCta(order),
  });
  const text = `${plainHeader(order, title)}
Hello ${customerName(order)}, your order has been shipped.

Courier: ${order.shipment?.courierName || ''}
Tracking number: ${order.shipment?.trackingNumber || ''}
Tracking link: ${order.shipment?.trackingUrl || orderViewUrl(order)}

${productSummaryText(order)}

${supportLine()}`;

  return { subject, html, text };
}
