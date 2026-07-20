import http from 'node:http';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import env, { validateEnv } from './config/env.js';

let server;
let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received. Shutting down Amorah API.`);

  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }

  await disconnectDatabase();
  process.exit(exitCode);
}

async function startServer() {
  validateEnv();
  await connectDatabase();

  server = http.createServer(app);
  server.listen(env.port, () => {
    console.log(`Amorah API listening on port ${env.port}.`);
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception.');
  console.error(error);
  shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection.');
  console.error(reason);
  shutdown('unhandledRejection', 1);
});

startServer().catch((error) => {
  console.error(error.message || 'Failed to start Amorah API.');
  process.exit(1);
});
