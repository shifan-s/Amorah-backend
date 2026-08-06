import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/database.js';
import Product from '../src/models/Product.js';

const poses = ['front', 'side', 'back'];

async function migrate() {
  await connectDatabase();
  const products = await Product.find({ 'variants.0': { $exists: true } });
  let updatedProducts = 0;
  const incomplete = [];

  for (const product of products) {
    const updates = {};

    product.variants.forEach((variant, variantIndex) => {
      if (variant.images.length !== 3) {
        incomplete.push(`${product.slug}: ${variant.colourName} (${variant.images.length} images)`);
        return;
      }

      variant.images
        .map((image, originalIndex) => ({ image, originalIndex }))
        .sort((a, b) => a.image.sortOrder - b.image.sortOrder)
        .forEach(({ image, originalIndex }, index) => {
          if (!image.pose) {
            updates[`variants.${variantIndex}.images.${originalIndex}.pose`] = poses[index];
            updates[`variants.${variantIndex}.images.${originalIndex}.sortOrder`] = index;
            updates[`variants.${variantIndex}.images.${originalIndex}.isPrimary`] = index === 0;
          }
        });
    });

    if (Object.keys(updates).length) {
      await Product.updateOne({ _id: product._id }, { $set: updates });
      updatedProducts += 1;
    }
  }

  console.log(`Assigned poses for ${updatedProducts} product(s).`);
  if (incomplete.length) {
    console.log('Variants requiring manual completion:');
    incomplete.forEach((entry) => console.log(`- ${entry}`));
  }
}

migrate()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
