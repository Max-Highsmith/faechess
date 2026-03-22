-- Migration 004: Add Elo rating system to users table

ALTER TABLE users ADD COLUMN elo_rating INTEGER NOT NULL DEFAULT 1200;
ALTER TABLE users ADD COLUMN games_played INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN draws INTEGER NOT NULL DEFAULT 0;

-- Index for leaderboard queries (sorted by rating descending)
CREATE INDEX idx_users_elo ON users(elo_rating DESC);
