import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Variant is required'],
    },
    sizeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Size is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator(value) {
          return Number.isInteger(value);
        },
        message: 'Quantity must be an integer',
      },
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false },
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      unique: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
