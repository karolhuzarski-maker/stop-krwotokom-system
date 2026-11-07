import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const required = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
async function sameSecret(actual: string, expected: string): Promise<boolean> {
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([actual, expected].map(s => crypto.subtle.digest('SHA-256', encode.encode(s))));
  return new Uint8Array(a).reduce((v, x, i) => v | (x ^ new Uint8Array(b)[i]), 0) === 0;
}
Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', {status: 405});
  try {
    if (!await sameSecret(request.headers.get('x-dispatch-secret') || '', required('DISPATCH_SECRET'))) return new Response('Unauthorized', {status: 401});
    const from = required('MAIL_FROM'), admin = required('ADMIN_NOTIFICATION_EMAIL');
    const portal = new URL(required('PORTAL_URL'));
    if (portal.protocol !== 'https:') throw new Error('HTTPS required');
    portal.hash = 'panel/admin';
    const apiKey = required('RESEND_API_KEY');
    const client = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {auth: {persistSession: false}});
    const {data: events, error} = await client.rpc('claim_notifications');
    if (error) throw error;
    let sent = 0, failed = 0;
    for (const event of events || []) {
      const p = event.payload;
      const status: Record<string, string> = {approved: 'zaakceptowane', rejected: 'odrzucone', suspended: 'zawieszone'};
      let subject: string, text: string;
      if (event.kind === 'access_request') {
        subject = 'STOP KRWOTOKOM SYSTEM – nowy wniosek o dostęp';
        text = `${p.name}\nE-mail: ${p.email}\nData zgłoszenia: ${p.submitted_at}\nWniosek oczekuje na akceptację.\nPanel wymagający logowania: ${portal}`;
      } else if (event.kind === 'account_decision') {
        subject = 'STOP KRWOTOKOM SYSTEM – decyzja dotycząca konta';
        text = `Status konta: ${status[p.status] || p.status}.\nAkceptacja konta nie oznacza nadania autoryzacji instruktorskiej.\nPanel: ${portal.origin}${portal.pathname}#panel/profile`;
      } else if (event.kind === 'authorization_granted' || event.kind === 'authorization_status') {
        subject = 'STOP KRWOTOKOM SYSTEM – autoryzacja instruktorska';
        text = `Numer: ${p.instructor_number}\nAutoryzacja od: ${p.starts_on}\nAutoryzacja do (koniec wyłączny): ${p.ends_on}\nZawieszona: ${p.suspended ? 'tak' : 'nie'}\nPanel: ${portal.origin}${portal.pathname}#panel/profile`;
      } else {
        const {error} = await client.rpc('finish_notification', {p_id: event.id, p_lease: event.lease_id, p_success: false, p_detail: 'Unsupported event kind'});
        if (error) throw error;
        failed++; continue;
      }
      let success = false, detail = 'Network error';
      try {
        const result = await fetch('https://api.resend.com/emails', {
          method: 'POST', signal: AbortSignal.timeout(15000),
          headers: {'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `sk-event/${event.id}`},
          body: JSON.stringify({from, to: [event.kind === 'access_request' ? admin : p.email], subject, text}),
        });
        if (result.ok) { const response = await result.json(); success = true; detail = response.id; }
        else detail = `Provider HTTP ${result.status}`; // Never log provider bodies, credentials or passwords.
      } catch { /* Retry using the same provider idempotency key. */ }
      const {error: finishError} = await client.rpc('finish_notification', {p_id: event.id, p_lease: event.lease_id, p_success: success, p_detail: detail});
      if (finishError) throw finishError;
      success ? sent++ : failed++;
    }
    return Response.json({sent, failed});
  } catch {
    return Response.json({error: 'Notification processing failed'}, {status: 500});
  }
});
