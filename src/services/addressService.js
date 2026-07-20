import mongoose from 'mongoose';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

const editableAddressFields = [
  'fullName',
  'mobile',
  'addressLine1',
  'addressLine2',
  'landmark',
  'city',
  'state',
  'postalCode',
  'addressType',
  'isDefault',
];
const duplicateFields = ['fullName', 'mobile', 'addressLine1', 'city', 'state', 'postalCode'];
const maxAddresses = 10;

function normalizeDigits(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return String(value).replace(/\D/g, '');
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed || undefined;
}

function normalizeForCompare(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAddressPayload(payload) {
  return {
    fullName: normalizeText(payload.fullName),
    mobile: normalizeDigits(payload.mobile),
    addressLine1: normalizeText(payload.addressLine1),
    addressLine2: normalizeText(payload.addressLine2),
    landmark: normalizeText(payload.landmark),
    city: normalizeText(payload.city),
    state: normalizeText(payload.state),
    postalCode: normalizeDigits(payload.postalCode),
    country: 'India',
    addressType: payload.addressType || 'Home',
    isDefault: Boolean(payload.isDefault),
  };
}

function toSafeAddress(address) {
  return {
    id: address._id.toString(),
    fullName: address.fullName,
    mobile: address.mobile,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    addressType: address.addressType,
    isDefault: address.isDefault,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

function sortAddresses(addresses) {
  return [...addresses].sort((a, b) => {
    if (a.isDefault === b.isDefault) {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }

    return a.isDefault ? -1 : 1;
  });
}

function toAddressList(addresses) {
  return sortAddresses(addresses).map(toSafeAddress);
}

function ensureValidAddressId(addressId) {
  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(400, 'Invalid address ID', []);
  }
}

async function findActiveUser(userId) {
  const user = await User.findById(userId);

  if (!user || user.status === 'disabled') {
    throw new ApiError(401, 'Authentication required', []);
  }

  return user;
}

function findAddress(user, addressId) {
  ensureValidAddressId(addressId);

  const address = user.addresses.id(addressId);

  if (!address) {
    throw new ApiError(404, 'Address not found', []);
  }

  return address;
}

function hasExactDuplicate(addresses, addressPayload, excludedAddressId) {
  return addresses.some((address) => {
    if (excludedAddressId && address._id.toString() === excludedAddressId) {
      return false;
    }

    return duplicateFields.every(
      (field) => normalizeForCompare(address[field]) === normalizeForCompare(addressPayload[field]),
    );
  });
}

function clearDefaults(addresses) {
  addresses.forEach((address) => {
    address.isDefault = false;
  });
}

function ensureOneDefault(addresses) {
  if (!addresses.length) {
    return;
  }

  const defaultAddresses = addresses.filter((address) => address.isDefault);

  if (defaultAddresses.length === 1) {
    return;
  }

  clearDefaults(addresses);
  addresses[0].isDefault = true;
}

export async function getAddresses(userId) {
  const user = await findActiveUser(userId);

  return toAddressList(user.addresses);
}

export async function addAddress(userId, payload) {
  const user = await findActiveUser(userId);

  if (user.addresses.length >= maxAddresses) {
    throw new ApiError(400, 'A customer can save up to 10 addresses', []);
  }

  const addressPayload = normalizeAddressPayload(payload);

  if (hasExactDuplicate(user.addresses, addressPayload)) {
    throw new ApiError(409, 'This address is already saved', []);
  }

  if (!user.addresses.length) {
    addressPayload.isDefault = true;
  }

  if (addressPayload.isDefault) {
    clearDefaults(user.addresses);
  }

  user.addresses.push(addressPayload);
  ensureOneDefault(user.addresses);
  await user.save();

  const address = user.addresses[user.addresses.length - 1];

  return {
    address: toSafeAddress(address),
    addresses: toAddressList(user.addresses),
  };
}

export async function updateAddress(userId, addressId, payload) {
  const user = await findActiveUser(userId);
  const address = findAddress(user, addressId);

  editableAddressFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      return;
    }

    if (field === 'mobile' || field === 'postalCode') {
      address[field] = normalizeDigits(payload[field]);
      return;
    }

    if (field === 'isDefault') {
      address.isDefault = Boolean(payload.isDefault);
      return;
    }

    address[field] = normalizeText(payload[field]);
  });

  const duplicatePayload = {
    fullName: address.fullName,
    mobile: address.mobile,
    addressLine1: address.addressLine1,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
  };

  if (hasExactDuplicate(user.addresses, duplicatePayload, address._id.toString())) {
    throw new ApiError(409, 'This address is already saved', []);
  }

  if (payload.isDefault === true) {
    clearDefaults(user.addresses);
    address.isDefault = true;
  }

  ensureOneDefault(user.addresses);
  await user.save();

  return toAddressList(user.addresses);
}

export async function deleteAddress(userId, addressId) {
  const user = await findActiveUser(userId);
  const address = findAddress(user, addressId);
  const wasDefault = address.isDefault;

  user.addresses.pull(address._id);

  if (wasDefault && user.addresses.length) {
    user.addresses[0].isDefault = true;
  }

  ensureOneDefault(user.addresses);
  await user.save();

  return toAddressList(user.addresses);
}

export async function setDefaultAddress(userId, addressId) {
  const user = await findActiveUser(userId);
  const address = findAddress(user, addressId);

  clearDefaults(user.addresses);
  address.isDefault = true;
  await user.save();

  return toAddressList(user.addresses);
}
