import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes (will create these next)
// import authRoutes from './routes/auth.routes.js';
import puzzleRoutes from './routes/puzzle.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import adminRoutes from './routes/admin.routes.js';
import gameRoutes from './routes/game.routes.js';
import profileRoutes from './routes/profile.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import matchmakingRoutes from './routes/matchmaking.routes.js';

// Import scheduler
import { startWeeklyPuzzleScheduler } from './puzzle-scheduler.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
// app.use('/api/auth', authRoutes); // Supabase handles auth directly from client
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/matchmaking', matchmakingRoutes);

// Serve static files from public directory (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../public')));

  // Serve frontend for all other routes (SPA)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });
} else {
  // In development, just send a message for non-API routes
  app.get('*', (req, res) => {
    res.json({ message: 'Development mode - use Vite at http://localhost:5173' });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start weekly puzzle scheduler in production
  if (process.env.NODE_ENV === 'production') {
    console.log('📅 Starting weekly puzzle scheduler...');
    startWeeklyPuzzleScheduler();
  }
});
