-- Migration: Add waitlist table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS waitlist (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL UNIQUE,
    plan text DEFAULT 'pro',
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE waitlist DISABLE ROW LEVEL SECURITY;
