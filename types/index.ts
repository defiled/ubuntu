// Shared types for the application

export type PaymentStatus =
  | 'QUOTED'
  | 'INITIATED'
  | 'CONFIRMED'
  | 'ONRAMP_PENDING'
  | 'ONRAMP_COMPLETED'
  | 'ONRAMP_FAILED'
  | 'OFFRAMP_PENDING'
  | 'OFFRAMP_COMPLETED'
  | 'OFFRAMP_FAILED'
  | 'COMPLETED'
  | 'FAILED';

export type FeeHandling = 'INCLUSIVE' | 'ADDITIVE';

export type SupportedCurrency = 'MXN' | 'NGN' | 'PHP' | 'INR' | 'BRL';

export type PaymentMethod = 'ach' | 'card';

// API Request/Response types

export interface QuoteRequest {
  amount: number;
  destination_currency: SupportedCurrency;
  payment_method: PaymentMethod;
  fee_handling?: 'inclusive' | 'additive';
}

export interface QuoteResponse {
  quote_id: string;
  expires_at: string;
  exchange_rate: number;
  breakdown: {
    input_amount: number;
    fees: {
      onramp: number;
      corridor: number;
      platform: number;
      network_gas: number;
      total: number;
    };
    usdc_sent: number;
    destination_amount: number;
    effective_rate: number;
  };
  margin: number;
}

export interface InitiateRequest {
  quote_id: string;
  fee_handling: 'inclusive' | 'additive';
}

export interface InitiateResponse {
  payment_id: string;
  status: PaymentStatus;
  quote_expires_at: string;
}

export interface ConfirmRequest {
  payment_id: string;
}

export interface ConfirmResponse {
  payment_id: string;
  status: PaymentStatus;
  processing: boolean;
}

export interface PaymentEvent {
  id: string;
  paymentId: string;
  eventType: string;
  status: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  message?: string;
}
