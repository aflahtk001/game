import { getSupabaseClient } from './supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';

export type ConnectionStatus = 'online' | 'offline' | 'in_session';
export type SessionStatus = 'waiting' | 'active' | 'finished' | 'closed';
export type MemberRole = 'host' | 'player' | 'spectator';

export interface DbPlayer {
  id: string;
  display_name: string;
  session_id: string | null;
  connection_status: ConnectionStatus;
  created_at: string;
  last_seen_at: string;
}

export interface DbPlayerProfile {
  player_id: string;
  avatar_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbGameSession {
  id: string;
  session_status: SessionStatus;
  max_capacity: number;
  host_player_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSessionMembership {
  id: string;
  session_id: string;
  player_id: string;
  role: MemberRole;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
}

export interface IDatabaseAdapter {
  // Players
  getPlayer(id: string): Promise<DbPlayer | null>;
  upsertPlayer(player: Partial<DbPlayer> & { id: string; display_name: string }): Promise<DbPlayer>;
  updatePlayer(id: string, updates: Partial<DbPlayer>): Promise<DbPlayer | null>;
  
  // Profiles
  getPlayerProfile(playerId: string): Promise<DbPlayerProfile | null>;
  upsertPlayerProfile(profile: Partial<DbPlayerProfile> & { player_id: string }): Promise<DbPlayerProfile>;

  // Sessions
  createSession(session: { host_player_id: string | null; max_capacity?: number; session_status?: SessionStatus }): Promise<DbGameSession>;
  getSession(id: string): Promise<DbGameSession | null>;
  updateSession(id: string, updates: Partial<DbGameSession>): Promise<DbGameSession | null>;
  listSessions(statusFilter?: SessionStatus[]): Promise<DbGameSession[]>;

  // Session Memberships
  addSessionMember(membership: { session_id: string; player_id: string; role?: MemberRole }): Promise<DbSessionMembership>;
  getSessionMembers(sessionId: string, activeOnly?: boolean): Promise<DbSessionMembership[]>;
  getActiveMembershipByPlayer(playerId: string): Promise<DbSessionMembership | null>;
  deactivateSessionMember(sessionId: string, playerId: string): Promise<boolean>;
}

// ==============================================================================
// In-Memory Storage Fallback (for local development before Supabase config)
// ==============================================================================
class MemoryDbAdapter implements IDatabaseAdapter {
  private players: Map<string, DbPlayer> = new Map();
  private profiles: Map<string, DbPlayerProfile> = new Map();
  private sessions: Map<string, DbGameSession> = new Map();
  private memberships: Map<string, DbSessionMembership> = new Map();

  async getPlayer(id: string): Promise<DbPlayer | null> {
    return this.players.get(id) || null;
  }

  async upsertPlayer(data: Partial<DbPlayer> & { id: string; display_name: string }): Promise<DbPlayer> {
    const existing = this.players.get(data.id);
    const now = new Date().toISOString();
    const player: DbPlayer = {
      id: data.id,
      display_name: data.display_name,
      session_id: data.session_id !== undefined ? data.session_id : (existing ? existing.session_id : null),
      connection_status: data.connection_status || existing?.connection_status || 'online',
      created_at: existing ? existing.created_at : now,
      last_seen_at: now,
    };
    this.players.set(player.id, player);
    return player;
  }

  async updatePlayer(id: string, updates: Partial<DbPlayer>): Promise<DbPlayer | null> {
    const existing = this.players.get(id);
    if (!existing) return null;
    const updated: DbPlayer = {
      ...existing,
      ...updates,
      last_seen_at: updates.last_seen_at || new Date().toISOString(),
    };
    this.players.set(id, updated);
    return updated;
  }

  async getPlayerProfile(playerId: string): Promise<DbPlayerProfile | null> {
    return this.profiles.get(playerId) || null;
  }

  async upsertPlayerProfile(data: Partial<DbPlayerProfile> & { player_id: string }): Promise<DbPlayerProfile> {
    const existing = this.profiles.get(data.player_id);
    const now = new Date().toISOString();
    const profile: DbPlayerProfile = {
      player_id: data.player_id,
      avatar_url: data.avatar_url !== undefined ? data.avatar_url : (existing?.avatar_url || null),
      settings: data.settings || existing?.settings || {},
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };
    this.profiles.set(profile.player_id, profile);
    return profile;
  }

  async createSession(data: { host_player_id: string | null; max_capacity?: number; session_status?: SessionStatus }): Promise<DbGameSession> {
    const now = new Date().toISOString();
    const session: DbGameSession = {
      id: uuidv4(),
      host_player_id: data.host_player_id,
      max_capacity: data.max_capacity || 8,
      session_status: data.session_status || 'waiting',
      created_at: now,
      updated_at: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(id: string): Promise<DbGameSession | null> {
    return this.sessions.get(id) || null;
  }

  async updateSession(id: string, updates: Partial<DbGameSession>): Promise<DbGameSession | null> {
    const existing = this.sessions.get(id);
    if (!existing) return null;
    const updated: DbGameSession = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async listSessions(statusFilter?: SessionStatus[]): Promise<DbGameSession[]> {
    const all = Array.from(this.sessions.values());
    if (!statusFilter || statusFilter.length === 0) {
      return all.filter(s => s.session_status !== 'closed' && s.session_status !== 'finished');
    }
    return all.filter(s => statusFilter.includes(s.session_status));
  }

  async addSessionMember(data: { session_id: string; player_id: string; role?: MemberRole }): Promise<DbSessionMembership> {
    // Deactivate previous active memberships for this player
    for (const [id, m] of this.memberships.entries()) {
      if (m.player_id === data.player_id && m.is_active) {
        this.memberships.set(id, { ...m, is_active: false, left_at: new Date().toISOString() });
      }
    }

    const membership: DbSessionMembership = {
      id: uuidv4(),
      session_id: data.session_id,
      player_id: data.player_id,
      role: data.role || 'player',
      is_active: true,
      joined_at: new Date().toISOString(),
      left_at: null,
    };
    this.memberships.set(membership.id, membership);
    return membership;
  }

  async getSessionMembers(sessionId: string, activeOnly = true): Promise<DbSessionMembership[]> {
    return Array.from(this.memberships.values()).filter(
      m => m.session_id === sessionId && (!activeOnly || m.is_active)
    );
  }

  async getActiveMembershipByPlayer(playerId: string): Promise<DbSessionMembership | null> {
    for (const m of this.memberships.values()) {
      if (m.player_id === playerId && m.is_active) {
        return m;
      }
    }
    return null;
  }

  async deactivateSessionMember(sessionId: string, playerId: string): Promise<boolean> {
    let found = false;
    for (const [id, m] of this.memberships.entries()) {
      if (m.session_id === sessionId && m.player_id === playerId && m.is_active) {
        this.memberships.set(id, { ...m, is_active: false, left_at: new Date().toISOString() });
        found = true;
      }
    }
    return found;
  }
}

// ==============================================================================
// Supabase Database Adapter (Production & Live Connection)
// ==============================================================================
class SupabaseDbAdapter implements IDatabaseAdapter {
  private get client() {
    const c = getSupabaseClient();
    if (!c) throw new Error('Supabase client unavailable');
    return c;
  }

  async getPlayer(id: string): Promise<DbPlayer | null> {
    const { data, error } = await this.client
      .from('players')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseDb] getPlayer error:', error);
      return null;
    }
    return data as DbPlayer | null;
  }

  async upsertPlayer(player: Partial<DbPlayer> & { id: string; display_name: string }): Promise<DbPlayer> {
    const now = new Date().toISOString();
    const payload = {
      id: player.id,
      display_name: player.display_name,
      session_id: player.session_id !== undefined ? player.session_id : null,
      connection_status: player.connection_status || 'online',
      last_seen_at: now,
    };

    const { data, error } = await this.client
      .from('players')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseDb] upsertPlayer error:', error);
      throw error;
    }
    return data as DbPlayer;
  }

  async updatePlayer(id: string, updates: Partial<DbPlayer>): Promise<DbPlayer | null> {
    const { data, error } = await this.client
      .from('players')
      .update({
        ...updates,
        last_seen_at: updates.last_seen_at || new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[SupabaseDb] updatePlayer error:', error);
      return null;
    }
    return data as DbPlayer | null;
  }

  async getPlayerProfile(playerId: string): Promise<DbPlayerProfile | null> {
    const { data, error } = await this.client
      .from('player_profiles')
      .select('*')
      .eq('player_id', playerId)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseDb] getPlayerProfile error:', error);
      return null;
    }
    return data as DbPlayerProfile | null;
  }

  async upsertPlayerProfile(profile: Partial<DbPlayerProfile> & { player_id: string }): Promise<DbPlayerProfile> {
    const { data, error } = await this.client
      .from('player_profiles')
      .upsert({
        player_id: profile.player_id,
        avatar_url: profile.avatar_url || null,
        settings: profile.settings || {},
      }, { onConflict: 'player_id' })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseDb] upsertPlayerProfile error:', error);
      throw error;
    }
    return data as DbPlayerProfile;
  }

  async createSession(session: { host_player_id: string | null; max_capacity?: number; session_status?: SessionStatus }): Promise<DbGameSession> {
    const { data, error } = await this.client
      .from('game_sessions')
      .insert({
        host_player_id: session.host_player_id,
        max_capacity: session.max_capacity || 8,
        session_status: session.session_status || 'waiting',
      })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseDb] createSession error:', error);
      throw error;
    }
    return data as DbGameSession;
  }

  async getSession(id: string): Promise<DbGameSession | null> {
    const { data, error } = await this.client
      .from('game_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseDb] getSession error:', error);
      return null;
    }
    return data as DbGameSession | null;
  }

  async updateSession(id: string, updates: Partial<DbGameSession>): Promise<DbGameSession | null> {
    const { data, error } = await this.client
      .from('game_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[SupabaseDb] updateSession error:', error);
      return null;
    }
    return data as DbGameSession | null;
  }

  async listSessions(statusFilter?: SessionStatus[]): Promise<DbGameSession[]> {
    let query = this.client.from('game_sessions').select('*');
    if (statusFilter && statusFilter.length > 0) {
      query = query.in('session_status', statusFilter);
    } else {
      query = query.neq('session_status', 'closed');
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('[SupabaseDb] listSessions error:', error);
      return [];
    }
    return data as DbGameSession[];
  }

  async addSessionMember(membership: { session_id: string; player_id: string; role?: MemberRole }): Promise<DbSessionMembership> {
    // Deactivate previous active memberships for this player
    await this.client
      .from('session_memberships')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('player_id', membership.player_id)
      .eq('is_active', true);

    const { data, error } = await this.client
      .from('session_memberships')
      .insert({
        session_id: membership.session_id,
        player_id: membership.player_id,
        role: membership.role || 'player',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseDb] addSessionMember error:', error);
      throw error;
    }
    return data as DbSessionMembership;
  }

  async getSessionMembers(sessionId: string, activeOnly = true): Promise<DbSessionMembership[]> {
    let query = this.client
      .from('session_memberships')
      .select('*')
      .eq('session_id', sessionId);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[SupabaseDb] getSessionMembers error:', error);
      return [];
    }
    return data as DbSessionMembership[];
  }

  async getActiveMembershipByPlayer(playerId: string): Promise<DbSessionMembership | null> {
    const { data, error } = await this.client
      .from('session_memberships')
      .select('*')
      .eq('player_id', playerId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseDb] getActiveMembershipByPlayer error:', error);
      return null;
    }
    return data as DbSessionMembership | null;
  }

  async deactivateSessionMember(sessionId: string, playerId: string): Promise<boolean> {
    const { error } = await this.client
      .from('session_memberships')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .eq('is_active', true);

    if (error) {
      console.error('[SupabaseDb] deactivateSessionMember error:', error);
      return false;
    }
    return true;
  }
}

// Select database adapter dynamically based on Supabase configuration
const memoryAdapter = new MemoryDbAdapter();
const supabaseAdapter = new SupabaseDbAdapter();

export const db: IDatabaseAdapter = new Proxy({} as IDatabaseAdapter, {
  get(_target, prop: keyof IDatabaseAdapter) {
    const client = getSupabaseClient();
    const adapter = client ? supabaseAdapter : memoryAdapter;
    const value = adapter[prop];
    return typeof value === 'function' ? value.bind(adapter) : value;
  },
});
