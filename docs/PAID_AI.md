# Paid AI deployment

Paid Gemini routes are restricted to trusted operators. The page includes an **AI 이용 권한** section: enter the operator access code there before using AI. It stays only in page memory, is sent as an Authorization bearer token, and is cleared on refresh or with the clear button. Do not distribute this shared code to an untrusted public audience; rotate it to revoke access. It is an access credential, separate from the provider API key.

Configure these **server-only** environment variables in the deployment secrets manager:

| Variable | Configuration |
| --- | --- |
| `GEMINI_API_KEY` | New provider credential; never commit it or send it to browsers |
| `AI_ACCESS_TOKEN` | Cryptographically random operator access code of at least 32 characters |
| `AI_REDIS_REST_URL` | HTTPS Redis REST endpoint supporting JSON-array commands and `EVAL` (for example a dedicated Upstash Redis database) |
| `AI_REDIS_REST_TOKEN` | Server-side Redis credential with EVAL, GET, INCRBY, INCR, EXPIRE, ZREMRANGEBYSCORE, ZCARD, ZADD, ZREM permissions |
| `AI_BUDGET_NAMESPACE` | Same 1–64 character letters/digits/underscore/hyphen namespace for every replica and route sharing the provider quota |
| `AI_DAILY_CALL_LIMIT` | Integer 1–1000, default 100 provider attempts per UTC day |

Never prefix any of these values with `NEXT_PUBLIC_`. Generate the operator code locally, store it as a server secret, and provide it privately to trusted operators. Use HTTPS and the same origin for frontend and API. A reverse proxy should reject excessive request bodies before forwarding them too.

Use one persistent Redis database and namespace across all replicas and deployments sharing this budget. Losing or flushing its data resets counters, so restrict administrative access. The code fails closed with 503 if authentication configuration or Redis is missing/unavailable, 401 for missing/wrong access code, and 429 when a budget or concurrency limit is exhausted. Client identity and IP headers cannot allocate a new budget.

One Lua transaction reserves worst-case provider attempts before calling Gemini. It permits 10 requests per minute and 2 concurrent requests globally per namespace. Failed/uncertain provider calls remain charged; releasing a concurrency lease does not refund daily usage. Leases expire after 120 seconds, exceeding the bounded provider call chain. Provider requests have 20-second timeouts and bounded output tokens. This is an application attempt/token control, not a provider invoice guarantee: also configure billing alerts and provider quotas. Do not change namespace to evade the cap.

Without `GEMINI_API_KEY`, receipt AI stays disabled while manual expense entry and the free non-AI exchange-rate service remain usable. Entering/changing the operator code retries exchange-rate loading when paid mode is configured. Receipt request JSON is streamed with a 2.8 MB limit; text is limited to 8,000 characters and JPEG/PNG/WebP base64 data to 2.7 million characters. Each receipt or exchange-rate refresh reserves one provider attempt. Existing cached exchange rates can be read without incurring a paid call.

The previously exposed Google credential was checked by the remediation coordinator on 2026-11-17 using the non-billable models-list authorization endpoint and rejected with `400 API_KEY_INVALID`. This confirms current invalidity, not agent-performed revocation. Historical exposure remains; use a new server-only credential if re-enabling AI and review provider access/billing records.

Validation (no real provider calls):

```text
node --test tests/*.test.cjs
python -m pip install "fakeredis[lua]"
python tests/redis_budget_test.py
npm run build
```

The Python tests execute the production Lua in an embedded Lua engine with shared Redis semantics, including concurrent independent clients; they do not certify a particular hosted Redis service. Before enabling paid AI, test EVAL compatibility against your own isolated Redis database with synthetic requests. Never use live paid requests for regression testing.


## Operator emergency switch

Set the server-only `PAID_AI_ENABLED=false` in production and preview to stop paid
provider calls while shared Redis/operator configuration is incomplete. Gift
recommendations and travel currency rates keep their free fallback paths. Receipt
AI analysis returns 503 while disabled. Existing provider credentials are retained
and are never exposed to the browser. Redeploy after changing the environment.

Re-enable only after the shared Redis URL/token, common budget namespace and
operator token are configured and verified. Do not enable an unbudgeted deployment.
