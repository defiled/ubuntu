import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/db';
import { createHmac } from 'crypto';
import { WebhookJobData } from '../lib/queue';

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_URL?.includes('://')
    ? new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname
    : 'localhost',
  port: process.env.REDIS_URL?.includes('://')
    ? parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port) || 6379
    : 6379,
};

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'demo-secret-key';
const WEBHOOK_ENABLED = process.env.ENABLE_WEBHOOKS === 'true';

console.log('🔔 Starting webhook delivery worker...');
console.log(`Webhooks enabled: ${WEBHOOK_ENABLED}`);

// Webhook Delivery Worker
const webhookWorker = new Worker<WebhookJobData>(
  'webhook-delivery',
  async (job: Job<WebhookJobData>) => {
    if (!WEBHOOK_ENABLED) {
      console.log('Webhooks disabled, skipping delivery');
      return;
    }

    const { paymentId, eventType } = job.data;

    console.log(`[Webhook ${paymentId}] Delivering ${eventType}...`);

    try {
      // Fetch payment and event data
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      // Build webhook payload
      const payload = {
        id: `evt_${Date.now()}`,
        event_type: eventType,
        api_version: '2025-01',
        created_at: new Date().toISOString(),
        data: {
          payment_id: payment.id,
          status: payment.status,
          amount: parseFloat(payment.amount.toString()),
          destination_currency: payment.destCurrency,
          exchange_rate: parseFloat(payment.exchangeRate.toString()),
          fees: {
            onramp: parseFloat(payment.onrampFee.toString()),
            corridor: parseFloat(payment.corridorFee.toString()),
            platform: parseFloat(payment.platformFee.toString()),
            network_gas: parseFloat(payment.networkGas.toString()),
            total: parseFloat(payment.totalFees.toString()),
          },
          usdc_sent: parseFloat(payment.usdcSent.toString()),
          destination_amount: parseFloat(payment.destAmount.toString()),
          onramp_tx_id: payment.onrampTxId,
          offramp_tx_id: payment.offrampTxId,
          created_at: payment.createdAt.toISOString(),
          updated_at: payment.updatedAt.toISOString(),
          completed_at: payment.completedAt?.toISOString(),
        },
      };

      // Sign payload
      const signature = signWebhook(payload);

      // In demo mode, we just log the webhook instead of sending HTTP request
      console.log(`[Webhook ${paymentId}] Payload:`, JSON.stringify(payload, null, 2));
      console.log(`[Webhook ${paymentId}] Signature: ${signature}`);

      // Store webhook delivery record
      await prisma.webhookDelivery.create({
        data: {
          paymentId,
          url: 'https://demo.example.com/webhooks', // Demo URL
          eventType,
          payload,
          status: 'DELIVERED',
          attempts: 1,
          signature,
          responseStatus: 200,
          responseBody: 'OK',
          lastAttemptAt: new Date(),
        },
      });

      console.log(`[Webhook ${paymentId}] ✅ Delivered successfully`);
    } catch (error) {
      console.error(`[Webhook ${paymentId}] ❌ Delivery failed:`, error);

      // Record failed delivery
      await prisma.webhookDelivery.create({
        data: {
          paymentId,
          url: 'https://demo.example.com/webhooks',
          eventType,
          payload: {},
          status: 'FAILED',
          attempts: job.attemptsMade,
          signature: '',
          lastAttemptAt: new Date(),
          nextRetryAt: job.attemptsMade < 3 ? new Date(Date.now() + 2000) : null,
        },
      });

      throw error; // Re-throw to trigger BullMQ retry
    }
  },
  {
    connection,
    concurrency: 10,
  }
);

// Sign webhook payload with HMAC SHA-256
function signWebhook(payload: object): string {
  const body = JSON.stringify(payload);
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

// Worker event handlers
webhookWorker.on('completed', (job) => {
  console.log(`✅ Webhook job ${job.id} completed`);
});

webhookWorker.on('failed', (job, err) => {
  console.error(`❌ Webhook job ${job?.id} failed:`, err.message);
});

webhookWorker.on('error', (err) => {
  console.error('Webhook worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing webhook worker...');
  await webhookWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing webhook worker...');
  await webhookWorker.close();
  process.exit(0);
});

export default webhookWorker;
