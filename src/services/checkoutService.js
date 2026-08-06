import mongoose from 'mongoose';
import env from '../config/env.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';

const currency = 'INR';

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

function currentPrice(product, variant) {
  if (variant?.price !== null && variant?.price !== undefined) return variant.price;
  return product.salePrice !== null && product.salePrice !== undefined && product.salePrice < product.regularPrice
    ? product.salePrice
    : product.regularPrice;
}

function getPrimaryImage(variant, productName) {
  const sortedImages = [...(variant?.images || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const image = sortedImages.find((item) => item.isPrimary) || sortedImages[0];

  return {
    url: image?.url || '',
    alt: image?.alt || productName || 'Amorah product image',
  };
}

function findVariant(product, variantId) {
  return product?.variants.find((variant) => sameId(variant._id, variantId));
}

function findSize(variant, sizeId) {
  return variant?.sizes.find((size) => sameId(size._id, sizeId));
}

function buildUnavailableError(item, message) {
  return {
    productId: idString(item.product),
    variantId: idString(item.variantId),
    sizeId: idString(item.sizeId),
    quantity: item.quantity,
    message,
  };
}

function buildOrderItemSnapshot(item, product, variant, size) {
  const unitPrice = currentPrice(product, variant);
  const quantity = Number(item.quantity) || 1;

  return {
    product: product._id,
    productName: product.name,
    productSlug: product.slug,
    productImage: getPrimaryImage(variant, product.name),
    variantId: variant._id,
    sizeId: size._id,
    sku: variant.sku,
    colourName: variant.colourName,
    colourHex: variant.colourHex || '',
    size: size.name,
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
  };
}

function publicItemSnapshot(item) {
  return {
    productId: idString(item.product),
    productName: item.productName,
    productSlug: item.productSlug,
    productImage: item.productImage,
    variantId: idString(item.variantId),
    sizeId: idString(item.sizeId),
    sku: item.sku,
    colourName: item.colourName,
    colourHex: item.colourHex,
    size: item.size,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  };
}

export function sanitizeCustomerNotes(value = '') {
  const notes = String(value || '').trim();

  if (/<[^>]*>/.test(notes)) {
    throw new ApiError(400, 'Order notes cannot include HTML', []);
  }

  if (notes.length > 500) {
    throw new ApiError(400, 'Order notes must be at most 500 characters', []);
  }

  return notes;
}

export function snapshotAddress(address) {
  return {
    fullName: address.fullName,
    mobile: address.mobile,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || '',
    landmark: address.landmark || '',
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country || 'India',
    addressType: address.addressType || 'Home',
  };
}

function findUserAddress(user, addressId, label) {
  if (!mongoose.Types.ObjectId.isValid(addressId || '')) {
    throw new ApiError(400, `${label} address is invalid`, []);
  }

  const address = (user.addresses || []).find((item) => sameId(item.id || item._id, addressId));

  if (!address) {
    throw new ApiError(404, `${label} address not found`, []);
  }

  return address;
}

export function resolveCheckoutAddress(user, payload) {
  const shippingAddress = findUserAddress(user, payload.shippingAddressId, 'Shipping');

  if (payload.billingSameAsShipping === false && !payload.billingAddressId) {
    throw new ApiError(400, 'Billing address is required', []);
  }

  const billingAddress =
    payload.billingSameAsShipping === false
      ? findUserAddress(user, payload.billingAddressId, 'Billing')
      : shippingAddress;

  return {
    shippingAddress: snapshotAddress(shippingAddress),
    billingAddress: snapshotAddress(billingAddress),
  };
}

export function calculateCheckoutSummary(items) {
  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const shippingCharge =
    subtotal > 0 && subtotal < env.checkoutFreeShippingThreshold ? env.checkoutShippingCharge : 0;
  const tax = 0;
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  return {
    itemCount,
    subtotal,
    shippingCharge,
    tax,
    total: subtotal + shippingCharge + tax,
    currency,
  };
}

async function loadProductsForCart(items) {
  const ids = [...new Set(items.map((item) => idString(item.product)).filter(Boolean))];
  const products = await Product.find({ _id: { $in: ids } }).populate('mainCategory', 'isActive name slug level');

  return new Map(products.map((product) => [product._id.toString(), product]));
}

export async function validateDirectSelection(clientItems) {
  if (!Array.isArray(clientItems) || clientItems.length !== 1) {
    throw new ApiError(400, 'Buy Now requires exactly one item', []);
  }

  const requested = clientItems[0];
  const product = await Product.findById(requested.productId).populate('mainCategory', 'isActive name slug level');
  const cartLikeItem = {
    product: requested.productId,
    variantId: requested.variantId,
    sizeId: requested.sizeId,
    quantity: Number(requested.quantity),
  };

  if (!product || product.status !== 'active' || product.mainCategory?.isActive === false) {
    throw new ApiError(400, 'Product is no longer available', []);
  }
  const variant = findVariant(product, requested.variantId);
  const size = findSize(variant, requested.sizeId);
  if (!variant?.active || !size?.active || size.stock < cartLikeItem.quantity) {
    throw new ApiError(400, 'The selected colour, size or quantity is no longer available', []);
  }

  return { cart: null, items: [buildOrderItemSnapshot(cartLikeItem, product, variant, size)] };
}

export async function validateCheckoutSelection(userId, payload) {
  return payload.checkoutMode === 'buyNow'
    ? validateDirectSelection(payload.items)
    : validateCheckoutCart(userId);
}

export async function validateCheckoutCart(userId) {
  const cart = await Cart.findOne({ user: userId });

  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty', []);
  }

  const productMap = await loadProductsForCart(cart.items);
  const unavailableItems = [];
  const snapshots = [];

  for (const item of cart.items) {
    const product = productMap.get(idString(item.product));

    if (!product || product.status !== 'active') {
      unavailableItems.push(buildUnavailableError(item, 'Product is no longer available'));
      continue;
    }

    if (product.mainCategory && product.mainCategory.isActive === false) {
      unavailableItems.push(buildUnavailableError(item, 'Product category is no longer available'));
      continue;
    }

    const variant = findVariant(product, item.variantId);

    if (!variant || !variant.active) {
      unavailableItems.push(buildUnavailableError(item, 'Selected colour is no longer available'));
      continue;
    }

    const size = findSize(variant, item.sizeId);

    if (!size || !size.active) {
      unavailableItems.push(buildUnavailableError(item, 'Selected size is no longer available'));
      continue;
    }

    if (size.stock <= 0) {
      unavailableItems.push(buildUnavailableError(item, 'Selected size is out of stock'));
      continue;
    }

    if (item.quantity > size.stock) {
      unavailableItems.push(buildUnavailableError(item, `Only ${size.stock} items are currently available`));
      continue;
    }

    snapshots.push(buildOrderItemSnapshot(item, product, variant, size));
  }

  if (unavailableItems.length > 0) {
    throw new ApiError(400, 'Some cart items need attention before checkout', unavailableItems);
  }

  return {
    cart,
    items: snapshots,
  };
}

export function validateClientCartSelection(clientItems, cartItems) {
  const normalize = (item) =>
    [
      idString(item.productId || item.product),
      idString(item.variantId),
      idString(item.sizeId),
      Number(item.quantity),
    ].join(':');
  const clientSelection = [...(clientItems || [])].map(normalize).sort();
  const storedSelection = [...(cartItems || [])].map(normalize).sort();

  if (
    clientSelection.length !== storedSelection.length ||
    clientSelection.some((item, index) => item !== storedSelection[index])
  ) {
    throw new ApiError(409, 'Your cart changed. Please review it before paying.', []);
  }
}

export async function buildCheckoutPreview(user, payload) {
  const { items } = await validateCheckoutSelection(user.id, payload);
  const { shippingAddress, billingAddress } = resolveCheckoutAddress(user, payload);
  const customerNotes = sanitizeCustomerNotes(payload.customerNotes);
  const summary = calculateCheckoutSummary(items);

  return {
    items: items.map(publicItemSnapshot),
    shippingAddress,
    billingAddress,
    summary,
    paymentMethod: 'razorpay',
    customerNotes,
  };
}
