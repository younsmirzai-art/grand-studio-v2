-- Phase 6: Cloud UE5, Teams, Game Store, Education
-- Run once in Supabase SQL Editor before starting Phase 6 features.

-- Cloud UE5 sessions
CREATE TABLE IF NOT EXISTS cloud_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  project_id uuid,
  status text DEFAULT 'pending',
  provider text DEFAULT 'local',
  server_url text,
  pixel_streaming_url text,
  gpu_type text DEFAULT 'none',
  region text DEFAULT 'auto',
  started_at timestamp with time zone,
  last_active_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  total_minutes_used integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE cloud_sessions DISABLE ROW LEVEL SECURITY;

-- Cloud usage tracking per day
CREATE TABLE IF NOT EXISTS cloud_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  session_id uuid REFERENCES cloud_sessions(id),
  minutes_used integer DEFAULT 0,
  commands_executed integer DEFAULT 0,
  screenshots_taken integer DEFAULT 0,
  date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE cloud_usage DISABLE ROW LEVEL SECURITY;

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  owner_email text NOT NULL,
  max_members integer DEFAULT 5,
  plan text DEFAULT 'free',
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;

-- Team members
CREATE TABLE IF NOT EXISTS team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES teams(id),
  user_email text NOT NULL,
  display_name text,
  role text DEFAULT 'member',
  is_online boolean DEFAULT false,
  last_seen_at timestamp with time zone DEFAULT now(),
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE(team_id, user_email)
);
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;

-- Project collaborators
CREATE TABLE IF NOT EXISTS project_collaborators (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid,
  user_email text NOT NULL,
  display_name text,
  permission text DEFAULT 'edit',
  invited_by text NOT NULL,
  status text DEFAULT 'pending',
  invited_at timestamp with time zone DEFAULT now(),
  joined_at timestamp with time zone,
  UNIQUE(project_id, user_email)
);
ALTER TABLE project_collaborators DISABLE ROW LEVEL SECURITY;

-- Game store listings
CREATE TABLE IF NOT EXISTS game_store_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid,
  seller_email text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  long_description text,
  genre text NOT NULL DEFAULT 'action',
  tags text[] DEFAULT '{}',
  price numeric NOT NULL DEFAULT 0,
  is_free boolean DEFAULT false,
  currency text DEFAULT 'usd',
  thumbnail_url text,
  screenshots text[] DEFAULT '{}',
  trailer_url text,
  download_url text,
  file_size_mb integer DEFAULT 0,
  platforms text[] DEFAULT ARRAY['windows'],
  system_requirements jsonb DEFAULT '{}',
  rating numeric DEFAULT 0,
  rating_count integer DEFAULT 0,
  download_count integer DEFAULT 0,
  revenue_total numeric DEFAULT 0,
  commission_rate numeric DEFAULT 0.30,
  status text DEFAULT 'draft',
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE game_store_listings DISABLE ROW LEVEL SECURITY;

-- Game purchases
CREATE TABLE IF NOT EXISTS game_purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES game_store_listings(id),
  buyer_email text NOT NULL,
  seller_email text NOT NULL,
  price numeric NOT NULL,
  commission numeric NOT NULL,
  seller_payout numeric NOT NULL,
  stripe_payment_id text,
  status text DEFAULT 'completed',
  purchased_at timestamp with time zone DEFAULT now()
);
ALTER TABLE game_purchases DISABLE ROW LEVEL SECURITY;

-- Game reviews
CREATE TABLE IF NOT EXISTS game_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES game_store_listings(id),
  reviewer_email text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  review_text text,
  helpful_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE game_reviews DISABLE ROW LEVEL SECURITY;

-- Education courses
CREATE TABLE IF NOT EXISTS courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'beginner',
  difficulty text DEFAULT 'beginner',
  thumbnail_url text,
  author_name text DEFAULT 'Grand Studio',
  is_free boolean DEFAULT true,
  price numeric DEFAULT 0,
  duration_minutes integer DEFAULT 30,
  enrollment_count integer DEFAULT 0,
  rating numeric DEFAULT 0,
  is_published boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;

-- Course lessons
CREATE TABLE IF NOT EXISTS course_lessons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid REFERENCES courses(id),
  lesson_number integer NOT NULL,
  title text NOT NULL,
  description text,
  content_type text DEFAULT 'interactive',
  agent_prompt text,
  ue5_code text,
  expected_result text,
  duration_minutes integer DEFAULT 10,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE course_lessons DISABLE ROW LEVEL SECURITY;

-- Student progress
CREATE TABLE IF NOT EXISTS student_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  course_id uuid REFERENCES courses(id),
  lesson_id uuid REFERENCES course_lessons(id),
  status text DEFAULT 'not_started',
  score integer DEFAULT 0,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_email, lesson_id)
);
ALTER TABLE student_progress DISABLE ROW LEVEL SECURITY;
