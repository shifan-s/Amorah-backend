import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';

const freeShippingThreshold = 1499;
const standardShippingCharge = 99;

function idString(value) {
  if (!value) {
    return '';
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
}

function sameId(left, right) {
  return idString(left) === idString(right);
}

function currentPrice(product) {
  return product.salePrice !== null && product.salePrice !== undefined && product.salePrice < product.regularPrice
    ? product.salePrice
    : product.regularPrice;
}

function primaryImage(variant, productName) {
  const images = [...(variant?.images || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const image = images.find((item) => item.isPrimary) || images[0];

  return {
    url: image?.url || '',
    alt: image?.alt || productName || 'Amorah product image',
  };
}

async function findOrCreateCart(userId) {
  const cart = await Cart.findOne({ user: userId });

  if (cart) {
    return cart;
  }

  return Cart.create({ user: userId, items: [] });
}

function findVariant(product, variantId) {
  return product.variants.find((variant) => sameId(variant._id, variantId));
}

function findSize(variant, sizeId) {
  return variant?.sizes.find((size) => sameId(size._id, sizeId));
}

export async function validateCartSelection({ productId, variantId, sizeId, quantity }) {
  const product = await Product.findById(productId).populate('mainCategory', 'name slug level isActive');

  if (!product || product.status !== 'active') {
    throw new ApiError(400, 'This product is no longer available', []);
  }

  if (product.mainCategory && product.mainCategory.isActive === false) {
    throw new ApiError(400, 'This product is no longer available', []);
  }

  const variant = findVariant(product, variantId);

  if (!variant || !variant.active) {
    throw new ApiError(400, 'The selected colour is unavailable', []);
  }

  const size = findSize(variant, sizeId);

  if (!size || !size.active) {
    throw new ApiError(400, 'The selected size is unavailable', []);
  }

  if (size.stock <= 0) {
    throw new ApiError(400, 'The selected size is unavailable', []);
  }

  if (quantity > size.stock) {
    throw new ApiError(400, `Only ${size.stock} items are currently available`, []);
  }

  return {
    product,
    variant,
    size,
    unitPrice: currentPrice(product),
  };
}

async function productsById(items) {
  const ids = [...new Set(items.map((item) => idString(item.product)).filter(Boolean))];
  const products = await Product.find({ _id: { $in: ids } }).populate('mainCategory', 'name slug level isActive');

  return new Map(products.map((product) => [product._id.toString(), product]));
}

function getAvailability(item, product) {
  if (!product || product.status !== 'active') {
    return { available: false, unavailableReason: 'Product is no longer available' };
  }

  if (product.mainCategory && product.mainCategory.isActive === false) {
    return { available: false, unavailableReason: 'Product category is no longer available' };
  }

  const variant = findVariant(product, item.variantId);

  if (!variant || !variant.active) {
    return { available: false, unavailableReason: 'Selected colour is no longer available' };
  }

  const size = findSize(variant, item.sizeId);

  if (!size || !size.active) {
    return { available: false, unavailableReason: 'Selected size is no longer available' };
  }

  if (size.stock <= 0) {
    return { available: false, unavailableReason: 'Selected size is out of stock' };
  }

  if (item.quantity > size.stock) {
    return {
      available: false,
      unavailableReason: `Only ${size.stock} items are currently available`,
      variant,
      size,
    };
  }

  return { available: true, variant, size };
}

export async function buildCartResponse(cart) {
  const safeCart = cart || { id: '', _id: '', items: [] };
  const productMap = await productsById(safeCart.items || []);
  const items = [];

  for (const item of safeCart.items || []) {
    const product = productMap.get(idString(item.product));
    const availability = getAvailability(item, product);
    const variant = availability.variant || (product ? findVariant(product, item.variantId) : null);
    const size = availability.size || findSize(variant, item.sizeId);
    const unitPrice = product ? currentPrice(product) : 0;
    const lineTotal = availability.available ? unitPrice * item.quantity : 0;

    items.push({
      itemId: item._id.toString(),
      productId: idString(item.product),
      variantId: idString(item.variantId),
      sizeId: idString(item.sizeId),
      slug: product?.slug || '',
      name: product?.name || 'Unavailable Amorah product',
      mainCategory: product?.mainCategory
        ? {
            id: idString(product.mainCategory),
            name: product.mainCategory.name,
            slug: product.mainCategory.slug,
          }
        : null,
      sku: variant?.sku || '',
      colourName: variant?.colourName || '',
      colourHex: variant?.colourHex || '',
      size: size?.name || '',
      image: primaryImage(variant, product?.name),
      quantity: item.quantity,
      availableStock: size?.stock || 0,
      regularPrice: product?.regularPrice || 0,
      salePrice: product?.salePrice ?? null,
      unitPrice,
      lineTotal,
      available: availability.available,
      ...(availability.available ? {} : { unavailableReason: availability.unavailableReason }),
    });
  }

  const subtotal = items.reduce((total, item) => total + (item.available ? item.lineTotal : 0), 0);
  const shippingCharge = subtotal > 0 && subtotal < freeShippingThreshold ? standardShippingCharge : 0;
  const itemCount = items.reduce((total, item) => total + (item.available ? item.quantity : 0), 0);
  const amountRemainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  return {
    id: idString(safeCart._id || safeCart.id),
    items,
    summary: {
      itemCount,
      uniqueItemCount: items.filter((item) => item.available).length,
      subtotal,
      shippingCharge,
      tax: 0,
      total: subtotal + shippingCharge,
      freeShippingThreshold,
      amountRemainingForFreeShipping,
    },
  };
}

export async function getCustomerCart(userId) {
  const cart = await findOrCreateCart(userId);
  return buildCartResponse(cart);
}

export async function addCartItem(userId, payload) {
  const cart = await findOrCreateCart(userId);
  await validateCartSelection(payload);
  const existingItem = cart.items.find(
    (item) =>
      sameId(item.product, payload.productId) &&
      sameId(item.variantId, payload.variantId) &&
      sameId(item.sizeId, payload.sizeId),
  );
  let created = false;

  if (existingItem) {
    const nextQuantity = existingItem.quantity + payload.quantity;
    await validateCartSelection({ ...payload, quantity: nextQuantity });
    existingItem.quantity = nextQuantity;
  } else {
    cart.items.push({
      product: payload.productId,
      variantId: payload.variantId,
      sizeId: payload.sizeId,
      quantity: payload.quantity,
    });
    created = true;
  }

  await cart.save();

  return {
    cart: await buildCartResponse(cart),
    created,
  };
}

export async function updateCartItemQuantity(userId, itemId, quantity) {
  const cart = await findOrCreateCart(userId);
  const item = cart.items.id(itemId);

  if (!item) {
    throw new ApiError(404, 'Cart item not found', []);
  }

  await validateCartSelection({
    productId: item.product,
    variantId: item.variantId,
    sizeId: item.sizeId,
    quantity,
  });

  item.quantity = quantity;
  await cart.save();

  return buildCartResponse(cart);
}

export async function removeCartItem(userId, itemId) {
  const cart = await findOrCreateCart(userId);
  const item = cart.items.id(itemId);

  if (!item) {
    throw new ApiError(404, 'Cart item not found', []);
  }

  cart.items.pull({ _id: itemId });
  await cart.save();

  return buildCartResponse(cart);
}

export async function clearCustomerCart(userId) {
  const cart = await findOrCreateCart(userId);
  cart.items = [];
  await cart.save();

  return buildCartResponse(cart);
}

function guestItemKey(item) {
  return [idString(item.productId), idString(item.variantId), idString(item.sizeId)].join(':');
}

export async function mergeGuestCart(userId, items = []) {
  const cart = await findOrCreateCart(userId);
  const warnings = [];
  const mergedPayload = new Map();

  items.forEach((item) => {
    const key = guestItemKey(item);
    const existing = mergedPayload.get(key);
    const quantity = Math.max(1, Math.floor(item.quantity || 1));

    if (existing) {
      existing.quantity += quantity;
      return;
    }

    mergedPayload.set(key, {
      productId: item.productId,
      variantId: item.variantId,
      sizeId: item.sizeId,
      quantity,
    });
  });

  for (const item of mergedPayload.values()) {
    try {
      const selection = await validateCartSelection({ ...item, quantity: 1 });
      const existingItem = cart.items.find(
        (cartItem) =>
          sameId(cartItem.product, item.productId) &&
          sameId(cartItem.variantId, item.variantId) &&
          sameId(cartItem.sizeId, item.sizeId),
      );
      const baseQuantity = existingItem?.quantity || 0;
      const desiredQuantity = baseQuantity + item.quantity;
      const nextQuantity = Math.min(desiredQuantity, selection.size.stock);

      if (nextQuantity < desiredQuantity) {
        warnings.push({
          productId: idString(item.productId),
          message: 'Quantity adjusted to available stock',
        });
      }

      if (existingItem) {
        existingItem.quantity = nextQuantity;
      } else {
        cart.items.push({
          product: item.productId,
          variantId: item.variantId,
          sizeId: item.sizeId,
          quantity: nextQuantity,
        });
      }
    } catch (error) {
      warnings.push({
        productId: idString(item.productId),
        message: error.message || 'Item skipped during cart merge',
      });
    }
  }

  await cart.save();

  return {
    cart: await buildCartResponse(cart),
    warnings,
  };
}

export function isValidCartObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}
