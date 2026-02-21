-- Phase 5: Game Templates Marketplace (Feature 1), Publish (Feature 2), API (Feature 3)
-- Run in Supabase SQL Editor. Can run in parts: Feature 1 tables first, then 2, then 3.

-- ========== FEATURE 1: Game Templates Marketplace ==========
CREATE TABLE IF NOT EXISTS game_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  thumbnail_url text,
  preview_images text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  author_name text NOT NULL DEFAULT 'Grand Studio',
  author_email text,
  price numeric DEFAULT 0,
  is_free boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  is_official boolean DEFAULT false,
  download_count integer DEFAULT 0,
  rating numeric DEFAULT 0,
  rating_count integer DEFAULT 0,
  template_data jsonb NOT NULL DEFAULT '{}',
  ue5_code text NOT NULL DEFAULT '',
  game_dna_preset text,
  agents_used text[] DEFAULT '{}',
  estimated_build_time integer DEFAULT 5,
  difficulty text DEFAULT 'beginner',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE game_templates DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS template_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES game_templates(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE template_reviews DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS template_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES game_templates(id) ON DELETE CASCADE,
  project_id uuid,
  user_email text,
  used_at timestamp with time zone DEFAULT now()
);
ALTER TABLE template_usage DISABLE ROW LEVEL SECURITY;

-- ========== FEATURE 2: Publish to Steam (prep) ==========
CREATE TABLE IF NOT EXISTS publish_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid,
  platform text DEFAULT 'steam',
  game_title text NOT NULL,
  short_description text,
  long_description text,
  genre text,
  tags text[] DEFAULT '{}',
  price numeric DEFAULT 0,
  screenshots text[] DEFAULT '{}',
  header_image text,
  build_config jsonb DEFAULT '{}',
  status text DEFAULT 'draft',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE publish_configs DISABLE ROW LEVEL SECURITY;

-- ========== FEATURE 3: Grand Studio API ==========
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  api_key text NOT NULL UNIQUE,
  name text DEFAULT 'Default',
  is_active boolean DEFAULT true,
  rate_limit integer DEFAULT 100,
  usage_count integer DEFAULT 0,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS api_usage_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id uuid REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer,
  response_time_ms integer,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE api_usage_log DISABLE ROW LEVEL SECURITY;
