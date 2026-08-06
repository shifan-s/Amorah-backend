import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import { generateUniqueProductSku } from '../utils/productSku.js';
import { deleteImage } from './uploadService.js';

const safeProductFields = [
  'name',
  'slug',
  'skuPrefix',
  'mainCategory',
  'subcategory',
  'productType',
  'style',
  'fabric',
  'occasion',
  'tags',
  'shortDescription',
  'description',
  'regularPrice',
  'salePrice',
  'variants',
  'fabricDetails',
  'fit',
  'careInstructions',
  'status',
  'featured',
  'newArrival',
  'bestSeller',
  'metaTitle',
  'metaDescription',
];

function normalizeText(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text || undefined;
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTag(value) {
  return normalizeText(value).toLowerCase();
}

function parseList(value) {
  return (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(0, 20);
}

function normalizeSku(value) {
  return normalizeText(value).toUpperCase();
}

function ensureProductId(productId) {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID', []);
  }
}

function idString(value) {
  if (!value) {
    return '';
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
}

function normalizeImage(image, index) {
  const legacyPose = ['front', 'side', 'back'][index];
  return {
    ...(image._id || image.id ? { _id: image._id || image.id } : {}),
    url: normalizeText(image.url),
    pose: normalizeText(image.pose || legacyPose).toLowerCase(),
    publicId: normalizeText(image.publicId),
    alt: normalizeText(image.alt),
    sortOrder: Number.isInteger(image.sortOrder) ? image.sortOrder : index,
    isPrimary: Boolean(image.isPrimary),
  };
}

function normalizeImages(images = []) {
  const nextImages = images.map(normalizeImage).sort((a, b) => a.sortOrder - b.sortOrder);

  if (nextImages.length && !nextImages.some((image) => image.isPrimary)) {
    nextImages[0].isPrimary = true;
  }

  let primaryFound = false;
  nextImages.forEach((image) => {
    if (image.isPrimary && !primaryFound) {
      primaryFound = true;
      return;
    }

    image.isPrimary = false;
  });

  return nextImages;
}

function normalizeSize(size) {
  return {
    ...(size._id || size.id ? { _id: size._id || size.id } : {}),
    name: normalizeText(size.name),
    stock: Number.isInteger(size.stock) ? size.stock : Number(size.stock || 0),
    active: size.active === undefined ? true : Boolean(size.active),
  };
}

function normalizeVariant(variant) {
  return {
    ...(variant._id || variant.id ? { _id: variant._id || variant.id } : {}),
    sku: normalizeSku(variant.sku),
    colourName: normalizeText(variant.colourName),
    colourHex: normalizeOptionalText(variant.colourHex),
    price: Number(variant.price),
    compareAtPrice: variant.compareAtPrice === '' || variant.compareAtPrice === null || variant.compareAtPrice === undefined ? null : Number(variant.compareAtPrice),
    images: normalizeImages(variant.images || []),
    sizes: (variant.sizes || []).map(normalizeSize),
    active: variant.active === undefined ? true : Boolean(variant.active),
  };
}

function validateVariants(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new ApiError(400, 'At least one colour variant is required', []);
  }

  const skus = new Set();
  const colours = new Set();

  variants.forEach((variant, variantIndex) => {
    if (variant.sku && skus.has(variant.sku)) {
      throw new ApiError(400, 'Variant SKU values must be unique', []);
    }

    if (variant.sku) {
      skus.add(variant.sku);
    }

    const colourKey = variant.colourName.toLowerCase();

    if (colours.has(colourKey)) {
      throw new ApiError(400, 'Colour variants must not duplicate', []);
    }

    colours.add(colourKey);

    if (!variant.colourName) {
      throw new ApiError(400, `Variant ${variantIndex + 1} requires a colour name`, []);
    }

    if (!Number.isFinite(variant.price) || variant.price < 0) {
      throw new ApiError(400, 'Variant price cannot be negative', []);
    }
    if (variant.compareAtPrice !== null && (!Number.isFinite(variant.compareAtPrice) || variant.compareAtPrice <= variant.price)) {
      throw new ApiError(400, 'Compare-at price must be greater than the variant price', []);
    }

    const poses = variant.images.map((image) => image.pose);
    if (variant.images.length !== 3 || !['front', 'side', 'back'].every((pose) => poses.includes(pose)) || new Set(poses).size !== 3) {
      throw new ApiError(400, 'Each color variant requires exactly one front, side and back image', []);
    }

    const sizeNames = new Set();

    if (variant.active && !variant.sizes.length) {
      throw new ApiError(400, 'Each active colour variant must contain at least one size', []);
    }

    variant.sizes.forEach((size) => {
      const sizeKey = size.name.toLowerCase();

      if (sizeNames.has(sizeKey)) {
        throw new ApiError(400, 'Size names must not duplicate inside a colour variant', []);
      }

      sizeNames.add(sizeKey);

      if (size.stock < 0) {
        throw new ApiError(400, 'Stock cannot be negative', []);
      }
    });
  });
}

async function assignMissingVariantSkus(variants, product, productId) {
  const reservedSkus = new Set(variants.map((variant) => variant.sku).filter(Boolean));

  for (const variant of variants) {
    if (variant.sku) {
      continue;
    }

    variant.sku = await generateUniqueProductSku({
      productName: product.name,
      productType: product.productType,
      skuPrefix: product.skuPrefix,
      colourName: variant.colourName,
      reservedSkus,
      skuExists: async (candidate) => {
        const query = { 'variants.sku': candidate };
        if (productId) {
          query._id = { $ne: productId };
        }
        return Boolean(await Product.exists(query));
      },
    });
  }
}

async function ensureSkuAvailable(variants, productId) {
  const skus = variants.map((variant) => variant.sku);
  const query = { 'variants.sku': { $in: skus } };

  if (productId) {
    query._id = { $ne: productId };
  }

  const existing = await Product.findOne(query).select('_id');

  if (existing) {
    throw new ApiError(409, 'Variant SKU already exists', []);
  }
}

async function ensureSlugAvailable(slug, productId) {
  const query = { slug };

  if (productId) {
    query._id = { $ne: productId };
  }

  const existing = await Product.findOne(query).select('_id');

  if (existing) {
    throw new ApiError(409, 'Product slug already exists', []);
  }
}

export async function validateProductCategories(mainCategoryId, subcategoryId) {
  if (!mainCategoryId) {
    throw new ApiError(400, 'Main category is required', []);
  }

  const mainCategory = await Category.findById(idString(mainCategoryId));

  if (!mainCategory || mainCategory.level !== 0 || !mainCategory.isActive) {
    throw new ApiError(400, 'Main category must be an active main category', []);
  }

  if (!subcategoryId) {
    return { mainCategory, subcategory: null };
  }

  const subcategory = await Category.findById(idString(subcategoryId));

  if (!subcategory || subcategory.level !== 1 || !subcategory.isActive) {
    throw new ApiError(400, 'Subcategory must be an active subcategory', []);
  }

  if (idString(subcategory.parent) !== mainCategory._id.toString()) {
    throw new ApiError(400, 'Selected subcategory does not belong to the selected main category', []);
  }

  return { mainCategory, subcategory };
}

function validatePricing(regularPrice, salePrice) {
  if (regularPrice === undefined || regularPrice === null || Number.isNaN(Number(regularPrice)) || Number(regularPrice) < 0) {
    throw new ApiError(400, 'Regular price cannot be negative', []);
  }

  if (salePrice !== null && salePrice !== undefined) {
    if (Number.isNaN(Number(salePrice)) || Number(salePrice) < 0) {
      throw new ApiError(400, 'Sale price cannot be negative', []);
    }

    if (Number(salePrice) >= Number(regularPrice)) {
      throw new ApiError(400, 'Sale price must be less than regular price', []);
    }
  }
}

function validateActiveProduct(product) {
  const errors = [];

  if (!product.name || !product.shortDescription || !product.description) {
    errors.push('Product name and descriptions are required');
  }

  try {
    validatePricing(product.regularPrice, product.salePrice);
  } catch (error) {
    errors.push(error.message);
  }

  const activeVariants = product.variants.filter((variant) => variant.active);

  if (!activeVariants.length) {
    errors.push('At least one active colour variant is required');
  }

  activeVariants.forEach((variant) => {
    const poses = variant.images.map((image) => image.pose);
    if (variant.images.length !== 3 || !['front', 'side', 'back'].every((pose) => poses.includes(pose))) {
      errors.push(`${variant.colourName} requires front, side and back images`);
    }

    if (!variant.sizes.some((size) => size.active)) {
      errors.push(`${variant.colourName} requires at least one active size`);
    }
  });

  if (errors.length) {
    throw new ApiError(400, 'Product cannot be activated until required content is complete', errors);
  }
}

function buildProductPayload(payload) {
  const slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);

  return {
    name: normalizeText(payload.name),
    slug,
    skuPrefix: normalizeOptionalText(payload.skuPrefix)?.toUpperCase(),
    mainCategory: payload.mainCategory,
    subcategory: payload.subcategory || null,
    productType: normalizeText(payload.productType),
    style: normalizeText(payload.style),
    fabric: normalizeText(payload.fabric),
    occasion: normalizeText(payload.occasion),
    tags: normalizeTags(payload.tags),
    shortDescription: normalizeText(payload.shortDescription),
    description: normalizeText(payload.description),
    regularPrice: Number(payload.regularPrice),
    salePrice: payload.salePrice === undefined || payload.salePrice === null || payload.salePrice === '' ? null : Number(payload.salePrice),
    variants: (payload.variants || []).map(normalizeVariant),
    fabricDetails: normalizeText(payload.fabricDetails),
    fit: normalizeText(payload.fit),
    careInstructions: normalizeText(payload.careInstructions),
    status: payload.status || 'draft',
    featured: Boolean(payload.featured),
    newArrival: Boolean(payload.newArrival),
    bestSeller: Boolean(payload.bestSeller),
    metaTitle: normalizeText(payload.metaTitle),
    metaDescription: normalizeText(payload.metaDescription),
  };
}

function applyProductUpdates(product, payload) {
  safeProductFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      return;
    }

    if (field === 'slug') {
      product.slug = payload.slug ? slugify(payload.slug) : slugify(product.name);
      return;
    }

    if (field === 'skuPrefix') {
      product.skuPrefix = normalizeOptionalText(payload.skuPrefix)?.toUpperCase();
      return;
    }

    if (['productType', 'style', 'fabric', 'occasion', 'fabricDetails', 'fit', 'careInstructions', 'metaTitle', 'metaDescription'].includes(field)) {
      product[field] = normalizeText(payload[field]);
      return;
    }

    if (field === 'tags') {
      product.tags = normalizeTags(payload.tags);
      return;
    }

    if (field === 'salePrice') {
      product.salePrice = payload.salePrice === null || payload.salePrice === '' || payload.salePrice === undefined ? null : Number(payload.salePrice);
      return;
    }

    if (field === 'regularPrice') {
      product.regularPrice = Number(payload.regularPrice);
      return;
    }

    if (field === 'variants') {
      product.variants = payload.variants.map(normalizeVariant);
      return;
    }

    if (field === 'subcategory') {
      product.subcategory = payload.subcategory || null;
      return;
    }

    if (['featured', 'newArrival', 'bestSeller'].includes(field)) {
      product[field] = Boolean(payload[field]);
      return;
    }

    product[field] = payload[field];
  });

  if (Object.prototype.hasOwnProperty.call(payload, 'name') && !Object.prototype.hasOwnProperty.call(payload, 'slug')) {
    product.slug = slugify(product.name);
  }
}

async function findAdminProduct(productId) {
  ensureProductId(productId);

  const product = await Product.findById(productId).populate('mainCategory', 'name slug level isActive').populate('subcategory', 'name slug level parent isActive');

  if (!product) {
    throw new ApiError(404, 'Product not found', []);
  }

  return product;
}

function buildSort(sort = 'recommended') {
  const sortMap = {
    recommended: { featured: -1, bestSeller: -1, newArrival: -1, createdAt: -1 },
    newest: { createdAt: -1 },
    'best-selling': { salesCount: -1, createdAt: -1 },
    'price-low-high': { regularPrice: 1 },
    'price-high-low': { regularPrice: -1 },
    'highest-discount': { salePrice: 1, regularPrice: -1 },
  };

  return sortMap[sort] || sortMap.recommended;
}

async function addCategoryFilters(query, filters) {
  if (query.mainCategory) {
    filters.mainCategory = query.mainCategory;
  }

  if (query.subcategory) {
    filters.subcategory = query.subcategory;
  }

  if (query.mainCategorySlug) {
    const category = await Category.findOne({ slug: query.mainCategorySlug, level: 0, isActive: true }).select('_id');
    filters.mainCategory = category?._id || new mongoose.Types.ObjectId();
  }

  if (query.subcategorySlug) {
    const category = await Category.findOne({ slug: query.subcategorySlug, level: 1, isActive: true }).select('_id');
    filters.subcategory = category?._id || new mongoose.Types.ObjectId();
  }
}

async function buildProductFilters(query = {}, publicOnly = true) {
  const filters = publicOnly ? { status: 'active' } : {};

  if (query.search) {
    filters.$text = { $search: query.search };
  }

  await addCategoryFilters(query, filters);

  ['productType', 'style', 'fabric', 'occasion'].forEach((field) => {
    if (query[field]) {
      filters[field] = query[field];
    }
  });

  ['featured', 'newArrival', 'bestSeller'].forEach((field) => {
    if (query[field] !== undefined) {
      filters[field] = query[field];
    }
  });

  if (!publicOnly && query.status) {
    filters.status = query.status;
  }

  if (query.tags) {
    const tags = parseList(query.tags);
    filters.tags = { $all: tags.map(normalizeTag) };
  }

  if (query.size) {
    const sizes = parseList(query.size);
    filters.variants = {
      $elemMatch: {
        active: true,
        sizes: { $elemMatch: { name: { $in: sizes }, active: true } },
      },
    };
  }

  if (query.colour) {
    const colours = parseList(query.colour);
    filters['variants.colourName'] = { $in: colours.map((colour) => new RegExp(`^${escapeRegex(colour)}$`, 'i')) };
  }

  if (query.inStock === true || query.stockStatus === 'in-stock') {
    filters.variants = {
      ...(filters.variants || {}),
      $elemMatch: {
        ...(filters.variants?.$elemMatch || {}),
        active: true,
        sizes: { $elemMatch: { active: true, stock: { $gt: 0 } } },
      },
    };
  }

  if (query.stockStatus === 'out-of-stock') {
    filters['variants.sizes.stock'] = { $lte: 0 };
  }

  if (query.sale === true) {
    filters.salePrice = { $ne: null };
  }

  const priceFilter = {};
  if (query.minPrice !== undefined) {
    priceFilter.$gte = query.minPrice;
  }
  if (query.maxPrice !== undefined) {
    priceFilter.$lte = query.maxPrice;
  }
  if (Object.keys(priceFilter).length) {
    filters.regularPrice = priceFilter;
  }

  return filters;
}

function paginate(items, page = 1, limit = 12) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return {
    items: items.slice(start, start + limit),
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

async function getProducts(query, publicOnly) {
  const page = query.page || 1;
  const limit = query.limit || 12;
  const filters = await buildProductFilters(query, publicOnly);
  const products = await Product.find(filters)
    .populate('mainCategory', 'name slug level isActive')
    .populate('subcategory', 'name slug level parent isActive')
    .sort(buildSort(query.sort));
  const transformed = products.map((product) => (publicOnly ? product.toPublicObject() : product.toAdminObject()));
  const paginated = paginate(transformed, page, limit);

  return {
    products: paginated.items,
    meta: paginated.meta,
  };
}

export async function getPublicProducts(query) {
  return getProducts(query, true);
}

export async function getAdminProducts(query) {
  return getProducts({ ...query, limit: query.limit || 20 }, false);
}

export async function getPublicProductBySlug(slug) {
  const product = await Product.findOne({ slug, status: 'active' })
    .populate('mainCategory', 'name slug level isActive')
    .populate('subcategory', 'name slug level parent isActive');

  if (!product) {
    throw new ApiError(404, 'Product not found', []);
  }

  await Product.updateOne({ _id: product._id }, { $inc: { viewCount: 1 } });

  return product.toPublicObject();
}

export async function getFeaturedProducts(query = {}) {
  return getPublicProducts({ ...query, featured: true, limit: query.limit || 8 });
}

export async function getNewArrivalProducts(query = {}) {
  return getPublicProducts({ ...query, newArrival: true, limit: query.limit || 8, sort: query.sort || 'newest' });
}

export async function getBestSellerProducts(query = {}) {
  return getPublicProducts({ ...query, bestSeller: true, limit: query.limit || 8, sort: query.sort || 'best-selling' });
}

export async function getRelatedProducts(slug, query = {}) {
  const product = await Product.findOne({ slug, status: 'active' }).select('mainCategory subcategory style fabric tags');

  if (!product) {
    throw new ApiError(404, 'Product not found', []);
  }

  const limit = query.limit || 8;
  const filters = {
    _id: { $ne: product._id },
    status: 'active',
    $or: [
      ...(product.subcategory ? [{ subcategory: product.subcategory }] : []),
      { mainCategory: product.mainCategory },
      ...(product.style ? [{ style: product.style }] : []),
      ...(product.fabric ? [{ fabric: product.fabric }] : []),
      ...(product.tags.length ? [{ tags: { $in: product.tags } }] : []),
    ],
  };

  const products = await Product.find(filters)
    .populate('mainCategory', 'name slug level isActive')
    .populate('subcategory', 'name slug level parent isActive')
    .sort({ bestSeller: -1, featured: -1, createdAt: -1 })
    .limit(limit);

  return products.map((item) => item.toPublicObject());
}

export async function getAdminProductById(productId) {
  const product = await findAdminProduct(productId);
  return product.toAdminObject();
}

export async function createProduct(payload, adminUserId) {
  const productPayload = buildProductPayload(payload);

  validatePricing(productPayload.regularPrice, productPayload.salePrice);
  await validateProductCategories(productPayload.mainCategory, productPayload.subcategory);
  await assignMissingVariantSkus(productPayload.variants, productPayload);
  validateVariants(productPayload.variants);
  await ensureSlugAvailable(productPayload.slug);
  await ensureSkuAvailable(productPayload.variants);

  const product = new Product({
    ...productPayload,
    createdBy: adminUserId,
    updatedBy: adminUserId,
  });

  if (product.status === 'active') {
    validateActiveProduct(product);
  }

  await product.save();
  await product.populate('mainCategory', 'name slug level isActive');
  await product.populate('subcategory', 'name slug level parent isActive');

  return product.toAdminObject();
}

export async function updateProduct(productId, payload, adminUserId) {
  const product = await findAdminProduct(productId);

  applyProductUpdates(product, payload);

  await validateProductCategories(product.mainCategory, product.subcategory);
  validatePricing(product.regularPrice, product.salePrice);
  await assignMissingVariantSkus(product.variants, product, product._id);
  validateVariants(product.variants);
  await ensureSlugAvailable(product.slug, product._id);
  await ensureSkuAvailable(product.variants, product._id);

  if (product.status === 'active') {
    validateActiveProduct(product);
  }

  product.updatedBy = adminUserId;
  await product.save();
  await product.populate('mainCategory', 'name slug level isActive');
  await product.populate('subcategory', 'name slug level parent isActive');

  return product.toAdminObject();
}

export async function updateProductStatus(productId, status, adminUserId) {
  const product = await findAdminProduct(productId);

  product.status = status;

  await validateProductCategories(product.mainCategory, product.subcategory);

  if (status === 'active') {
    validateActiveProduct(product);
  }

  product.updatedBy = adminUserId;
  await product.save();

  return product.toAdminObject();
}

export async function updateVariantStock(productId, payload, adminUserId) {
  const product = await findAdminProduct(productId);
  const variant = product.variants.id(payload.variantId);

  if (!variant) {
    throw new ApiError(404, 'Variant not found', []);
  }

  const size = variant.sizes.id(payload.sizeId);

  if (!size) {
    throw new ApiError(404, 'Size not found', []);
  }

  size.stock = payload.stock;
  product.updatedBy = adminUserId;
  await product.save();
  const adminProduct = product.toAdminObject();

  return {
    product: adminProduct,
    stock: {
      variantId: variant._id.toString(),
      sizeId: size._id.toString(),
      stock: size.stock,
      totalStock: adminProduct.totalStock,
    },
  };
}

export async function archiveProduct(productId, adminUserId) {
  const product = await findAdminProduct(productId);

  product.status = 'archived';
  product.updatedBy = adminUserId;
  await product.save();

  return product.toAdminObject();
}

export async function deleteProduct(productId) {
  const product = await findAdminProduct(productId);
  const hasOrders = await Order.exists({ 'items.product': product._id });

  await Cart.updateMany(
    { 'items.product': product._id },
    { $pull: { items: { product: product._id } } },
  );
  const imagePublicIds = [
    ...new Set(
      product.variants
        .flatMap((variant) => variant.images || [])
        .map((image) => image.publicId)
        .filter(Boolean),
    ),
  ];
  await product.deleteOne();
  const imageDeletionResults = hasOrders
    ? []
    : await Promise.allSettled(imagePublicIds.map((publicId) => deleteImage(publicId)));

  return {
    id: product._id.toString(),
    imagesRetainedForOrderHistory: Boolean(hasOrders),
    imageCleanupFailed: imageDeletionResults.filter((result) => result.status === 'rejected').length,
  };
}
