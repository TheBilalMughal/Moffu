import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 1x1 transparent GIF
const PIXEL = new Uint8Array([
  71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,0,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59
]);

serve(async (req) => {
  const url        = new URL(req.url);
  const event      = url.searchParams.get('event');
  const contactId  = url.searchParams.get('contact_id');
  const campaignId = url.searchParams.get('campaign_id');
  const redirectTo = url.searchParams.get('url');

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  if (event === 'open' && contactId && campaignId) {
    const { data: contact } = await adminClient
      .from('campaign_contacts').select('opened_at').eq('id', contactId).single();
    if (contact && !contact.opened_at) {
      await adminClient.from('campaign_contacts')
        .update({ opened_at: new Date().toISOString() }).eq('id', contactId);
      await adminClient.from('campaign_events')
        .insert({ campaign_id: campaignId, contact_id: contactId, event_type: 'opened' });
      await adminClient.rpc('increment_campaign_counter', { p_campaign_id: campaignId, p_field: 'opened_count' }).catch(() => {});
    }
    return new Response(PIXEL, {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache' },
    });
  }

  if (event === 'click' && contactId && campaignId) {
    const { data: contact } = await adminClient
      .from('campaign_contacts').select('clicked_at').eq('id', contactId).single();
    if (contact && !contact.clicked_at) {
      await adminClient.from('campaign_contacts')
        .update({ clicked_at: new Date().toISOString() }).eq('id', contactId);
      await adminClient.from('campaign_events')
        .insert({ campaign_id: campaignId, contact_id: contactId, event_type: 'clicked' });
      await adminClient.rpc('increment_campaign_counter', { p_campaign_id: campaignId, p_field: 'clicked_count' }).catch(() => {});
    }
    const dest = redirectTo ? decodeURIComponent(redirectTo) : 'https://google.com';
    return new Response(null, { status: 302, headers: { Location: dest } });
  }

  if (event === 'unsubscribe' && contactId && campaignId) {
    await adminClient.from('campaign_contacts')
      .update({ status: 'unsubscribed' }).eq('id', contactId);
    await adminClient.from('campaign_events')
      .insert({ campaign_id: campaignId, contact_id: contactId, event_type: 'unsubscribed' });
    await adminClient.rpc('increment_campaign_counter', { p_campaign_id: campaignId, p_field: 'unsubscribed_count' }).catch(() => {});
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:-apple-system,sans-serif;text-align:center;padding:80px 16px;background:#f9fafb;">
  <div style="max-width:400px;margin:auto;">
    <div style="width:56px;height:56px;background:#F0FDF4;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
      <svg width="28" height="28" fill="none" stroke="#15803D" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
    </div>
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">You've been unsubscribed</h2>
    <p style="margin:0;color:#6B7280;font-size:14px;line-height:1.6;">You will no longer receive emails from this campaign.</p>
  </div>
</body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  return new Response('Not found', { status: 404 });
});
