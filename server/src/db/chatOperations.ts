import { getSupabaseClient } from './supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  session_id: string;
  player_id: string;
  display_name: string;
  content: string;
  created_at: string;
}

// Memory fallback if Supabase is down or unconfigured
const memoryChatHistory: Map<string, ChatMessage[]> = new Map();

export async function insertChatMessage(
  sessionId: string,
  playerId: string,
  displayName: string,
  content: string
): Promise<ChatMessage> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  
  const msg: ChatMessage = {
    id: uuidv4(),
    session_id: sessionId,
    player_id: playerId,
    display_name: displayName,
    content,
    created_at: now
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          id: msg.id,
          session_id: msg.session_id,
          player_id: msg.player_id,
          display_name: msg.display_name,
          content: msg.content,
          created_at: msg.created_at
        }])
        .select()
        .single();
        
      if (error) {
        // Table might not exist yet if user hasn't run the SQL, fallback to memory
        console.warn('[ChatOperations] Supabase insert failed, falling back to memory. Error:', error.message);
        fallbackInsert(msg);
      } else if (data) {
        return data as ChatMessage;
      }
    } catch (e) {
      console.warn('[ChatOperations] Supabase exception, falling back to memory.');
      fallbackInsert(msg);
    }
  } else {
    fallbackInsert(msg);
  }

  return msg;
}

export async function getChatHistory(sessionId: string, limit = 50): Promise<ChatMessage[]> {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);
        
      if (error) {
        console.warn('[ChatOperations] Supabase fetch failed, falling back to memory. Error:', error.message);
        return fallbackGetHistory(sessionId, limit);
      } else if (data) {
        return (data as ChatMessage[]).reverse(); // Return in chronological order
      }
    } catch (e) {
      return fallbackGetHistory(sessionId, limit);
    }
  }
  
  return fallbackGetHistory(sessionId, limit);
}

function fallbackInsert(msg: ChatMessage) {
  if (!memoryChatHistory.has(msg.session_id)) {
    memoryChatHistory.set(msg.session_id, []);
  }
  const history = memoryChatHistory.get(msg.session_id)!;
  history.push(msg);
  // Keep only the last 100 in memory
  if (history.length > 100) {
    history.shift();
  }
}

function fallbackGetHistory(sessionId: string, limit: number): ChatMessage[] {
  const history = memoryChatHistory.get(sessionId) || [];
  return history.slice(-limit);
}
