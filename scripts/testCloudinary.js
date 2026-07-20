import '../src/config/env.js';
import { v2 as cloudinary } from 'cloudinary';
import { classifyCloudinaryError } from '../src/utils/cloudinaryErrors.js';

const requiredConfig = {
  cloudName: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
  apiKey: Boolean(process.env.CLOUDINARY_API_KEY),
  apiSecret: Boolean(process.env.CLOUDINARY_API_SECRET),
};

console.log('Configuration present:', requiredConfig.cloudName && requiredConfig.apiKey && requiredConfig.apiSecret ? 'yes' : 'no');
console.log('Cloud name present:', requiredConfig.cloudName ? 'yes' : 'no');
console.log('API key present:', requiredConfig.apiKey ? 'yes' : 'no');
console.log('API secret present:', requiredConfig.apiSecret ? 'yes' : 'no');

if (!requiredConfig.cloudName || !requiredConfig.apiKey || !requiredConfig.apiSecret) {
  console.log('Authentication result: not tested');
  console.log('Safe error category: configuration');
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

try {
  await cloudinary.api.ping();
  console.log('Authentication result: success');
  console.log('Safe error category: none');
  process.exit(0);
} catch (error) {
  const classified = classifyCloudinaryError(error);
  console.log('Authentication result: failure');
  console.log(`Safe error category: ${classified.category}`);
  process.exit(1);
}
