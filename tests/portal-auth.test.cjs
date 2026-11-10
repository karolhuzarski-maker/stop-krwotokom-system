const { test } = require('node:test');
const assert = require('node:assert/strict');
const createAuth = require('../assets/js/portal-auth.js');
const config = { supabaseUrl: 'https://example-project.supabase.co', publishableKey: 'sb_publishable_test_public_key' };

function harness(options = {}) {
  const calls = [];
  const user = { id: 'user-a', email: 'instructor@example.test' };
  const profile = { instructor_id: 'SK-I-2026-000001', display_name: 'Test', enabled: true, valid_until: '2027-12-31' };
  let currentUser = options.guest ? null : user;
  const query = {
    select(columns) { calls.push(['select', columns]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    async maybeSingle() { return options.profileResult || { data: profile, error: null }; }
  };
  const client = {
    auth: {
      async getUser() { calls.push(['getUser']); return options.getUser ? options.getUser() : { data: { user: currentUser }, error: null }; },
      onAuthStateChange(handler) { calls.push(['subscribe']); },
      async signInWithPassword(input) { calls.push(['signIn', input]); return { error: options.signInError || null }; },
      async signOut() { calls.push(['signOut']); currentUser = null; return { error: null }; },
      async updateUser(input) { calls.push(['updateUser', input]); return { error: null }; },
      async resetPasswordForEmail(email, input) { calls.push(['reset', email, input]); return { error: null }; }
    },
    from(table) { calls.push(['from', table]); return query; },
    async rpc(name) { calls.push(['rpc', name]); return options.permission || { data: true, error: null }; }
  };
  const env = {
    location: { href: 'https://example.test/project/konto.html' },
    setTimeout() {},
    supabase: { createClient(url, key, settings) { calls.push(['createClient', url, key, settings]); return client; } }
  };
  return { auth: createAuth(env, options.config || config), calls, profile, client };
}

test('missing, foreign or privileged configuration never loads an SDK or creates a client', async () => {
  for (const bad of [{}, { ...config, supabaseUrl: 'https://attacker.test' }, { ...config, publishableKey: 'sb_secret_private' }, { ...config, publishableKey: 'eyJlegacyJWT' }]) {
    const { auth, calls } = harness({ config: bad });
    assert.equal(auth.isConfigured(), false);
    assert.equal((await auth.init()).mode, 'disabled');
    await assert.rejects(auth.signIn('x', 'x'), /nie zostało/);
    assert.deepEqual(calls, []);
  }
});

test('verified session and explicit server permission activate only the own profile', async () => {
  const { auth, calls } = harness();
  assert.equal((await auth.init()).mode, 'active');
  assert.deepEqual(calls.find(c => c[0] === 'eq'), ['eq', 'user_id', 'user-a']);
  assert.deepEqual(calls.find(c => c[0] === 'rpc'), ['rpc', 'portal_has_access']);
  assert.ok(calls.some(c => c[0] === 'getUser'));
});

test('missing or invalid session stays guest without querying profiles', async () => {
  for (const options of [{ guest: true }, { getUser: async () => ({ data: { user: null }, error: new Error('invalid session') }) }]) {
    const { auth, calls } = harness(options);
    assert.equal((await auth.init()).mode, 'guest');
    assert.equal(calls.some(c => c[0] === 'from'), false);
  }
});

test('denied, expired or revoked server permission never grants access', async () => {
  for (const permission of [false, null, 'true', 1]) {
    const { auth } = harness({ permission: { data: permission, error: null } });
    assert.equal((await auth.init()).mode, 'blocked');
  }
});

test('a missing profile cannot activate even if the permission response is true', async () => {
  const { auth } = harness({ profileResult: { data: null, error: null } });
  assert.equal((await auth.init()).mode, 'blocked');
});

test('profile or permission failures fail closed and discard previous access', async () => {
  for (const options of [
    { profileResult: { data: null, error: new Error('db offline') } },
    { permission: { data: null, error: new Error('rpc offline') } },
    { getUser: async () => { throw new Error('network offline'); } }
  ]) {
    const { auth } = harness(options);
    assert.equal((await auth.init()).mode, 'unavailable');
    assert.equal(auth.getState().profile, null);
  }
});

test('callers cannot change the stored permission snapshot', async () => {
  const { auth } = harness();
  await auth.init();
  const state = auth.getState();
  state.mode = 'blocked'; state.profile.instructor_id = 'changed';
  assert.equal(auth.getState().mode, 'active');
  assert.equal(auth.getState().profile.instructor_id, 'SK-I-2026-000001');
});

test('an in-flight refresh cannot restore access after sign-out', async () => {
  const { auth, client } = harness();
  await auth.init();
  let resolveUser;
  client.auth.getUser = () => new Promise(resolve => { resolveUser = resolve; });
  const pending = auth.refresh();
  await auth.signOut();
  resolveUser({ data: { user: { id: 'user-a', email: 'stale@example.test' } }, error: null });
  await pending;
  assert.equal(auth.getState().mode, 'guest');
  assert.equal(auth.getState().profile, null);
});

test('password setup requires twelve characters and a verified invitation session', async () => {
  const { auth, calls } = harness({ guest: true });
  await assert.rejects(auth.setPassword('short'), /12/);
  await assert.rejects(auth.setPassword('long-enough-test-password'), /Zaproszenie wygasło/);
  assert.equal(calls.some(c => c[0] === 'updateUser'), false);
  const valid = harness();
  await valid.auth.setPassword('long-enough-test-password');
  assert.deepEqual(valid.calls.find(c => c[0] === 'updateUser'), ['updateUser', { password: 'long-enough-test-password' }]);
});

test('sign-in forwards CAPTCHA and returns a generic credentials error', async () => {
  const { auth, calls } = harness({ signInError: { message: 'account exists, blocked' } });
  await assert.rejects(auth.signIn(' instructor@example.test ', 'password', 'captcha-token'), /Sprawdź dane/);
  const input = calls.find(c => c[0] === 'signIn')[1];
  assert.equal(input.email, 'instructor@example.test');
  assert.equal(input.options.captchaToken, 'captcha-token');
});

test('password reset returns to the account page and uses the CAPTCHA token', async () => {
  const { auth, calls } = harness();
  await auth.resetPassword(' instructor@example.test ', 'captcha-token');
  assert.deepEqual(calls.find(c => c[0] === 'reset'), ['reset', 'instructor@example.test', { redirectTo: 'https://example.test/project/konto.html', captchaToken: 'captcha-token' }]);
});

test('the browser exposes no signup or privileged administration method', () => {
  const { auth } = harness();
  assert.equal(auth.signUp, undefined);
  assert.equal(auth.admin, undefined);
  assert.equal(Object.isFrozen(auth), true);
});
