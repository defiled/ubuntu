# Mock Providers

This directory contains mock implementations of payment providers for the demo.

## Providers

### Onramp (`providers/onramp.ts`)
- Simulates ACH (free) and card (2.9%) deposits
- Adds realistic 1-2 second delay
- 5% failure rate to test error handling
- Returns mock transaction ID: `onramp_<uuid>`

### Offramp (`providers/offramp.ts`)
- Simulates USDC → local currency conversion
- Fetches real exchange rates (cached 30s)
- 3% failure rate for compliance holds
- Returns mock transaction ID: `offramp_<uuid>`

### Exchange Rates (`providers/exchange.ts`)
- Fetches real rates from exchangerate-api.com
- Caches in Redis for 30 seconds
- Fallback rates if API unavailable

## Configuration

### Corridors (`config/corridors.ts`)
Supported currencies:
- MXN (Mexican Peso) - 1.0% fee
- NGN (Nigerian Naira) - 2.0% fee
- PHP (Philippine Peso) - 1.5% fee
- INR (Indian Rupee) - 1.2% fee
- BRL (Brazilian Real) - 1.8% fee

### User Balance (`config/user-balance.ts`)
- All users have mock balance of $10,000
- No actual deduction in demo mode

## Transitioning to Production

To replace mocks with Stripe:

```typescript
// Before (demo)
import { mockOnramp } from '@/mocks/providers/onramp';
const result = await mockOnramp({ amount, method });

// After (production)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount * 100),
  currency: 'usd',
  payment_method_types: ['us_bank_account', 'card'],
});
```
