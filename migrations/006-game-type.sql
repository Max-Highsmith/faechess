-- Add game type to support different chess variants (raumschach, torus)
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_type VARCHAR(20) DEFAULT 'raumschach';
