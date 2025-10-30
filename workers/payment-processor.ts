import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/db';
import { mockOnramp } from '../mocks/providers/onramp';
import { mockOfframp } from '../mocks/providers/offramp';
import { PaymentJobData } from '../lib/queue';

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_URL?.includes('://')
    ? new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname
    : 'localhost',
  port: process.env.REDIS_URL?.includes('://')
    ? parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port) || 6379
    : 6379,
};

console.log('🚀 Starting payment processor worker...');

// Payment Processor Worker
const paymentWorker = new Worker<PaymentJobData>(
  'payment-processing',
  async (job: Job<PaymentJobData>) => {
    const { paymentId } = job.data;

    console.log(`[Payment ${paymentId}] Starting processing...`);

    try {
      // Fetch payment details
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      // Step 1: Onramp (ACH/card → USDC)
      console.log(`[Payment ${paymentId}] Starting onramp...`);
      await updateStatus(paymentId, 'ONRAMP_PENDING');

      const onrampResult = await mockOnramp({
        amount: parseFloat(payment.amount.toString()),
        method: payment.onrampFee.toString() === '0' ? 'ach' : 'card',
        userId: payment.userId,
      });

      await prisma.payment.update({
        where: { id: paymentId },
        data: { onrampTxId: onrampResult.txId },
      });

      await updateStatus(paymentId, 'ONRAMP_COMPLETED', {
        txId: onrampResult.txId,
        usdcReceived: onrampResult.usdcReceived,
      });

      console.log(`[Payment ${paymentId}] Onramp completed: ${onrampResult.txId}`);

      // Step 2: Offramp (USDC → local currency)
      console.log(`[Payment ${paymentId}] Starting offramp...`);
      await updateStatus(paymentId, 'OFFRAMP_PENDING');

      const offrampResult = await mockOfframp({
        usdc: parseFloat(payment.usdcSent.toString()),
        currency: payment.destCurrency,
        userId: payment.userId,
      });

      await prisma.payment.update({
        where: { id: paymentId },
        data: { offrampTxId: offrampResult.txId },
      });

      await updateStatus(paymentId, 'OFFRAMP_COMPLETED', {
        txId: offrampResult.txId,
        localAmount: offrampResult.localAmount,
        currency: offrampResult.currency,
      });

      console.log(`[Payment ${paymentId}] Offramp completed: ${offrampResult.txId}`);

      // Step 3: Complete payment
      await updateStatus(paymentId, 'COMPLETED');
      await prisma.payment.update({
        where: { id: paymentId },
        data: { completedAt: new Date() },
      });

      console.log(`[Payment ${paymentId}] ✅ Processing complete!`);
    } catch (error) {
      console.error(`[Payment ${paymentId}] ❌ Processing failed:`, error);

      await updateStatus(paymentId, 'FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error; // Re-throw to trigger BullMQ retry
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 payments concurrently
  }
);

// Update payment status and create event
async function updateStatus(
  paymentId: string,
  status: string,
  metadata: Record<string, any> = {}
) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: status as any },
  });

  const eventType = status.toLowerCase().replace('_', '.');

  await prisma.event.create({
    data: {
      paymentId,
      eventType,
      status,
      metadata,
    },
  });
}

// Worker event handlers
paymentWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

paymentWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

paymentWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await paymentWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  await paymentWorker.close();
  process.exit(0);
});

export default paymentWorker;
