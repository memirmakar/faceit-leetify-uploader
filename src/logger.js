import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';

mkdirSync(config.logDir, { recursive: true });
const logFile = join(config.logDir, 'uploader.log');

export function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}`;
  console.log(line);
  try {
    appendFileSync(logFile, line + '\n');
  } catch {
    /* ignore */
  }
}
