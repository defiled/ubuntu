# Cross-Border Payment API

A production-quality demo of a USD → multi-currency payment platform with complete event traceability, real-time observability, and industry-standard patterns from Stripe, Coinbase, and Circle.

## Features

- **Real-time UI Dashboard**: Live payment tracking with Server-Sent Events (SSE)
- **Idempotent APIs**: Industry-standard idempotency implementation
- **Complete Observability**: Every state change logged and visible
- **Mock Providers**: Zero-cost demo with easy swap to Stripe
- **75%+ Cost Savings**: Compared to traditional banking (SWIFT)
- **Production-Ready**: Full error handling, retry logic, and webhook delivery

## Tech Stack

- **Framework**: Next.js 14.2+ (App Router, TypeScript)
- **Database**: PostgreSQL 16 + Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **UI**: Tailwind CSS + shadcn/ui
- **Validation**: Zod
- **Real-time**: Server-Sent Events (SSE)

## Quick Start

### Prerequisites

- Node.js 20.x LTS
- Docker & Docker Compose
- pnpm (or npm/yarn)

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables (first time only)
cp .env.example .env

# Start PostgreSQL and Redis (via Docker Compose)
pnpm docker:up

# Run database migrations
pnpm db:migrate

# Generate Prisma Client
pnpm db:generate
```

### Development

```bash
# Start Next.js + Workers (one command!)
pnpm dev

# Open browser
open http://localhost:3000
```

The app will be available at `http://localhost:3000/wallet`

**What `pnpm dev` does:**
- Starts Next.js dev server (port 3000)
- Starts background workers (payment processor + webhooks)
- Both run in parallel with colored output

**Other useful commands:**
```bash
pnpm docker:logs    # View PostgreSQL/Redis logs
pnpm docker:down    # Stop containers
pnpm docker:clean   # Stop containers and remove volumes
pnpm dev:api        # Run only Next.js (no workers)
pnpm dev:workers    # Run only workers (no Next.js)
```

## Project Structure

```
/
├── app/                          # Next.js App Router
│   ├── api/v1/                   # REST API endpoints
│   │   ├── quote/                # POST - Get fee quote
│   │   ├── initiate/             # POST - Create payment (idempotent)
│   │   ├── confirm/              # POST - Confirm payment (idempotent)
│   │   └── events/[id]/          # GET - SSE event stream
│   └── wallet/                   # UI pages
│       ├── page.tsx              # Dashboard
│       └── [paymentId]/page.tsx  # Payment detail
├── lib/                          # Core utilities
│   ├── db.ts                     # Prisma client
│   ├── redis.ts                  # Redis client
│   ├── queue.ts                  # BullMQ setup
│   ├── fee-engine.ts             # Fee calculation
│   ├── idempotency.ts            # Idempotency middleware
│   └── utils.ts                  # Helpers
├── mocks/                        # Mock providers
│   ├── providers/
│   │   ├── onramp.ts             # Mock ACH/card → USDC
│   │   ├── offramp.ts            # Mock USDC → local currency
│   │   └── exchange.ts           # Real-time exchange rates
│   └── config/
│       ├── corridors.ts          # Supported currencies
│       └── user-balance.ts       # Mock balance
├── workers/                      # Background processors
│   ├── payment-processor.ts     # Orchestrates payment flow
│   ├── webhook-delivery.ts      # Delivers webhooks
│   └── index.ts                 # Entry point
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   └── wallet/                   # Payment UI
│       ├── PaymentForm.tsx       # Send money form
│       └── EventLog.tsx          # Real-time event timeline
├── prisma/
│   └── schema.prisma             # Database schema
└── types/
    └── index.ts                  # Shared TypeScript types
```

## Payment Flow

```
1. User enters amount and selects currency
   ↓
2. Frontend fetches quote (/api/v1/quote)
   ↓
3. User confirms → POST /api/v1/initiate (idempotent)
   - Creates Payment record
   - Status: INITIATED
   ↓
4. Frontend calls POST /api/v1/confirm (idempotent)
   - Validates balance
   - Enqueues BullMQ job
   - Status: CONFIRMED
   ↓
5. Worker processes payment
   - Onramp: ACH/card → USDC (1-2s delay)
   - Status: ONRAMP_COMPLETED
   - Offramp: USDC → local currency (1-2s delay)
   - Status: OFFRAMP_COMPLETED
   - Final: COMPLETED
   ↓
6. Frontend receives real-time events via SSE
   - Updates UI automatically
   - Shows transaction IDs and amounts
```

## API Endpoints

### POST /api/v1/quote
Get fee breakdown and exchange rate (stateless, no DB write)

**Request**:
```json
{
  "amount": 100,
  "destination_currency": "MXN",
  "payment_method": "ach",
  "fee_handling": "inclusive"
}
```

**Response**:
```json
{
  "quote_id": "uuid",
  "expires_at": "2025-10-28T12:01:00Z",
  "exchange_rate": 17.234,
  "breakdown": {
    "input_amount": 100,
    "fees": { "total": 4.54 },
    "usdc_sent": 95.46,
    "destination_amount": 1644.84
  }
}
```

### POST /api/v1/initiate
Create payment record (idempotent)

**Headers**: `Idempotency-Key: <uuid>`

**Request**:
```json
{
  "quote_id": "uuid",
  "amount": 100,
  "destination_currency": "MXN",
  "payment_method": "ach",
  "fee_handling": "inclusive"
}
```

### POST /api/v1/confirm
Trigger payment processing (idempotent)

**Headers**: `Idempotency-Key: <uuid>` (different from initiate)

**Request**:
```json
{
  "payment_id": "abc123"
}
```

### GET /api/v1/events/:paymentId
Real-time event stream (Server-Sent Events)

**Response** (text/event-stream):
```
event: payment.event
data: {"eventType":"onramp.completed","status":"ONRAMP_COMPLETED",...}
```

## Supported Currencies

| Currency | Code | Fee | Symbol |
|----------|------|-----|--------|
| Mexican Peso | MXN | 1.0% | $ |
| Nigerian Naira | NGN | 2.0% | ₦ |
| Philippine Peso | PHP | 1.5% | ₱ |
| Indian Rupee | INR | 1.2% | ₹ |
| Brazilian Real | BRL | 1.8% | R$ |

## Fee Structure

### Onramp Fees
- ACH: 0%
- Card: 2.9%

### Corridor Fees
- Currency-specific (see table above)

### Platform Fee
- $2.99 + 0.5%
- Min: $0.99
- Max: $50.00

### Network Gas
- $0.05 (absorbed by platform)

### Example (100 USD → MXN via ACH)
```
Input:        $100.00
Onramp:         $0.00 (ACH is free)
Corridor:       $1.00 (1.0%)
Platform:       $3.49
Network:        $0.05
─────────────────────
Total Fees:     $4.54
USDC Sent:     $95.46
Rate:          17.234
─────────────────────
Recipient:  1,644.84 MXN
```

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/payment_demo"

# Redis
REDIS_URL="redis://localhost:6379"

# Secrets
WEBHOOK_SECRET="your-webhook-secret-key"

# APIs (optional)
EXCHANGE_RATE_API_KEY="optional"

# Feature Flags
ENABLE_WEBHOOKS=true
```

## Scripts

```bash
# Development
pnpm dev              # Start Next.js dev server
pnpm workers          # Start background workers

# Database
pnpm db:migrate       # Run migrations
pnpm db:generate      # Generate Prisma Client
pnpm db:studio        # Open Prisma Studio

# Production
pnpm build            # Build for production
pnpm start            # Start production server
```

## Production Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
pnpm i -g vercel

# Deploy
vercel --prod

# Add environment variables in Vercel dashboard
```

**Requirements**:
- Use Vercel Postgres or external PostgreSQL
- Use Upstash Redis
- Deploy workers separately (e.g., Railway, Render)

### Database Scaling
- Connection pooling: PgBouncer
- Read replicas for high traffic
- Index optimization (already included)

### Worker Scaling
- Horizontal scaling: Run multiple worker processes
- BullMQ supports distributed workers out of the box
- Monitor queue depth and job latency

## Transitioning to Production (Stripe)

### 1. Install Stripe SDK
```bash
pnpm add stripe
```

### 2. Replace Mock Onramp
```typescript
// Before (mocks/providers/onramp.ts)
const result = await mockOnramp({ amount, method });

// After (lib/stripe.ts)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount * 100),
  currency: 'usd',
  payment_method_types: ['us_bank_account', 'card'],
});
```

### 3. Replace Mock Offramp
```typescript
// Before (mocks/providers/offramp.ts)
const result = await mockOfframp({ usdc, currency });

// After (lib/stripe.ts)
const payout = await stripe.payouts.create({
  amount: Math.round(localAmount * 100),
  currency: currency.toLowerCase(),
  destination: recipientBankAccountId,
});
```

### 4. Setup Requirements
- Stripe Connect account (2-3 weeks for verification)
- Business bank account
- KYC/KYB documentation
- Production API keys

### 5. Cost Comparison
- **Demo**: $0
- **Production**: ~1.5% per transaction
- **Traditional Bank (SWIFT)**: 3-6% + fixed fees
- **Savings**: 75%+

## Testing

### Manual Testing Flow
1. Open `http://localhost:3000/wallet`
2. Enter amount (e.g., $100)
3. Select currency (e.g., MXN)
4. Choose payment method (ACH or Card)
5. Click "Send Payment"
6. Watch real-time events on detail page

### Expected Behavior
- Quote updates as you type (debounced 300ms)
- Payment completes in 2-4 seconds
- Events appear in real-time
- ~5% chance of onramp failure (to test error handling)
- ~3% chance of offramp failure

### Database Inspection
```bash
pnpm db:studio
# Browse Payment, Event, and WebhookDelivery tables
```

## Troubleshooting

### Workers not processing jobs
- Check Redis connection: `redis-cli ping`
- Verify workers are running: `pnpm workers`
- Check BullMQ logs in worker terminal

### Events not streaming
- Check SSE connection in browser DevTools (Network tab)
- Look for `text/event-stream` response
- Verify payment exists in database

### Database connection errors
- Check DATABASE_URL in `.env.local`
- Verify PostgreSQL is running: `psql -U postgres -l`
- Run migrations: `pnpm db:migrate`

### Exchange rate failures
- Check Redis connection
- Fallback rates are hardcoded (see `mocks/providers/exchange.ts`)
- API rate limit: ~1500 requests/day (free tier)

## Architecture Decisions

### Why Next.js App Router?
- Server Actions for simplified API calls
- React Server Components for better performance
- Built-in API routes without separate backend

### Why BullMQ over alternatives?
- Redis-backed (already using Redis for cache)
- Built-in retry logic and exponential backoff
- Excellent TypeScript support
- Production-proven (Vercel, Auth0, etc.)

### Why SSE over WebSockets?
- Simpler implementation (one-way streaming)
- Lower overhead
- Native browser support
- Automatic reconnection

### Why Mock Providers?
- Zero-cost demo
- No KYC/compliance delays
- Easy to swap for real APIs
- Controlled failure rates for testing

## Documentation

- [CLAUDE.md](CLAUDE.md) - Guidance for Claude Code instances
- [Prisma Schema](prisma/schema.prisma) - Database schema
- [Design Spec](original-spec.md) - Complete design specification
- [Mock Providers](mocks/README.md) - Provider documentation

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

---

Built with [Next.js](https://nextjs.org), [Prisma](https://prisma.io), [BullMQ](https://bullmq.io), and [shadcn/ui](https://ui.shadcn.com)
