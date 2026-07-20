import '../src/config/env.js';
import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import Product from '../src/models/Product.js';
import { deleteImage } from '../src/services/uploadService.js';
import { DEMO_PRODUCT_TAG } from './demoProductData.js';

const CONFIRM_FLAG = '--confirm-client-demo-product-removal';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectPublicIds(products) {
  return unique(
    products.flatMap((product) =>
      product.variants.flatMap((variant) => variant.images.map((image) => image.publicId).filter(Boolean)),
    ),
  );
}

async function removeDemoProducts({ confirmed = false } = {}) {
  const products = await Product.find({ tags: DEMO_PRODUCT_TAG }).select('name slug variants.images.publicId');

  if (!confirmed) {
    return {
      confirmed: false,
      matched: products.length,
      productNames: products.map((product) => product.name),
      deletedProducts: 0,
      deletedImages: 0,
      imageDeleteFailures: 0,
    };
  }

  const productIds = products.map((product) => product._id);
  const publicIds = collectPublicIds(products);
  const imageResults = await Promise.allSettled(publicIds.map((publicId) => deleteImage(publicId)));
  const deleteResult = productIds.length
    ? await Product.deleteMany({ _id: { $in: productIds }, tags: DEMO_PRODUCT_TAG })
    : { deletedCount: 0 };

  return {
    confirmed: true,
    matched: products.length,
    productNames: products.map((product) => product.name),
    deletedProducts: deleteResult.deletedCount || 0,
    deletedImages: imageResults.filter((result) => result.status === 'fulfilled').length,
    imageDeleteFailures: imageResults.filter((result) => result.status === 'rejected').length,
  };
}

async function main() {
  const confirmed = process.argv.includes(CONFIRM_FLAG);
  await connectDatabase();

  try {
    const report = await removeDemoProducts({ confirmed });

    if (!confirmed) {
      console.log(`Matched demo products: ${report.matched}`);
      if (report.productNames.length) {
        console.log(`Products matched: ${report.productNames.join(', ')}`);
      }
      console.log('No products were deleted.');
      console.log(`Run npm run remove:demo-products -- ${CONFIRM_FLAG} to permanently remove only products tagged ${DEMO_PRODUCT_TAG}.`);
      return;
    }

    console.log('Temporary Amorah demo product removal completed.');
    console.log(`Products matched: ${report.matched}`);
    console.log(`Products deleted: ${report.deletedProducts}`);
    console.log(`Cloudinary images deleted: ${report.deletedImages}`);
    console.log(`Cloudinary image delete failures: ${report.imageDeleteFailures}`);
  } finally {
    await disconnectDatabase();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    console.error(error.message || 'Unable to remove demo products.');
    await disconnectDatabase();
    process.exit(1);
  });
}

export { removeDemoProducts };
