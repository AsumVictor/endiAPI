-- Migration: Add transcript_url column to videos table
-- Date: 2024
-- Description: Adds transcript_url field to store the URL of video transcripts

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS transcript_url TEXT;

COMMENT ON COLUMN videos.transcript_url IS 'URL to the video transcript';

