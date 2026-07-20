import '../src/config/env.js';
import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import { createProduct } from '../src/services/productService.js';
import { uploadImages, deleteImage } from '../src/services/uploadService.js';
import { DEMO_PRODUCT_TAG, buildSizes, demoProducts } from './demoProductData.js';
import { makeDemoImageFiles } from './demoProductImages.js';

function idString(value) {
  return value?._id ? value._id.toString() : value?.toString();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function loadCategoryMap() {
  const slugs = unique(demoProducts.flatMap((product) => [product.mainCategorySlug, product.subcategorySlug]));
  const categories = await Category.find({ slug: { $in: slugs }, isActive: true });
  return new Map(categories.map((category) => [category.slug, category]));
}

function assertCategoriesReady(categoryMap) {
  const missing = [];

  demoProducts.forEach((product) => {
    const mainCategory = categoryMap.get(product.mainCategorySlug);
    const subcategory = categoryMap.get(product.subcategorySlug);

    if (!mainCategory) {
      missing.push(product.mainCategorySlug);
    }

    if (!subcategory) {
      missing.push(product.subcategorySlug);
    }

    if (mainCategory && mainCategory.level !== 0) {
      missing.push(`${product.mainCategorySlug} must be a main category`);
    }

    if (subcategory && subcategory.level !== 1) {
      missing.push(`${product.subcategorySlug} must be a subcategory`);
    }

    if (mainCategory && subcategory && idString(subcategory.parent) !== idString(mainCategory._id)) {
      missing.push(`${product.subcategorySlug} must belong to ${product.mainCategorySlug}`);
    }
  });

  if (missing.length) {
    throw new Error(
      `Required active categories are missing or incompatible: ${unique(missing).join(', ')}. Run the existing catalogue setup or create these categories before seeding demo products.`,
    );
  }
}

function buildVariant(product, images) {
  return {
    sku: `${product.skuPrefix}-01`,
    colourName: product.colourName,
    colourHex: product.colourHex,
    images: images.map((image, index) => ({
      url: image.secureUrl || image.url,
      publicId: image.publicId,
      alt: `${product.name} ${index === 0 ? 'main product image' : `product image ${index + 1}`}`,
      sortOrder: index,
      isPrimary: index === 0,
    })),
    sizes: buildSizes(product),
    active: true,
  };
}

function buildPayload(product, categoryMap, images) {
  return {
    name: product.name,
    slug: product.slug,
    skuPrefix: product.skuPrefix,
    mainCategory: idString(categoryMap.get(product.mainCategorySlug)._id),
    subcategory: idString(categoryMap.get(product.subcategorySlug)._id),
    productType: product.productType,
    style: product.style,
    fabric: product.fabric,
    occasion: product.occasion,
    tags: product.tags,
    shortDescription: product.shortDescription,
    description: product.description,
    regularPrice: product.regularPrice,
    salePrice: product.salePrice,
    variants: [buildVariant(product, images)],
    fabricDetails: product.fabricDetails,
    fit: product.fit,
    careInstructions: product.careInstructions,
    status: 'active',
    featured: product.featured,
    newArrival: product.newArrival,
    bestSeller: product.bestSeller,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
  };
}

async function cleanupUploadedImages(images) {
  const publicIds = unique(images.map((image) => image.publicId));
  await Promise.allSettled(publicIds.map((publicId) => deleteImage(publicId)));
}

async function seedDemoProducts() {
  const report = {
    created: [],
    skipped: [],
    failed: [],
  };
  const categoryMap = await loadCategoryMap();
  assertCategoriesReady(categoryMap);

  const existingProducts = await Product.find({
    $or: [
      { slug: { $in: demoProducts.map((product) => product.slug) } },
      { tags: DEMO_PRODUCT_TAG },
    ],
  }).select('name slug tags');
  const existingSlugs = new Set(existingProducts.map((product) => product.slug));

  for (const product of demoProducts) {
    if (existingSlugs.has(product.slug)) {
      report.skipped.push(product.name);
      continue;
    }

    let uploadedImages = [];

    try {
      uploadedImages = await uploadImages(makeDemoImageFiles(product), 'product', `client-demo-${product.slug}`);
      const payload = buildPayload(product, categoryMap, uploadedImages);
      await createProduct(payload, null);
      report.created.push(product.name);
    } catch (error) {
      if (uploadedImages.length) {
        await cleanupUploadedImages(uploadedImages);
      }

      report.failed.push({ name: product.name, message: error.message || 'Unknown error' });
    }
  }

  return report;
}

async function main() {
  await connectDatabase();

  try {
    const existingDemoCount = await Product.countDocuments({ tags: DEMO_PRODUCT_TAG });
    const report = await seedDemoProducts();

    console.log('Temporary Amorah demo product seed completed.');
    console.log(`Demo products already present before seed: ${existingDemoCount}`);
    console.log(`Created: ${report.created.length}`);
    console.log(`Skipped existing: ${report.skipped.length}`);
    console.log(`Failed: ${report.failed.length}`);

    if (report.created.length) {
      console.log(`Products added: ${report.created.join(', ')}`);
    }

    if (report.skipped.length) {
      console.log(`Products skipped: ${report.skipped.join(', ')}`);
    }

    if (report.failed.length) {
      report.failed.forEach((failure) => console.log(`Failed ${failure.name}: ${failure.message}`));
      process.exitCode = 1;
    }

    console.log(`Removal tag: ${DEMO_PRODUCT_TAG}`);
  } finally {
    await disconnectDatabase();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    console.error(error.message || 'Unable to seed demo products.');
    await disconnectDatabase();
    process.exit(1);
  });
}

export { seedDemoProducts };
