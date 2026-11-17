"use client";
import { useState } from 'react';
import { setAiAccessToken } from '../lib/ai-session';

export function AiAccessPanel() {
  const [token, setToken] = useState('');
  return <details className="p-3 rounded-xl border text-sm">
    <summary>AI 이용 권한</summary>
    <label className="block mt-2">운영자에게 받은 이용 코드
      <input type="password" autoComplete="off" value={token} aria-label="AI 이용 코드"
        className="block w-full p-2 border rounded text-black" onChange={event => {
          setToken(event.target.value);
        }} />
    </label>
    <p>코드는 현재 페이지 메모리에만 보관됩니다. 새로고침하면 다시 입력하세요.</p>
    <button type="button" onClick={() => setAiAccessToken(token)}>코드 적용</button>
    <button type="button" onClick={() => { setToken(''); setAiAccessToken(''); }}>코드 지우기</button>
  </details>;
}
