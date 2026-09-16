import { getMatch, getPlayer } from './faceit.js';
import { config } from './config.js';
import { launchContext } from './browser.js';

const MATCH = process.argv[2] ?? '1-1d35f056-a053-4611-89ee-7973bdd17e50';

// --- Data API view ---
const me = await getPlayer(config.faceitNickname);
const myId = me.player_id;
const d = await getMatch(MATCH);
console.log('=== Data API getMatch ===');
console.log('top keys:', Object.keys(d).join(', '));
console.log('voting.map.pick:', JSON.stringify(d.voting?.map?.pick));
console.log('results:', JSON.stringify(d.results));
const f1 = (d.teams?.faction1?.roster ?? []).map((p) => p.player_id);
const f2 = (d.teams?.faction2?.roster ?? []).map((p) => p.player_id);
console.log('my faction:', f1.includes(myId) ? 'faction1' : f2.includes(myId) ? 'faction2' : 'UNKNOWN');

// --- Browser match/v2 view ---
const { context, page } = await launchContext({ visible: false });
try {
  await page.goto('https://www.faceit.com/en', { waitUntil: 'domcontentloaded' });
  const v2 = await page.evaluate(async ({ MATCH }) => {
    const r = await fetch(`https://www.faceit.com/api/match/v2/match/${MATCH}`, {
      credentials: 'include', headers: { Accept: 'application/json' },
    });
    const j = await r.json();
    const p = j?.payload ?? {};
    return {
      keys: Object.keys(p),
      results: p.results,
      votingPick: p.voting?.map?.pick ?? p.voting?.map,
      teamsShape: p.teams ? Object.keys(p.teams) : null,
      sampleTeams: p.teams ? JSON.stringify(p.teams).slice(0, 400) : null,
    };
  }, { MATCH });
  console.log('\n=== match/v2 payload ===');
  console.log('keys:', v2.keys.join(', '));
  console.log('results:', JSON.stringify(v2.results));
  console.log('votingPick:', JSON.stringify(v2.votingPick));
  console.log('teams shape:', JSON.stringify(v2.teamsShape));
  console.log('teams sample:', v2.sampleTeams);
} finally {
  await context.close();
}
