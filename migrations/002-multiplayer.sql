-- ============================================
-- MULTIPLAYER TABLES
-- ============================================

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_player_id UUID REFERENCES users(id) ON DELETE SET NULL,
  black_player_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  result VARCHAR(30),
  current_turn CHAR(1) NOT NULL DEFAULT 'w' CHECK (current_turn IN ('w', 'b')),
  board_state JSONB NOT NULL,
  move_count INTEGER NOT NULL DEFAULT 0,
  invite_code VARCHAR(12) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE game_moves (
  id SERIAL PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  player_id UUID REFERENCES users(id) ON DELETE SET NULL,
  color CHAR(1) NOT NULL CHECK (color IN ('w', 'b')),
  from_pos VARCHAR(5) NOT NULL,
  to_pos VARCHAR(5) NOT NULL,
  piece_type CHAR(1) NOT NULL,
  captured_type CHAR(1),
  notation VARCHAR(20),
  board_after JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(game_id, move_number)
);

-- Indexes
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_invite ON games(invite_code);
CREATE INDEX idx_games_white ON games(white_player_id);
CREATE INDEX idx_games_black ON games(black_player_id);
CREATE INDEX idx_game_moves_game ON game_moves(game_id);
CREATE INDEX idx_game_moves_order ON game_moves(game_id, move_number);

-- RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their games"
  ON games FOR SELECT
  USING (
    auth.uid() = white_player_id OR
    auth.uid() = black_player_id OR
    status = 'waiting'
  );

CREATE POLICY "Players can view game moves"
  ON game_moves FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_moves.game_id
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
  );

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_game_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_game_timestamp();
