import assert from 'node:assert/strict';
import test from 'node:test';
import { approvedSlugs, requiredCatalogue } from '../scripts/setupClientCatalogue.js';
import { calculateCheckoutSummary } from '../src/services/checkoutService.js';

test('client catalogue contains exactly the approved two-level categories', () => {
  assert.deepEqual(
    requiredCatalogue.map((category) => ({
      name: category.name,
      slug: category.slug,
      subcategories: category.subcategories.map((subcategory) => subcategory.name),
    })),
    [
      {
        name: 'Ethnic Wear',
        slug: 'ethnic-wear',
        subcategories: ['Churidar Sets', 'Partywear', 'Gowns'],
      },
      {
        name: 'Western Wear',
        slug: 'western-wear',
        subcategories: ['Western Co-ord Sets', 'Knee-Length Tops', 'Short Tops', 'Shirts for Girls', 'Jeans'],
      },
      {
        name: 'Hijabs',
        slug: 'hijabs',
        subcategories: ['Jersey Hijabs', 'Shimmer Hijabs', 'Georgette Chiffon Hijabs'],
      },
    ],
  );

  assert.equal(requiredCatalogue.every((category) => category.subcategories.every((subcategory) => !subcategory.subcategories)), true);
});

test('approved catalogue slugs include only client-approved main and subcategories', () => {
  assert.deepEqual([...approvedSlugs()].sort(), [
    'churidar-sets',
    'ethnic-wear',
    'georgette-chiffon-hijabs',
    'gowns',
    'hijabs',
    'jeans',
    'jersey-hijabs',
    'knee-length-tops',
    'partywear',
    'shimmer-hijabs',
    'shirts-for-girls',
    'short-tops',
    'western-co-ord-sets',
    'western-wear',
  ]);
});

test('checkout summary multiplies unit price by selected quantity totals', () => {
  const unitPrice = 1499;
  const quantity = 3;
  const summary = calculateCheckoutSummary([{ quantity, unitPrice, lineTotal: unitPrice * quantity }]);

  assert.equal(summary.itemCount, 3);
  assert.equal(summary.subtotal, 4497);
  assert.equal(summary.total, 4497);
});
