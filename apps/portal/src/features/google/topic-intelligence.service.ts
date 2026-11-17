import { supabase } from '@/lib/supabase';

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

export const TOPIC_LABELS: Record<string, string> = {
  staff_service:     'Staff & Service',
  food_quality:      'Food & Quality',
  wait_time:         'Wait Time',
  value_pricing:     'Value & Pricing',
  cleanliness:       'Cleanliness',
  ambiance:          'Ambiance',
  delivery_shipping: 'Delivery',
  location_parking:  'Location & Parking',
  communication:     'Communication',
};

export interface TopicStat {
  topic:     string;
  label:     string;
  positive:  number;
  negative:  number;
  neutral:   number;
  total:     number;
}

export const topicIntelligenceService = {
  async analyze(locationId?: string | null): Promise<{ analyzed?: number; tagged?: number; error?: string }> {
    const auth = await getAuthHeader();
    if (!auth) return { error: 'Not authenticated' };
    const res = await fetch(`${BASE}/analyze-review-topics`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(locationId ? { location_id: locationId } : {}),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Analysis failed' };
    return { analyzed: data.analyzed, tagged: data.tagged };
  },

  async getTopics(orgId: string, locationId?: string | null): Promise<{ topics: TopicStat[]; error?: string }> {
    let query = supabase
      .from('review_topics')
      .select('topic, sentiment')
      .eq('org_id', orgId);

    if (locationId) query = query.eq('location_id', locationId);

    const { data, error } = await query;
    if (error) return { topics: [], error: error.message };

    // Aggregate counts
    const map = new Map<string, { positive: number; negative: number; neutral: number }>();
    for (const row of data ?? []) {
      const cur = map.get(row.topic) ?? { positive: 0, negative: 0, neutral: 0 };
      cur[row.sentiment as 'positive' | 'negative' | 'neutral']++;
      map.set(row.topic, cur);
    }

    const topics: TopicStat[] = Array.from(map.entries())
      .map(([topic, counts]) => ({
        topic,
        label:    TOPIC_LABELS[topic] ?? topic,
        positive: counts.positive,
        negative: counts.negative,
        neutral:  counts.neutral,
        total:    counts.positive + counts.negative + counts.neutral,
      }))
      .sort((a, b) => b.total - a.total);

    return { topics };
  },

  async getPendingCount(locationIds: string[]): Promise<number> {
    if (!locationIds.length) return 0;
    const { count } = await supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .in('location_id', locationIds)
      .is('topics_analyzed_at', null);
    return count ?? 0;
  },
};
