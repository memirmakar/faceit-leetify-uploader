// Quick diagnostic: prints your recent FACEIT CS2 matches and whether the
// Data API exposes a demo URL for each. Run: npm run matches
import { config } from './config.js';
import { getRecentMatches, getMatch } from './faceit.js';

function fmtDate(unixSeconds) {
  if (!unixSeconds) return '?';
  return new Date(unixSeconds * 1000).toISOString().replace('T', ' ').slice(0, 16);
}

const { player, matches } = await getRecentMatches();
console.log(`Player: ${player.nickname}  (player_id: ${player.player_id})`);
console.log(`Recent CS2 matches in last ${config.lookbackDays} days: ${matches.length}\n`);

for (const m of matches) {
  let demoInfo = '';
  try {
    const detail = await getMatch(m.match_id);
    const demoUrls = detail.demo_url ?? [];
    demoInfo = demoUrls.length ? `demo_url: ${demoUrls.length} present` : 'demo_url: NONE';
  } catch (err) {
    demoInfo = `detail error: ${err.message}`;
  }
  console.log(
    `${fmtDate(m.finished_at ?? m.started_at)}  ${m.match_id}  ${m.competition_name ?? ''}  | ${demoInfo}`,
  );
}
