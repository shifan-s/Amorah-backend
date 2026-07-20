import assert from 'node:assert/strict';
import test from 'node:test';
import { getUploadFolder } from '../src/services/uploadService.js';
import {
  buildSafePublicId,
  validateAmorahPublicId,
} from '../src/utils/cloudinaryUpload.js';

test('selects the product upload folder', () => {
  assert.equal(getUploadFolder('product'), 'amorah/products');
});

test('selects the category upload folder', () => {
  assert.equal(getUploadFolder('category'), 'amorah/categories');
});

test('selects the banner upload folder', () => {
  assert.equal(getUploadFolder('banner'), 'amorah/banners');
});

test('rejects arbitrary upload types instead of raw folders', () => {
  assert.throws(() => getUploadFolder('amorah/private'), /Upload type must be product, category or banner/);
});

test('allows only Amorah public IDs for deletion', () => {
  assert.equal(validateAmorahPublicId('amorah/products/example'), 'amorah/products/example');
  assert.equal(validateAmorahPublicId('amorah/categories/example'), 'amorah/categories/example');
  assert.equal(validateAmorahPublicId('amorah/banners/example'), 'amorah/banners/example');
  assert.throws(() => validateAmorahPublicId('other-folder/example'), /Only Amorah Cloudinary images may be deleted/);
  assert.throws(() => validateAmorahPublicId('amorah/products/../example'), /Cloudinary public ID is invalid/);
});

test('builds safe public ID hints without exposing local paths', () => {
  const publicId = buildSafePublicId('C:\\Users\\HP\\Pictures\\Printed Kurta.JPG');

  assert.match(publicId, /^printed-kurta-\d+-[a-f0-9-]+$/);
  assert.doesNotMatch(publicId, /users|pictures|\\/i);
});
