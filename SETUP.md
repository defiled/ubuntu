# Setup Guide

Complete setup guide for the Cross-Border Payment API demo.

## Prerequisites

Before starting, ensure you have:

- **Node.js 20.x LTS** - [Download](https://nodejs.org/)
- **Docker & Docker Compose** - [Download](https://docs.docker.com/get-docker/)
- **pnpm** - Install with `npm install -g pnpm`

## Quick Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment variables
cp .env.example .env

# 3. Start PostgreSQL & Redis
pnpm docker:up

# 4. Run database migrations
pnpm db:migrate
pnpm db:generate

# 5. Start development
pnpm dev
```

Then proceed to [Running the Application](#running-the-application).

---

## Manual Setup

### 1. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install project dependencies
pnpm install
```

### 2. Setup PostgreSQL & Redis

**Using Docker Compose** (Recommended)
```bash
# Start both services
pnpm docker:up

# View logs
pnpm docker:logs

# Check status
docker-compose ps
```

This automatically starts:
- PostgreSQL 16 on port 5432
- Redis 7 on port 6379
- Both with persistent volumes
- Health checks enabled

**Troubleshooting:** If you get a connection error like `role "app_user" does not exist`, you may have a local PostgreSQL instance running on port 5432. Stop it with:
```bash
# For Homebrew installations
brew services stop postgresql@14
brew services stop postgresql@15
brew services stop postgresql@16
# Or find the process and kill it
lsof -i :5432
```

### 3. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

The default values work out of the box with Docker Compose:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/payment_demo"
REDIS_URL="redis://localhost:6379"
WEBHOOK_SECRET="demo-secret-key-change-in-production"
ENABLE_WEBHOOKS=true
```

**Note:** `.env` is gitignored. You can safely add production credentials here when testing against production databases.

### 4. Initialize Database

```bash
# Run migrations
pnpm db:migrate

# Generate Prisma Client
pnpm db:generate
```

Expected output:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your schema
```

### 5. Verify Setup

```bash
# Check Docker services
docker-compose ps

# Should show:
# NAME                IMAGE            STATUS
# payment-postgres    postgres:16      Up (healthy)
# payment-redis       redis:7-alpine   Up (healthy)

# Test database with Prisma Studio
pnpm db:studio
# Opens at http://localhost:5555
```

---

## Running the Application

### Development Mode

**Single command starts everything:**

```bash
pnpm dev
```

Expected output:
```
[api] ▲ Next.js 14.2.x
[api] - Local: http://localhost:3000
[workers] 🚀 Starting payment processor worker...
[workers] 🔔 Starting webhook delivery worker...
[workers] 🎯 All workers started successfully!
```

**What's running:**
- Next.js dev server (cyan output)
- Background workers (magenta output)
- Both with auto-restart on file changes

### Access the Application

Open your browser to:
```
http://localhost:3000/wallet
```

---

## Testing the Payment Flow

### 1. Create a Payment

1. Navigate to `http://localhost:3000/wallet`
2. Enter amount (e.g., `100`)
3. Select currency (e.g., `MXN - Mexican Peso`)
4. Choose payment method (`ACH` or `Card`)
5. Review fee breakdown (updates live as you type)
6. Click **"Send Payment"**

### 2. Watch Real-Time Events

After sending, you'll be redirected to the payment detail page:
```
http://localhost:3000/wallet/{payment-id}
```

You should see:
- ✅ Payment Initiated
- ⏳ Onramp Pending
- ✅ Onramp Completed (1-2 seconds)
- ⏳ Offramp Pending
- ✅ Offramp Completed (1-2 seconds)
- ✅ Payment Completed

Total time: **2-4 seconds**

### 3. Check Worker Logs

In Terminal 2, you should see:
```
[Payment abc123] Starting processing...
[Payment abc123] Starting onramp...
[Payment abc123] Onramp completed: onramp_xyz...
[Payment abc123] Starting offramp...
[Payment abc123] Offramp completed: offramp_xyz...
[Payment abc123] ✅ Processing complete!
```

### 4. Inspect Database

Open Prisma Studio:
```bash
pnpm db:studio
```

Navigate to:
- **Payment** table - See payment record with fees
- **Event** table - See all state transitions
- **WebhookDelivery** table - See webhook attempts

---

## Troubleshooting

### Issue: "Connection refused" (PostgreSQL)

**Solution:**
```bash
# Check if PostgreSQL is running
psql -U postgres -l

# If not running (macOS):
brew services start postgresql@16

# If not running (Linux):
sudo systemctl start postgresql

# If using Docker:
docker ps  # Check if container is running
docker start payment-postgres
```

### Issue: "Connection refused" (Redis)

**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# If not running (macOS):
brew services start redis

# If not running (Linux):
sudo systemctl start redis-server

# If using Docker:
docker start payment-redis
```

### Issue: Workers not processing jobs

**Symptoms:**
- Payment stuck in "CONFIRMED" status
- No logs in worker terminal

**Solution:**
```bash
# 1. Check Redis connection
redis-cli ping

# 2. Restart workers
# Press Ctrl+C in Terminal 2, then:
pnpm workers

# 3. Check BullMQ queues
redis-cli
> KEYS bull:*
> HGETALL bull:payment-processing:meta
```

### Issue: Events not streaming

**Symptoms:**
- Event log shows "Loading events..."
- Browser console shows connection error

**Solution:**
1. Check browser DevTools → Network tab
2. Look for `/api/v1/events/{id}` request
3. Verify response type is `text/event-stream`
4. Check payment exists in database:
   ```bash
   pnpm db:studio
   # Navigate to Payment table
   ```

### Issue: "Quote expired"

**Solution:**
- Quotes expire after 60 seconds
- Generate a new quote by adjusting amount or currency
- Or refresh the page and try again

### Issue: Exchange rate API failures

**Symptoms:**
- Error: "Failed to fetch exchange rate"

**Solution:**
1. Check Redis connection (rates are cached)
2. Verify internet connection (API is external)
3. Check API limits: https://api.exchangerate-api.com
4. Fallback rates are hardcoded in `mocks/providers/exchange.ts`

---

## Production Deployment

### Vercel

1. Install Vercel CLI:
   ```bash
   pnpm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel --prod
   ```

3. Add environment variables in Vercel dashboard:
   - `DATABASE_URL` - Use Vercel Postgres or external DB
   - `REDIS_URL` - Use Upstash Redis
   - `WEBHOOK_SECRET` - Generate secure key
   - `ENABLE_WEBHOOKS` - Set to `true`

4. Deploy workers separately:
   - **Railway**: `railway up`
   - **Render**: Connect GitHub repo
   - **Heroku**: `git push heroku main`

### Database Migration (Production)

```bash
# Generate migration
npx prisma migrate deploy

# Apply to production database
DATABASE_URL="<production-url>" npx prisma migrate deploy
```

### Health Checks

Add these endpoints for monitoring:

**Next.js**: `/api/health`
```typescript
export async function GET() {
  return Response.json({ status: 'ok' });
}
```

**Workers**: Check BullMQ queue depth
```bash
redis-cli
> LLEN bull:payment-processing:wait
```

---

## Database Management

### View data
```bash
pnpm db:studio
```

### Reset database
```bash
# WARNING: Deletes all data
npx prisma migrate reset
```

### Create new migration
```bash
# After editing schema.prisma
npx prisma migrate dev --name <migration-name>
```

### Apply migrations (production)
```bash
npx prisma migrate deploy
```

---

## Development Tips

### Hot Reload Issues

If changes aren't reflected:
```bash
# Restart dev server
Ctrl+C
pnpm dev

# Clear Next.js cache
rm -rf .next
pnpm dev
```

### Prisma Schema Changes

After editing `schema.prisma`:
```bash
pnpm db:migrate
pnpm db:generate
```

### Redis Cache Issues

Clear Redis cache:
```bash
redis-cli FLUSHALL
```

### View BullMQ Jobs

Install BullMQ Board (optional):
```bash
pnpm add -D @bull-board/api @bull-board/express
```

---

## Architecture Overview

```
┌─────────────────┐
│   Browser UI    │ (React + SSE)
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│   Next.js API Routes    │
│  /api/v1/quote          │
│  /api/v1/initiate       │ (idempotent)
│  /api/v1/confirm        │ (idempotent)
│  /api/v1/events/:id     │ (SSE)
└────────┬────────────────┘
         │
    ┌────┼────┬────────┬──────────┐
    ▼    ▼    ▼        ▼          ▼
 Prisma Redis BullMQ  Mocks    Workers
 (PG)         │                   │
              └───────────────────┘
```

---

## Next Steps

1. ✅ Complete setup
2. ✅ Test payment flow
3. 📖 Read [CLAUDE.md](CLAUDE.md) for architecture details
4. 🚀 Ready for production? See [README.md](README.md#transitioning-to-production-stripe)

---

For issues, please check the [Troubleshooting](#troubleshooting) section or open an issue on GitHub.
