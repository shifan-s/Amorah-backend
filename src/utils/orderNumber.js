import Counter from '../models/Counter.js';

export function formatOrderNumber(year, sequence) {
  return `AMR-${year}-${String(sequence).padStart(6, '0')}`;
}

export async function generateOrderNumber(date = new Date()) {
  const year = date.getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { key: `order-${year}` },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return formatOrderNumber(year, counter.sequence);
}
