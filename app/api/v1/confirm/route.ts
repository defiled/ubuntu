import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { paymentQueue } from '@/lib/queue';
import { checkIdempotency, storeIdempotency, isUUIDv4 } from '@/lib/idempotency';
import { getUserBalance } from '@/mocks/config/user-balance';

const confirmSchema = z.object({
  payment_id: z.string().uuid(),
});

const DEMO_USER_ID = 'user_001';

export async function POST(req: NextRequest) {
  try {
    // 1. Clone request BEFORE consuming body (to avoid "unusable" error)
    const clonedReq = req.clone();

    // 2. Validate idempotency key
    const idempotencyKey = req.headers.get('idempotency-key');
    if (!idempotencyKey || !isUUIDv4(idempotencyKey)) {
      return NextResponse.json(
        {
          error: 'Invalid idempotency key',
          message: 'Valid Idempotency-Key header (UUID v4) is required',
        },
        { status: 400 }
      );
    }

    // 3. Check idempotency (using cloned request)
    const cached = await checkIdempotency(
      'confirm',
      DEMO_USER_ID,
      idempotencyKey,
      clonedReq
    );
    if (cached) return cached;

    // 4. Validate request body (using original request)
    const body = await req.json();
    const validated = confirmSchema.parse(body);

    // 4. Fetch payment
    const payment = await prisma.payment.findUnique({
      where: { id: validated.payment_id },
    });

    if (!payment) {
      return NextResponse.json(
        {
          error: 'Payment not found',
          message: `No payment found with ID: ${validated.payment_id}`,
        },
        { status: 404 }
      );
    }

    // 5. Verify payment is in INITIATED state
    if (payment.status !== 'INITIATED') {
      return NextResponse.json(
        {
          error: 'Invalid payment status',
          message: `Payment must be in INITIATED status. Current status: ${payment.status}`,
        },
        { status: 400 }
      );
    }

    // 6. Check quote expiration
    if (payment.quoteExpiresAt && payment.quoteExpiresAt < new Date()) {
      return NextResponse.json(
        {
          error: 'Quote expired',
          message: 'The quote has expired. Please create a new payment.',
        },
        { status: 400 }
      );
    }

    // 7. Final balance check (last gate before processing)
    const balance = await getUserBalance(DEMO_USER_ID);
    const requiredAmount =
      payment.feeHandling === 'INCLUSIVE'
        ? parseFloat(payment.amount.toString())
        : parseFloat(payment.amount.toString()) +
          parseFloat(payment.totalFees.toString());

    if (balance < requiredAmount) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          message: `Required: $${requiredAmount.toFixed(2)}, Available: $${balance.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // 8. Update payment status to CONFIRMED
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CONFIRMED' },
    });

    // 9. Create confirmation event
    await prisma.event.create({
      data: {
        paymentId: payment.id,
        eventType: 'payment.confirmed',
        status: 'CONFIRMED',
        metadata: {
          confirmed_at: new Date().toISOString(),
        },
      },
    });

    // 10. Enqueue payment processing job
    await paymentQueue.add('process-payment', {
      paymentId: payment.id,
    });

    // 11. Prepare response
    const response = NextResponse.json({
      payment_id: payment.id,
      status: 'CONFIRMED',
      processing: true,
    });

    // 12. Store for idempotency (using cloned request)
    await storeIdempotency('confirm', DEMO_USER_ID, idempotencyKey, clonedReq, response);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: error.errors[0]?.message || 'Validation failed',
        },
        { status: 400 }
      );
    }

    console.error('Confirm error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
