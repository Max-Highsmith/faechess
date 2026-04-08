-- Matchmaking queue for ranked play
-- Players join the queue and get paired FIFO with someone queuing for the same game_type + time_control

CREATE TABLE matchmaking_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL DEFAULT 'raumschach',
  time_control INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(player_id, game_type, time_control)
);

-- Fast lookup for matching: find oldest waiting player with same criteria
CREATE INDEX idx_queue_match ON matchmaking_queue (game_type, time_control, created_at ASC);

-- Fast cleanup of stale entries
CREATE INDEX idx_queue_stale ON matchmaking_queue (created_at);

-- RLS policies
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Players can insert their own queue entries
CREATE POLICY "Players can join queue" ON matchmaking_queue
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Players can delete their own queue entries
CREATE POLICY "Players can leave queue" ON matchmaking_queue
  FOR DELETE USING (auth.uid() = player_id);

-- Players can view queue entries (needed for matchmaking queries via service role)
CREATE POLICY "Players can view queue" ON matchmaking_queue
  FOR SELECT USING (true);
