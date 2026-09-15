import { config } from './config.js';

/**
 * Submit a presigned FACEIT demo URL to Leetify.
 * @returns {Promise<{id?: string, rateLimited?: boolean, error?: string}>}
 */
export async function submitDemo(url) {
  let res;
  try {
    res = await fetch(config.leetifySubmitUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (err) {
    return { error: `network: ${err.message}` };
  }

  if (res.status === 429) return { rateLimited: true };

  const raw = await res.text().catch(() => '');
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    /* non-JSON */
  }
  if (!res.ok) return { error: `leetify ${res.status}: ${raw.slice(0, 200)}` };
  return { id: json?.id ?? null };
}
