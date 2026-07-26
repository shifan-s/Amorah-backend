import mongoose from 'mongoose';

const adminAuditSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

adminAuditSchema.index({ order: 1, createdAt: -1 });
adminAuditSchema.index({ admin: 1, createdAt: -1 });

export default mongoose.model('AdminAudit', adminAuditSchema);
