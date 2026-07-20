import mongoose from 'mongoose';

export const emailEventTypes = [
  'order_confirmation',
  'order_shipped',
  'order_out_for_delivery',
  'order_delivered',
  'cancellation_requested_customer',
  'cancellation_requested_admin',
  'cancellation_approved',
  'cancellation_rejected',
  'refund_initiated',
  'refund_processed',
  'refund_failed',
];

export const emailStatuses = ['pending', 'sending', 'sent', 'failed', 'skipped'];

const emailNotificationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: emailEventTypes,
      required: true,
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    status: {
      type: String,
      enum: emailStatuses,
      default: 'pending',
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      min: 0,
      default: 0,
    },
    messageId: {
      type: String,
      trim: true,
      default: '',
    },
    lastError: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    sentAt: {
      type: Date,
      default: null,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

emailNotificationSchema.index({ createdAt: -1 });

const EmailNotification = mongoose.model('EmailNotification', emailNotificationSchema);

export default EmailNotification;
