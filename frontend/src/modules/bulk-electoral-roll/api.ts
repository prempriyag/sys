/**
 * Bulk Electoral Roll API - isolated from main api.ts
 */
import { API_BASE_URL, getAuthToken } from '../../config/api';
import type { BulkProgress, BulkResult } from './types';

const ENDPOINTS = {
  BASE: '/api/bulk-electoral-roll',
  STREAM: '/api/bulk-electoral-roll/stream',
  COUNT: '/api/bulk-electoral-roll/count',
};

export const bulkElectoralRollCount = () =>
  fetch(`${API_BASE_URL}${ENDPOINTS.COUNT}`, {
    headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
  }).then((r) => r.json());

export const bulkElectoralRoll = (formData: FormData) =>
  fetch(`${API_BASE_URL}${ENDPOINTS.BASE}`, {
    method: 'POST',
    body: formData,
    headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {},
    signal: AbortSignal.timeout(600000),
  }).then(async (r) => {
    if (!r.ok) {
      const t = await r.text();
      throw new Error(t || r.statusText);
    }
    return r.json();
  });

/** Bulk with progress: POST to stream endpoint, call onProgress for each event, resolve with result on 'done'. */
export async function bulkElectoralRollWithProgress(
  formData: FormData,
  onProgress: (p: BulkProgress) => void,
): Promise<BulkResult> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}${ENDPOINTS.STREAM}`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(600000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');
  const dec = new TextDecoder();
  let buffer = '';
  let result: BulkResult = {};
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'progress') {
            onProgress({
              current: data.current,
              total: data.total,
              pdf_name: data.pdf_name ?? '',
              records_so_far: data.records_so_far ?? 0,
            });
          } else if (data.type === 'done' && data.result) {
            result = data.result;
          } else if (data.type === 'error') {
            throw new Error(data.detail ?? 'Stream error');
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  }
  return result;
}
