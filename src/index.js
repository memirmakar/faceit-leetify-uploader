// Main entry point: find new FACEIT CS2 matches and upload their demos to
// Leetify. Safe to run repeatedly (e.g. daily) — already-uploaded matches are
// skipped via state/uploaded.json.
//
// Two discovery modes (config.discoveryMode):
//   'api'     — match list via the free FACEIT Data API (needs a key)
//   'browser' — match list via your logged-in browser session (no key)
import { config } from './config.js';
import { getRecentMatches, getMatch, getPlayer } from './faceit.js';
import {
  listMatchesBrowser,
  getDemoResourceBrowser,
  getMyGuidBrowser,
} from './faceit-browser.js';
import { getPresignedUrl } from './faceit-demo.js';
import { submitDemo } from './leetify.js';
import { launchContext } from './browser.js';
import { saveDemo, pruneDemos } from './demos.js';
import { log } from './logger.js';
import { notify } from './notifier.js';
import {
  loadState,
  saveState,
  isDone,
  markUploaded,
  markFailed,
} from './state.js';
import { existsSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Prevents a manual run and the scheduled run from colliding on the browser.
const LOCK = join(config.logDir, 'run.lock');
function acquireLock() {
  try {
    if (existsSync(LOCK) && Date.now() - statSync(LOCK).mtimeMs < 20 * 60 * 1000) {
      return false;
    }
    writeFileSync(LOCK, String(process.pid));
    return true;
  } catch {
    return true; // if the lock can't be managed, don't block the run
  }
}
function releaseLock() {
  try { unlinkSync(LOCK); } catch { /* ignore */ }
}

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

// Get demo resource URL + map + win/loss for one match, mode-appropriately.
async function resolveResource(page, matchId, myId) {
  if (config.discoveryMode === 'browser') {
    const r = await getDemoResourceBrowser(page, matchId, myId);
    return { resourceUrl: r.resourceUrl, map: r.map, won: r.won, score: r.score, status: r.status ?? r.error };
  }
  const d = await getMatch(matchId);
  const map = d.voting?.map?.pick?.[0];
  const winner = d.results?.winner;
  let won = null;
  let score = null;
  if (winner && d.teams) {
    const ids = (fac) => (d.teams[fac]?.roster ?? []).map((x) => x.player_id);
    const myFaction = ids('faction1').includes(myId)
      ? 'faction1'
      : ids('faction2').includes(myId)
        ? 'faction2'
        : null;
    if (myFaction) {
      won = myFaction === winner;
      const other = myFaction === 'faction1' ? 'faction2' : 'faction1';
      const a = d.results?.score?.[myFaction];
      const b = d.results?.score?.[other];
      if (a != null && b != null) score = `${a}-${b}`;
    }
  }
  return { resourceUrl: d.demo_url?.[0], map, won, score, status: d.status };
}

async function main() {
  if (!acquireLock()) {
    log('Another run is already in progress; exiting.');
    return { uploaded: 0, failed: 0 };
  }
  const state = loadState();
  log(`Discovery mode: ${config.discoveryMode}`);

  let context = null;
  let page = null;
  const ensureBrowser = async () => {
    if (!context) ({ context, page } = await launchContext({ visible: false }));
    return page;
  };

  try {
    if (config.saveDemos) {
      const pruned = pruneDemos();
      if (pruned) log(`Pruned ${pruned} demo(s) older than ${config.demoRetentionDays} days.`);
    }

    // 'browser' mode needs the browser just to list matches; 'api' mode doesn't.
    if (config.discoveryMode === 'browser') await ensureBrowser();

    // Only needed to label saved demos win/loss.
    let myId = null;
    if (config.saveDemos) {
      if (config.discoveryMode === 'browser') {
        await ensureBrowser();
        myId = await getMyGuidBrowser(page);
      } else {
        myId = (await getPlayer(config.faceitNickname)).player_id;
      }
    }

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
        const { resourceUrl, map, won, score, status } = await resolveResource(page, id, myId);
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

        if (config.saveDemos && config.demoDir) {
          const saved = await saveDemo({
            downloadUrl: presign.downloadUrl,
            finishedAt: m.finishedAt,
            map,
            won,
            score,
            matchId: id,
          });
          if (saved.error) log(`WARN ${id}: demo save failed (${saved.error})`);
          else if (saved.skipped) log(`     ${id}: demo already saved (${saved.name})`);
          else log(`     ${id}: saved demo ${saved.name} (${saved.mb} MB)`);
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
    releaseLock();
  }
}

main().catch((err) => {
  log(`FATAL: ${err.stack ?? err.message}`);
  notify('FACEIT → Leetify: run failed', String(err.message).slice(0, 180));
  process.exit(1);
});
