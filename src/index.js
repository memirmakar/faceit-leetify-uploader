// Main entry point: find new FACEIT CS2 matches and upload their demos to
// Leetify. Safe to run repeatedly (e.g. daily) — already-uploaded matches are
// skipped via state/uploaded.json.
//
// Two discovery modes (config.discoveryMode):
//   'api'     — match list via the free FACEIT Data API (needs a key)
//   'browser' — match list via your logged-in browser session (no key)
import { config } from './config.js';
import { getRecentMatches, getMatch } from './faceit.js';
import { listMatchesBrowser, getDemoResourceBrowser } from './faceit-browser.js';
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
const cutoff = () => Date.now() / 1000 - config.lookbackDays * 86400;

async function uploadWithRateLimit(url) {
  let r = await submitDemo(url);
  if (r.rateLimited) {
    log('Leetify rate-limited (429); waiting 300s then retrying once...');
    await sleep(RATE_LIMIT_WAIT_MS);
    r = await submitDemo(url);
  }
  return r;
}

// Normalize both modes to [{ matchId, finishedAt }].
async function listMatches(page) {
  if (config.discoveryMode === 'browser') {
    return listMatchesBrowser(page);
  }
  const { matches } = await getRecentMatches();
  return matches.map((m) => ({
    matchId: m.match_id,
    finishedAt: m.finished_at ?? m.started_at ?? 0,
  }));
}

// Get a demo resource URL for one match, mode-appropriately.
async function resolveResource(page, matchId) {
  if (config.discoveryMode === 'browser') {
    const r = await getDemoResourceBrowser(page, matchId);
    return { resourceUrl: r.resourceUrl, status: r.status ?? r.error };
  }
  const d = await getMatch(matchId);
  return { resourceUrl: d.demo_url?.[0], status: d.status };
}

async function main() {
  const state = loadState();
  log(`Discovery mode: ${config.discoveryMode}`);

  let context = null;
  let page = null;
  const ensureBrowser = async () => {
    if (!context) ({ context, page } = await launchContext({ visible: false }));
    return page;
  };

  try {
    // 'browser' mode needs the browser just to list matches; 'api' mode doesn't.
    if (config.discoveryMode === 'browser') await ensureBrowser();
    log('Checking FACEIT for recent matches...');
    const list = await listMatches(page);

    const candidates = list
      .filter((m) => m.matchId)
      .filter((m) => (m.finishedAt ?? 0) >= cutoff())
      .filter((m) => !isDone(state, m.matchId))
      .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0)) // oldest first
      .slice(0, MAX_PER_RUN === Infinity ? undefined : MAX_PER_RUN);

    if (candidates.length === 0) {
      log('Nothing new to upload. Done.');
      return { uploaded: 0, failed: 0 };
    }
    log(`${candidates.length} new match(es) to process.`);

    await ensureBrowser(); // needed for the presign step in both modes

    let uploaded = 0;
    let failed = 0;
    for (const m of candidates) {
      const id = m.matchId;
      try {
        const { resourceUrl, status } = await resolveResource(page, id);
        if (!resourceUrl) {
          log(`SKIP ${id}: no demo available (status=${status})`);
          markFailed(state, id, `no demo (${status})`);
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
        saveState(state);
      }
      await sleep(DELAY_MS);
    }

    log(`Run complete. Uploaded: ${uploaded}, failed/skipped: ${failed}.`);
    if (uploaded === 0 && failed > 0) {
      notify(
        'FACEIT → Leetify: action needed',
        'No demos uploaded this run. Your FACEIT login may have expired — open the folder and run the login step again.',
      );
    }
    return { uploaded, failed };
  } finally {
    if (context) await context.close();
  }
}

main().catch((err) => {
  log(`FATAL: ${err.stack ?? err.message}`);
  notify('FACEIT → Leetify: run failed', String(err.message).slice(0, 180));
  process.exit(1);
});
