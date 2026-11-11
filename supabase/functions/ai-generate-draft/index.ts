import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type UsageEventType = 'ai_draft' | 'published_reply';
const ENTITLEMENT_KEY: Record<UsageEventType, string> = {
  ai_draft: 'ai_drafts',
  published_reply: 'published_replies',
};

const OVERRIDE_FIELD: Record<UsageEventType, string> = {
  ai_draft: 'ai_drafts_per_month',
  published_reply: 'published_replies_per_month',
};

async function checkAndRecordUsage(
  supabase: SupabaseClient,
  userId: string,
  eventType: UsageEventType,
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const entKey = ENTITLEMENT_KEY[eventType];
  const overrideField = OVERRIDE_FIELD[eventType];

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('current_period_start, current_period_end, plan_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!sub) return { allowed: false, used: 0, limit: 0 };

  // Check org-level override first
  const { data: orgMember } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle();

  let overrideLimit: number | null = null;
  if (orgMember?.org_id) {
    const { data: override } = await supabase
      .from('org_plan_overrides')
      .select(overrideField)
      .eq('org_id', orgMember.org_id)
      .maybeSingle();
    if (override && override[overrideField] !== null && override[overrideField] !== undefined) {
      overrideLimit = override[overrideField] as number;
    }
  }

  // -1 = unlimited via override
  if (overrideLimit === -1) return { allowed: true, used: 0, limit: null };

  // If no org override, fall back to plan entitlement
  if (overrideLimit === null) {
    const { data: ent } = await supabase
      .from('plan_entitlements')
      .select('value_type, limit_value, usage_reset')
      .eq('plan_id', sub.plan_id)
      .eq('key', entKey)
      .maybeSingle();

    if (!ent || ent.value_type === 'UNLIMITED') return { allowed: true, used: 0, limit: null };

    const resetCadence = (ent.usage_reset as string | null) ?? 'monthly';
    let periodStart: string;
    let periodEnd: string;

    if (resetCadence === 'weekly') {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      periodStart = start.toISOString();
      periodEnd = now.toISOString();
    } else {
      periodStart = sub.current_period_start;
      periodEnd = sub.current_period_end;
    }

    const { count } = await supabase
      .from('usage_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    const used = count ?? 0;
    const limit = ent.limit_value ?? 0;
    return used >= limit ? { allowed: false, used, limit } : { allowed: true, used, limit };
  }

  // Org override is a positive number — count usage in current calendar month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { count } = await supabase
    .from('usage_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd);

  const used = count ?? 0;
  return used >= overrideLimit
    ? { allowed: false, used, limit: overrideLimit }
    : { allowed: true, used, limit: overrideLimit };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// ── AI provider calls ─────────────────────────────────────────────────────────

async function callAI(
  provider: string, apiKey: string, model: string,
  systemPrompt: string, userPrompt: string,
): Promise<string> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model, max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? '';
  }

  if (provider === 'groq') {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStarBucket(rating: number): 'five_star' | 'mid_star' | 'low_star' {
  if (rating >= 5) return 'five_star';
  if (rating >= 3) return 'mid_star';
  return 'low_star';
}

function lengthGuide(key: string): string {
  if (key === 'short') return '1-2 sentences';
  if (key === 'long')  return '5+ sentences';
  return '3-4 sentences';
}

// Merge location override onto global: non-null override fields win
function mergeOverride(
  global: Record<string, unknown>,
  override: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!override) return global;
  const merged = { ...global };
  const skip = new Set(['id', 'user_id', 'location_id', 'created_at', 'updated_at']);
  for (const [key, val] of Object.entries(override)) {
    if (!skip.has(key) && val !== null && val !== undefined) {
      merged[key] = val;
    }
  }
  return merged;
}

// Find keyword contexts whose trigger appears in the review body
function matchedKeywordContexts(
  reviewBody: string,
  contexts: Array<{ keyword: string; context: string }>,
): string[] {
  const lower = reviewBody.toLowerCase();
  return contexts
    .filter(kc => lower.includes(kc.keyword.toLowerCase()))
    .map(kc => kc.context);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { review_id } = await req.json();
    if (!review_id) return json({ error: 'Missing review_id' }, 400);

    // ── Load everything in parallel ──────────────────────────────────────────
    const [
      { data: aiSetting },
      { data: review },
      { data: globalBrain },
    ] = await Promise.all([
      supabase
        .from('ai_settings')
        .select('provider, api_key, model')
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('reviews')
        .select('reviewer_name, rating, body, location_id')
        .eq('id', review_id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('brand_brain')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (!aiSetting) return json({ error: 'No AI provider configured. Please set one in the admin panel.' }, 503);
    if (!review)    return json({ error: 'Review not found' }, 404);

    // Check AI draft usage limit
    const limitCheck = await checkAndRecordUsage(supabase, user.id, 'ai_draft');
    if (!limitCheck.allowed) {
      const msg = limitCheck.limit === 0
        ? 'No active subscription found. Please contact support.'
        : `AI draft limit reached (${limitCheck.used}/${limitCheck.limit} used this period).`;
      return json({ error: msg, used: limitCheck.used, limit: limitCheck.limit }, 429);
    }

    // ── Fetch location override if review has a location_id ──────────────────
    let locOverride: Record<string, unknown> | null = null;
    if (review.location_id) {
      const { data: ov } = await supabase
        .from('brand_brain_overrides')
        .select('*')
        .eq('user_id', user.id)
        .eq('location_id', review.location_id)
        .maybeSingle();
      locOverride = ov ?? null;
    }

    // Merge global brain + location override
    const brain = mergeOverride(globalBrain ?? {}, locOverride) as Record<string, unknown>;

    // ── Resolve effective settings ───────────────────────────────────────────
    const businessName  = (brain.business_name  as string | null) ?? 'our business';
    const businessType  = (brain.business_type  as string | null) ?? '';
    const businessDesc  = (brain.business_desc  as string | null) ?? '';
    const customTone    = (brain.custom_tone_instructions as string | null) ?? '';
    const exampleReply  = (brain.example_reply  as string | null) ?? '';
    const signature     = (brain.reply_signature as string | null) ?? '';
    const useEmoji      = (brain.use_emoji       as boolean | null) ?? false;
    const addressByName = (brain.use_customer_name as boolean | null) ?? true;
    const prohibited    = ((brain.prohibited_phrases as string[] | null) ?? []).join(', ');
    const negativeRule  = (brain.negative_rule   as string | null) ?? 'cautious';
    const keywordCtxs   = (brain.keyword_contexts as Array<{ keyword: string; context: string }> | null) ?? [];
    const approvalRules = (brain.approval_rules  as { require_approval_below: number } | null) ?? { require_approval_below: 0 };
    const langBehaviour = (brain.reviewer_lang_behaviour as string | null) ?? 'primary';
    const primaryLang   = (brain.primary_language as string | null) ?? 'English';

    // Per-star overrides for tone and length
    const starRules     = (brain.star_rating_rules as Record<string, { tone?: string; reply_length?: string }> | null) ?? {};
    const bucket        = getStarBucket(review.rating);
    const starRule      = starRules[bucket] ?? {};
    let   tone          = (starRule.tone ?? (brain.tone as string | null) ?? 'professional').toLowerCase();
    let   replyLength   = (starRule.reply_length ?? (brain.reply_length as string | null) ?? 'medium').toLowerCase();

    // Language: match reviewer if behaviour is 'match'
    const langInstruction = langBehaviour === 'match'
      ? "Detect the language of the review and reply in the same language. If the review is in English, reply in English."
      : `Reply in ${primaryLang}.`;

    // Keyword-triggered context injection
    const reviewBody = review.body ?? '';
    const injectedContexts = matchedKeywordContexts(reviewBody, keywordCtxs);

    // Reviewer first name
    const firstName = (review.reviewer_name ?? '').split(' ')[0] || '';

    // ── Build system prompt ──────────────────────────────────────────────────
    const systemPrompt = [
      'You are a customer service specialist writing Google Business review replies.',
      'Output ONLY the reply text — no labels, no markdown, no extra commentary.',
    ].join(' ');

    // ── Build user prompt ────────────────────────────────────────────────────
    const lines: string[] = [];

    // Business context
    lines.push(`Business: ${businessName}`);
    if (businessType) lines.push(`Type: ${businessType}`);
    if (businessDesc) lines.push(`About: ${businessDesc}`);

    lines.push('');
    lines.push(`Customer review (${review.rating}/5 stars):`);
    lines.push(`"${reviewBody || '(no text left)'}"`);
    lines.push('');
    lines.push('Requirements:');

    // Tone
    const toneDescriptions: Record<string, string> = {
      professional: 'Formal, polished, brand-forward.',
      friendly:     'Warm, approachable, conversational.',
      formal:       'Structured and respectful.',
      casual:       'Relaxed and natural.',
    };
    lines.push(`- Tone: ${tone} — ${toneDescriptions[tone] ?? tone}`);
    if (customTone) lines.push(`- Additional tone instructions: ${customTone}`);

    // Length
    lines.push(`- Length: ${lengthGuide(replyLength)}`);

    // Name
    if (addressByName && firstName) {
      lines.push(`- Address the reviewer by their first name "${firstName}"`);
    } else {
      lines.push('- Do not use the reviewer\'s name');
    }

    // Emoji
    lines.push(useEmoji ? '- You may include 1-2 relevant emojis' : '- No emojis');

    // Language
    lines.push(`- ${langInstruction}`);

    // Prohibited phrases
    if (prohibited) lines.push(`- NEVER use these phrases: ${prohibited}`);

    // Negative review handling
    if (review.rating <= 2) {
      const negDesc =
        negativeRule === 'manual'   ? 'This is a manual review — write an empathetic, non-committal acknowledgment only.' :
        negativeRule === 'cautious' ? 'Be empathetic. Acknowledge the issue clearly. Offer to resolve it offline (provide no direct contact info). Do not make promises.' :
                                      'Treat like any other review but remain empathetic.';
      lines.push(`- Negative review handling: ${negDesc}`);
    }

    // Keyword-triggered context
    if (injectedContexts.length > 0) {
      lines.push('');
      lines.push('Context relevant to this review (incorporate naturally):');
      injectedContexts.forEach(ctx => lines.push(`- ${ctx}`));
    }

    // Example reply style reference
    if (exampleReply) {
      lines.push('');
      lines.push(`Style reference (match this tone and structure):`);
      lines.push(`"${exampleReply}"`);
    }

    lines.push('');
    lines.push('Write the reply now (reply text only, nothing else):');

    const userPrompt = lines.join('\n');

    // ── Generate draft ───────────────────────────────────────────────────────
    let draft = await callAI(aiSetting.provider, aiSetting.api_key, aiSetting.model, systemPrompt, userPrompt);
    if (!draft) return json({ error: 'Empty response from AI' }, 500);

    // Append reply signature if set
    if (signature) {
      draft = `${draft.trimEnd()}\n\n${signature}`;
    }

    // ── Determine review status ──────────────────────────────────────────────
    const needsApproval =
      approvalRules.require_approval_below === 6 ||
      (approvalRules.require_approval_below > 0 && review.rating <= approvalRules.require_approval_below);

    const newStatus = needsApproval ? 'NEEDS_APPROVAL' : 'DRAFT_READY';

    // ── Persist draft ────────────────────────────────────────────────────────
    await Promise.all([
      supabase
        .from('reviews')
        .update({ reply_draft: draft, status: newStatus })
        .eq('id', review_id)
        .eq('user_id', user.id),
      supabase
        .from('usage_events')
        .insert({ user_id: user.id, event_type: 'ai_draft', review_id }),
    ]);

    // ── Usage threshold notifications ─────────────────────────────────────
    // Fire-and-forget: don't block the response
    sendUsageNotificationIfNeeded(supabase, user.id, limitCheck.used + 1, limitCheck.limit).catch(e =>
      console.error('Usage notification error:', e),
    );

    return json({ draft, needs_approval: needsApproval });
  } catch (err) {
    console.error('ai-generate-draft error:', err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    return json({ error: msg }, 500);
  }
});

// ── Usage notification helper ─────────────────────────────────────────────────

async function sendUsageNotificationIfNeeded(
  supabase: SupabaseClient,
  userId: string,
  used: number,
  limit: number | null,
) {
  if (!limit || limit <= 0) return;
  const pct = used / limit;
  if (pct < 0.8) return;

  const period = (() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, usage_80_notified_period, usage_100_notified_period')
    .eq('user_id', userId)
    .maybeSingle();

  if (!sub) return;

  const is100 = used >= limit;
  const notifiedField = is100 ? 'usage_100_notified_period' : 'usage_80_notified_period';
  const alreadyNotified = is100 ? sub.usage_100_notified_period === period : sub.usage_80_notified_period === period;
  if (alreadyNotified) return;

  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.email;
  if (!email) return;

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  const name = profile?.display_name ?? null;
  const webUrl = Deno.env.get('WEB_URL') ?? 'https://moffu.pro';

  const subject = is100
    ? "You've reached your monthly AI draft limit"
    : `You've used ${Math.round(pct * 100)}% of your monthly AI drafts`;

  await supabase.from('subscriptions').update({ [notifiedField]: period }).eq('id', sub.id);

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Moffu <notifications@moffu.pro>',
      to: [email],
      subject,
      html: usageEmailHtml(name, used, limit, pct, is100, webUrl),
    }),
  });
}

function usageEmailHtml(
  name: string | null, used: number, limit: number, pct: number,
  isBlocked: boolean, webUrl: string,
) {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  const pctLabel = Math.round(pct * 100);
  const barColor = isBlocked ? '#DC2626' : '#F59E0B';
  const badgeColor = isBlocked ? '#FEF2F2' : '#FFF7ED';
  const badgeText = isBlocked ? '#DC2626' : '#B45309';
  const headline = isBlocked
    ? "You've reached your AI draft limit"
    : `You've used ${pctLabel}% of your AI drafts`;
  const body = isBlocked
    ? `You've used all ${limit} AI drafts for this period. Upgrade your plan to continue generating replies.`
    : `You've used ${used} of ${limit} AI drafts this month. Upgrade now to avoid any interruption to your workflow.`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:28px;">
        <div style="background:#6C55E8;border-radius:12px;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:20px;font-weight:800;line-height:40px;">M</span>
        </div>
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:20px;border:1px solid #E5E7EB;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${badgeText};background:${badgeColor};display:inline-block;padding:3px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:0.08em;">Usage alert</p>
        <h1 style="margin:16px 0;font-size:22px;font-weight:700;color:#111827;">${headline}</h1>
        <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">${greeting}<br/>${body}</p>
        <!-- Progress bar -->
        <div style="background:#F3F4F6;border-radius:8px;height:10px;margin-bottom:8px;overflow:hidden;">
          <div style="background:${barColor};height:10px;width:${Math.min(pctLabel, 100)}%;border-radius:8px;"></div>
        </div>
        <p style="margin:0 0 28px;font-size:12px;color:#9CA3AF;">${used} / ${limit} AI drafts used this period</p>
        <a href="${webUrl}/billing" style="display:inline-block;background:#6C55E8;color:#ffffff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:12px;text-decoration:none;">
          Upgrade plan
        </a>
      </td></tr>
      <tr><td style="padding-top:24px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#D1D5DB;">Powered by <a href="https://moffu.pro" style="color:#9CA3AF;text-decoration:none;">Moffu</a></p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}
