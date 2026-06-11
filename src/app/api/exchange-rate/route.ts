import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Server-side in-memory cache (30 minutes)
let cache: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
  });
}

export async function POST() {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'API 키 없음' }, { status: 500, headers: CORS });
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ rates: cache.rates, source: 'cache', fetchedAt: cache.fetchedAt }, { headers: CORS });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} } as any],
    });

    const result = await model.generateContent(
      `Google Finance에서 현재 실시간 기준환율(mid-market rate, 인터뱅크 환율)을 검색해. 은행 매수/매도율이 아닌 Google Finance 또는 XE.com 기준 환율을 사용해.
1단위 외화 = KRW 원으로 환산한 값을 아래 JSON 형식으로만 반환해. 다른 텍스트 없이 JSON 객체 하나만.
예시 형식 (실제 값은 검색해서 채워): {"JPY":9.81,"USD":1370,"EUR":1480,"CNY":188,"GBP":1720,"HKD":176,"SGD":1020,"THB":40,"AUD":860,"CAD":1000,"TWD":43}`
    );

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패: ' + text);

    const rates: Record<string, number> = JSON.parse(jsonMatch[0]);
    cache = { rates, fetchedAt: Date.now() };

    return NextResponse.json({ rates, source: 'live', fetchedAt: cache.fetchedAt }, { headers: CORS });
  } catch (e: any) {
    if (cache) {
      return NextResponse.json({ rates: cache.rates, source: 'stale', fetchedAt: cache.fetchedAt }, { headers: CORS });
    }
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/KRW');
      const data = await res.json();
      const rawRates: Record<string, number> = data.rates;
      const converted: Record<string, number> = {};
      for (const [k, v] of Object.entries(rawRates)) {
        converted[k] = parseFloat((1 / v).toFixed(4));
      }
      cache = { rates: converted, fetchedAt: Date.now() };
      return NextResponse.json({ rates: converted, source: 'fallback', fetchedAt: cache.fetchedAt }, { headers: CORS });
    } catch {
      return NextResponse.json({ error: e.message }, { status: 500, headers: CORS });
    }
  }
}
