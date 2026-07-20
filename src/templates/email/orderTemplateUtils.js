import env from '../../config/env.js';
import {
  buildFrontendUrl,
  escapeHtml,
  formatEmailCurrency,
  formatEmailDate,
  isValidHttpUrl,
} from '../../utils/emailHtml.js';
import { detailTable, paragraph, productList } from './baseEmailTemplate.js';

export function customerName(order) {
  return order.customer?.fullName || order.shippingAddress?.fullName || 'Amorah customer';
}

export function orderViewUrl(order) {
  return buildFrontendUrl(`/account/orders/${order.orderNumber}`);
}

export function adminOrderUrl(order) {
  return buildFrontendUrl(`/admin/orders/${order.orderNumber}`);
}

export function orderItems(order) {
  return {
    ...order,
    items: (order.items || []).map((item) => ({
      ...item,
      lineTotalFormatted: formatEmailCurrency(item.lineTotal),
    })),
  };
}

export function totalsTable(order) {
  return detailTable([
    { label: 'Subtotal', value: formatEmailCurrency(order.subtotal) },
    { label: 'Shipping', value: Number(order.shippingCharge) === 0 ? 'Free' : formatEmailCurrency(order.shippingCharge) },
    { label: 'Tax', value: formatEmailCurrency(order.tax) },
    { label: 'Total', value: formatEmailCurrency(order.total) },
  ]);
}

export function addressText(address = {}) {
  return [
    address.fullName,
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    `${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`.trim(),
    address.country,
    address.mobile ? `+91 ${address.mobile}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function addressHtml(address = {}) {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#302925;">${escapeHtml(addressText(address)).replace(/\n/g, '<br />')}</p>`;
}

export function shipmentRows(order) {
  const shipment = order.shipment || {};
  return detailTable([
    { label: 'Courier', value: shipment.courierName || 'Courier details will be updated soon' },
    { label: 'Tracking number', value: shipment.trackingNumber || '' },
    { label: 'Estimated delivery', value: shipment.estimatedDeliveryDate ? formatEmailDate(shipment.estimatedDeliveryDate) : '' },
  ]);
}

export function shipmentCta(order) {
  const trackingUrl = order.shipment?.trackingUrl || '';

  if (!isValidHttpUrl(trackingUrl)) {
    return { label: 'View Order', url: orderViewUrl(order) };
  }

  return { label: 'Track Shipment', url: trackingUrl };
}

export function productSummaryHtml(order) {
  return productList(orderItems(order));
}

export function productSummaryText(order) {
  return (order.items || [])
    .map(
      (item) =>
        `${item.productName} - ${item.colourName}, Size ${item.size}, Qty ${item.quantity}, ${formatEmailCurrency(item.lineTotal)}`,
    )
    .join('\n');
}

export function supportLine() {
  return env.supportEmail ? `For help, contact ${env.supportEmail}.` : 'Our support team is here to help.';
}

export function statusLabel(value = '') {
  return String(value)
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function safeReason(value = '') {
  return escapeHtml(value || 'No reason provided.');
}

export function plainHeader(order, title) {
  return `${title}\nOrder ${order.orderNumber}\n`;
}

export { formatEmailCurrency, formatEmailDate, paragraph };
