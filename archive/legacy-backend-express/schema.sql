-- SmartKey-Deploy Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Keywords table
CREATE TABLE IF NOT EXISTS keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    type TEXT DEFAULT 'general' CHECK (type IN ('核心词', '长尾词', '场景词', '客户画像', '问答词', '竞品词', '品牌词', 'general')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'planned', 'done')),
    notes TEXT DEFAULT '',
    position TEXT DEFAULT '',
    related_article TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    keyword_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rank_check_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source TEXT DEFAULT 'manual',
    domain TEXT NOT NULL,
    provider TEXT DEFAULT 'serpapi',
    status TEXT DEFAULT 'completed',
    params JSONB DEFAULT '{}'::jsonb,
    keyword_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rank_check_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES rank_check_jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    found BOOLEAN DEFAULT FALSE,
    page INTEGER,
    position INTEGER,
    url TEXT,
    provider TEXT DEFAULT '',
    error TEXT DEFAULT '',
    queried_at TIMESTAMP WITH TIME ZONE,
    raw JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indexing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_url TEXT,
    action TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    params JSONB DEFAULT '{}'::jsonb,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indexing_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES indexing_jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    indexed BOOLEAN,
    coverage TEXT DEFAULT '',
    indexing_state TEXT DEFAULT '',
    last_crawl TIMESTAMP WITH TIME ZONE,
    error TEXT DEFAULT '',
    checked_at TIMESTAMP WITH TIME ZONE,
    submission_success BOOLEAN,
    status_code INTEGER,
    status_message TEXT DEFAULT '',
    retry_count INTEGER,
    raw JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_keywords_user_id ON keywords(user_id);
CREATE INDEX IF NOT EXISTS idx_keywords_status ON keywords(status);
CREATE INDEX IF NOT EXISTS idx_keywords_type ON keywords(type);
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_rank_jobs_user_id ON rank_check_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_rank_results_job_id ON rank_check_results(job_id);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_user_id ON indexing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_indexing_pages_job_id ON indexing_pages(job_id);

-- Row Level Security (RLS) - Enable for security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_check_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexing_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see/update their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Keywords policies
CREATE POLICY "Users can view own keywords" ON keywords
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own keywords" ON keywords
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own keywords" ON keywords
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own keywords" ON keywords
    FOR DELETE USING (auth.uid() = user_id);

-- Articles policies
CREATE POLICY "Users can view own articles" ON articles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own articles" ON articles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own articles" ON articles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own articles" ON articles
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own rank jobs" ON rank_check_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rank jobs" ON rank_check_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rank jobs" ON rank_check_jobs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rank jobs" ON rank_check_jobs
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own rank results" ON rank_check_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rank results" ON rank_check_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rank results" ON rank_check_results
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rank results" ON rank_check_results
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own indexing jobs" ON indexing_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own indexing jobs" ON indexing_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own indexing jobs" ON indexing_jobs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own indexing jobs" ON indexing_jobs
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own indexing pages" ON indexing_pages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own indexing pages" ON indexing_pages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own indexing pages" ON indexing_pages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own indexing pages" ON indexing_pages
    FOR DELETE USING (auth.uid() = user_id);
