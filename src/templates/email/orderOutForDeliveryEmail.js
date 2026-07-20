import { baseEmailTemplate } from './baseEmailTemplate.js';
import {
  addressHtml,
  customerName,
  paragraph,
  plainHeader,
  shipmentCta,
  shipmentRows,
  supportLine,
} from './orderTemplateUtils.js';

export default function orderOutForDeliveryEmail(order) {
  const subject = `Your Amorah order is out for delivery - ${order.orderNumber}`;
  const title = 'Your order is out for delivery';
  const html = baseEmailTemplate({
    title,
    preview: `Order ${order.orderNumber} is out for delivery.`,
    content: [
      paragraph(`Hello ${customerName(order)}, your order is out for delivery. The courier has not provided an exact delivery time.`),
      shipmentRows(order),
      paragraph('Delivery address'),
      addressHtml(order.shippingAddress),
    ].join(''),
    cta: shipmentCta(order),
  });
  const text = `${plainHeader(order, title)}
Hello ${customerName(order)}, your order is out for delivery.

Courier: ${order.shipment?.courierName || ''}
Tracking number: ${order.shipment?.trackingNumber || ''}

${supportLine()}`;

  return { subject, html, text };
}
