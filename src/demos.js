// Optional local demo saving: download the FACEIT .dem.zst, decompress it to a
// playable .dem, name it "<date>-<map>-<win|loss>.dem", and prune files older
// than the retention window. Enabled with SAVE_DEMOS=true + DEMO_DIR in .env.
import {
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import { config } from './config.js';
import { log } from './logger.js';

// Matches only files WE created, so pruning never touches other demos.
const OUR_PATTERN = /^\d{4}-\d{2}-\d{2}-.+-(win|loss)(-[0-9a-f]{1,8})?\.dem$/i;

export function demoFilename(finishedAt, map, won) {
  const d = new Date((finishedAt || 0) * 1000);
  const date = Number.isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10);
  const safeMap = (map || 'unknown').replace(/[^a-z0-9_]/gi, '') || 'unknown';
  const res = won == null ? 'unknown' : won ? 'win' : 'loss';
  return `${date}-${safeMap}-${res}.dem`;
}

/**
 * Download + decompress a demo to config.demoDir.
 * @returns {Promise<{name?: string, mb?: number, skipped?: boolean, error?: string}>}
 */
export async function saveDemo({ downloadUrl, finishedAt, map, won, matchId }) {
  mkdirSync(config.demoDir, { recursive: true });

  let name = demoFilename(finishedAt, map, won);
  let dest = join(config.demoDir, name);
  if (existsSync(dest)) {
    // Same date+map+result already exists — disambiguate with the match id.
    name = name.replace(/\.dem$/i, `-${String(matchId).slice(2, 10)}.dem`);
    dest = join(config.demoDir, name);
  }
  if (existsSync(dest)) return { skipped: true, name };

  let res;
  try {
    res = await fetch(downloadUrl);
  } catch (err) {
    return { error: `download network: ${err.message}` };
  }
  if (!res.ok) return { error: `download HTTP ${res.status}` };

  const raw = Buffer.from(await res.arrayBuffer());
  let dem;
  try {
    dem = zstdDecompressSync(raw); // FACEIT serves .dem.zst
  } catch {
    dem = raw; // fall back if it wasn't compressed
  }
  writeFileSync(dest, dem);
  return { name, mb: Math.round(dem.length / 1048576) };
}

/** Delete our saved demos older than the retention window. Returns count. */
export function pruneDemos() {
  if (!config.demoDir || !existsSync(config.demoDir)) return 0;
  const cutoff = Date.now() - config.demoRetentionDays * 86400 * 1000;
  let n = 0;
  for (const f of readdirSync(config.demoDir)) {
    if (!OUR_PATTERN.test(f)) continue;
    const p = join(config.demoDir, f);
    try {
      if (statSync(p).mtimeMs < cutoff) {
        unlinkSync(p);
        n++;
        log(`Pruned old demo (>${config.demoRetentionDays}d): ${f}`);
      }
    } catch {
      /* ignore */
    }
  }
  return n;
}
