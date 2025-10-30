# Setup Guide - Troubleshooting & Production

> For quick start instructions, see [README.md](README.md#getting-started)

This guide covers advanced setup topics, troubleshooting, and production deployment.

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
