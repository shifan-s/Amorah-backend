import mongoose from 'mongoose';

const orderIssueSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    issueType: {
      type: String,
      enum: ['wrong-product', 'wrong-colour', 'wrong-size', 'damaged', 'defective', 'missing-item', 'not-as-described'],
      required: true,
    },
    explanation: { type: String, required: true, trim: true, minlength: 10, maxlength: 1500 },
    evidenceImages: {
      type: [String],
      default: [],
      validate: { validator: (images) => images.length <= 5, message: 'A maximum of five evidence images is allowed' },
    },
    status: { type: String, enum: ['submitted', 'under-review', 'approved', 'rejected', 'resolved'], default: 'submitted' },
    adminDecision: { type: String, trim: true, default: '' },
    adminNotes: { type: String, trim: true, maxlength: 1500, default: '' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

orderIssueSchema.index({ order: 1, customer: 1, product: 1, createdAt: -1 });

export default mongoose.model('OrderIssue', orderIssueSchema);
