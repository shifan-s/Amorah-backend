import '../src/config/env.js';
import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';

export const requiredCatalogue = [
  {
    name: 'Ethnic Wear',
    slug: 'ethnic-wear',
    description: 'Client-approved ethnic clothing collections from Amorah.',
    displayOrder: 10,
    subcategories: [
      { name: 'Churidar Sets', slug: 'churidar-sets', displayOrder: 10 },
      { name: 'Partywear', slug: 'partywear', displayOrder: 20 },
      { name: 'Gowns', slug: 'gowns', displayOrder: 30 },
    ],
  },
  {
    name: 'Western Wear',
    slug: 'western-wear',
    description: 'Client-approved western clothing collections from Amorah.',
    displayOrder: 20,
    subcategories: [
      { name: 'Western Co-ord Sets', slug: 'western-co-ord-sets', displayOrder: 10 },
      { name: 'Knee-Length Tops', slug: 'knee-length-tops', displayOrder: 20 },
      { name: 'Short Tops', slug: 'short-tops', displayOrder: 30 },
      { name: 'Shirts for Girls', slug: 'shirts-for-girls', displayOrder: 40 },
      { name: 'Jeans', slug: 'jeans', displayOrder: 50 },
    ],
  },
  {
    name: 'Hijabs',
    slug: 'hijabs',
    description: 'Client-approved hijab collections from Amorah.',
    displayOrder: 30,
    subcategories: [
      { name: 'Jersey Hijabs', slug: 'jersey-hijabs', displayOrder: 10 },
      { name: 'Shimmer Hijabs', slug: 'shimmer-hijabs', displayOrder: 20 },
      { name: 'Georgette Chiffon Hijabs', slug: 'georgette-chiffon-hijabs', displayOrder: 30 },
    ],
  },
];

export function approvedSlugs(catalogue = requiredCatalogue) {
  return new Set(catalogue.flatMap((category) => [category.slug, ...category.subcategories.map((subcategory) => subcategory.slug)]));
}

function idString(value) {
  if (!value) {
    return '';
  }

  if (value._id) {
    return value._id.toString();
  }

  return value.toString();
}

function needsCategoryUpdate(category, payload) {
  return Object.entries(payload).some(([key, value]) => {
    if (key === 'parent') {
      return idString(category.parent) !== idString(value);
    }

    return category[key] !== value;
  });
}

async function upsertCategory(CategoryModel, payload, report) {
  const existing = await CategoryModel.findOne({ slug: payload.slug });

  if (!existing) {
    const category = await CategoryModel.create(payload);
    report.created.push(category.slug);
    return category;
  }

  if (!needsCategoryUpdate(existing, payload)) {
    report.skipped.push(existing.slug);
    return existing;
  }

  Object.assign(existing, payload);
  await existing.save();
  report.updated.push(existing.slug);
  return existing;
}

export async function setupClientCatalogue({ CategoryModel = Category, ProductModel = Product, catalogue = requiredCatalogue } = {}) {
  const report = {
    created: [],
    updated: [],
    skipped: [],
    deactivatedCategories: [],
    archivedProducts: 0,
  };
  const allowedSlugs = approvedSlugs(catalogue);
  const approvedMainIds = [];
  const approvedSubcategoryIds = [];

  for (const mainCategory of catalogue) {
    const parent = await upsertCategory(
      CategoryModel,
      {
        name: mainCategory.name,
        slug: mainCategory.slug,
        description: mainCategory.description,
        parent: null,
        level: 0,
        isFeatured: true,
        showOnHomepage: true,
        showInNavigation: true,
        displayOrder: mainCategory.displayOrder,
        isActive: true,
      },
      report,
    );

    approvedMainIds.push(parent._id);

    for (const subcategory of mainCategory.subcategories) {
      const child = await upsertCategory(
        CategoryModel,
        {
          name: subcategory.name,
          slug: subcategory.slug,
          description: '',
          parent: parent._id,
          level: 1,
          isFeatured: false,
          showOnHomepage: false,
          showInNavigation: true,
          displayOrder: subcategory.displayOrder,
          isActive: true,
        },
        report,
      );

      approvedSubcategoryIds.push(child._id);
    }
  }

  const categoryResult = await CategoryModel.updateMany(
    { slug: { $nin: [...allowedSlugs] } },
    {
      $set: {
        isActive: false,
        showOnHomepage: false,
        showInNavigation: false,
        isFeatured: false,
      },
    },
  );

  report.deactivatedCategories = categoryResult.modifiedCount || 0;

  const productResult = await ProductModel.updateMany(
    {
      status: { $ne: 'archived' },
      $or: [
        { mainCategory: { $nin: approvedMainIds } },
        { subcategory: null },
        { subcategory: { $nin: approvedSubcategoryIds } },
      ],
    },
    {
      $set: {
        status: 'archived',
        featured: false,
        newArrival: false,
        bestSeller: false,
      },
    },
  );

  report.archivedProducts = productResult.modifiedCount || 0;

  return report;
}

async function main() {
  await connectDatabase();

  try {
    const report = await setupClientCatalogue();
    console.log('Client catalogue setup completed safely.');
    console.log(`Created categories: ${report.created.length ? report.created.join(', ') : 'none'}`);
    console.log(`Updated categories: ${report.updated.length ? report.updated.join(', ') : 'none'}`);
    console.log(`Skipped categories: ${report.skipped.length ? report.skipped.join(', ') : 'none'}`);
    console.log(`Deactivated unrelated categories: ${report.deactivatedCategories}`);
    console.log(`Archived unrelated products: ${report.archivedProducts}`);
    console.log('No categories, products, orders, payments, refunds or invoices were deleted.');
  } finally {
    await disconnectDatabase();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    console.error(error.message || 'Unable to setup client catalogue.');
    await disconnectDatabase();
    process.exit(1);
  });
}
