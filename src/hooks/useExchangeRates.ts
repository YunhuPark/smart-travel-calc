"use client";

import { useState, useEffect } from "react";

const API_URL = "https://open.er-api.com/v6/latest/KRW";
const CACHE_KEY = "smart_travel_exchange_rates";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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

      // Check cache first
      const cachedString = localStorage.getItem(CACHE_KEY);
      let hasValidCache = false;

      if (cachedString) {
        try {
          const cachedData: CachedData = JSON.parse(cachedString);
          const now = Date.now();
          // If cache is fresh, use it and don't fetch
          if (now - cachedData.timestamp < CACHE_TTL) {
            setRates(cachedData.rates);
            setLoading(false);
            return;
          } else {
             // Cache expired, but keep it in state just in case fetch fails
             setRates(cachedData.rates);
             hasValidCache = true;
          }
        } catch (e) {
          console.error("Failed to parse cached rates", e);
        }
      }

      // Fetch new rates
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data && data.rates) {
          setRates(data.rates);
          // Save to cache
          const cacheData: CachedData = {
            rates: data.rates,
            timestamp: Date.now(),
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } else {
          throw new Error("Invalid data format from API");
        }
      } catch (err) {
        console.error("Failed to fetch exchange rates:", err);
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

  // Helper function to convert any currency to KRW
  const convertToKRW = (amount: number, currencyCode: string): number | null => {
    if (!rates || !rates[currencyCode]) return null;
    return amount / rates[currencyCode];
  };

  return { rates, loading, error, isOffline, convertToKRW };
}
