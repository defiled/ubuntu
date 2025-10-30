// Supported payment corridors and their configurations

export const CORRIDORS = {
  MXN: { name: 'Mexican Peso', fee_percent: 1.0, symbol: 'MX$', flag: '🇲🇽', locale: 'es-MX' },
  NGN: { name: 'Nigerian Naira', fee_percent: 2.0, symbol: '₦', flag: '🇳🇬', locale: 'en-NG' },
  PHP: { name: 'Philippine Peso', fee_percent: 1.5, symbol: '₱', flag: '🇵🇭', locale: 'en-PH' },
  INR: { name: 'Indian Rupee', fee_percent: 1.2, symbol: '₹', flag: '🇮🇳', locale: 'en-IN' },
  BRL: { name: 'Brazilian Real', fee_percent: 1.8, symbol: 'R$', flag: '🇧🇷', locale: 'pt-BR' },
} as const;

export type SupportedCurrency = keyof typeof CORRIDORS;

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return currency in CORRIDORS;
}

export function getCurrencyInfo(currency: SupportedCurrency) {
  return CORRIDORS[currency];
}

/**
 * Format amount in destination currency with proper localization
 */
export function formatDestinationAmount(amount: number, currency: SupportedCurrency): string {
  const info = CORRIDORS[currency];
  // Use locale-aware formatting with proper thousands/decimal separators
  const formatted = amount.toLocaleString(info.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${info.symbol}${formatted}`;
}
