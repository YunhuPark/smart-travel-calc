import { acquirePaidAi, PaidAiError } from '../../../lib/paid-ai';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Server-side in-memory cache (30 minutes)
let cache: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

const CORS = {};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
  });
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    try { return await freeRates(); } catch {
      return NextResponse.json({ error: '환율 정보를 불러올 수 없습니다.' }, { status: 503 });
    }
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ rates: cache.rates, source: 'cache', fetchedAt: cache.fetchedAt }, { headers: CORS });
  }

  let release: (() => Promise<void>) | undefined;
  try {
    release = await acquirePaidAi(req);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} } as any],
      generationConfig: { maxOutputTokens: 512 },
    });

    const result = await model.generateContent(
      `Google Finance에서 현재 실시간 기준환율(mid-market rate, 인터뱅크 환율)을 검색해. 은행 매수/매도율이 아닌 Google Finance 또는 XE.com 기준 환율을 사용해.
1단위 외화 = KRW 원으로 환산한 값을 아래 JSON 형식으로만 반환해. 다른 텍스트 없이 JSON 객체 하나만.
예시 형식 (실제 값은 검색해서 채워): {"JPY":9.81,"USD":1370,"EUR":1480,"CNY":188,"GBP":1720,"HKD":176,"SGD":1020,"THB":40,"AUD":860,"CAD":1000,"TWD":43}`
    , { timeout: 20000 });

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + text);

    const rates: Record<string, number> = JSON.parse(jsonMatch[0]);
    cache = { rates, fetchedAt: Date.now() };

    return NextResponse.json({ rates, source: 'live', fetchedAt: cache.fetchedAt }, { headers: CORS });
  } catch (e: any) {
    if (e instanceof PaidAiError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (cache) {
      return NextResponse.json({ rates: cache.rates, source: 'stale', fetchedAt: cache.fetchedAt }, { headers: CORS });
    }
    try {
      return await freeRates();
    } catch {
      return NextResponse.json({ error: e.message }, { status: 500, headers: CORS });
    }
  } finally { await release?.(); }
}

// Non-AI currency conversion remains available when paid AI is disabled.
async function freeRates() {
  const res = await fetch('https://open.er-api.com/v6/latest/KRW', { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('Rates service unavailable');
  const data = await res.json();
  if (!data.rates || typeof data.rates !== 'object') throw new Error('Invalid rates');
  const converted: Record<string, number> = {};
  for (const [currency, value] of Object.entries(data.rates)) {
    if (/^[A-Z]{3}$/.test(currency) && typeof value === 'number' && Number.isFinite(value) && value > 0) {
      converted[currency] = parseFloat((1 / value).toFixed(4));
    }
  }
  if (!Object.keys(converted).length) throw new Error('Empty rates');
  cache = { rates: converted, fetchedAt: Date.now() };
  return NextResponse.json({ rates: converted, source: 'fallback', fetchedAt: cache.fetchedAt });
}
