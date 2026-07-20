import mongoose from 'mongoose';
import Category from '../models/Category.js';
import ApiError from '../utils/ApiError.js';

function normalizeText(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureCategoryId(categoryId) {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, 'Invalid category ID', []);
  }
}

function toSafeCategory(category) {
  return category.toSafeObject();
}

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }

    if (a.parent?.id !== b.parent?.id) {
      return String(a.parent?.id || '').localeCompare(String(b.parent?.id || ''));
    }

    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }

    return a.name.localeCompare(b.name);
  });
}

async function findCategory(categoryId) {
  ensureCategoryId(categoryId);

  const category = await Category.findById(categoryId).populate('parent', 'name slug level');

  if (!category) {
    throw new ApiError(404, 'Category not found', []);
  }

  return category;
}

async function getParentCategory(parentId) {
  if (!parentId) {
    return null;
  }

  ensureCategoryId(parentId);

  const parent = await Category.findById(parentId);

  if (!parent || parent.level !== 0) {
    throw new ApiError(400, 'Parent category must be a main category', []);
  }

  return parent;
}

async function ensureSlugAvailable(slug, categoryId) {
  const existing = await Category.findOne({ slug }).select('_id');

  if (existing && existing._id.toString() !== categoryId) {
    throw new ApiError(409, 'Category slug already exists', []);
  }
}

function buildImage(payload) {
  if (!payload.image?.url) {
    return undefined;
  }

  return {
    url: normalizeText(payload.image.url),
    publicId: normalizeText(payload.image.publicId),
    alt: normalizeText(payload.image.alt),
  };
}

function buildCategoryPayload(payload, parent) {
  const isSubcategory = Boolean(parent);
  const slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);

  return {
    name: normalizeText(payload.name),
    slug,
    description: normalizeText(payload.description),
    parent: parent?._id || null,
    level: isSubcategory ? 1 : 0,
    image: buildImage(payload),
    isFeatured: Boolean(payload.isFeatured),
    showOnHomepage: isSubcategory ? false : Boolean(payload.showOnHomepage),
    showInNavigation: payload.showInNavigation === undefined ? true : Boolean(payload.showInNavigation),
    displayOrder: Number.isInteger(payload.displayOrder) ? payload.displayOrder : 0,
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
  };
}

function applyCategoryUpdates(category, payload, parent) {
  const isSubcategory = Boolean(parent);

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    category.name = normalizeText(payload.name);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'slug')) {
    category.slug = payload.slug ? slugify(payload.slug) : slugify(category.name);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    category.description = normalizeText(payload.description);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'parent')) {
    category.parent = parent?._id || null;
    category.level = isSubcategory ? 1 : 0;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'image')) {
    category.image = buildImage(payload);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'isFeatured')) {
    category.isFeatured = Boolean(payload.isFeatured);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'showOnHomepage')) {
    category.showOnHomepage = category.level === 1 ? false : Boolean(payload.showOnHomepage);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'showInNavigation')) {
    category.showInNavigation = Boolean(payload.showInNavigation);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'displayOrder')) {
    category.displayOrder = payload.displayOrder;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    category.isActive = Boolean(payload.isActive);
  }

  if (category.level === 1) {
    category.showOnHomepage = false;
  }
}

function buildFilters(query = {}, publicOnly = false) {
  const filters = {};

  if (publicOnly) {
    filters.isActive = true;
  }

  if (query.search) {
    filters.name = { $regex: query.search, $options: 'i' };
  }

  if (query.type === 'main') {
    filters.level = 0;
  }

  if (query.type === 'subcategory') {
    filters.level = 1;
  }

  if (query.status === 'active') {
    filters.isActive = true;
  }

  if (query.status === 'inactive') {
    filters.isActive = false;
  }

  if (query.showOnHomepage !== undefined) {
    filters.showOnHomepage = query.showOnHomepage;
  }

  if (query.showOnHome !== undefined) {
    filters.showOnHomepage = query.showOnHome;
  }

  if (query.showInNavigation !== undefined) {
    filters.showInNavigation = query.showInNavigation;
  }

  return filters;
}

export async function getAdminCategories(query) {
  const categories = await Category.find(buildFilters(query))
    .populate('parent', 'name slug level')
    .sort({ level: 1, displayOrder: 1, name: 1 });

  const safeCategories = sortCategories(categories.map(toSafeCategory));

  return {
    categories: safeCategories,
    meta: {
      total: safeCategories.length,
    },
  };
}

export async function getAdminCategory(categoryId) {
  const category = await findCategory(categoryId);
  return toSafeCategory(category);
}

export async function createCategory(payload) {
  const parent = await getParentCategory(payload.parent);
  const categoryPayload = buildCategoryPayload(payload, parent);

  await ensureSlugAvailable(categoryPayload.slug);

  const category = await Category.create(categoryPayload);
  await category.populate('parent', 'name slug level');

  return toSafeCategory(category);
}

export async function updateCategory(categoryId, payload) {
  const category = await findCategory(categoryId);
  const parent = Object.prototype.hasOwnProperty.call(payload, 'parent')
    ? await getParentCategory(payload.parent)
    : category.parent;

  if (parent && parent._id.toString() === category._id.toString()) {
    throw new ApiError(400, 'A category cannot be its own parent', []);
  }

  if (parent) {
    const childCount = await Category.countDocuments({ parent: category._id });

    if (childCount > 0) {
      throw new ApiError(400, 'A category with subcategories cannot become a subcategory', []);
    }
  }

  applyCategoryUpdates(category, payload, parent);
  await ensureSlugAvailable(category.slug, category._id.toString());
  await category.save();
  await category.populate('parent', 'name slug level');

  return toSafeCategory(category);
}

export async function deactivateCategory(categoryId) {
  const category = await findCategory(categoryId);

  category.isActive = false;
  category.showOnHomepage = false;
  await category.save();
  await category.populate('parent', 'name slug level');

  return toSafeCategory(category);
}

export async function getPublicCategories(query) {
  const categories = await Category.find(buildFilters(query, true))
    .populate('parent', 'name slug level')
    .sort({ level: 1, displayOrder: 1, name: 1 });

  return sortCategories(categories.map(toSafeCategory));
}

export async function getPublicCategoryBySlug(slug) {
  const category = await Category.findOne({ slug, isActive: true }).populate('parent', 'name slug level');

  if (!category) {
    throw new ApiError(404, 'Category not found', []);
  }

  return toSafeCategory(category);
}
