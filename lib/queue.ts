import { Queue } from 'bullmq';
import { redis } from './redis';

// BullMQ requires Redis connection configuration
const connection = {
  host: process.env.REDIS_URL?.includes('://')
    ? new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname
    : 'localhost',
  port: process.env.REDIS_URL?.includes('://')
    ? parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port) || 6379
    : 6379,
};

// Payment Processing Queue
export const paymentQueue = new Queue('payment-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Webhook Delivery Queue
export const webhookQueue = new Queue('webhook-delivery', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Type definitions for job data
export type PaymentJobData = {
  paymentId: string;
};

export type WebhookJobData = {
  paymentId: string;
  eventType: string;
};
