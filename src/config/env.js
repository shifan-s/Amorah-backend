import dotenv from 'dotenv';
import { detectRazorpayKeyMode, maskRazorpayKeyId } from '../utils/razorpayMode.js';

dotenv.config();

function parseOrigins(value = '') {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parsePositiveInteger(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

function parseTrustProxy(value = '') {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized || normalized === 'false' || normalized === '0') {
    return false;
  }

  if (normalized === 'true') {
    return 1;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : false;
}

function parseInvoiceDocumentType(value = 'receipt') {
  const type = String(value || 'receipt').trim().toLowerCase();

  if (['receipt', 'invoice', 'tax_invoice'].includes(type)) {
    return type;
  }

  return 'receipt';
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173'),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  authCookieName: process.env.AUTH_COOKIE_NAME || 'amorah_token',
  cookieSecure: parseBoolean(process.env.COOKIE_SECURE, false),
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  cookieDomain: process.env.COOKIE_DOMAIN || '',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  maintenanceMode: parseBoolean(process.env.MAINTENANCE_MODE, false),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryProductFolder: process.env.CLOUDINARY_PRODUCT_FOLDER || 'amorah/products',
  cloudinaryCategoryFolder: process.env.CLOUDINARY_CATEGORY_FOLDER || 'amorah/categories',
  cloudinaryBannerFolder: process.env.CLOUDINARY_BANNER_FOLDER || 'amorah/banners',
  maxImageSizeMb: parsePositiveInteger(process.env.MAX_IMAGE_SIZE_MB, 5),
  maxImagesPerRequest: Math.min(parsePositiveInteger(process.env.MAX_IMAGES_PER_REQUEST, 5), 5),
  checkoutFreeShippingThreshold: parsePositiveInteger(process.env.CHECKOUT_FREE_SHIPPING_THRESHOLD, 1499),
  checkoutShippingCharge: parsePositiveInteger(process.env.CHECKOUT_SHIPPING_CHARGE, 99),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  razorpayCurrency: process.env.RAZORPAY_CURRENCY || 'INR',
  razorpayCompanyName: process.env.RAZORPAY_COMPANY_NAME || 'Amorah',
  razorpayCompanyDescription:
    process.env.RAZORPAY_COMPANY_DESCRIPTION || 'Secure payment for your Amorah order',
  razorpayLogoUrl: process.env.RAZORPAY_LOGO_URL || '',
  emailEnabled: parseBoolean(process.env.EMAIL_ENABLED, true),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parsePositiveInteger(process.env.SMTP_PORT, 587),
  smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFromName: process.env.EMAIL_FROM_NAME || 'Amorah',
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS || '',
  emailReplyTo: process.env.EMAIL_REPLY_TO || '',
  supportEmail: process.env.SUPPORT_EMAIL || '',
  adminOrderEmail: process.env.ADMIN_ORDER_EMAIL || '',
  emailLogoUrl: process.env.EMAIL_LOGO_URL || '',
  frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  emailConnectionTimeoutMs: parsePositiveInteger(process.env.EMAIL_CONNECTION_TIMEOUT_MS, 10000),
  emailGreetingName: process.env.EMAIL_GREETING_NAME || 'Amorah Customer Care',
  testEmailTo: process.env.TEST_EMAIL_TO || '',
  invoiceEnabled: parseBoolean(process.env.INVOICE_ENABLED, true),
  invoicePrefix: process.env.INVOICE_PREFIX || 'AMR-INV',
  invoiceDocumentType: parseInvoiceDocumentType(process.env.INVOICE_DOCUMENT_TYPE),
  businessLegalName: process.env.BUSINESS_LEGAL_NAME || '',
  businessDisplayName: process.env.BUSINESS_DISPLAY_NAME || 'Amorah',
  businessAddressLine1: process.env.BUSINESS_ADDRESS_LINE_1 || '',
  businessAddressLine2: process.env.BUSINESS_ADDRESS_LINE_2 || '',
  businessCity: process.env.BUSINESS_CITY || '',
  businessState: process.env.BUSINESS_STATE || '',
  businessPostalCode: process.env.BUSINESS_POSTAL_CODE || '',
  businessCountry: process.env.BUSINESS_COUNTRY || 'India',
  businessEmail: process.env.BUSINESS_EMAIL || '',
  businessPhone: process.env.BUSINESS_PHONE || '',
  businessWebsite: process.env.BUSINESS_WEBSITE || '',
  businessGstin: process.env.BUSINESS_GSTIN || '',
  businessPan: process.env.BUSINESS_PAN || '',
  businessStateCode: process.env.BUSINESS_STATE_CODE || '',
  invoiceLogoUrl: process.env.INVOICE_LOGO_URL || '',
  invoiceFooterText: process.env.INVOICE_FOOTER_TEXT || 'Thank you for shopping with Amorah.',
};

function requireProductionValues(missing, values) {
  Object.entries(values).forEach(([name, value]) => {
    if (!String(value || '').trim()) {
      missing.push(name);
    }
  });
}

export function validateEnv() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is required to start the Amorah API.');
  }

  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is required to start the Amorah API.');
  }

  if (env.nodeEnv !== 'production') {
    if (detectRazorpayKeyMode(env.razorpayKeyId) === 'live') {
      console.warn(`Razorpay Live Key ID detected outside production: ${maskRazorpayKeyId(env.razorpayKeyId)}.`);
    }
    return;
  }

  const missing = [];

  requireProductionValues(missing, {
    MONGODB_URI: env.mongoUri,
    CLIENT_URL: env.clientUrl,
    ALLOWED_ORIGINS: env.allowedOrigins.join(','),
    JWT_SECRET: env.jwtSecret,
  });

  if (env.jwtSecret.length < 32) {
    missing.push('JWT_SECRET_MIN_LENGTH_32');
  }

  if (!env.clientUrl || env.clientUrl.includes('localhost')) {
    missing.push('CLIENT_URL_PRODUCTION_ORIGIN');
  }

  if (env.allowedOrigins.some((origin) => origin.includes('localhost'))) {
    missing.push('ALLOWED_ORIGINS_PRODUCTION_ONLY');
  }

  requireProductionValues(missing, {
    RAZORPAY_KEY_ID: env.razorpayKeyId,
    RAZORPAY_KEY_SECRET: env.razorpayKeySecret,
    RAZORPAY_WEBHOOK_SECRET: env.razorpayWebhookSecret,
  });

  if (detectRazorpayKeyMode(env.razorpayKeyId) === 'test') {
    missing.push('RAZORPAY_LIVE_KEY_ID');
  }

  requireProductionValues(missing, {
    CLOUDINARY_CLOUD_NAME: env.cloudinaryCloudName,
    CLOUDINARY_API_KEY: env.cloudinaryApiKey,
    CLOUDINARY_API_SECRET: env.cloudinaryApiSecret,
  });

  if (env.emailEnabled) {
    requireProductionValues(missing, {
      SMTP_HOST: env.smtpHost,
      SMTP_USER: env.smtpUser,
      SMTP_PASS: env.smtpPass,
      EMAIL_FROM_ADDRESS: env.emailFromAddress,
    });
  }

  if (env.invoiceEnabled && env.invoiceDocumentType === 'invoice') {
    requireProductionValues(missing, {
      BUSINESS_LEGAL_NAME: env.businessLegalName || env.businessDisplayName,
      BUSINESS_ADDRESS_LINE_1: env.businessAddressLine1,
      BUSINESS_CITY: env.businessCity,
      BUSINESS_STATE: env.businessState,
      BUSINESS_POSTAL_CODE: env.businessPostalCode,
      BUSINESS_COUNTRY: env.businessCountry,
    });
  }

  if (env.invoiceEnabled && env.invoiceDocumentType === 'tax_invoice') {
    requireProductionValues(missing, {
      BUSINESS_LEGAL_NAME: env.businessLegalName,
      BUSINESS_ADDRESS_LINE_1: env.businessAddressLine1,
      BUSINESS_CITY: env.businessCity,
      BUSINESS_STATE: env.businessState,
      BUSINESS_POSTAL_CODE: env.businessPostalCode,
      BUSINESS_COUNTRY: env.businessCountry,
      BUSINESS_GSTIN: env.businessGstin,
      BUSINESS_STATE_CODE: env.businessStateCode,
    });
  }

  if (missing.length > 0) {
    throw new Error(`Production configuration is incomplete. Missing: ${[...new Set(missing)].join(', ')}.`);
  }
}

export default env;
