-- ==============================================================================
-- Multiplayer Browser Game Database Schema (Supabase PostgreSQL)
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Game Sessions Table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (session_status IN ('waiting', 'active', 'finished', 'closed')),
    max_capacity INTEGER NOT NULL DEFAULT 8 CHECK (max_capacity > 0 AND max_capacity <= 64),
    host_player_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Players Table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(100) NOT NULL,
    session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
    connection_status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (connection_status IN ('online', 'offline', 'in_session')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key reference for host_player_id now that players table exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_game_sessions_host_player'
    ) THEN
        ALTER TABLE game_sessions 
        ADD CONSTRAINT fk_game_sessions_host_player 
        FOREIGN KEY (host_player_id) REFERENCES players(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Player Profiles Table
CREATE TABLE IF NOT EXISTS player_profiles (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    avatar_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Session Membership Table
CREATE TABLE IF NOT EXISTS session_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'player' CHECK (role IN ('host', 'player', 'spectator')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    CONSTRAINT unique_active_session_player UNIQUE (session_id, player_id, is_active)
);

-- ==============================================================================
-- Indexes for Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_players_connection_status ON players(connection_status);
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_session_memberships_active ON session_memberships(session_id, is_active);
CREATE INDEX IF NOT EXISTS idx_session_memberships_player ON session_memberships(player_id);

-- ==============================================================================
-- Auto-update updated_at Trigger
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_sessions_updated_at ON game_sessions;
CREATE TRIGGER trg_game_sessions_updated_at
BEFORE UPDATE ON game_sessions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_player_profiles_updated_at ON player_profiles;
CREATE TRIGGER trg_player_profiles_updated_at
BEFORE UPDATE ON player_profiles
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_memberships ENABLE ROW LEVEL SECURITY;

-- Backend Service Role has full access (bypasses RLS by default)
-- Public read policies for players and game sessions
CREATE POLICY "Public players are viewable by all" ON players
    FOR SELECT USING (true);

CREATE POLICY "Public player profiles are viewable by all" ON player_profiles
    FOR SELECT USING (true);

CREATE POLICY "Public game sessions are viewable by all" ON game_sessions
    FOR SELECT USING (true);

CREATE POLICY "Public session memberships are viewable by all" ON session_memberships
    FOR SELECT USING (true);

-- ==============================================================================
-- 5. Chat Messages Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public chat messages are viewable by all" ON chat_messages
    FOR SELECT USING (true);

