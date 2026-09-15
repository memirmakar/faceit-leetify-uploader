import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');

// Load .env from the project root regardless of the current working directory.
dotenv.config({ path: join(ROOT, '.env') });

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing ${name}. Set it in ${join(ROOT, '.env')} (see .env.example).`,
    );
  }
  return v.trim();
}

export const config = {
  // FACEIT nickname to watch (case-sensitive).
  faceitNickname: required('FACEIT_NICKNAME'),
  // Free FACEIT Data API key (Bearer). NOT the paused Downloads API key.
  faceitDataApiKey: required('FACEIT_DATA_API_KEY'),
  // How many days back to consider (FACEIT hard-limits demos to ~30 days).
  lookbackDays: Number(process.env.LOOKBACK_DAYS ?? 30),
  // Max matches to scan per run.
  historyLimit: Number(process.env.HISTORY_LIMIT ?? 20),
  // Browser channel for Playwright: 'msedge', 'chrome', or 'chromium'
  // (chromium = Playwright's bundled browser, no Edge/Chrome needed).
  browserChannel: process.env.BROWSER_CHANNEL || 'msedge',
  // Persistent browser profile dir (kept logged into FACEIT between runs).
  profileDir: process.env.PROFILE_DIR ?? join(ROOT, '.browser-profile'),
  // File tracking which match IDs have already been uploaded.
  stateFile: join(ROOT, 'state', 'uploaded.json'),
  logDir: join(ROOT, 'logs'),
  leetifySubmitUrl:
    'https://api.cs-prod.leetify.com/api/faceit-demos/submit-demo-download-url',
};
