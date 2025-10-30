import { randomUUID } from 'crypto';
import { getExchangeRate } from './exchange';

export interface OfframpParams {
  usdc: number;
  currency: string;
  userId?: string;
}

export interface OfframpResult {
  txId: string;
  localAmount: number;
  currency: string;
  status: 'completed';
  timestamp: Date;
}

/**
 * Mock offramp provider (USDC → local currency)
 * Simulates realistic delays and occasional compliance holds
 */
export async function mockOfframp(params: OfframpParams): Promise<OfframpResult> {
  const { usdc, currency } = params;

  // Simulate processing delay (4-6 seconds for cross-border rails)
  await delay(randomInt(4000, 6000));

  // Simulate 3% failure rate (compliance holds)
  if (Math.random() < 0.03) {
    throw new Error('Offramp failed: Transaction under compliance review');
  }

  // Get real-time exchange rate
  const rate = await getExchangeRate('USD', currency);
  const localAmount = usdc * rate;

  return {
    txId: `offramp_${randomUUID()}`,
    localAmount: round(localAmount),
    currency,
    status: 'completed',
    timestamp: new Date(),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
