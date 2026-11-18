import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY     = Deno.env.get('GEMINI_API_KEY')!;
const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY')!;
const CRON_SECRET        = Deno.env.get('CRON_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function prevMonth(month: string): string {
  const parts = month.split('-').map(Number);
  const y = parts[0] ?? 2024;
  const m = parts[1] ?? 1;
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const parts = month.split('-').map(Number);
  const y = parts[0] ?? 2024;
  const m = parts[1] ?? 1;
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

async function callGemini(prompt: string): Promise<string> {
  for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      },
    );
    if (!res.ok) continue;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (text) return text;
  }
  return '';
}

async function sendDigestEmail(params: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  if (!RESEND_API_KEY) { console.error('RESEND_API_KEY not set'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Moffu <notifications@moffu.pro>',
      reply_to: 'support@moffu.pro',
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });
  if (!res.ok) console.error('Resend error:', await res.text());
}

// ── Core: generate digest for one org ─────────────────────────────────────────

async function generateForOrg(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  month: string,
): Promise<{ ok: boolean; error?: string }> {
  const prev = prevMonth(month);
  const monthStart = `${month}-01`;
  // Handle December → next year January correctly
  const [mYear, mMonth] = month.split('-').map(Number);
  const nextYear  = mMonth === 12 ? mYear + 1 : mYear;
  const nextMonth = mMonth === 12 ? 1 : mMonth + 1;
  const monthEnd  = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  const prevStart = `${prev}-01`;

  // Org info
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();

  // Get location IDs for this org (reviews are linked via location_id, not org_id)
  const { data: locations } = await supabase
    .from('google_locations')
    .select('id')
    .eq('org_id', orgId);
  const locationIds = (locations ?? []).map((l: { id: string }) => l.id);

  if (locationIds.length === 0) return { ok: true };

  // Reviews this month
  const { data: monthReviews } = await supabase
    .from('reviews')
    .select('id, rating, body, reviewer_name, reply_text, published_at')
    .in('location_id', locationIds)
    .gte('published_at', monthStart)
    .lt('published_at', monthEnd)
    .order('published_at', { ascending: false });

  const reviews = monthReviews ?? [];
  const reviewCount = reviews.length;

  if (reviewCount === 0) {
    // Skip orgs with no reviews this month
    return { ok: true };
  }

  // Rating distribution
  const ratingDist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let ratingSum = 0;
  let repliedCount = 0;
  for (const r of reviews) {
    ratingDist[String(r.rating)] = (ratingDist[String(r.rating)] ?? 0) + 1;
    ratingSum += r.rating;
    if (r.reply_text) repliedCount++;
  }
  const avgRating = reviewCount > 0 ? Math.round((ratingSum / reviewCount) * 100) / 100 : null;
  const replyRate  = reviewCount > 0 ? Math.round((repliedCount / reviewCount) * 100) : 0;

  // Previous month avg for comparison
  const { data: prevReviews } = await supabase
    .from('reviews')
    .select('rating')
    .in('location_id', locationIds)
    .gte('published_at', prevStart)
    .lt('published_at', monthStart);

  const prevRatings = (prevReviews ?? []).map((r: { rating: number }) => r.rating);
  const avgRatingPrev = prevRatings.length > 0
    ? Math.round((prevRatings.reduce((a, b) => a + b, 0) / prevRatings.length) * 100) / 100
    : null;

  // Pending (unreplied) reviews across all time
  const { count: pendingCount } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .in('location_id', locationIds)
    .is('reply_text', null);

  // Top topics from this month's reviews
  const reviewIds = reviews.map((r: { id: string }) => r.id);
  const { data: topicsData } = reviewIds.length
    ? await supabase
        .from('review_topics')
        .select('topic, sentiment')
        .in('review_id', reviewIds)
    : { data: [] };

  const topicMap = new Map<string, { positive: number; negative: number; neutral: number; label: string }>();
  const TOPIC_LABELS: Record<string, string> = {
    staff_service: 'Staff & Service', food_quality: 'Food & Quality', wait_time: 'Wait Time',
    value_pricing: 'Value & Pricing', cleanliness: 'Cleanliness', ambiance: 'Ambiance',
    delivery_shipping: 'Delivery', location_parking: 'Location & Parking', communication: 'Communication',
  };
  for (const t of topicsData ?? []) {
    const cur = topicMap.get(t.topic) ?? { positive: 0, negative: 0, neutral: 0, label: TOPIC_LABELS[t.topic] ?? t.topic };
    cur[t.sentiment as 'positive' | 'negative' | 'neutral']++;
    topicMap.set(t.topic, cur);
  }
  const topTopics = Array.from(topicMap.entries())
    .map(([topic, v]) => ({ topic, label: v.label, positive: v.positive, negative: v.negative, neutral: v.neutral, total: v.positive + v.negative + v.neutral }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Sample reviews for Gemini context
  const best  = [...reviews].sort((a, b) => b.rating - a.rating).find(r => r.body?.length > 20);
  const worst = [...reviews].filter(r => r.rating <= 2 && r.body?.length > 20)[0];
  const sample = reviews.filter(r => r.body?.length > 20).slice(0, 8);

  const ratingDelta = avgRating && avgRatingPrev ? (avgRating - avgRatingPrev).toFixed(2) : null;

  // ── Gemini prompt ─────────────────────────────────────────────────────────
  const topicsText = topTopics.length
    ? topTopics.map(t => `${t.label}: ${t.total} mentions (${t.positive} positive, ${t.negative} negative)`).join('\n')
    : 'No topics analyzed yet.';

  const sampleText = sample.map((r: { rating: number; reviewer_name?: string; body?: string }) =>
    `[${r.rating}★] ${r.reviewer_name ?? 'Customer'}: ${r.body?.slice(0, 200)}`).join('\n\n');

  const prompt = `You are writing a monthly performance digest for a business called "${org?.name ?? 'this business'}" on Moffu (a review management platform).

Month: ${monthLabel(month)}
Reviews received: ${reviewCount}
Average rating: ${avgRating ?? 'N/A'}${ratingDelta ? ` (${Number(ratingDelta) >= 0 ? '+' : ''}${ratingDelta} vs last month)` : ''}
Reply rate: ${replyRate}%
Pending unreplied reviews: ${pendingCount ?? 0}

Top topics mentioned:
${topicsText}

Sample reviews this month:
${sampleText || '(no review text available)'}

Write a JSON object with these exact keys (no markdown, raw JSON only):
{
  "summary": "2-3 sentence plain text overview of this month's review performance. Be specific, honest, and business-focused.",
  "insights": ["insight 1 (specific finding from the data)", "insight 2", "insight 3"],
  "actions": [
    {"title": "short action title", "description": "1 sentence action description"},
    {"title": "...", "description": "..."},
    {"title": "...", "description": "..."}
  ]
}`;

  const rawText = await callGemini(prompt);
  let summary = `${reviewCount} reviews received in ${monthLabel(month)} with an average rating of ${avgRating ?? 'N/A'}.`;
  let insightsList: string[] = [];
  let actionItems: { title: string; description: string }[] = [];

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.summary) summary = parsed.summary;
      if (Array.isArray(parsed.insights)) insightsList = parsed.insights.slice(0, 3);
      if (Array.isArray(parsed.actions)) actionItems = parsed.actions.slice(0, 3);
    }
  } catch { /* use defaults */ }

  // Build insights HTML
  const insightsHtml = insightsList.length
    ? insightsList.map(i => `<li style="margin-bottom:10px;font-size:14px;color:#374151;line-height:1.6;">${i}</li>`).join('')
    : '';

  const emailSubject = `Your ${monthLabel(month)} Review Digest — ${reviewCount} reviews, ${avgRating ?? '?'}★ avg`;

  // ── Email HTML ────────────────────────────────────────────────────────────
  const ratingArrow = avgRating && avgRatingPrev
    ? (avgRating >= avgRatingPrev ? '↑' : '↓')
    : '';
  const ratingColor = avgRating && avgRatingPrev
    ? (avgRating >= avgRatingPrev ? '#10B981' : '#EF4444')
    : '#6C55E8';

  const starBars = [5, 4, 3, 2, 1].map(star => {
    const count = ratingDist[String(star)] ?? 0;
    const pct = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0;
    const barColor = star >= 4 ? '#10B981' : star === 3 ? '#F59E0B' : '#EF4444';
    return `
      <tr>
        <td style="font-size:12px;color:#6B7280;white-space:nowrap;padding-right:8px;width:16px;">${star}★</td>
        <td style="padding-right:8px;">
          <div style="background:#F3F4F6;border-radius:4px;height:8px;width:120px;">
            <div style="background:${barColor};border-radius:4px;height:8px;width:${pct}%;"></div>
          </div>
        </td>
        <td style="font-size:12px;color:#9CA3AF;white-space:nowrap;">${count}</td>
      </tr>`;
  }).join('');

  const topicsRows = topTopics.slice(0, 4).map(t => {
    const posColor = '#10B981'; const negColor = '#EF4444';
    return `
      <tr style="border-bottom:1px solid #F3F4F6;">
        <td style="padding:8px 0;font-size:13px;color:#374151;font-weight:600;">${t.label}</td>
        <td style="padding:8px 0 8px 12px;font-size:12px;color:${posColor};">${t.positive} pos</td>
        <td style="padding:8px 0 8px 8px;font-size:12px;color:${negColor};">${t.negative} neg</td>
        <td style="padding:8px 0 8px 8px;font-size:12px;color:#9CA3AF;text-align:right;">${t.total} total</td>
      </tr>`;
  }).join('');

  const actionsHtml = actionItems.map((a, i) => `
    <tr>
      <td style="padding:14px 0${i < actionItems.length - 1 ? ';border-bottom:1px solid #F3F4F6' : ''};">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:top;padding-top:3px;padding-right:12px;">
            <div style="width:22px;height:22px;background:#6C55E8;border-radius:6px;text-align:center;line-height:22px;font-size:11px;font-weight:800;color:#fff;">${i + 1}</div>
          </td>
          <td>
            <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">${a.title}</p>
            <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">${a.description}</p>
          </td>
        </tr></table>
      </td>
    </tr>`).join('');

  const year = new Date().getFullYear();
  const appUrl = 'https://app.moffu.pro';

  const emailHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F4F1FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1FF;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- Logo -->
      <tr><td align="center" style="padding-bottom:24px;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#6C55E8;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
            <span style="color:#fff;font-size:18px;font-weight:900;line-height:36px;">M</span>
          </td>
          <td style="padding-left:10px;font-size:20px;font-weight:900;color:#111827;letter-spacing:-0.03em;vertical-align:middle;">Moffu</td>
        </tr></table>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">

        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#6C55E8;padding:28px 36px 24px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.08em;">Monthly Digest</p>
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.03em;line-height:1.2;">${monthLabel(month)}</h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.72);line-height:1.5;">${org?.name ?? 'Your business'} &mdash; here&rsquo;s how your reviews performed.</p>
          </td></tr>
        </table>

        <!-- KPI strip -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #F3F4F6;">
          <tr>
            <td style="padding:20px 24px;text-align:center;border-right:1px solid #F3F4F6;">
              <p style="margin:0 0 2px;font-size:28px;font-weight:900;color:#111827;letter-spacing:-0.03em;">${reviewCount}</p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;">Reviews</p>
            </td>
            <td style="padding:20px 24px;text-align:center;border-right:1px solid #F3F4F6;">
              <p style="margin:0 0 2px;font-size:28px;font-weight:900;color:${ratingColor};letter-spacing:-0.03em;">${avgRating ?? '—'} ${ratingArrow}</p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;">Avg Rating</p>
            </td>
            <td style="padding:20px 24px;text-align:center;">
              <p style="margin:0 0 2px;font-size:28px;font-weight:900;color:${replyRate >= 80 ? '#10B981' : replyRate >= 50 ? '#F59E0B' : '#EF4444'};letter-spacing:-0.03em;">${replyRate}%</p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;">Reply Rate</p>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 36px 0;">

          <!-- Summary -->
          <tr><td style="padding-bottom:24px;border-bottom:1px solid #F3F4F6;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${summary}</p>
          </td></tr>

          <!-- Rating distribution -->
          <tr><td style="padding-top:24px;padding-bottom:20px;border-bottom:1px solid #F3F4F6;">
            <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Rating breakdown</p>
            <table cellpadding="0" cellspacing="4">${starBars}</table>
          </td></tr>

          ${topTopics.length > 0 ? `
          <!-- Topics -->
          <tr><td style="padding-top:24px;padding-bottom:4px;border-bottom:1px solid #F3F4F6;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Top topics</p>
            <table width="100%" cellpadding="0" cellspacing="0">${topicsRows}</table>
          </td></tr>` : ''}

          ${insightsList.length > 0 ? `
          <!-- AI Insights -->
          <tr><td style="padding-top:24px;padding-bottom:20px;border-bottom:1px solid #F3F4F6;">
            <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">AI insights</p>
            <ul style="margin:0;padding-left:18px;">${insightsHtml}</ul>
          </td></tr>` : ''}

          ${actionItems.length > 0 ? `
          <!-- Action items -->
          <tr><td style="padding-top:24px;border-bottom:1px solid #F3F4F6;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.08em;">Actions for next month</p>
            <table width="100%" cellpadding="0" cellspacing="0">${actionsHtml}</table>
          </td></tr>` : ''}

          ${pendingCount ? `
          <!-- Pending notice -->
          <tr><td style="padding-top:16px;padding-bottom:16px;border-bottom:1px solid #F3F4F6;">
            <p style="margin:0;font-size:13px;color:#374151;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:12px 14px;line-height:1.5;">
              You have <strong>${pendingCount} unreplied review${pendingCount !== 1 ? 's' : ''}</strong> waiting. Responding promptly improves your ranking on Google.
            </p>
          </td></tr>` : ''}

          <!-- CTA -->
          <tr><td style="padding:24px 0 20px;">
            <a href="${appUrl}/digest" style="display:block;background:#6C55E8;color:#ffffff;font-size:14px;font-weight:700;padding:15px;border-radius:10px;text-decoration:none;text-align:center;letter-spacing:-0.01em;">View full digest in portal</a>
          </td></tr>

          <!-- Support -->
          <tr><td style="padding-bottom:32px;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
              Questions? <a href="mailto:support@moffu.pro" style="color:#6C55E8;text-decoration:none;">support@moffu.pro</a>
            </p>
          </td></tr>

        </table>

      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:20px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;">
          &copy; ${year} Moffu &middot; <a href="https://moffu.pro" style="color:#9CA3AF;text-decoration:none;">moffu.pro</a> &middot; <a href="${appUrl}/settings/preferences" style="color:#9CA3AF;text-decoration:none;">Manage notifications</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  // Upsert digest record
  const { error: upsertErr } = await supabase
    .from('monthly_digests')
    .upsert({
      org_id: orgId,
      month,
      review_count: reviewCount,
      avg_rating: avgRating,
      avg_rating_prev: avgRatingPrev,
      reply_rate: replyRate,
      pending_count: pendingCount ?? 0,
      rating_dist: ratingDist,
      top_topics: topTopics,
      summary_text: summary,
      insights_html: insightsHtml,
      action_items: actionItems,
      email_subject: emailSubject,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,month' });

  if (upsertErr) return { ok: false, error: upsertErr.message };

  // Find org member emails to send to
  const { data: members } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('status', 'active');

  if (members?.length) {
    const userIds = members.map((m: { user_id: string }) => m.user_id);

    // Fetch emails from auth.users via service-role admin API (profiles table has no email column)
    const emails: string[] = [];
    for (const uid of userIds) {
      const { data: authData } = await supabase.auth.admin.getUserById(uid);
      if (authData?.user?.email) emails.push(authData.user.email);
    }

    if (emails.length) {
      await sendDigestEmail({ to: emails, subject: emailSubject, html: emailHtml });

      await supabase
        .from('monthly_digests')
        .update({ sent_at: new Date().toISOString(), sent_to: emails })
        .eq('org_id', orgId)
        .eq('month', month);
    }
  }

  return { ok: true };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  // Determine target month (default = previous calendar month)
  let body: { org_id?: string; month?: string } = {};
  try { body = await req.json(); } catch { /* empty fine */ }

  const now = new Date();
  const defaultMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  const targetMonth = body.month ?? defaultMonth;

  // ── Auth: cron secret or user JWT ─────────────────────────────────────────
  const cronHeader = req.headers.get('x-cron-secret');
  const isCron = CRON_SECRET && cronHeader === CRON_SECRET;

  if (isCron) {
    // Process all orgs
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('status', 'active');

    let processed = 0;
    for (const org of orgs ?? []) {
      const result = await generateForOrg(supabase, org.id, targetMonth);
      if (result.ok) processed++;
      else console.error(`Digest failed for org ${org.id}:`, result.error);
    }

    return json({ processed, month: targetMonth });
  }

  // Portal user: manual trigger for their own org
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member?.org_id) return json({ error: 'No organization found' }, 403);

  const result = await generateForOrg(supabase, member.org_id, targetMonth);
  if (!result.ok) return json({ error: result.error ?? 'Generation failed' }, 500);

  return json({ ok: true, month: targetMonth });
});
