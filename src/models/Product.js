import mongoose from 'mongoose';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const urlPattern = /^https?:\/\/.+/i;

function normalizeUpper(value) {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  return String(value).trim().toUpperCase();
}

function normalizeLower(value) {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  return String(value).trim().toLowerCase();
}

const variantImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
      validate: {
        validator(value) {
          return urlPattern.test(value);
        },
        message: 'Image URL must be a valid HTTP or HTTPS URL',
      },
    },
    publicId: {
      type: String,
      trim: true,
      default: '',
    },
    alt: {
      type: String,
      required: [true, 'Image alt text is required'],
      trim: true,
      maxlength: [180, 'Image alt text must be at most 180 characters'],
    },
    sortOrder: {
      type: Number,
      min: [0, 'Image sort order must be at least 0'],
      default: 0,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: false },
);

const variantSizeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Size name is required'],
      trim: true,
      maxlength: [40, 'Size name must be at most 40 characters'],
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: false },
);

const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, 'Variant SKU is required'],
      trim: true,
      uppercase: true,
      set: normalizeUpper,
      maxlength: [80, 'Variant SKU must be at most 80 characters'],
    },
    colourName: {
      type: String,
      required: [true, 'Colour name is required'],
      trim: true,
      maxlength: [50, 'Colour name must be at most 50 characters'],
    },
    colourHex: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          return !value || hexPattern.test(value);
        },
        message: 'Colour hex must be a valid hex colour',
      },
    },
    images: {
      type: [variantImageSchema],
      default: [],
    },
    sizes: {
      type: [variantSizeSchema],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: false },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [150, 'Product name must be at most 150 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      set: normalizeLower,
      validate: {
        validator(value) {
          return slugPattern.test(value);
        },
        message: 'Slug must be lowercase and URL safe',
      },
    },
    skuPrefix: {
      type: String,
      trim: true,
      uppercase: true,
      set: normalizeUpper,
      maxlength: [30, 'SKU prefix must be at most 30 characters'],
    },
    mainCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Main category is required'],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    productType: {
      type: String,
      trim: true,
      maxlength: [80, 'Product type must be at most 80 characters'],
      default: '',
    },
    style: {
      type: String,
      trim: true,
      maxlength: [80, 'Style must be at most 80 characters'],
      default: '',
    },
    fabric: {
      type: String,
      trim: true,
      maxlength: [80, 'Fabric must be at most 80 characters'],
      default: '',
    },
    occasion: {
      type: String,
      trim: true,
      maxlength: [80, 'Occasion must be at most 80 characters'],
      default: '',
    },
    tags: {
      type: [String],
      default: [],
      set(values) {
        const tags = Array.isArray(values) ? values : [];
        return [...new Set(tags.map((tag) => normalizeLower(tag)).filter(Boolean))].slice(0, 20);
      },
      validate: {
        validator(values) {
          return values.length <= 20 && values.every((tag) => tag.length <= 40);
        },
        message: 'Tags must be 40 characters or less with a maximum of 20 tags',
      },
    },
    shortDescription: {
      type: String,
      required: [true, 'Short description is required'],
      trim: true,
      maxlength: [300, 'Short description must be at most 300 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [5000, 'Description must be at most 5000 characters'],
    },
    regularPrice: {
      type: Number,
      required: [true, 'Regular price is required'],
      min: [0, 'Regular price cannot be negative'],
    },
    salePrice: {
      type: Number,
      min: [0, 'Sale price cannot be negative'],
      default: null,
      validate: {
        validator(value) {
          return value === null || value === undefined || value < this.regularPrice;
        },
        message: 'Sale price must be less than regular price',
      },
    },
    variants: {
      type: [variantSchema],
      required: [true, 'At least one colour variant is required'],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one colour variant is required',
      },
    },
    fabricDetails: {
      type: String,
      trim: true,
      maxlength: [500, 'Fabric details must be at most 500 characters'],
      default: '',
    },
    fit: {
      type: String,
      trim: true,
      maxlength: [200, 'Fit must be at most 200 characters'],
      default: '',
    },
    careInstructions: {
      type: String,
      trim: true,
      maxlength: [500, 'Care instructions must be at most 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    newArrival: {
      type: Boolean,
      default: false,
    },
    bestSeller: {
      type: Boolean,
      default: false,
    },
    ratingAverage: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    ratingCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    salesCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    viewCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [70, 'Meta title must be at most 70 characters'],
      default: '',
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [170, 'Meta description must be at most 170 characters'],
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      select: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ mainCategory: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ status: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ newArrival: 1 });
productSchema.index({ bestSeller: 1 });
productSchema.index({ regularPrice: 1 });
productSchema.index({ salePrice: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ 'variants.sku': 1 }, { unique: true });
productSchema.index({ tags: 1 });
productSchema.index({ productType: 1 });
productSchema.index({ style: 1 });
productSchema.index({ fabric: 1 });
productSchema.index({ occasion: 1 });
productSchema.index({
  name: 'text',
  shortDescription: 'text',
  description: 'text',
  tags: 'text',
  productType: 'text',
  style: 'text',
  fabric: 'text',
});

function toSafeCategory(category) {
  if (!category) {
    return null;
  }

  if (category.name) {
    return {
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      level: category.level,
    };
  }

  return {
    id: category.toString(),
  };
}

function calculateCurrentPrice(product) {
  return product.salePrice !== null && product.salePrice !== undefined ? product.salePrice : product.regularPrice;
}

function calculateDiscountPercentage(product) {
  if (product.salePrice === null || product.salePrice === undefined || product.regularPrice <= 0) {
    return 0;
  }

  return Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100);
}

function normalizeVariantImages(images) {
  const nextImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  if (!nextImages.some((image) => image.isPrimary) && nextImages[0]) {
    nextImages[0].isPrimary = true;
  }

  let primaryFound = false;
  nextImages.forEach((image) => {
    if (image.isPrimary && !primaryFound) {
      primaryFound = true;
      return;
    }

    image.isPrimary = false;
  });

  return nextImages;
}

function transformVariant(variant, publicOnly) {
  if (publicOnly && !variant.active) {
    return null;
  }

  const sizes = (publicOnly ? variant.sizes.filter((size) => size.active) : variant.sizes).map((size) => ({
    id: size._id.toString(),
    name: size.name,
    stock: size.stock,
    active: size.active,
  }));

  return {
    id: variant._id.toString(),
    sku: variant.sku,
    colourName: variant.colourName,
    colourHex: variant.colourHex,
    images: normalizeVariantImages(variant.images).map((image) => ({
      id: image._id.toString(),
      url: image.url,
      publicId: image.publicId,
      alt: image.alt,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
    })),
    sizes,
    active: variant.active,
  };
}

function calculateStock(variants) {
  return variants.reduce((total, variant) => {
    if (!variant.active) {
      return total;
    }

    return (
      total +
      variant.sizes.reduce((sizeTotal, size) => {
        if (!size.active) {
          return sizeTotal;
        }

        return sizeTotal + size.stock;
      }, 0)
    );
  }, 0);
}

function availableColours(variants) {
  return variants
    .filter((variant) => variant.active)
    .map((variant) => ({
      id: variant.id || variant._id.toString(),
      name: variant.colourName,
      hex: variant.colourHex,
      sku: variant.sku,
    }));
}

function availableSizes(variants) {
  return [
    ...new Set(
      variants
        .filter((variant) => variant.active)
        .flatMap((variant) => variant.sizes.filter((size) => size.active && size.stock > 0).map((size) => size.name)),
    ),
  ];
}

function toProductObject(product, { publicOnly = false } = {}) {
  const variants = product.variants.map((variant) => transformVariant(variant, publicOnly)).filter(Boolean);
  const totalStock = calculateStock(variants);
  const response = {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    mainCategory: toSafeCategory(product.mainCategory),
    subcategory: toSafeCategory(product.subcategory),
    productType: product.productType,
    style: product.style,
    fabric: product.fabric,
    occasion: product.occasion,
    tags: product.tags,
    shortDescription: product.shortDescription,
    description: product.description,
    regularPrice: product.regularPrice,
    salePrice: product.salePrice,
    currentPrice: calculateCurrentPrice(product),
    discountPercentage: calculateDiscountPercentage(product),
    isOnSale: product.salePrice !== null && product.salePrice !== undefined,
    variants,
    fabricDetails: product.fabricDetails,
    fit: product.fit,
    careInstructions: product.careInstructions,
    featured: product.featured,
    newArrival: product.newArrival,
    bestSeller: product.bestSeller,
    ratingAverage: product.ratingAverage,
    ratingCount: product.ratingCount,
    totalStock,
    inStock: totalStock > 0,
    availableColours: availableColours(variants),
    availableSizes: availableSizes(variants),
    createdAt: product.createdAt,
  };

  if (!publicOnly) {
    response.skuPrefix = product.skuPrefix;
    response.status = product.status;
    response.salesCount = product.salesCount;
    response.viewCount = product.viewCount;
    response.metaTitle = product.metaTitle;
    response.metaDescription = product.metaDescription;
    response.updatedAt = product.updatedAt;
  }

  return response;
}

productSchema.methods.toPublicObject = function toPublicObject() {
  return toProductObject(this, { publicOnly: true });
};

productSchema.methods.toAdminObject = function toAdminObject() {
  return toProductObject(this);
};

const Product = mongoose.model('Product', productSchema);

export default Product;
