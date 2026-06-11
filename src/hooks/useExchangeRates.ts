"use client";

import { useState, useEffect } from "react";

const CACHE_KEY = "smart_travel_exchange_rates_v2";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export interface ExchangeRates {
  [currencyCode: string]: number;
}

interface CachedData {
  rates: ExchangeRates;
  timestamp: number;
}

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  useEffect(() => {
    async function fetchRates() {
      setLoading(true);
      setError(null);
      setIsOffline(false);

      const cachedString = localStorage.getItem(CACHE_KEY);
      let hasValidCache = false;

      if (cachedString) {
        try {
          const cachedData: CachedData = JSON.parse(cachedString);
          if (Date.now() - cachedData.timestamp < CACHE_TTL) {
            setRates(cachedData.rates);
            setLoading(false);
            return;
          } else {
            setRates(cachedData.rates); // stale-while-revalidate
            hasValidCache = true;
          }
        } catch (e) {
          console.error("캐시 파싱 실패", e);
        }
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const response = await fetch(`${apiUrl}/api/exchange-rate`, { method: 'POST' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.rates) {
          setRates(data.rates);
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            rates: data.rates,
            timestamp: Date.now(),
          }));
        } else {
          throw new Error("응답 형식 오류");
        }
      } catch (err) {
        console.error("환율 fetch 실패:", err);
        setIsOffline(true);
        if (!hasValidCache) {
          setError("환율 정보를 불러올 수 없습니다. 인터넷 연결을 확인해주세요.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchRates();
  }, []);

  // rates 형식: { JPY: 9.81, USD: 1370, ... } — 1단위 외화 = KRW
  const convertToKRW = (amount: number, currencyCode: string): number | null => {
    if (currencyCode === 'KRW') return Math.round(amount);
    if (!rates || rates[currencyCode] === undefined) return null;
    return Math.round(amount * rates[currencyCode]);
  };

  return { rates, loading, error, isOffline, convertToKRW };
}
