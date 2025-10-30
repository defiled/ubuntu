import { redis } from '@/lib/redis';

const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
const CACHE_TTL = 30; // 30 seconds

// Fallback rates in case API is unavailable
const FALLBACK_RATES: Record<string, number> = {
  MXN: 17.234,
  NGN: 745.50,
  PHP: 56.75,
  INR: 83.25,
  BRL: 4.95,
};

/**
 * Get exchange rate from USD to target currency
 * Fetches from real API and caches in Redis for 30 seconds
 */
export async function getExchangeRate(
  from: string,
  to: string
): Promise<number> {
  if (from !== 'USD') {
    throw new Error('Only USD as source currency is supported');
  }

  const cacheKey = `rate:${from}:${to}`;

  try {
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return parseFloat(cached);
    }

    // Fetch from real API
    const response = await fetch(EXCHANGE_API_URL, {
      next: { revalidate: CACHE_TTL },
    });

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.rates[to];

    if (!rate) {
      throw new Error(`No exchange rate found for ${to}`);
    }

    // Cache for 30 seconds
    await redis.setex(cacheKey, CACHE_TTL, rate.toString());

    return rate;
  } catch (error) {
    console.warn(`Failed to fetch exchange rate for ${to}, using fallback:`, error);

    // Use fallback rate
    if (to in FALLBACK_RATES) {
      return FALLBACK_RATES[to];
    }

    throw new Error(`No exchange rate available for ${to}`);
  }
}
