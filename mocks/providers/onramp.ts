import { randomUUID } from 'crypto';

export interface OnrampParams {
  amount: number;
  method: 'ach' | 'card';
  userId?: string;
}

export interface OnrampResult {
  txId: string;
  usdcReceived: number;
  status: 'completed';
  timestamp: Date;
}

/**
 * Mock onramp provider (ACH/card → USDC)
 * Simulates realistic delays and occasional failures
 */
export async function mockOnramp(params: OnrampParams): Promise<OnrampResult> {
  const { amount, method } = params;

  // Simulate processing delay (ACH: 3-5 seconds, Card: 2-3 seconds)
  const delayMs = method === 'ach'
    ? randomInt(3000, 5000)  // ACH is slower (bank transfers)
    : randomInt(2000, 3000); // Card is faster (instant but needs verification)
  await delay(delayMs);

  // Simulate 5% failure rate
  if (Math.random() < 0.05) {
    throw new Error('Onramp failed: Insufficient funds in source account');
  }

  // Calculate fee (ACH is free, card is 2.9%)
  const fee = method === 'ach' ? 0 : amount * 0.029;
  const usdcReceived = amount - fee;

  return {
    txId: `onramp_${randomUUID()}`,
    usdcReceived: round(usdcReceived),
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
