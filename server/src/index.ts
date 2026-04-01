import 'dotenv/config';
import cron from 'node-cron';
import { runReminderJob } from './reminderCron.js';
import { startReminderServer } from './app.js';

const PORT = Number(process.env.PORT) || 3001;
const CRON_SCHEDULE = '0 9 * * *';

function run(): void {
  runReminderJob().catch((err) => {
    console.error('[reminder] Job error:', err instanceof Error ? err.message : err);
  });
}

cron.schedule(CRON_SCHEDULE, () => {
  run();
});

startReminderServer(PORT);
console.log('[reminder] Cron scheduled at 9:00 AM daily. Waiting...');
