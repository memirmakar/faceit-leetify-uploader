import { config } from './config.js';

const DATA_API = 'https://open.faceit.com/data/v4';

async function dataApi(path) {
  const res = await fetch(`${DATA_API}${path}`, {
    headers: {
      Authorization: `Bearer ${config.faceitDataApiKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`FACEIT Data API ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Resolve a nickname to a player object (includes player_id and per-game data). */
export async function getPlayer(nickname) {
  return dataApi(`/players?nickname=${encodeURIComponent(nickname)}&game=cs2`);
}

/**
 * Recent CS2 matches for a player, newest first.
 * Returns items with match_id, started_at, finished_at (unix seconds), etc.
 */
export async function getMatchHistory(playerId, limit = config.historyLimit) {
  const data = await dataApi(
    `/players/${playerId}/history?game=cs2&offset=0&limit=${limit}`,
  );
  return data.items ?? [];
}

/** Full match details, including demo_url (an array of resource URLs) when present. */
export async function getMatch(matchId) {
  return dataApi(`/matches/${matchId}`);
}

/** Matches finished within the last `lookbackDays`, newest first, enriched with details. */
export async function getRecentMatches() {
  const player = await getPlayer(config.faceitNickname);
  const playerId = player.player_id;
  const history = await getMatchHistory(playerId);

  const cutoff = Date.now() / 1000 - config.lookbackDays * 86400;
  const recent = history.filter((m) => (m.finished_at ?? m.started_at ?? 0) >= cutoff);

  return { player, matches: recent };
}
