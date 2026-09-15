// "No API key" discovery: get your match list and each demo's resource URL
// straight from FACEIT's own website endpoints, using your logged-in session.
// (Used when DISCOVERY_MODE=browser.)

async function ensureFaceit(page) {
  if (!page.url().includes('faceit.com')) {
    await page.goto('https://www.faceit.com/en', { waitUntil: 'domcontentloaded' });
  }
}

/**
 * Your recent CS2 matches via the logged-in session.
 * @returns {Promise<Array<{matchId: string, finishedAt: number}>>}
 */
export async function listMatchesBrowser(page, size = 30) {
  await ensureFaceit(page);
  return page.evaluate(async ({ size }) => {
    async function api(url) {
      const r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
      return r.json();
    }
    const me = await api('https://www.faceit.com/api/users/v1/sessions/me');
    const guid = me?.payload?.id;
    if (!guid) throw new Error('Not logged in (no FACEIT session). Run the login step.');

    const stats = await api(
      `https://www.faceit.com/api/stats/v1/stats/time/users/${guid}/games/cs2?size=${size}`,
    );
    const items = Array.isArray(stats) ? stats : [];
    const seen = new Set();
    const out = [];
    for (const s of items) {
      const matchId = s.matchId; // "1-...." room id
      if (!matchId || !/^1-/.test(matchId) || seen.has(matchId)) continue;
      seen.add(matchId);
      const ms = Number(s.date ?? s.created_at ?? 0);
      out.push({ matchId, finishedAt: ms ? ms / 1000 : 0 });
    }
    return out;
  }, { size });
}

/**
 * The demo resource URL for a match via the logged-in session.
 * @returns {Promise<{resourceUrl: string|null, status?: string, error?: string}>}
 */
export async function getDemoResourceBrowser(page, matchId) {
  await ensureFaceit(page);
  return page.evaluate(async ({ matchId }) => {
    const r = await fetch(`https://www.faceit.com/api/match/v2/match/${matchId}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return { resourceUrl: null, error: `match/v2 HTTP ${r.status}` };
    const j = await r.json();
    const p = j?.payload ?? {};
    const urls = p.demoURLs ?? [];
    return { resourceUrl: urls[0] ?? null, status: p.status ?? p.state };
  }, { matchId });
}
