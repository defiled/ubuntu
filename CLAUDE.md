# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

This is a **production-quality demo** of a cross-border payment platform that converts USD to multiple currencies (MXN, NGN, PHP, INR, BRL) using stablecoin rails (USDC). The system follows industry-standard patterns from Stripe, Coinbase, and Circle, featuring complete event traceability, idempotent APIs, and real-time observability.

**Key Goal**: Demonstrate 75%+ cost savings vs traditional banking while maintaining production-grade code quality.

---

## Technology Stack

- **Framework**: Next.js 14.2+ with App Router (TypeScript 5.3+, Node 20.x LTS)
- **Database**: PostgreSQL 16 with Prisma 5.x ORM
- **Cache/Queue**: Redis 7.x + BullMQ 5.x
- **Validation**: Zod for runtime type safety
- **UI**: Tailwind CSS 3.4+ + shadcn/ui components
- **Real-time**: Server-Sent Events (SSE) for live updates

---

## Development Setup

### Initial Setup
```bash
# Install dependencies
pnpm install

# Setup database
npx prisma migrate dev
npx prisma generate

# Start Redis (Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Start development server
pnpm dev

# Start workers (in separate terminal)
pnpm workers
```

### Common Commands
```bash
# Database migrations
npx prisma migrate dev --name <migration_name>
npx prisma generate                    # Regenerate Prisma Client after schema changes
npx prisma studio                      # Open database GUI

# Development
pnpm dev                               # Start Next.js dev server (port 3000)
pnpm build                             # Production build
pnpm start                             # Start production server

# Testing (if implemented)
pnpm test                              # Run tests
pnpm test:watch                        # Watch mode
```

### Environment Variables Required
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/payment_demo"
REDIS_URL="redis://localhost:6379"
WEBHOOK_SECRET="your-webhook-secret-key"
EXCHANGE_RATE_API_KEY="optional"      # For paid exchange rate API
ENABLE_WEBHOOKS=true
```

---

## System Architecture

### Payment State Machine
The system implements a strict state machine with the following transitions:

```
QUOTED (60s TTL)
  ↓ POST /api/v1/initiate (idempotent)
INITIATED
  ↓ POST /api/v1/confirm (idempotent)
CONFIRMED
  ↓ BullMQ enqueues job
ONRAMP_PENDING
  ↓ Mock provider (~1-2s)
ONRAMP_COMPLETED
  ↓
OFFRAMP_PENDING
  ↓ Mock provider (~1-2s)
OFFRAMP_COMPLETED
  ↓
COMPLETED (terminal)

Alternative terminal state: FAILED
```

**Critical**: Once a payment reaches `CONFIRMED`, it enters asynchronous processing via BullMQ workers. All state changes are logged to the `Event` table and broadcast via SSE.

### Three-Tier Architecture

1. **API Layer** (`/app/api/v1/`)
   - Stateless HTTP endpoints
   - Idempotency enforcement via Redis
   - Zod validation on all inputs
   - Enqueues jobs, never processes payments synchronously

2. **Worker Layer** (`/workers/`)
   - `payment-processor.ts`: Orchestrates onramp → offramp flow
   - `webhook-delivery.ts`: Retries webhook delivery with exponential backoff
   - Runs as separate Node.js processes (not in Next.js)

3. **Mock Provider Layer** (`/mocks/providers/`)
   - Simulates ACH/card onramps, local currency offramps, exchange rates
   - Includes realistic delays (1-2s) and failure rates (3-5%)
   - **Production**: Replace with Stripe API calls (see section below)

### Directory Structure

```
/
├── app/
│   ├── api/v1/                     # REST API endpoints
│   │   ├── quote/route.ts          # GET quote (stateless)
│   │   ├── initiate/route.ts       # Create payment (idempotent)
│   │   ├── confirm/route.ts        # Trigger processing (idempotent)
│   │   └── events/[id]/route.ts    # SSE event stream
│   ├── wallet/                     # UI pages
│   │   ├── page.tsx                # Dashboard
│   │   └── [paymentId]/page.tsx    # Payment detail view
│   └── layout.tsx
├── lib/
│   ├── db.ts                       # Prisma client singleton
│   ├── redis.ts                    # Redis client (ioredis)
│   ├── queue.ts                    # BullMQ setup
│   ├── idempotency.ts              # Idempotency middleware
│   └── fee-engine.ts               # Fee calculation logic
├── mocks/
│   ├── providers/
│   │   ├── onramp.ts               # Mock ACH/card → USDC
│   │   ├── offramp.ts              # Mock USDC → local currency
│   │   └── exchange.ts             # Real-time exchange rates (cached)
│   └── config/
│       ├── corridors.ts            # Supported currencies + fees
│       └── user-balance.ts         # Mock user balance ($10k)
├── workers/
│   ├── payment-processor.ts        # BullMQ worker for payments
│   └── webhook-delivery.ts         # BullMQ worker for webhooks
├── components/
│   ├── ui/                         # shadcn/ui components
│   └── wallet/                     # Custom payment UI
├── prisma/
│   └── schema.prisma               # Database schema
└── types/
    └── index.ts                    # Shared TypeScript types
```

---

## Core Business Logic

### Fee Engine (`lib/fee-engine.ts`)

The fee calculation is **deterministic** and follows this structure:

1. **Onramp Fee**: 0% (ACH) or 2.9% (card)
2. **Corridor Fee**: Currency-specific (1.0% MXN, 2.0% NGN, 1.5% PHP, 1.2% INR, 1.8% BRL)
3. **Platform Fee**: $2.99 + 0.5%, min $0.99, max $50
4. **Network Gas**: $0.05 (absorbed by platform)

**Fee Handling Modes**:
- `INCLUSIVE`: Fees deducted from input amount (default)
- `ADDITIVE`: Fees added on top of input amount

**Example** (100 USD → MXN via ACH, inclusive):
```
Input:        $100.00
Onramp:         $0.00 (ACH is free)
Corridor:       $1.00 (1.0% for MXN)
Platform:       $3.49 ($2.99 + 0.5% of $100)
Network:        $0.05
─────────────────────
Total Fees:     $4.54
USDC Sent:     $95.46
Exchange Rate:  17.234
─────────────────────
Recipient:  1,644.84 MXN
```

**Critical**: Fees are calculated at quote time and stored immutably in the `Payment` table. Never recalculate fees after `INITIATED` state.

### Idempotency (`lib/idempotency.ts`)

**Purpose**: Prevent duplicate payments due to network retries or client-side bugs.

**Implementation**:
- All mutation endpoints (`/initiate`, `/confirm`) require `Idempotency-Key` header (UUID v4)
- Keys are stored in Redis with 24h TTL: `idempotency:{endpoint}:{userId}:{key}`
- Request body is hashed (SHA-256) and stored alongside response
- **Conflict Detection**: Same key + different body → `409 Conflict`
- **Replay Detection**: Same key + same body → Return cached response with `Idempotent-Replayed: true` header

**Example**:
```typescript
// Client sends same request twice
POST /api/v1/initiate
Idempotency-Key: a3f2c8d9-1234-5678-90ab-cdef12345678
{ "quote_id": "xyz", "fee_handling": "inclusive" }

// First request: Creates payment, stores in Redis
Response: 200 OK { "payment_id": "abc123", ... }

// Second request (retry): Returns cached response
Response: 200 OK
Idempotent-Replayed: true
{ "payment_id": "abc123", ... }
```

**Important**: Idempotency keys are scoped by endpoint and user, so the same key can be reused across different endpoints.

### Event System (`prisma/schema.prisma` - Event model)

Every state transition creates an `Event` record with:
- `eventType`: e.g., `"payment.initiated"`, `"onramp.completed"`
- `status`: Current payment status after this event
- `metadata`: Flexible JSON field for event-specific data (e.g., txIds, error messages)
- `timestamp`: Automatically set by database

**Event Types**:
- `payment.quoted`, `payment.initiated`, `payment.confirmed`
- `onramp.pending`, `onramp.completed`, `onramp.failed`
- `offramp.pending`, `offramp.completed`, `offramp.failed`
- `payment.completed`, `payment.failed`

**Webhooks**: Each event triggers a webhook delivery job (BullMQ) with HMAC-SHA256 signature. Webhooks retry up to 3 times with exponential backoff (2s, 4s, 8s).

### Queue Architecture (`lib/queue.ts` + `workers/`)

**BullMQ Queues**:
1. **`payment-processing`**: Orchestrates onramp → offramp flow
2. **`webhook-delivery`**: Delivers webhook events to configured URLs

**Worker Responsibilities**:
- **Payment Processor**:
  1. Update status to `ONRAMP_PENDING`
  2. Call mock onramp provider (ACH/card → USDC)
  3. Update status to `ONRAMP_COMPLETED`, store `onrampTxId`
  4. Update status to `OFFRAMP_PENDING`
  5. Call mock offramp provider (USDC → local currency)
  6. Update status to `OFFRAMP_COMPLETED`, store `offrampTxId`
  7. Update status to `COMPLETED`, set `completedAt` timestamp

- **Webhook Delivery**:
  1. Fetch event payload from database
  2. Sign payload with HMAC-SHA256
  3. POST to configured webhook URL
  4. Retry up to 3 times on failure (exponential backoff)
  5. Update `WebhookDelivery` status to `DELIVERED`, `FAILED`, or `EXHAUSTED`

**Important**: Workers run as **separate Node.js processes**, not within the Next.js runtime. Start them with `pnpm workers`.

---

## API Endpoints

### POST /api/v1/quote (Stateless)
**Purpose**: Get real-time fee breakdown and exchange rate without creating a payment.

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
    "fees": {
      "onramp": 0,
      "corridor": 1.0,
      "platform": 3.49,
      "network_gas": 0.05,
      "total": 4.54
    },
    "usdc_sent": 95.46,
    "destination_amount": 1644.84
  }
}
```

**Notes**: No database write. Quote expires in 60 seconds.

---

### POST /api/v1/initiate (Idempotent)
**Purpose**: Create payment record and reserve quote.

**Headers**: `Idempotency-Key: <uuid>`

**Request**:
```json
{
  "quote_id": "uuid-from-quote",
  "fee_handling": "inclusive"
}
```

**Response**:
```json
{
  "payment_id": "abc123",
  "status": "INITIATED",
  "quote_expires_at": "2025-10-28T12:01:00Z"
}
```

**Side Effects**: Creates `Payment` record, creates `payment.initiated` event.

---

### POST /api/v1/confirm (Idempotent)
**Purpose**: Final balance check and trigger asynchronous processing.

**Headers**: `Idempotency-Key: <uuid>` (must be different from `/initiate`)

**Request**:
```json
{
  "payment_id": "abc123"
}
```

**Response**:
```json
{
  "payment_id": "abc123",
  "status": "CONFIRMED",
  "processing": true
}
```

**Side Effects**:
- Updates status to `CONFIRMED`
- Creates `payment.confirmed` event
- Enqueues `payment-processing` job in BullMQ
- Triggers webhook delivery

**Important**: This endpoint verifies the user has sufficient balance before confirming.

---

### GET /api/v1/events/:paymentId (Server-Sent Events)
**Purpose**: Stream payment events in real-time for UI updates.

**Response** (text/event-stream):
```
event: payment.event
data: {"eventType":"onramp.completed","status":"ONRAMP_COMPLETED","timestamp":"..."}

event: payment.event
data: {"eventType":"offramp.pending","status":"OFFRAMP_PENDING","timestamp":"..."}
```

**Implementation Notes**:
- Polls database every 500ms for new events
- Closes connection when client disconnects
- Sends all historical events on initial connection

---

## Database Schema Highlights

### Payment Model (Core Entity)
- **Immutable Fee Fields**: Once created, `onrampFee`, `corridorFee`, `platformFee`, `networkGas`, `totalFees` never change
- **Provider Tracking**: `onrampTxId` and `offrampTxId` store external transaction IDs
- **Quote Linkage**: `quoteId` and `quoteExpiresAt` track quote validity
- **Timestamps**: `createdAt`, `updatedAt`, `completedAt` for full audit trail

### Event Model (Audit Log)
- **One-to-Many**: Each payment has many events
- **Flexible Metadata**: `metadata` JSON field stores event-specific data (e.g., `{"txId": "onramp_xyz", "error": "..."}`)
- **Cascade Delete**: Events are deleted when parent payment is deleted

### WebhookDelivery Model (Reliability Layer)
- **Retry Logic**: `attempts`, `maxAttempts` (default: 3), `nextRetryAt`
- **Signature**: HMAC-SHA256 signature for webhook verification
- **Response Tracking**: Stores HTTP status and body from webhook endpoint

---

## Mock Providers (Demo Mode)

The `/mocks/providers/` directory simulates real payment providers:

### Onramp (`mocks/providers/onramp.ts`)
- Simulates ACH (free) and card (2.9% fee) deposits
- Adds 1-2 second delay
- 5% failure rate to test error handling
- Returns mock transaction ID: `onramp_<uuid>`

### Offramp (`mocks/providers/offramp.ts`)
- Simulates USDC → local currency conversion
- Fetches real-time exchange rates (cached 30s)
- 3% failure rate for compliance holds
- Returns mock transaction ID: `offramp_<uuid>`

### Exchange Rates (`mocks/providers/exchange.ts`)
- Fetches real rates from `https://api.exchangerate-api.com/v4/latest/USD`
- Caches in Redis for 30 seconds
- Fallback to hardcoded rates if API fails

### User Balance (`mocks/config/user-balance.ts`)
- All users have a mock balance of $10,000
- **Production**: Replace with real database query or API call

---

## Transitioning to Production with Stripe

To replace mocks with Stripe's stablecoin infrastructure:

### 1. Install Stripe SDK
```bash
pnpm add stripe
```

### 2. Replace Onramp
```typescript
// Before (mocks/providers/onramp.ts)
const result = await mockOnramp({ amount, method });

// After (lib/stripe.ts)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amount * 100), // cents
  currency: 'usd',
  payment_method_types: ['us_bank_account', 'card'],
  metadata: { payment_id: paymentId }
});
```

### 3. Replace Offramp
```typescript
// Before (mocks/providers/offramp.ts)
const result = await mockOfframp({ usdc, currency });

// After (lib/stripe.ts)
const payout = await stripe.payouts.create({
  amount: Math.round(localAmount * 100),
  currency: currency.toLowerCase(),
  destination: recipientBankAccountId
});
```

### 4. Setup Requirements (2-3 weeks)
- Stripe Connect account verification (KYC/KYB)
- Link business bank account
- Enable stablecoin payments (request access)
- Configure payout destinations (46+ countries supported)

### 5. Cost Structure
- **Demo**: $0
- **Production**: ~1.5% per transaction (onramp + offramp fees)
- **Break-even**: ~$100k monthly volume
- **Savings vs SWIFT**: 75%+ (typical international wire: 3-6%)

---

## UI Components

### Real-Time Updates
All payment detail pages (`/wallet/[paymentId]`) connect to SSE endpoint:

```typescript
// components/wallet/EventLog.tsx
useEffect(() => {
  const eventSource = new EventSource(`/api/v1/events/${paymentId}`);

  eventSource.addEventListener('payment.event', (e) => {
    const event = JSON.parse(e.data);
    setEvents(prev => [...prev, event]);
  });

  return () => eventSource.close();
}, [paymentId]);
```

### shadcn/ui Components Used
- `Card`, `CardHeader`, `CardContent` - Container layouts
- `Badge` - Status indicators (success, pending, error)
- `Button`, `Input`, `Label` - Form controls
- `Select` - Currency dropdown
- `RadioGroup` - Payment method selection
- `Table` - Event timeline
- `Separator` - Visual dividers

---

## Production Scaling Considerations

### Rate Limiting
- Implement Redis-based rate limiting: 100 req/min per user
- Use `ioredis` with sliding window algorithm

### Database Optimization
- Enable connection pooling (PgBouncer) for >1k concurrent connections
- Add read replicas for high-traffic queries (event logs)
- Index critical columns: `Payment.status`, `Payment.userId`, `Event.paymentId`

### Queue Scaling
- Run multiple worker processes on separate servers
- BullMQ supports horizontal scaling out of the box
- Monitor queue depth and job completion times

### Caching Strategy
- Exchange rates: 30s TTL (already implemented)
- User balances: 5s TTL
- Idempotency keys: 24h TTL (already implemented)

### Monitoring & Observability
- **Errors**: Sentry or similar APM
- **Metrics**: Datadog, Prometheus (queue depth, job latency, API response times)
- **Logs**: Structured logging with Winston or Pino
- **Traces**: OpenTelemetry for distributed tracing

### Security Hardening
- Move `WEBHOOK_SECRET` to AWS Secrets Manager or HashiCorp Vault
- Enable Web Application Firewall (Cloudflare, AWS WAF)
- Implement IP-based rate limiting (Cloudflare Workers)
- Add 2FA for high-value transactions (>$1k)
- PCI compliance audit if handling card data directly

---

## Key Patterns & Conventions

### Error Handling
- All API routes return structured errors: `{ error: string, code?: string }`
- Use Zod for input validation (throws `ZodError` with detailed messages)
- Workers catch errors and update payment status to `FAILED`

### Type Safety
- Prisma generates types automatically (`npx prisma generate`)
- Share types via `/types/index.ts` for cross-layer consistency
- Use Zod schemas for runtime validation + type inference

### Testing Strategy (if implementing)
- Unit tests: Fee engine, idempotency logic
- Integration tests: API endpoints with test database
- E2E tests: Full payment flow with mock providers

### Code Style
- Use Prettier for formatting
- ESLint for linting
- Prefer `async/await` over `.then()`
- Use `const` over `let` where possible

---

## Common Gotchas

1. **Workers Must Run Separately**: BullMQ workers cannot run in Next.js runtime. Use `pnpm workers` or deploy separately.

2. **Quote Expiration**: Quotes expire in 60 seconds. Always check `quoteExpiresAt` before initiating payment.

3. **Idempotency Key Conflicts**: If you get `409 Conflict`, the client sent the same key with different body. This is a client-side bug.

4. **SSE Connection Limits**: Browsers limit SSE connections to ~6 per domain. Close connections when navigating away.

5. **Redis Persistence**: For production, enable Redis persistence (RDB/AOF) to prevent data loss on restart.

6. **Decimal Precision**: Use Prisma's `Decimal` type for money (`@db.Decimal(12,2)`). Never use `Float` for currency.

---

## Additional Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **BullMQ Docs**: https://docs.bullmq.io
- **shadcn/ui**: https://ui.shadcn.com
- **Stripe Payouts API**: https://stripe.com/docs/payouts
- **Idempotency Best Practices**: https://stripe.com/docs/api/idempotent_requests

---

This codebase is designed to be a **production-ready reference implementation** that can be extended for real-world use. Focus on understanding the state machine, idempotency patterns, and event-driven architecture when making changes.
