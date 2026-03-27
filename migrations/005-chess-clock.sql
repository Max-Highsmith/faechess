-- Add chess clock support to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS time_control INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS white_time_remaining INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS black_time_remaining INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_move_at TIMESTAMPTZ;
