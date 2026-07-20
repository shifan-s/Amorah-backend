import mongoose from 'mongoose';

export const refundStatuses = ['initiating', 'pending', 'processed', 'failed'];
export const refundInventoryStatuses = ['not_required', 'pending', 'completed', 'failed'];

const refundSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
      index: true,
    },
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      trim: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required'],
      index: true,
    },
    paymentId: {
      type: String,
      required: [true, 'Razorpay payment ID is required'],
      trim: true,
      index: true,
    },
    razorpayRefundId: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Refund amount is required'],
      min: [0, 'Refund amount cannot be negative'],
    },
    currency: {
      type: String,
      trim: true,
      default: 'INR',
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Refund reason must be at most 500 characters'],
      default: '',
    },
    idempotencyKey: {
      type: String,
      required: [true, 'Refund idempotency key is required'],
      trim: true,
      unique: true,
    },
    attemptNumber: {
      type: Number,
      min: 1,
      default: 1,
    },
    status: {
      type: String,
      enum: refundStatuses,
      default: 'initiating',
      required: true,
      index: true,
    },
    speedRequested: {
      type: String,
      trim: true,
      default: 'normal',
    },
    speedProcessed: {
      type: String,
      trim: true,
      default: '',
    },
    webhookVerified: {
      type: Boolean,
      default: false,
    },
    inventoryRestorationStatus: {
      type: String,
      enum: refundInventoryStatuses,
      default: 'pending',
    },
    inventoryRestoredAt: {
      type: Date,
      default: null,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Initiating admin is required'],
    },
    initiatedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    acquirerReference: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

refundSchema.index({ razorpayRefundId: 1 }, { unique: true, sparse: true });
refundSchema.index(
  { order: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['initiating', 'pending', 'processed'] } },
  },
);
refundSchema.index({ createdAt: -1 });

const Refund = mongoose.model('Refund', refundSchema);

export default Refund;
