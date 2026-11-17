let accessToken = '';
export function setAiAccessToken(value: string) { accessToken = value;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ai-access-changed')); }
export function aiHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
