// End-to-end test on a single match: presign -> submit to Leetify.
// Usage: node src/test-e2e.js <matchId>
import { launchContext } from './browser.js';
import { getMatch } from './faceit.js';
import { getPresignedUrl } from './faceit-demo.js';
import { submitDemo } from './leetify.js';

const matchId = process.argv[2];
if (!matchId) {
  console.error('Usage: node src/test-e2e.js <matchId>');
  process.exit(1);
}
const detail = await getMatch(matchId);
console.log('match:', matchId, '| status:', detail.status);

const { context, page } = await launchContext({ visible: false });
try {
  const p = await getPresignedUrl(page, matchId, detail.demo_url?.[0]);
  console.log('presign:', p.downloadUrl ? 'OK' : `FAILED (${p.error ?? p.status})`);
  if (p.downloadUrl) {
    const r = await submitDemo(p.downloadUrl);
    console.log('leetify response:', JSON.stringify(r));
    if (r.id !== undefined && !r.error) {
      console.log('LEETIFY MATCH:', `https://leetify.com/app/match-details/${r.id}`);
    }
  }
} finally {
  await context.close();
}
