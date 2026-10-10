import { supabase } from '@/lib/supabase';

export type GoogleConnectionState =
  | 'PENDING' | 'CONNECTED' | 'ATTENTION_REQUIRED'
  | 'REFRESH_FAILED' | 'REVOKED' | 'DISCONNECTED' | 'ERROR';

export interface GoogleConnection {
  id: string;
  state: GoogleConnectionState;
  google_email: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  error_message: string | null;
}

export interface GoogleLocation {
  id: string;
  google_location_name: string;
  display_name: string | null;
  address: string | null;
  is_selected: boolean;
}

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const googleService = {
  async getConnection(): Promise<{ data?: GoogleConnection | null; error?: string }> {
    const { data, error } = await supabase
      .from('google_connections')
      .select('id, state, google_email, connected_at, last_synced_at, error_message')
      .maybeSingle();
    if (error) return { error: error.message };
    return { data };
  },

  async getLocations(): Promise<{ data?: GoogleLocation[]; error?: string }> {
    const { data, error } = await supabase
      .from('google_locations')
      .select('id, google_location_name, display_name, address, is_selected')
      .order('display_name');
    if (error) return { error: error.message };
    return { data: data ?? [] };
  },

  async startOAuth(): Promise<{ auth_url?: string; error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/google-oauth-start`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Failed to start OAuth' };
    return { auth_url: json.auth_url };
  },

  async handleCallback(code: string, state: string): Promise<{ error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/google-oauth-callback`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Callback failed' };
    return {};
  },

  async syncReviews(): Promise<{ synced?: number; error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/google-sync-reviews`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Sync failed' };
    return { synced: json.synced };
  },

  async disconnect(): Promise<{ error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/google-disconnect`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Disconnect failed' };
    return {};
  },

  async toggleLocationSelected(locationId: string, selected: boolean): Promise<{ error?: string }> {
    const { error } = await supabase
      .from('google_locations')
      .update({ is_selected: selected })
      .eq('id', locationId);
    if (error) return { error: error.message };
    return {};
  },

  async generateDraft(reviewId: string): Promise<{ draft?: string; error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/ai-generate-draft`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_id: reviewId }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'AI generation failed' };
    return { draft: json.draft };
  },

  async publishReply(reviewId: string, replyText: string): Promise<{ error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/google-publish-reply`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_id: reviewId, reply_text: replyText }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Publish failed' };
    return {};
  },
};
