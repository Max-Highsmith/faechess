-- Raumschach Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_admin BOOLEAN DEFAULT FALSE
);

-- Puzzles table
CREATE TABLE puzzles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  hint TEXT,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
  board_state JSONB NOT NULL,
  solution JSONB NOT NULL,
  turn CHAR(1) NOT NULL CHECK (turn IN ('w', 'b')),
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  week_number INTEGER UNIQUE,
  tags TEXT[] DEFAULT '{}'
);

-- User puzzle attempts
CREATE TABLE user_puzzle_attempts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id INTEGER REFERENCES puzzles(id) ON DELETE CASCADE,
  solved BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  first_attempt_at TIMESTAMP DEFAULT NOW(),
  solved_at TIMESTAMP,
  UNIQUE(user_id, puzzle_id)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMP DEFAULT NOW(),
  unsubscribed_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Weekly puzzle schedule
CREATE TABLE weekly_puzzle_schedule (
  id SERIAL PRIMARY KEY,
  puzzle_id INTEGER REFERENCES puzzles(id) UNIQUE,
  scheduled_week DATE NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================

CREATE INDEX idx_puzzles_active ON puzzles(is_active);
CREATE INDEX idx_puzzles_week_number ON puzzles(week_number);
CREATE INDEX idx_user_attempts_user ON user_puzzle_attempts(user_id);
CREATE INDEX idx_user_attempts_puzzle ON user_puzzle_attempts(puzzle_id);
CREATE INDEX idx_user_attempts_solved ON user_puzzle_attempts(solved);
CREATE INDEX idx_subscriptions_active ON subscriptions(is_active);
CREATE INDEX idx_schedule_week ON weekly_puzzle_schedule(scheduled_week);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_puzzle_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_puzzle_schedule ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Puzzles table policies
CREATE POLICY "Anyone can view active puzzles"
  ON puzzles FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can insert puzzles"
  ON puzzles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can update puzzles"
  ON puzzles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can delete puzzles"
  ON puzzles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- User puzzle attempts policies
CREATE POLICY "Users can view own attempts"
  ON user_puzzle_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts"
  ON user_puzzle_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attempts"
  ON user_puzzle_attempts FOR UPDATE
  USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscription"
  ON subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Weekly puzzle schedule policies
CREATE POLICY "Anyone can view schedule"
  ON weekly_puzzle_schedule FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage schedule"
  ON weekly_puzzle_schedule FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to automatically create user record when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update last_login timestamp
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET last_login = now()
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SAMPLE DATA (optional - for testing)
-- ============================================

-- Create a sample admin user (replace with your email)
-- First, sign up through your app, then run this to make yourself admin:
-- UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';

-- ============================================
-- NOTES
-- ============================================
-- 1. Run this entire file in the Supabase SQL Editor
-- 2. After running, sign up for an account through your app
-- 3. Make yourself admin by running the UPDATE query above
-- 4. Then run the puzzle migration script to import existing puzzles
