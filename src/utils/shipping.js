import env from '../config/env.js';

export const additionalPieceShippingCharge = 30;

export function getProductShippingChargeAmount(product) {
  const amount = product?.shippingChargeAmount;

  if (amount !== null && amount !== undefined && Number.isFinite(Number(amount))) {
    return Math.max(0, Number(amount));
  }

  return product?.shippingChargeApplies === false ? 0 : env.checkoutShippingCharge;
}

export function calculateShippingCharge(items, subtotal, freeShippingThreshold) {
  const shippableItems = items.filter((item) => item.available !== false);
  const itemCount = shippableItems.reduce((total, item) => total + (Number(item.quantity) || 0), 0);

  if (itemCount === 0 || subtotal <= 0 || subtotal >= freeShippingThreshold) {
    return 0;
  }

  const firstPieceCharge = Math.max(0, ...shippableItems.map(getProductShippingChargeAmount));
  return firstPieceCharge + additionalPieceShippingCharge * (itemCount - 1);
}