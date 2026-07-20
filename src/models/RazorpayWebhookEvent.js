import mongoose from 'mongoose';

const processingStatuses = ['processing', 'processed', 'failed', 'ignored'];

const razorpayWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, 'Webhook event ID is required'],
      trim: true,
      unique: true,
    },
    eventType: {
      type: String,
      trim: true,
      default: '',
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      default: '',
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      default: '',
    },
    processingStatus: {
      type: String,
      enum: processingStatuses,
      default: 'processing',
      required: true,
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

razorpayWebhookEventSchema.index({ razorpayOrderId: 1 });
razorpayWebhookEventSchema.index({ razorpayPaymentId: 1 });

const RazorpayWebhookEvent = mongoose.model('RazorpayWebhookEvent', razorpayWebhookEventSchema);

export default RazorpayWebhookEvent;
