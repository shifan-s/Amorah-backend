import mongoose from 'mongoose';

const paymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
const refundStatuses = ['none', 'required', 'initiating', 'pending', 'processed', 'failed'];
const inventoryRestorationStatuses = ['not_required', 'pending', 'completed', 'failed'];
const invoiceDocumentTypes = ['receipt', 'invoice', 'tax_invoice'];
const orderStatuses = [
  'pending_payment',
  'payment_failed',
  'payment_review',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'return_requested',
  'returned',
  'refund_initiated',
  'refunded',
];

const addressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'India' },
    addressType: { type: String, trim: true, default: 'Home' },
  },
  { _id: false },
);

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: { type: String, required: true, trim: true },
    productSlug: { type: String, required: true, trim: true },
    productImage: {
      url: { type: String, trim: true, default: '' },
      alt: { type: String, trim: true, default: '' },
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    sizeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    sku: { type: String, required: true, trim: true },
    colourName: { type: String, required: true, trim: true },
    colourHex: { type: String, trim: true, default: '' },
    size: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const razorpaySchema = new mongoose.Schema(
  {
    orderId: { type: String, trim: true, default: '' },
    paymentId: { type: String, trim: true, default: '' },
    checkoutSignatureVerified: { type: Boolean, default: false },
    webhookVerified: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    lastPaymentStatus: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const statusTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: orderStatuses,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false },
);

const shipmentSchema = new mongoose.Schema(
  {
    courierName: { type: String, trim: true, maxlength: 120, default: '' },
    trackingNumber: { type: String, trim: true, maxlength: 120, default: '' },
    trackingUrl: { type: String, trim: true, maxlength: 500, default: '' },
    estimatedDeliveryDate: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    outForDeliveryAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { _id: false },
);

const cancellationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['none', 'requested', 'approved', 'rejected', 'refund_required', 'refunded'],
      default: 'none',
    },
    requestReason: { type: String, trim: true, maxlength: 1000, default: '' },
    requestedAt: { type: Date, default: null },
    customerResponse: { type: String, trim: true, maxlength: 1000, default: '' },
    decidedAt: { type: Date, default: null },
  },
  { _id: false },
);

const refundSummarySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: refundStatuses,
      default: 'none',
    },
    amount: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, default: 'INR' },
    razorpayRefundId: { type: String, trim: true, default: '' },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    initiatedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, maxlength: 500, default: '' },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    webhookVerified: { type: Boolean, default: false },
    inventoryRestorationStatus: {
      type: String,
      enum: inventoryRestorationStatuses,
      default: 'not_required',
    },
    inventoryRestoredAt: { type: Date, default: null },
    inventoryRestorationFailureReason: { type: String, trim: true, maxlength: 500, default: '' },
    emailStatus: { type: String, trim: true, default: '' },
    acquirerReference: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true, immutable: true },
    documentType: {
      type: String,
      enum: invoiceDocumentTypes,
      default: 'receipt',
    },
    issuedAt: { type: Date, default: null },
    generatedAt: { type: Date, default: null },
    version: { type: Number, default: 1, min: 1 },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      trim: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required'],
      index: true,
    },
    checkoutIdempotencyKey: {
      type: String,
      required: [true, 'Checkout idempotency key is required'],
      trim: true,
      maxlength: [120, 'Checkout idempotency key is too long'],
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'An order must include at least one item',
      },
    },
    shippingAddress: {
      type: addressSnapshotSchema,
      required: true,
    },
    billingAddress: {
      type: addressSnapshotSchema,
      required: true,
    },
    subtotal: { type: Number, required: true, min: 0 },
    shippingCharge: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, trim: true, default: 'INR' },
    paymentMethod: {
      type: String,
      enum: ['razorpay'],
      default: 'razorpay',
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: paymentStatuses,
      default: 'pending',
      required: true,
    },
    orderStatus: {
      type: String,
      enum: orderStatuses,
      default: 'pending_payment',
      required: true,
    },
    razorpay: {
      type: razorpaySchema,
      default: () => ({}),
    },
    statusTimeline: {
      type: [statusTimelineSchema],
      default: () => [
        {
          status: 'pending_payment',
          message: 'Waiting for online payment',
        },
      ],
    },
    customerNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Customer notes must be at most 500 characters'],
      default: '',
    },
    shipment: {
      type: shipmentSchema,
      default: () => ({}),
    },
    cancellation: {
      type: cancellationSchema,
      default: () => ({}),
    },
    refundSummary: {
      type: refundSummarySchema,
      default: () => ({}),
    },
    invoice: {
      type: invoiceSchema,
      default: () => ({}),
    },
    paymentFailureReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Payment failure reason must be at most 500 characters'],
      default: '',
    },
    paymentInitiatedAt: {
      type: Date,
      default: null,
    },
    paymentCompletedAt: {
      type: Date,
      default: null,
    },
    inventoryApplied: {
      type: Boolean,
      default: false,
    },
    inventoryAppliedAt: {
      type: Date,
      default: null,
    },
    cartCleared: {
      type: Boolean,
      default: false,
    },
    cartClearedAt: {
      type: Date,
      default: null,
    },
    inventoryRestored: {
      type: Boolean,
      default: false,
    },
    inventoryRestoredAt: {
      type: Date,
      default: null,
    },
    paymentReviewReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Payment review reason must be at most 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ 'refundSummary.status': 1 });
orderSchema.index({ 'invoice.number': 1 }, { unique: true, sparse: true });
orderSchema.index({ customer: 1, checkoutIdempotencyKey: 1 }, { unique: true });
orderSchema.index(
  { 'razorpay.orderId': 1 },
  { unique: true, partialFilterExpression: { 'razorpay.orderId': { $type: 'string', $gt: '' } } },
);
orderSchema.index(
  { 'razorpay.paymentId': 1 },
  { unique: true, partialFilterExpression: { 'razorpay.paymentId': { $type: 'string', $gt: '' } } },
);

const Order = mongoose.model('Order', orderSchema);

export default Order;
