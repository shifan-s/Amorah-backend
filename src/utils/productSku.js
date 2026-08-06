import crypto from 'node:crypto';

export function sanitizeSkuPart(value, fallback = '') {
  return String(value || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildSkuBase({ productName, productType, skuPrefix, colourName } = {}) {
  const productPart = sanitizeSkuPart(skuPrefix || productType || productName, 'PRODUCT')
    .replace(/^AMO-/, '')
    .slice(0, 40);
  const colourPart = sanitizeSkuPart(colourName).slice(0, 20);

  return ['AMO', productPart || 'PRODUCT', colourPart]
    .filter(Boolean)
    .join('-')
    .slice(0, 70)
    .replace(/-+$/, '');
}

export async function generateUniqueProductSku({
  productName,
  productType,
  skuPrefix,
  colourName,
  reservedSkus = new Set(),
  skuExists,
  createSuffix = () => String(crypto.randomInt(100000, 1000000)),
}) {
  const base = buildSkuBase({ productName, productType, skuPrefix, colourName });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = sanitizeSkuPart(createSuffix());
    const candidate = `${base}-${suffix}`.slice(0, 80).replace(/-+$/, '');

    if (!reservedSkus.has(candidate) && !(await skuExists(candidate))) {
      reservedSkus.add(candidate);
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique SKU');
}
