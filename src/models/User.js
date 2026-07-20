import mongoose from 'mongoose';
import { comparePassword as comparePasswordValue } from '../utils/password.js';

const roles = ['customer', 'admin'];
const statuses = ['active', 'disabled'];
const indianMobilePattern = /^[6-9]\d{9}$/;
const postalCodePattern = /^\d{6}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeMobile(value) {
  if (!value) {
    return undefined;
  }

  return String(value).replace(/\D/g, '');
}

const avatarSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [80, 'Full name must be at most 80 characters'],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      set: normalizeMobile,
      validate: {
        validator(value) {
          return indianMobilePattern.test(value);
        },
        message: 'Enter a valid Indian mobile number',
      },
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
      maxlength: [150, 'Address line 1 must be at most 150 characters'],
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [150, 'Address line 2 must be at most 150 characters'],
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: [100, 'Landmark must be at most 100 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [80, 'City must be at most 80 characters'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [80, 'State must be at most 80 characters'],
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
      set: normalizeMobile,
      validate: {
        validator(value) {
          return postalCodePattern.test(value);
        },
        message: 'Postal code must be exactly six digits',
      },
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    addressType: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [80, 'Full name must be at most 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      validate: {
        validator(value) {
          return emailPattern.test(value);
        },
        message: 'Enter a valid email address',
      },
    },
    mobile: {
      type: String,
      trim: true,
      set: normalizeMobile,
      validate: {
        validator(value) {
          return !value || indianMobilePattern.test(value);
        },
        message: 'Enter a valid Indian mobile number',
      },
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: roles,
      default: 'customer',
    },
    status: {
      type: String,
      enum: statuses,
      default: 'active',
    },
    avatar: {
      type: avatarSchema,
      default: undefined,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    addresses: {
      type: [addressSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 10;
        },
        message: 'A customer can save up to 10 addresses',
      },
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ mobile: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, status: 1 });

userSchema.methods.comparePassword = function comparePassword(password) {
  return comparePasswordValue(password, this.passwordHash);
};

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

function sortSafeAddresses(addresses) {
  return [...addresses].sort((a, b) => {
    if (a.isDefault === b.isDefault) {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }

    return a.isDefault ? -1 : 1;
  });
}

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    email: this.email,
    mobile: this.mobile,
    role: this.role,
    status: this.status,
    avatar: this.avatar,
    addresses: sortSafeAddresses(this.addresses).map(toSafeAddress),
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.model('User', userSchema);

export default User;
