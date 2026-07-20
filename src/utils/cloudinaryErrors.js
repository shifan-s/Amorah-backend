import env from '../config/env.js';
import ApiError from './ApiError.js';

const secretValues = [
  process.env.CLOUDINARY_CLOUD_NAME,
  process.env.CLOUDINARY_API_KEY,
  process.env.CLOUDINARY_API_SECRET,
  process.env.CLOUDINARY_URL,
].filter(Boolean);

function redactCloudinaryValues(value = '') {
  let safeValue = String(value || '');

  secretValues.forEach((secret) => {
    safeValue = safeValue.split(secret).join('[redacted]');
  });

  return safeValue.replace(/cloudinary:\/\/[^\s]+/gi, 'cloudinary://[redacted]');
}

export function classifyCloudinaryError(error = {}) {
  const providerError = error?.error || error || {};
  const statusCode = Number(
    providerError.http_code ||
      providerError.httpCode ||
      providerError.statusCode ||
      providerError.status ||
      error.http_code ||
      error.httpCode ||
      error.statusCode ||
      error.status ||
      0,
  );
  const code = String(providerError.code || providerError.name || error.code || error.name || '').toLowerCase();
  const rawMessage = redactCloudinaryValues(providerError.message || error.message || '');
  const lowerMessage = rawMessage.toLowerCase();

  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    return {
      category: 'configuration',
      statusCode: 503,
      safeMessage: 'Cloudinary uploads are not configured',
    };
  }

  if (lowerMessage.includes('cloud_name mismatch')) {
    return {
      category: 'configuration',
      statusCode: 502,
      safeMessage: 'Cloudinary cloud name does not match the configured API credentials',
    };
  }

  if (statusCode === 401 || lowerMessage.includes('invalid api key') || lowerMessage.includes('invalid signature')) {
    return {
      category: 'authentication',
      statusCode: 502,
      safeMessage: 'Cloudinary authentication failed',
    };
  }

  if (statusCode === 404 || lowerMessage.includes('cloud name') || lowerMessage.includes('not found')) {
    return {
      category: 'configuration',
      statusCode: 502,
      safeMessage: 'Cloudinary cloud configuration is invalid',
    };
  }

  if (statusCode === 403 || lowerMessage.includes('disabled') || lowerMessage.includes('unverified')) {
    return {
      category: 'authentication',
      statusCode: 502,
      safeMessage: 'Cloudinary account is not available for uploads',
    };
  }

  if (statusCode === 400 || lowerMessage.includes('invalid image') || lowerMessage.includes('unsupported')) {
    return {
      category: 'file_validation',
      statusCode: 400,
      safeMessage: 'Image file could not be accepted by Cloudinary',
    };
  }

  if (code.includes('timeout') || lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return {
      category: 'timeout',
      statusCode: 504,
      safeMessage: 'Cloudinary upload timed out',
    };
  }

  if (
    ['enotfound', 'econnreset', 'econnrefused', 'etimedout', 'eai_again'].some((networkCode) =>
      code.includes(networkCode),
    ) ||
    lowerMessage.includes('network')
  ) {
    return {
      category: 'network',
      statusCode: 502,
      safeMessage: 'Cloudinary network request failed',
    };
  }

  return {
    category: 'provider',
    statusCode: statusCode >= 400 && statusCode < 600 ? 502 : 502,
    safeMessage: 'Cloudinary upload failed',
  };
}

export function logSafeCloudinaryError(error, context = 'Cloudinary request failed') {
  if (env.nodeEnv !== 'development') {
    return;
  }

  const classified = classifyCloudinaryError(error);

  console.error(context, {
    name: redactCloudinaryValues(error?.error?.name || error?.name || 'CloudinaryError'),
    httpCode:
      Number(
        error?.error?.http_code ||
          error?.error?.httpCode ||
          error?.error?.statusCode ||
          error?.error?.status ||
          error?.http_code ||
          error?.httpCode ||
          error?.statusCode ||
          error?.status ||
          0,
      ) || undefined,
    message: classified.safeMessage,
    category: classified.category,
  });
}

export function toCloudinaryApiError(error) {
  const classified = classifyCloudinaryError(error);
  return new ApiError(classified.statusCode, classified.safeMessage, [
    `Cloudinary error category: ${classified.category}`,
  ]);
}
