/* Invite-only access. The server and RLS enforce permissions, not this UI. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.SKAuth = factory(root, root.SK_PORTAL_CONFIG || {});
})(typeof window !== 'undefined' ? window : globalThis, function createPortalAuth(env, config) {
  'use strict';
  const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js';
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl || '') &&
    /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey || '');
  let client, initialization, revision = 0;
  let state = { mode: configured ? 'guest' : 'disabled', email: '', profile: null };
  const snapshot = () => ({ mode: state.mode, email: state.email, profile: state.profile && { ...state.profile } });
  function publish(next) {
    state = next;
    if (env.dispatchEvent && env.CustomEvent) env.dispatchEvent(new env.CustomEvent('sk:access', { detail: snapshot() }));
    return snapshot();
  }
  function loadScript(url, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = env.document.createElement('script');
      script.src = url;
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.onload = () => ready() ? resolve() : reject(new Error('Usługa kont jest chwilowo niedostępna.'));
      script.onerror = () => { script.remove(); reject(new Error('Nie udało się połączyć z usługą kont.')); };
      env.document.head.appendChild(script);
    });
  }
  async function refresh() {
    if (!client) return snapshot();
    const version = ++revision;
    try {
      // getUser verifies the session with Auth; no trust in editable local data.
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) {
        if (version !== revision) return snapshot();
        return publish({ mode: 'guest', email: '', profile: null });
      }
      const profileResult = await client.from('instructor_access')
        .select('display_name,instructor_id,enabled,valid_until').eq('user_id', data.user.id).maybeSingle();
      const permission = await client.rpc('portal_has_access');
      if (version !== revision) return snapshot();
      if (profileResult.error || permission.error) throw new Error('Nie można potwierdzić uprawnień.');
      return publish({
        mode: permission.data === true && profileResult.data ? 'active' : 'blocked',
        email: data.user.email || '', profile: profileResult.data || null
      });
    } catch (_) {
      if (version !== revision) return snapshot();
      return publish({ mode: 'unavailable', email: '', profile: null });
    }
  }
  async function init() {
    if (!configured) return snapshot();
    if (!initialization) initialization = (async () => {
      await loadScript(sdkUrl, () => Boolean(env.supabase && env.supabase.createClient));
      client = env.supabase.createClient(config.supabaseUrl, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'sks-instructor-session' }
      });
      client.auth.onAuthStateChange(() => {
        // Avoid calling Auth methods while the SDK holds its auth-event lock.
        env.setTimeout(() => { refresh(); }, 0);
      });
      return refresh();
    })().catch(() => {
      publish({ mode: 'unavailable', email: '', profile: null });
      throw new Error('Usługa kont jest chwilowo niedostępna. Spróbuj ponownie później.');
    });
    await initialization;
    return snapshot();
  }
  async function requireClient() {
    if (!configured) throw new Error('Logowanie nie zostało jeszcze uruchomione.');
    await init();
    if (!client) throw new Error('Usługa kont jest chwilowo niedostępna.');
    return client;
  }
  async function signIn(email, password, captchaToken) {
    const api = await requireClient();
    const { error } = await api.auth.signInWithPassword({
      email: String(email || '').trim(), password,
      options: { captchaToken: captchaToken || undefined }
    });
    if (error) throw new Error('Nie udało się zalogować. Sprawdź dane lub spróbuj ponownie później.');
    return refresh();
  }
  async function signOut() {
    ++revision;
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw new Error('Nie udało się wylogować. Spróbuj ponownie.');
    }
    return publish({ mode: configured ? 'guest' : 'disabled', email: '', profile: null });
  }
  async function setPassword(password) {
    if (typeof password !== 'string' || password.length < 12) throw new Error('Hasło musi mieć co najmniej 12 znaków.');
    const api = await requireClient();
    const verified = await api.auth.getUser();
    if (verified.error || !verified.data.user) throw new Error('Zaproszenie wygasło. Poproś organizatora o nowy link.');
    const { error } = await api.auth.updateUser({ password });
    if (error) throw new Error('Nie udało się ustawić hasła. Spróbuj ponownie lub poproś o nowy link.');
    return refresh();
  }
  async function resetPassword(email, captchaToken) {
    const api = await requireClient();
    const { error } = await api.auth.resetPasswordForEmail(String(email || '').trim(), {
      redirectTo: new URL('konto.html', env.location.href).href,
      captchaToken: captchaToken || undefined
    });
    if (error) throw new Error('Nie udało się wysłać wiadomości. Spróbuj ponownie później.');
  }
  async function mountCaptcha(element, onToken) {
    if (!config.turnstileSiteKey) return { reset() {}, remove() {} };
    await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', () => Boolean(env.turnstile));
    const id = env.turnstile.render(element, {
      sitekey: config.turnstileSiteKey, language: 'pl',
      callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => onToken('')
    });
    return { reset() { onToken(''); env.turnstile.reset(id); }, remove() { env.turnstile.remove(id); } };
  }
  return Object.freeze({
    isConfigured: () => configured, needsCaptcha: () => Boolean(config.turnstileSiteKey),
    getState: snapshot, init, refresh, signIn, signOut, setPassword, resetPassword, mountCaptcha
  });
});
