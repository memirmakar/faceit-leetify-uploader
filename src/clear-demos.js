// Delete all locally saved demos (any age) to free disk space.
// Run: node src/clear-demos.js   (also wired to the tray "Clear saved demos").
import { clearAllDemos } from './demos.js';
import { log } from './logger.js';

const { count, mb } = clearAllDemos();
log(`Cleared ${count} saved demo(s), freed ~${mb} MB.`);
console.log(`Cleared ${count} saved demo(s), freed ~${mb} MB.`);
