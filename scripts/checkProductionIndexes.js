import '../src/config/env.js';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import '../src/models/Cart.js';
import '../src/models/Category.js';
import '../src/models/Counter.js';
import '../src/models/EmailNotification.js';
import '../src/models/Order.js';
import '../src/models/Product.js';
import '../src/models/RazorpayWebhookEvent.js';
import '../src/models/Refund.js';
import '../src/models/User.js';

function stableKeys(keys = {}) {
  return JSON.stringify(Object.entries(keys).sort(([a], [b]) => a.localeCompare(b)));
}

function summarizeIndex(index) {
  return {
    name: index.name || '',
    keys: stableKeys(index.key || {}),
    unique: Boolean(index.unique),
    sparse: Boolean(index.sparse),
    partialFilterExpression: index.partialFilterExpression ? JSON.stringify(index.partialFilterExpression) : '',
  };
}

function expectedIndexes(model) {
  return model.schema.indexes().map(([keys, options = {}]) => ({
    keys: stableKeys(keys),
    unique: Boolean(options.unique),
    sparse: Boolean(options.sparse),
    partialFilterExpression: options.partialFilterExpression ? JSON.stringify(options.partialFilterExpression) : '',
  }));
}

function isMissingCollectionError(error) {
  return error?.codeName === 'NamespaceNotFound' || /ns does not exist/i.test(error?.message || '');
}

async function checkIndexes() {
  await connectDatabase();

  try {
    let missingCount = 0;
    let conflictCount = 0;

    for (const modelName of mongoose.modelNames().sort()) {
      const model = mongoose.model(modelName);
      const expected = expectedIndexes(model);
      let actual = [];

      try {
        actual = (await model.collection.indexes()).map(summarizeIndex);
      } catch (error) {
        if (!isMissingCollectionError(error)) {
          throw error;
        }

        missingCount += expected.length;
        console.log(`${modelName}: collection is missing; expected indexes cannot be verified until data or indexes exist.`);
        continue;
      }

      expected.forEach((expectedIndex) => {
        const matchingKey = actual.find((actualIndex) => actualIndex.keys === expectedIndex.keys);

        if (!matchingKey) {
          missingCount += 1;
          console.log(`${modelName}: missing index ${expectedIndex.keys}`);
          return;
        }

        const conflict =
          matchingKey.unique !== expectedIndex.unique ||
          matchingKey.sparse !== expectedIndex.sparse ||
          matchingKey.partialFilterExpression !== expectedIndex.partialFilterExpression;

        if (conflict) {
          conflictCount += 1;
          console.log(`${modelName}: conflicting index options for ${expectedIndex.keys}`);
        }
      });
    }

    if (missingCount === 0 && conflictCount === 0) {
      console.log('All expected model indexes are present.');
      return;
    }

    console.log(`Index check complete. Missing: ${missingCount}. Conflicting: ${conflictCount}. No changes were made.`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

checkIndexes().catch(async (error) => {
  console.error(error.message || 'Unable to check production indexes.');
  await disconnectDatabase();
  process.exit(1);
});
