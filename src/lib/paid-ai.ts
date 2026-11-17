import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';

export class PaidAiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// A shared Redis transaction reserves provider attempts BEFORE the call. All
// deployments for this key must use the same Redis and AI_BUDGET_NAMESPACE.
const RESERVE = `
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
if tonumber(redis.call('GET', KEYS[1]) or '0') + tonumber(ARGV[3]) > tonumber(ARGV[4]) then return 0 end
if tonumber(redis.call('GET', KEYS[2]) or '0') >= 10 then return 0 end
if redis.call('ZCARD', KEYS[3]) >= 2 then return 0 end
redis.call('INCRBY', KEYS[1], ARGV[3]); redis.call('EXPIRE', KEYS[1], 172800)
redis.call('INCR', KEYS[2]); redis.call('EXPIRE', KEYS[2], 120)
redis.call('ZADD', KEYS[3], now + 120000, ARGV[2]); redis.call('EXPIRE', KEYS[3], 180)
return 1`;

function authenticate(request: Request) {
  const expected = process.env.AI_ACCESS_TOKEN;
  if (!expected || expected.length < 32) throw new PaidAiError(503, 'Paid AI is not enabled');
  const actual = request.headers.get('authorization') || '';
  const digest = (s: string) => createHash('sha256').update(s).digest();
  if (!timingSafeEqual(digest(actual), digest(`Bearer ${expected}`))) {
    throw new PaidAiError(401, 'AI access token required');
  }
}

export async function readPaidJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  authenticate(request);
  if (!request.body) throw new PaidAiError(400, 'JSON body required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new PaidAiError(413, 'Input too large'); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch (error) {
    if (error instanceof PaidAiError) throw error;
    throw new PaidAiError(400, 'Invalid JSON');
  } finally { reader.releaseLock(); }
}

export async function acquirePaidAi(request: Request, attempts = 1): Promise<() => Promise<void>> {
  authenticate(request);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new PaidAiError(503, 'Invalid provider attempt budget');
  }
  const url = process.env.AI_REDIS_REST_URL;
  const token = process.env.AI_REDIS_REST_TOKEN;
  const namespace = process.env.AI_BUDGET_NAMESPACE;
  if (!url?.startsWith('https://') || !token || !namespace || !/^[\w-]{1,64}$/.test(namespace)) {
    throw new PaidAiError(503, 'Shared AI budget is not configured');
  }
  const configured = Number(process.env.AI_DAILY_CALL_LIMIT || 100);
  if (!Number.isInteger(configured) || configured < 1 || configured > 1000) {
    throw new PaidAiError(503, 'Invalid AI budget');
  }
  const now = Date.now();
  const prefix = `paid-ai:${namespace}`;
  const active = `${prefix}:active`;
  const lease = randomUUID();
  const command = async (args: (string | number)[]) => {
    const response = await fetch(url, { method: 'POST', headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify(args), signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!response.ok) throw new Error('Budget store unavailable');
    const result = await response.json();
    if (result.error) throw new Error('Budget store error');
    return result.result;
  };
  try {
    const accepted = await command(['EVAL', RESERVE, 3,
      `${prefix}:day:${new Date(now).toISOString().slice(0, 10)}`, `${prefix}:minute:${Math.floor(now / 60000)}`,
      active, now, lease, attempts, configured]);
    if (accepted !== 1) throw new PaidAiError(429, 'AI budget or concurrency limit reached');
  } catch (error) {
    if (error instanceof PaidAiError) throw error;
    throw new PaidAiError(503, 'AI budget unavailable');
  }
  return async () => { try { await command(['ZREM', active, lease]); } catch { /* expires automatically */ } };
}
