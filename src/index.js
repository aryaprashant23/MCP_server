import { runWeeklyPulse } from './orchestrator.js';

async function main() {
  await runWeeklyPulse();
}

main().catch(err => {
  console.error('Error during execution:', err);
});
