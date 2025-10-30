import { redis } from './redis';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const TTL = 60 * 60 * 24; // 24 hours

interface CachedResponse {
  requestHash: string;
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Check if an idempotent request has been processed before
 * Returns cached response if found, null if new request
 * Throws error if same key but different body (conflict)
 */
export async function checkIdempotency(
  endpoint: string,
  userId: string,
  key: string,
  request: NextRequest
): Promise<NextResponse | null> {
  const redisKey = `idempotency:${endpoint}:${userId}:${key}`;
  const cached = await redis.get(redisKey);

  if (!cached) return null;

  const data: CachedResponse = JSON.parse(cached);
  const requestHash = await hashRequest(request);

  // Same key, different body = conflict
  if (data.requestHash !== requestHash) {
    return NextResponse.json(
      {
        error: 'Idempotency key conflict',
        message: 'The same idempotency key was used with a different request body',
      },
      { status: 409 }
    );
  }

  // Same key, same body = replay cached response
  return new NextResponse(data.body, {
    status: data.status,
    headers: {
      ...data.headers,
      'Content-Type': 'application/json',
      'Idempotent-Replayed': 'true',
    },
  });
}

/**
 * Store the response for an idempotent request
 */
export async function storeIdempotency(
  endpoint: string,
  userId: string,
  key: string,
  request: NextRequest,
  response: NextResponse
): Promise<void> {
  const redisKey = `idempotency:${endpoint}:${userId}:${key}`;
  const requestHash = await hashRequest(request);

  // Clone response to read body
  const clonedResponse = response.clone();
  const body = await clonedResponse.text();

  const data: CachedResponse = {
    requestHash,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  };

  await redis.setex(redisKey, TTL, JSON.stringify(data));
}

/**
 * Hash request body for comparison
 */
async function hashRequest(request: NextRequest): Promise<string> {
  const cloned = request.clone();
  const body = await cloned.text();
  return createHash('sha256').update(body).digest('hex');
}

/**
 * Validate UUID v4 format
 */
export function isUUIDv4(str: string): boolean {
  const uuidv4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(str);
}
