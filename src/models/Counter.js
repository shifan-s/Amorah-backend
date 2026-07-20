import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Counter key is required'],
      trim: true,
      unique: true,
    },
    sequence: {
      type: Number,
      required: [true, 'Counter sequence is required'],
      min: [0, 'Counter sequence cannot be negative'],
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
