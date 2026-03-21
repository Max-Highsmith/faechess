import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing Supabase environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Helper function to get Monday of a week
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Define the existing puzzles
const existingPuzzles = [
  {
    title: "Queen's Triagonal Trap",
    description: "White to move. Mate in 1.",
    hint: "The queen can cover all 7 escape squares from one perfect position.",
    difficulty: 1,
    turn: 'w',
    board: {
      '0,4,4': { type: 'K', color: 'b' },
      '2,0,0': { type: 'K', color: 'w' },
      '1,3,0': { type: 'Q', color: 'w' },
      '1,0,3': { type: 'R', color: 'w' }
    },
    solution: { from: [1,3,0], to: [1,3,3] }
  },
  {
    title: "Smothered Royalty",
    description: "White to move. Mate in 1.",
    hint: "The king's own pieces form its prison. Capture the guard.",
    difficulty: 2,
    turn: 'w',
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,1,0': { type: 'R', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '1,1,0': { type: 'P', color: 'b' },
      '1,1,1': { type: 'P', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '1,1,4': { type: 'Q', color: 'w' },
      '2,2,2': { type: 'U', color: 'w' }
    },
    solution: { from: [1,1,4], to: [1,1,1] }
  },
  {
    title: "Descent of Doom",
    description: "White to move. Mate in 1.",
    hint: "The queen descends through the levels to strike.",
    difficulty: 1,
    turn: 'w',
    board: {
      '4,4,0': { type: 'K', color: 'b' },
      '0,0,4': { type: 'K', color: 'w' },
      '3,3,4': { type: 'Q', color: 'w' },
      '3,0,1': { type: 'R', color: 'w' }
    },
    solution: { from: [3,3,4], to: [3,3,1] }
  },
  {
    title: "Cross-Board Strike",
    description: "White to move. Mate in 1.",
    hint: "Send the queen across the board through the z-axis.",
    difficulty: 2,
    turn: 'w',
    board: {
      '4,0,4': { type: 'K', color: 'b' },
      '0,4,0': { type: 'K', color: 'w' },
      '3,1,0': { type: 'Q', color: 'w' },
      '3,4,3': { type: 'R', color: 'w' }
    },
    solution: { from: [3,1,0], to: [3,1,3] }
  },
  {
    title: "Level Lock",
    description: "White to move. Mate in 1.",
    hint: "Trap the king between levels with the queen's multi-dimensional reach.",
    difficulty: 2,
    turn: 'w',
    board: {
      '0,0,4': { type: 'K', color: 'b' },
      '4,4,0': { type: 'K', color: 'w' },
      '1,1,0': { type: 'Q', color: 'w' },
      '1,4,3': { type: 'R', color: 'w' }
    },
    solution: { from: [1,1,0], to: [1,1,3] }
  }
];

async function migrate() {
  console.log('📦 Starting puzzle migration...\n');

  // Get the next Monday as the starting week
  const startWeek = getStartOfWeek(new Date());
  startWeek.setDate(startWeek.getDate() + 7); // Start from next week

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < existingPuzzles.length; i++) {
    const puzzle = existingPuzzles[i];

    console.log(`📝 Migrating puzzle ${i + 1}/${existingPuzzles.length}: "${puzzle.title}"`);

    try {
      // Insert puzzle
      const { data, error } = await supabase
        .from('puzzles')
        .insert({
          title: puzzle.title,
          description: puzzle.description,
          hint: puzzle.hint,
          difficulty: puzzle.difficulty,
          board_state: puzzle.board,
          solution: puzzle.solution,
          turn: puzzle.turn,
          week_number: i + 1,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error(`   ❌ Error inserting puzzle:`, error.message);
        errorCount++;
        continue;
      }

      console.log(`   ✅ Puzzle created with ID: ${data.id}`);

      // Schedule for upcoming weeks
      const weekDate = new Date(startWeek);
      weekDate.setDate(weekDate.getDate() + (i * 7));
      const weekString = weekDate.toISOString().split('T')[0];

      const { error: scheduleError } = await supabase
        .from('weekly_puzzle_schedule')
        .insert({
          puzzle_id: data.id,
          scheduled_week: weekString
        });

      if (scheduleError) {
        console.error(`   ⚠️  Warning: Could not schedule puzzle:`, scheduleError.message);
      } else {
        console.log(`   📅 Scheduled for week of ${weekString}`);
      }

      successCount++;
      console.log('');
    } catch (error) {
      console.error(`   ❌ Unexpected error:`, error);
      errorCount++;
      console.log('');
    }
  }

  console.log('='.repeat(50));
  console.log(`✅ Migration complete!`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log('='.repeat(50));
}

// Run migration
migrate()
  .then(() => {
    console.log('\n🎉 Done! Your puzzles are now in the database.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
