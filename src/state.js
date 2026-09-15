import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

// State shape: { uploaded: { [matchId]: { leetifyId, at } },
//                failed:   { [matchId]: { count, lastError, at } } }
const MAX_FAILS = 6; // stop retrying a match after this many failed attempts

export function loadState() {
  try {
    const s = JSON.parse(readFileSync(config.stateFile, 'utf8'));
    return { uploaded: s.uploaded ?? {}, failed: s.failed ?? {} };
  } catch {
    return { uploaded: {}, failed: {} };
  }
}

export function saveState(state) {
  mkdirSync(dirname(config.stateFile), { recursive: true });
  writeFileSync(config.stateFile, JSON.stringify(state, null, 2));
}

export function isDone(state, matchId) {
  if (state.uploaded[matchId]) return true;
  if ((state.failed[matchId]?.count ?? 0) >= MAX_FAILS) return true;
  return false;
}

export function markUploaded(state, matchId, leetifyId) {
  state.uploaded[matchId] = { leetifyId, at: new Date().toISOString() };
  delete state.failed[matchId];
}

export function markFailed(state, matchId, error) {
  const prev = state.failed[matchId]?.count ?? 0;
  state.failed[matchId] = {
    count: prev + 1,
    lastError: String(error).slice(0, 200),
    at: new Date().toISOString(),
  };
}
