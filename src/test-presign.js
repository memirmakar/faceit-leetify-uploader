// Make-or-break test: can the automated (logged-in) browser mint a Turnstile
// token and fetch a presigned demo URL for one real match?
// Usage: node src/test-presign.js <matchId>
import { launchContext } from './browser.js';
import { getMatch } from './faceit.js';

const matchId = process.argv[2];
if (!matchId) {
  console.error('Usage: node src/test-presign.js <matchId>');
  process.exit(1);
}

const detail = await getMatch(matchId);
const resourceUrl = detail.demo_url?.[0];
console.log('match      :', matchId);
console.log('resource   :', resourceUrl);

const { context, page } = await launchContext({ visible: true });
try {
  const { getPresignedUrl } = await import('./faceit-demo.js');
  const result = await getPresignedUrl(page, matchId, resourceUrl);
  console.log('\n--- result ---');
  console.log('status     :', result.status);
  console.log('siteKey    :', result.siteKey);
  console.log('error      :', result.error);
  console.log('raw        :', result.raw);
  console.log('downloadUrl:', result.downloadUrl ? result.downloadUrl.slice(0, 120) + '...' : '(none)');
  console.log('\nSUCCESS   :', Boolean(result.downloadUrl));
} finally {
  await context.close();
}
