import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  calculateFees,
  calculateDestinationAmount,
  calculateEffectiveRate,
} from '@/lib/fee-engine';
import { getExchangeRate } from '@/mocks/providers/exchange';
import { randomUUID } from 'crypto';

const quoteSchema = z.object({
  amount: z.number().min(10).max(10000),
  destination_currency: z.enum(['MXN', 'NGN', 'PHP', 'INR', 'BRL']),
  payment_method: z.enum(['ach', 'card']),
  fee_handling: z.enum(['inclusive', 'additive']).optional().default('inclusive'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = quoteSchema.parse(body);

    // Generate quote ID and expiration
    const quoteId = randomUUID();
    const expiresAt = new Date(Date.now() + 60000); // 60 seconds

    // Get real-time exchange rate
    const rate = await getExchangeRate('USD', validated.destination_currency);

    // Calculate fees
    const fees = calculateFees({
      amount: validated.amount,
      paymentMethod: validated.payment_method,
      corridor: validated.destination_currency,
      feeHandling: validated.fee_handling,
    });

    // Calculate destination amount
    const destAmount = calculateDestinationAmount(fees.usdc_sent, rate);

    // Calculate effective rate
    const effectiveRate = calculateEffectiveRate(validated.amount, destAmount);

    return NextResponse.json({
      quote_id: quoteId,
      expires_at: expiresAt.toISOString(),
      exchange_rate: rate,
      breakdown: {
        input_amount: fees.input_amount,
        fees: fees.fees,
        usdc_sent: fees.usdc_sent,
        destination_amount: destAmount,
        effective_rate: effectiveRate,
      },
      margin: fees.fees.platform,
    });
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

    console.error('Quote error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
