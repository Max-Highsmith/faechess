-- Migration: Add game_id and avatar_url to users table
-- Run this in Supabase SQL Editor

-- Add profile columns
ALTER TABLE users ADD COLUMN game_id VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Constraint: game_id must be 3-20 chars, alphanumeric + underscores only
ALTER TABLE users ADD CONSTRAINT game_id_format
  CHECK (game_id ~ '^[a-zA-Z0-9_]{3,20}$');

-- Index for fast game_id lookups
CREATE INDEX idx_users_game_id ON users(game_id);

-- ===================================
-- Supabase Storage: avatars bucket
-- ===================================

-- Create avatars bucket (public so avatar URLs are accessible)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Policy: authenticated users can upload to their own folder
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: authenticated users can update/overwrite their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
