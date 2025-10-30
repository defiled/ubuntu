import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkIdempotency, storeIdempotency, isUUIDv4 } from '@/lib/idempotency';
import { calculateFees, calculateDestinationAmount } from '@/lib/fee-engine';
import { getExchangeRate } from '@/mocks/providers/exchange';
import { getUserBalance } from '@/mocks/config/user-balance';

const initiateSchema = z.object({
  quote_id: z.string().uuid().optional(), // Optional: for tracking/analytics only
  amount: z.number().min(10).max(10000),
  destination_currency: z.enum(['MXN', 'NGN', 'PHP', 'INR', 'BRL']),
  payment_method: z.enum(['ach', 'card']),
  fee_handling: z.enum(['inclusive', 'additive']),
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
      'initiate',
      DEMO_USER_ID,
      idempotencyKey,
      clonedReq
    );
    if (cached) return cached;

    // 4. Validate request body (using original request)
    const body = await req.json();
    const validated = initiateSchema.parse(body);

    // 4. Check user balance
    const balance = await getUserBalance(DEMO_USER_ID);
    const requiredAmount =
      validated.fee_handling === 'inclusive'
        ? validated.amount
        : validated.amount +
          calculateFees({
            amount: validated.amount,
            paymentMethod: validated.payment_method,
            corridor: validated.destination_currency,
            feeHandling: validated.fee_handling,
          }).fees.total;

    if (balance < requiredAmount) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          message: `Required: $${requiredAmount.toFixed(2)}, Available: $${balance.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // 5. Get fresh exchange rate
    const rate = await getExchangeRate('USD', validated.destination_currency);

    // 6. Calculate fees
    const fees = calculateFees({
      amount: validated.amount,
      paymentMethod: validated.payment_method,
      corridor: validated.destination_currency,
      feeHandling: validated.fee_handling,
    });

    // 7. Calculate destination amount
    const destAmount = calculateDestinationAmount(fees.usdc_sent, rate);

    // 8. Create payment record
    const quoteExpiresAt = new Date(Date.now() + 60000); // 60 seconds

    const payment = await prisma.payment.create({
      data: {
        userId: DEMO_USER_ID,
        status: 'INITIATED',
        amount: validated.amount,
        sourceCurrency: 'USD',
        destCurrency: validated.destination_currency,
        exchangeRate: rate,
        quoteId: validated.quote_id || null, // Optional: store if provided
        quoteExpiresAt,
        onrampFee: fees.fees.onramp,
        corridorFee: fees.fees.corridor,
        platformFee: fees.fees.platform,
        networkGas: fees.fees.network_gas,
        totalFees: fees.fees.total,
        usdcSent: fees.usdc_sent,
        destAmount,
        feeHandling: validated.fee_handling.toUpperCase() as 'INCLUSIVE' | 'ADDITIVE',
      },
    });

    // 9. Create initiation event
    await prisma.event.create({
      data: {
        paymentId: payment.id,
        eventType: 'payment.initiated',
        status: 'INITIATED',
        metadata: {
          quote_id: validated.quote_id,
          amount: validated.amount,
          destination_currency: validated.destination_currency,
        },
      },
    });

    // 10. Prepare response
    const response = NextResponse.json({
      payment_id: payment.id,
      status: payment.status,
      quote_expires_at: payment.quoteExpiresAt?.toISOString(),
    });

    // 11. Store for idempotency (using cloned request)
    await storeIdempotency('initiate', DEMO_USER_ID, idempotencyKey, clonedReq, response);

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

    console.error('Initiate error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
