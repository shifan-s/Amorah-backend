import mongoose from 'mongoose';

const urlPattern = /^https?:\/\/.+/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          return !value || urlPattern.test(value);
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
      trim: true,
      maxlength: [120, 'Image alt text must be at most 120 characters'],
    },
  },
  { _id: false },
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters'],
      maxlength: [80, 'Category name must be at most 80 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      lowercase: true,
      trim: true,
      unique: true,
      validate: {
        validator(value) {
          return slugPattern.test(value);
        },
        message: 'Slug must be lowercase and URL safe',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be at most 500 characters'],
      default: '',
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    level: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },
    image: {
      type: imageSchema,
      default: undefined,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    showOnHomepage: {
      type: Boolean,
      default: false,
    },
    showInNavigation: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      min: [0, 'Display order must be at least 0'],
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

categorySchema.index({ parent: 1, displayOrder: 1, name: 1 });
categorySchema.index({ level: 1, isActive: 1 });
categorySchema.index({ showOnHomepage: 1, isActive: 1 });
categorySchema.index({ showInNavigation: 1, isActive: 1 });

function toSafeParent(parent) {
  if (!parent) {
    return null;
  }

  if (parent.name) {
    return {
      id: parent._id.toString(),
      name: parent.name,
      slug: parent.slug,
    };
  }

  return {
    id: parent.toString(),
  };
}

categorySchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    description: this.description,
    parent: toSafeParent(this.parent),
    level: this.level,
    image: this.image,
    isFeatured: this.isFeatured,
    showOnHomepage: this.showOnHomepage,
    showInNavigation: this.showInNavigation,
    displayOrder: this.displayOrder,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Category = mongoose.model('Category', categorySchema);

export default Category;
