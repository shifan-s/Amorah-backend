import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSkuBase,
  generateUniqueProductSku,
  sanitizeSkuPart,
} from '../src/utils/productSku.js';

test('sanitizes generated SKU parts to uppercase letters, numbers and hyphens', () => {
  assert.equal(sanitizeSkuPart(' Lavender / Rose '), 'LAVENDER-ROSE');
  assert.equal(buildSkuBase({ productName: 'Silk Salwar', colourName: 'Cotton Ivory' }), 'AMO-SILK-SALWAR-COTTON-IVORY');
  assert.equal(buildSkuBase({}), 'AMO-PRODUCT');
});

test('generates a SKU for a colour variant when the admin leaves it blank', async () => {
  const sku = await generateUniqueProductSku({
    productType: 'Salwar',
    colourName: 'Ivory',
    skuExists: async () => false,
    createSuffix: () => '4821',
  });

  assert.equal(sku, 'AMO-SALWAR-IVORY-4821');
  assert.match(sku, /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/);
});

test('regenerates the suffix when a SKU already exists in MongoDB', async () => {
  const suffixes = ['4821', '7394'];
  const checked = [];
  const sku = await generateUniqueProductSku({
    productName: 'Salwar',
    colourName: 'Lavender',
    skuExists: async (candidate) => {
      checked.push(candidate);
      return candidate.endsWith('4821');
    },
    createSuffix: () => suffixes.shift(),
  });

  assert.deepEqual(checked, ['AMO-SALWAR-LAVENDER-4821', 'AMO-SALWAR-LAVENDER-7394']);
  assert.equal(sku, 'AMO-SALWAR-LAVENDER-7394');
});

test('does not reuse a generated SKU reserved by another colour in the same submission', async () => {
  const reservedSkus = new Set(['AMO-PRODUCT-IVORY-582914']);
  const suffixes = ['582914', '582915'];
  const sku = await generateUniqueProductSku({
    colourName: 'Ivory',
    reservedSkus,
    skuExists: async () => false,
    createSuffix: () => suffixes.shift(),
  });

  assert.equal(sku, 'AMO-PRODUCT-IVORY-582915');
  assert.equal(reservedSkus.has(sku), true);
});
