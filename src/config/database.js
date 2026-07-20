import mongoose from 'mongoose';
import env from './env.js';

let listenersRegistered = false;

function registerConnectionListeners() {
  if (listenersRegistered) {
    return;
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection disconnected.');
  });

  mongoose.connection.on('error', () => {
    console.error('MongoDB connection error.');
  });

  listenersRegistered = true;
}

export async function connectDatabase() {
  try {
    registerConnectionListeners();
    await mongoose.connect(env.mongoUri);
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('Unable to connect to MongoDB.');
    throw error;
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}
