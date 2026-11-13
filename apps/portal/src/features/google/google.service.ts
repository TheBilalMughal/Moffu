import { supabase } from '@/lib/supabase';

export type GoogleConnectionState =
  | 'PENDING' | 'CONNECTED' | 'ATTENTION_REQUIRED'
  | 'REFRESH_FAILED' | 'REVOKED' | 'DISCONNECTED' | 'ERROR';

export type AutoSyncInterval = '12h' | '24h' | (string & {});

export interface AutoSchedule { type: 'always' | 'scheduled'; from: string; to: string; }

export interface GoogleConnection {
  id: string;
  state: GoogleConnectionState;
  google_email: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  error_message: string | null;
  auto_sync_enabled: boolean;
  auto_sync_interval: AutoSyncInterval;
  auto_draft_enabled: boolean;
  auto_draft_schedule: AutoSchedule;
  auto_publish_enabled: boolean;
  auto_publish_schedule: AutoSchedule;
}

export interface GoogleLocation {
  id: string;
  google_location_name: string;
  display_name: string | null;
  address: string | null;
  is_selected: boolean;
  description: string | null;
}

export interface Competitor {
  position: number;
  name: string;
  place_id: string;
  rating: number | null;
  review_count: number;
  address: string | null;
  distance_km: number;
  is_you: boolean;
}

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface BusinessSearchResult {
  place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  reviews_count: number | null;
}

export const googleService = {
  async getConnection(): Promise<{ data?: GoogleConnection | null; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null };
    const { data, error } = await supabase
      .from('google_connections')
      .select('id, state, google_email, connected_at, last_synced_at, error_message, auto_sync_enabled, auto_sync_interval, auto_draft_enabled, auto_draft_schedule, auto_publish_enabled, auto_publish_schedule')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return { error: error.message };
    return { data };
  },

  async updateAutoSync(connectionId: string, enabled: boolean, interval: AutoSyncInterval): Promise<{ error?: string }> {
    const { error } = await supabase
      .from('google_connections')
      .update({ auto_sync_enabled: enabled, auto_sync_interval: interval })
      .eq('id', connectionId);
    if (error) return { error: error.message };
    return {};
  },

  async updateAutoDraftPublish(connectionId: string, updates: Partial<{
    auto_draft_enabled: boolean; auto_draft_schedule: AutoSchedule;
    auto_publish_enabled: boolean; auto_publish_schedule: AutoSchedule;
  }>): Promise<{ error?: string }> {
    const { error } = await supabase
      .from('google_connections')
      .update(updates)
      .eq('id', connectionId);
    if (error) return { error: error.message };
    return {};
  },

  async getLocations(): Promise<{ data?: GoogleLocation[]; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [] };
    const { data, error } = await supabase
      .from('google_locations')
      .select('id, google_location_name, display_name, address, is_selected, description')
      .eq('user_id', user.id)
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

  async syncReviews(): Promise<{ synced?: number; error?: string; errors?: string[] }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/google-sync-reviews`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Sync failed' };
    return { synced: json.synced, errors: json.errors };
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

  async fetchLocations(): Promise<{ locations_fetched?: number; error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/google-fetch-locations`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Failed to fetch locations' };
    return { locations_fetched: json.locations_fetched };
  },

  async getCompetitors(locationId: string | null, radiusKm: number): Promise<{ competitors?: Competitor[]; error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };
    const res = await fetch(`${BASE}/google-competitors`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, radius_km: radiusKm }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Failed to fetch competitors' };
    return { competitors: json.competitors };
  },

  async searchBusiness(keyword: string): Promise<{ businesses?: BusinessSearchResult[]; error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };

    const res = await fetch(`${BASE}/google-search-business`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Search failed' };
    return { businesses: json.businesses };
  },

  async addLocationByPlaceId(
    connectionId: string,
    placeId: string,
    displayName: string,
    address: string | null,
  ): Promise<{ error?: string }> {
    const { error } = await supabase.from('google_locations').upsert({
      connection_id: connectionId,
      google_location_name: `places/${placeId}`,
      display_name: displayName,
      address,
      dataforseo_place_id: placeId,
      is_selected: true,
    }, { onConflict: 'connection_id,google_location_name' });
    if (error) return { error: error.message };
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
