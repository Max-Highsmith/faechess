import cron from 'node-cron';
import supabase from './db.js';
import { sendWeeklyPuzzleEmail } from './email-service.js';

/**
 * Helper function to get Monday of current week
 */
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Send weekly puzzle emails to all subscribed users
 */
async function sendWeeklyPuzzleEmails() {
  console.log('📅 Running weekly puzzle email scheduler...');

  try {
    // Get this week's puzzle
    const currentWeek = getStartOfWeek(new Date());
    const weekString = currentWeek.toISOString().split('T')[0];

    const { data: schedule, error: scheduleError } = await supabase
      .from('weekly_puzzle_schedule')
      .select(`
        puzzle_id,
        puzzles (*)
      `)
      .eq('scheduled_week', weekString)
      .single();

    if (scheduleError || !schedule?.puzzles) {
      console.log(`⚠️ No puzzle scheduled for week of ${weekString}`);
      return;
    }

    const puzzle = schedule.puzzles;
    console.log(`📧 Sending emails for puzzle: "${puzzle.title}"`);

    // Get all subscribed users
    const { data: subscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select(`
        user_id,
        users!inner (email)
      `)
      .eq('is_active', true)
      .eq('email_notifications', true);

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('ℹ️ No active subscriptions found');
      return;
    }

    console.log(`📬 Sending to ${subscriptions.length} subscribers...`);

    // Send emails with rate limiting
    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const userEmail = sub.users?.email;
      if (!userEmail) continue;

      const result = await sendWeeklyPuzzleEmail(userEmail, puzzle);

      if (result.success) {
        sent++;
      } else {
        failed++;
        console.error(`Failed to send email to ${userEmail}:`, result.error);
      }

      // Rate limit: wait 100ms between emails
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Weekly puzzle emails sent: ${sent} successful, ${failed} failed`);
  } catch (error) {
    console.error('❌ Error in weekly puzzle scheduler:', error);
  }
}

/**
 * Start the weekly puzzle scheduler
 * Runs every Monday at 9:00 AM
 */
export function startWeeklyPuzzleScheduler() {
  console.log('📅 Weekly puzzle scheduler initialized');
  console.log('⏰ Schedule: Every Monday at 9:00 AM');

  // Schedule for every Monday at 9:00 AM
  // Cron format: minute hour day-of-month month day-of-week
  // '0 9 * * 1' = minute 0, hour 9, any day of month, any month, Monday
  cron.schedule('0 9 * * 1', async () => {
    await sendWeeklyPuzzleEmails();
  }, {
    timezone: process.env.TIMEZONE || 'UTC'
  });

  console.log('✅ Weekly puzzle scheduler started');

  // Optional: Send immediately for testing (uncomment for testing)
  // console.log('🧪 Running immediate test send...');
  // sendWeeklyPuzzleEmails();
}

/**
 * Manual trigger for testing
 * Can be called from admin API or CLI
 */
export async function triggerWeeklyPuzzleEmails() {
  console.log('🧪 Manually triggering weekly puzzle emails...');
  await sendWeeklyPuzzleEmails();
}
