import cron from 'node-cron';
import { runWeeklyPulse } from './orchestrator.js';

console.log('🤖 Starting Weekly Review Pulse automation service...');
console.log('📅 Schedule configured to run every Friday at 4:00 PM.');

// Schedule task to run every Friday at 16:00 (4:00 PM)
cron.schedule('0 16 * * 5', async () => {
  console.log('⏰ Triggering Weekly Review Pulse...');
  try {
    await runWeeklyPulse();
    console.log('✅ Weekly Review Pulse completed successfully.');
  } catch (error) {
    console.error('❌ Failed to run Weekly Review Pulse:', error);
  }
});
