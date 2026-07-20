import mongoose from 'mongoose';
import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';

function getDatabaseStatus() {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

export const welcome = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Amorah API',
  });
});

export const healthCheck = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Amorah API is healthy',
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
    },
  });
});

export const readinessCheck = asyncHandler(async (req, res) => {
  const database = getDatabaseStatus();
  const ready = database === 'connected';

  res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready ? 'Amorah API is ready' : 'Amorah API is not ready',
    data: {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
      database: getDatabaseStatus(),
    },
  });
});
