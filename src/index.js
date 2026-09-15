// Main entry point: find new FACEIT CS2 matches and upload their demos to
// Leetify. Safe to run repeatedly (e.g. daily) — already-uploaded matches are
// skipped via state/uploaded.json.
import { config } from './config.js';
import { getRecentMatches, getMatch } from './faceit.js';
import { getPresignedUrl } from './faceit-demo.js';
import { submitDemo } from './leetify.js';
import { launchContext } from './browser.js';
import { log } from './logger.js';
import { notify } from './notifier.js';
import {
  loadState,
  saveState,
  isDone,
  markUploaded,
  markFailed,
} from './state.js';

const MAX_PER_RUN = process.env.MAX_PER_RUN ? Number(process.env.MAX_PER_RUN) : Infinity;
const DELAY_MS = process.env.DELAY_MS ? Number(process.env.DELAY_MS) : 4000;
const RATE_LIMIT_WAIT_MS = 300_000; // Leetify asks for 300s on HTTP 429

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadWithRateLimit(url) {
  let r = await submitDemo(url);
  if (r.rateLimited) {
    log('Leetify rate-limited (429); waiting 300s then retrying once...');
    await sleep(RATE_LIMIT_WAIT_MS);
    r = await submitDemo(url);
  }
  return r;
}

async function main() {
  const state = loadState();

  log('Checking FACEIT for recent matches...');
  const { player, matches } = await getRecentMatches();
  log(`Player ${player.nickname}: ${matches.length} matches in last ${config.lookbackDays} days.`);

  // Oldest first, and only ones we haven't finished with.
  const candidates = matches
    .filter((m) => !isDone(state, m.match_id))
    .reverse()
    .slice(0, MAX_PER_RUN === Infinity ? undefined : MAX_PER_RUN);

  if (candidates.length === 0) {
    log('Nothing new to upload. Done.');
    return { uploaded: 0, failed: 0 };
  }
  log(`${candidates.length} new match(es) to process.`);

  const { context, page } = await launchContext({ visible: false });
  let uploaded = 0;
  let failed = 0;
  try {
    for (const m of candidates) {
      const id = m.match_id;
      try {
        const detail = await getMatch(id);
        const resourceUrl = detail.demo_url?.[0];
        if (detail.status !== 'FINISHED' || !resourceUrl) {
          log(`SKIP ${id}: status=${detail.status} demo=${Boolean(resourceUrl)}`);
          markFailed(state, id, 'no demo / not finished');
          failed++;
          continue;
        }

        const presign = await getPresignedUrl(page, id, resourceUrl);
        if (!presign.downloadUrl) {
          const reason = presign.error ?? `status ${presign.status}: ${presign.raw ?? ''}`;
          log(`FAIL ${id}: presign failed (${reason})`);
          markFailed(state, id, reason);
          failed++;
          continue;
        }

        const res = await uploadWithRateLimit(presign.downloadUrl);
        if (res.rateLimited) {
          // Still throttled after a 300s wait — stop cleanly; the next daily
          // run resumes where we left off. Don't count this as a failure.
          log(`STOP ${id}: Leetify still rate-limiting; will resume next run.`);
          break;
        }
        if (res.id !== undefined && !res.error) {
          log(`OK   ${id}: uploaded to Leetify (id=${res.id ?? 'accepted'})`);
          markUploaded(state, id, res.id);
          uploaded++;
        } else {
          log(`FAIL ${id}: leetify (${res.error ?? 'unknown'})`);
          markFailed(state, id, res.error ?? 'unknown');
          failed++;
        }
      } catch (err) {
        log(`ERR  ${id}: ${err.message}`);
        markFailed(state, id, err.message);
        failed++;
      } finally {
        saveState(state); // persist progress after every match
      }
      await sleep(DELAY_MS);
    }
  } finally {
    await context.close();
  }

  log(`Run complete. Uploaded: ${uploaded}, failed/skipped: ${failed}.`);

  // If we had matches to do but none succeeded, the most likely cause is an
  // expired FACEIT login — surface it so you can re-run the login step.
  if (uploaded === 0 && failed > 0) {
    notify(
      'FACEIT → Leetify: action needed',
      'No demos uploaded this run. Your FACEIT login may have expired — open the folder and run the login step again.',
    );
  }
  return { uploaded, failed };
}

main().catch((err) => {
  log(`FATAL: ${err.stack ?? err.message}`);
  notify('FACEIT → Leetify: run failed', String(err.message).slice(0, 180));
  process.exit(1);
});
