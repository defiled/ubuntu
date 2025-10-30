# Quick Start Guide

Get the Cross-Border Payment API running in **3 minutes**.

## Prerequisites

- Node.js 20.x
- Docker & Docker Compose

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment variables
cp .env.example .env

# 3. Start PostgreSQL & Redis
pnpm docker:up

# 4. Initialize database
pnpm db:migrate
pnpm db:generate

# 5. Start everything (Next.js + Workers)
pnpm dev
```

### 3. Test Payment

1. Open http://localhost:3000/wallet
2. Enter: **$100 → MXN**
3. Click **"Send Payment"**
4. Watch real-time processing (2-4 seconds)

## That's it!

For detailed setup, see [SETUP.md](SETUP.md)

## Common Issues

### Services not running?
```bash
# Check if containers are up
docker-compose ps

# View logs
pnpm docker:logs

# Restart services
pnpm docker:down
pnpm docker:up
```

### Clean slate needed?
```bash
# Remove containers and volumes (wipes database)
pnpm docker:clean

# Then start fresh
pnpm docker:up
pnpm db:migrate
```

## Project Structure

```
app/
├── api/v1/           # REST API endpoints
│   ├── quote/        # GET quote
│   ├── initiate/     # POST create payment
│   ├── confirm/      # POST trigger processing
│   └── events/[id]/  # GET real-time events (SSE)
└── wallet/           # UI pages

lib/
├── fee-engine.ts     # Fee calculations
├── idempotency.ts    # Idempotency logic
└── queue.ts          # BullMQ setup

workers/
├── payment-processor.ts  # Orchestrates payment flow
└── webhook-delivery.ts   # Delivers webhooks

mocks/
└── providers/        # Mock ACH/card/exchange providers
```

## API Quick Reference

### Get Quote
```bash
curl -X POST http://localhost:3000/api/v1/quote \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "destination_currency": "MXN",
    "payment_method": "ach",
    "fee_handling": "inclusive"
  }'
```

### Initiate Payment
```bash
curl -X POST http://localhost:3000/api/v1/initiate \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "quote_id": "<quote-id>",
    "amount": 100,
    "destination_currency": "MXN",
    "payment_method": "ach",
    "fee_handling": "inclusive"
  }'
```

### Confirm Payment
```bash
curl -X POST http://localhost:3000/api/v1/confirm \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "payment_id": "<payment-id>"
  }'
```

## Supported Currencies

- 🇲🇽 MXN (Mexican Peso) - 1.0% fee
- 🇳🇬 NGN (Nigerian Naira) - 2.0% fee
- 🇵🇭 PHP (Philippine Peso) - 1.5% fee
- 🇮🇳 INR (Indian Rupee) - 1.2% fee
- 🇧🇷 BRL (Brazilian Real) - 1.8% fee

## Next Steps

- 📖 Read [README.md](README.md) for full documentation
- 🏗️ See [SETUP.md](SETUP.md) for detailed setup
- 🧠 Check [CLAUDE.md](CLAUDE.md) for architecture details
