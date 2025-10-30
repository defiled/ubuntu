// Fee calculation engine for cross-border payments

export const FEE_CONFIG = {
  onramp: {
    ach: 0,        // 0% for ACH
    card: 0.029,   // 2.9% for card
  },

  corridor: {
    MXN: 0.010,    // 1.0%
    NGN: 0.020,    // 2.0%
    PHP: 0.015,    // 1.5%
    INR: 0.012,    // 1.2%
    BRL: 0.018,    // 1.8%
  },

  platform: {
    fixed: 2.99,
    percent: 0.005, // 0.5%
    min: 0.99,
    max: 50.00,
  },

  networkGas: 0.05, // Absorbed by platform

  limits: {
    min: 10,
    max: 10000,
  },
} as const;

export type SupportedCurrency = keyof typeof FEE_CONFIG.corridor;
export type PaymentMethod = keyof typeof FEE_CONFIG.onramp;

export interface FeeCalculationInput {
  amount: number;
  paymentMethod: PaymentMethod;
  corridor: SupportedCurrency;
  feeHandling: 'inclusive' | 'additive';
}

export interface FeeBreakdown {
  input_amount: number;
  total_charged: number;
  fees: {
    onramp: number;
    corridor: number;
    platform: number;
    network_gas: number;
    total: number;
  };
  usdc_sent: number;
}

/**
 * Calculate all fees for a payment
 * Fees are calculated deterministically and should be stored immutably
 */
export function calculateFees(params: FeeCalculationInput): FeeBreakdown {
  const { amount, paymentMethod, corridor, feeHandling } = params;

  // Validate amount
  if (amount < FEE_CONFIG.limits.min || amount > FEE_CONFIG.limits.max) {
    throw new Error(
      `Amount must be between $${FEE_CONFIG.limits.min} and $${FEE_CONFIG.limits.max}`
    );
  }

  // Calculate each fee component
  const onrampFee = amount * FEE_CONFIG.onramp[paymentMethod];
  const corridorFee = amount * FEE_CONFIG.corridor[corridor];

  // Platform fee: $2.99 + 0.5%, min $0.99, max $50
  let platformFee =
    FEE_CONFIG.platform.fixed + amount * FEE_CONFIG.platform.percent;
  platformFee = Math.max(
    FEE_CONFIG.platform.min,
    Math.min(platformFee, FEE_CONFIG.platform.max)
  );

  const networkGas = FEE_CONFIG.networkGas;
  const totalFees = onrampFee + corridorFee + platformFee + networkGas;

  // Calculate USDC sent based on fee handling
  const usdcSent = feeHandling === 'inclusive' ? amount - totalFees : amount;

  const totalCharged = feeHandling === 'inclusive' ? amount : amount + totalFees;

  // Round to 2 decimal places
  return {
    input_amount: round(amount),
    total_charged: round(totalCharged),
    fees: {
      onramp: round(onrampFee),
      corridor: round(corridorFee),
      platform: round(platformFee),
      network_gas: round(networkGas),
      total: round(totalFees),
    },
    usdc_sent: round(usdcSent),
  };
}

/**
 * Calculate destination amount given USDC sent and exchange rate
 */
export function calculateDestinationAmount(
  usdcSent: number,
  exchangeRate: number
): number {
  return round(usdcSent * exchangeRate);
}

/**
 * Calculate effective rate (what user actually gets per USD input)
 */
export function calculateEffectiveRate(
  inputAmount: number,
  destinationAmount: number
): number {
  return round(destinationAmount / inputAmount, 6);
}

/**
 * Round to specified decimal places (default 2 for money)
 */
function round(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
