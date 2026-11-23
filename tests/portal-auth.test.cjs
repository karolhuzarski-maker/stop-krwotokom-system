const { test } = require('node:test');
const assert = require('node:assert/strict');
const createAuth = require('../assets/js/portal-auth.js');
const config = { supabaseUrl: 'https://example-project.supabase.co', publishableKey: 'sb_publishable_test_public_key' };

function harness(options = {}) {
  const calls = [];
  const user = { id: 'user-a', email: 'instructor@example.test' };
  const profile = { instructor_id: 'SKS-I-2026-001', display_name: 'Test', enabled: true, valid_until: '2027-12-31' };
  let currentUser = options.guest ? null : user;
  let courseMutation = null;
  const query = {
    select(columns) { calls.push(['select', columns]); return this; },
    eq(column, value) { calls.push(['eq', column, value]); return this; },
    order(column, config) { calls.push(['order', column, config]); return this; },
    async limit(count) { calls.push(['limit', count]); return options.courseList || { data: [], error: null }; },
    async insert(payload) { calls.push(['insert', payload]); return options.courseInsert || { data: null, error: null }; },
    update(payload) { calls.push(['update', payload]); courseMutation = 'update'; return this; },
    delete() { calls.push(['delete']); courseMutation = 'delete'; return this; },
    async maybeSingle() {
      if (courseMutation) {
        const operation = courseMutation;
        courseMutation = null;
        return operation === 'update'
          ? options.courseUpdate || { data: { id: 'some-id' }, error: null }
          : options.courseDelete || { data: { id: 'some-id' }, error: null };
      }
      return options.profileResult || { data: profile, error: null };
    }
  };
  const client = {
    storage: {
      from(bucket) {
        calls.push(['storage', bucket]);
        return {
          async list(prefix, config) {
            calls.push(['list', prefix, config]);
            return options.materialList || { data: [], error: null };
          },
          async createSignedUrl(filename, seconds) {
            calls.push(['signedUrl', filename, seconds]);
            return options.materialUrl || { data: { signedUrl: 'https://example.test/signed-pdf' }, error: null };
          },
          async upload(filename, file, config) {
            calls.push(['upload', filename, file, config]);
            return options.materialUpload || { data: { path: filename }, error: null };
          }
        };
      }
    },
    auth: {
      async getUser() { calls.push(['getUser']); return options.getUser ? options.getUser() : { data: { user: currentUser }, error: null }; },
      onAuthStateChange(handler) { calls.push(['subscribe']); },
      async signInWithPassword(input) { calls.push(['signIn', input]); return { error: options.signInError || null }; },
      async signOut() { calls.push(['signOut']); currentUser = null; return { error: null }; },
      async updateUser(input) { calls.push(['updateUser', input]); return { error: null }; },
      async resetPasswordForEmail(email, input) { calls.push(['reset', email, input]); return { error: null }; }
    },
    from(table) { calls.push(['from', table]); return query; },
    async rpc(name) {
      calls.push(['rpc', name]);
      if (name === 'portal_has_access') return options.permission || { data: true, error: null };
      if (name === 'portal_is_admin') return options.centralPermission || { data: false, error: null };
      if (name === 'portal_admin_list_instructors') return options.centralList || { data: [], error: null };
      if (name === 'portal_admin_list_courses') return options.courseCentralList || { data: [], error: null };
      throw new Error('Unexpected RPC: ' + name);
    }
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
  assert.equal(auth.getState().profile.instructor_id, 'SKS-I-2026-001');
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


test('ordinary instructor never receives the Central SKS role', async () => {
  const { auth, calls } = harness();
  const state = await auth.init();
  assert.equal(state.mode, 'active');
  assert.equal(state.isAdmin, false);
  await assert.rejects(auth.listCentralInstructors(), /Brak uprawnień/);
  assert.equal(calls.some(c => c[0] === 'rpc' && c[1] === 'portal_admin_list_instructors'), false);
});

test('only a verified positive server role enables the Central SKS register', async () => {
  const rows = [{ instructor_id: 'SKS-I-2026-001', display_name: 'Test', email: 'instructor@example.test',
    enabled: true, valid_until: '2029-11-23', created_at: '2026-11-23T18:00:00Z', status: 'active' }];
  const { auth, calls } = harness({
    centralPermission: { data: true, error: null },
    centralList: { data: rows, error: null }
  });
  assert.equal((await auth.init()).isAdmin, true);
  assert.deepEqual(await auth.listCentralInstructors(), rows);
  assert.ok(calls.some(c => c[0] === 'rpc' && c[1] === 'portal_admin_list_instructors'));
  await auth.signOut();
  assert.equal(auth.getState().isAdmin, false);
  await assert.rejects(auth.listCentralInstructors(), /Brak uprawnień/);
});

test('Central SKS role failure does not break instructor login and fails closed', async () => {
  const { auth } = harness({ centralPermission: { data: null, error: new Error('migration pending') } });
  const state = await auth.init();
  assert.equal(state.mode, 'active');
  assert.equal(state.isAdmin, false);
});

test('Central SKS register failures never return a fictitious list', async () => {
  const { auth } = harness({
    centralPermission: { data: true, error: null },
    centralList: { data: null, error: new Error('database offline') }
  });
  await auth.init();
  await assert.rejects(auth.listCentralInstructors(), /Nie udało się pobrać rejestru/);
});

test('active instructors can list private materials, not arbitrary Storage files', async () => {
  const { auth, calls } = harness({ materialList: { data: [
    { name: 'SK-01_Preambula_SKS_0.9.pdf' }, { name: 'random-file.html' }
  ], error: null } });
  await auth.init();
  const files = await auth.listInstructorMaterials();
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'SK-01_Preambula_SKS_0.9.pdf');
  assert.ok(calls.some(c => c[0] === 'storage' && c[1] === 'instructor-materials'));
});

test('private document links are short-lived and require authenticated access', async () => {
  const { auth, calls } = harness();
  await auth.init();
  assert.equal(await auth.getInstructorMaterialUrl('SK-02_Karta_programu_SKS_0.9.pdf'),
    'https://example.test/signed-pdf');
  assert.ok(calls.some(c => c[0] === 'signedUrl' && c[2] === 60));
  await assert.rejects(auth.getInstructorMaterialUrl('../../unsafe.pdf'), /Nieprawidłowy/);
  await auth.signOut();
  await assert.rejects(auth.getInstructorMaterialUrl('SK-01_Preambula_SKS_0.9.pdf'), /Brak aktywnego/);
  await assert.rejects(auth.listInstructorMaterials(), /Brak aktywnego/);
});

test('only central administrator can upload PDF files to private materials', async () => {
  const file = { name: 'SK-03_Standard_szkoleniowy_SKS_0.9.pdf', type: 'application/pdf', size: 12345 };
  const instructor = harness();
  await instructor.auth.init();
  await assert.rejects(instructor.auth.uploadInstructorMaterials([file]), /Centrali SKS/);
  assert.equal(instructor.calls.some(c => c[0] === 'upload'), false);
  const central = harness({ centralPermission: { data: true, error: null } });
  await central.auth.init();
  assert.deepEqual(await central.auth.uploadInstructorMaterials([file]), [file.name]);
  assert.ok(central.calls.some(c => c[0] === 'upload' && c[1] === file.name &&
    c[3].upsert === true && c[3].contentType === 'application/pdf'));
});

test('admin upload rejects unsupported filenames and oversized files before sending', async () => {
  const { auth, calls } = harness({ centralPermission: { data: true, error: null } });
  await auth.init();
  for (const file of [
    { name: '../SK-01_bad.pdf', type: 'application/pdf', size: 1000 },
    { name: 'SK-01_bad.html', type: 'text/html', size: 1000 },
    { name: 'SK-01_bad.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 },
    { name: 'SK-01_bad.pdf', type: 'text/html', size: 1000 }
  ]) await assert.rejects(auth.uploadInstructorMaterials([file]), /Dozwolone/);
  assert.equal(calls.some(c => c[0] === 'upload'), false);
});

test('private material API errors cannot show fictitious available documents', async () => {
  const { auth } = harness({ materialList: { data: null, error: new Error('Storage is offline') } });
  await auth.init();
  await assert.rejects(auth.listInstructorMaterials(), /Nie udało się pobrać/);
});

test('instructor inserts only date, location, number and optional notes without selecting owner', async () => {
  const { auth, calls } = harness();
  await auth.init();
  await auth.addInstructorCourse({training_date:'2026-12-16',location_name:'  Kraków  ',
    participant_count:14,notes:'  dla OSP  ',instructor_user_id:'another-user'});
  const call = calls.find(c => c[0] === 'insert');
  assert.ok(call);
  assert.deepEqual(call[1], { training_date:'2026-12-16', location_name:'Kraków',
    participant_count:14, notes:'dla OSP' });
  assert.ok(calls.some(c => c[0] === 'from' && c[1] === 'sk_courses'));
});

test('revoked instructor cannot create a course record even as Central SKS admin', async () => {
  const { auth, calls } = harness({
    permission:{ data:false,error:null },
    centralPermission:{ data:true,error:null }
  });
  await auth.init();
  await assert.rejects(auth.addInstructorCourse({training_date:'2026-12-16',
    location_name:'Kraków',participant_count:5}),/aktywnej autoryzacji/);
  assert.equal(calls.some(c => c[0] === 'insert'), false);
});

test('invalid course data are rejected locally', async () => {
  const { auth, calls } = harness();
  await auth.init();
  const base = {training_date:'2026-12-16',location_name:'Kraków',participant_count:12,notes:''};
  for (const payload of [
    {...base,training_date:'2026-02-31'},
    {...base,training_date:'invalid'},
    {...base,location_name:' '},
    {...base,participant_count:0},
    {...base,participant_count:1001},
    {...base,participant_count:1.1},
    {...base,notes:'x'.repeat(1001)}
  ]) await assert.rejects(auth.addInstructorCourse(payload));
  assert.equal(calls.some(c => c[0] === 'insert'), false);
});

test('personal course listing filters by verified session user even for Central SKS admin', async () => {
  const rows = [{id:'abc',training_date:'2026-12-16',location_name:'Kraków',
    participant_count:12,notes:''}];
  const { auth, calls } = harness({centralPermission:{data:true,error:null},
    courseList:{data:rows,error:null}});
  await auth.init();
  assert.deepEqual(await auth.listMyCourses(), rows);
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'instructor_user_id' && c[2] === 'user-a'));
  assert.ok(calls.some(c => c[0] === 'limit' && c[1] === 200));
});

test('only Central SKS admin can load the complete course register', async () => {
  const ordinary = harness();
  await ordinary.auth.init();
  await assert.rejects(ordinary.auth.listCentralCourses(),/Brak uprawnień/);
  assert.equal(ordinary.calls.some(c => c[0] === 'rpc' && c[1] === 'portal_admin_list_courses'), false);
  const data = [{instructor_id:'SKS-I-2026-001',display_name:'Test',participant_count:12}];
  const admin = harness({centralPermission:{data:true,error:null},
    courseCentralList:{data,error:null}});
  await admin.auth.init();
  assert.deepEqual(await admin.auth.listCentralCourses(), data);
  assert.ok(admin.calls.some(c => c[0] === 'rpc' && c[1] === 'portal_admin_list_courses'));
});

test('failed course queries do not invent saved records', async () => {
  const { auth } = harness({courseList:{data:null,error:new Error('offline')},
    courseInsert:{data:null,error:new Error('offline')}});
  await auth.init();
  await assert.rejects(auth.listMyCourses(),/Nie udało się pobrać/);
  await assert.rejects(auth.addInstructorCourse({training_date:'2026-12-16',
    location_name:'Kraków',participant_count:12}),/Nie udało się zapisać/);
});

test('instructor may update only own identified course and four editable fields', async () => {
  const id = '3a021c91-3541-4f6f-9b7f-16934d6f5d09';
  const { auth, calls } = harness();
  await auth.init();
  await auth.updateInstructorCourse(id, {
    training_date: '2026-11-23', location_name: '  Kraków  ',
    participant_count: 18, notes: '  zmiana liczby  ', instructor_user_id: 'hacker'
  });
  assert.deepEqual(calls.find(c => c[0] === 'update'), ['update', {
    training_date: '2026-11-23', location_name: 'Kraków',
    participant_count: 18, notes: 'zmiana liczby'
  }]);
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === id));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'instructor_user_id' && c[2] === 'user-a'));
  assert.ok(calls.some(c => c[0] === 'select' && c[1] === 'id'));
});

test('instructor can delete only own course with explicit id and verified account', async () => {
  const id = '4f24321b-accb-4dfe-bf5a-1fdfc1a6f49e';
  const { auth, calls } = harness();
  await auth.init();
  assert.equal(await auth.deleteInstructorCourse(id), true);
  assert.ok(calls.some(c => c[0] === 'delete'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === id));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'instructor_user_id' && c[2] === 'user-a'));
});

test('invalid edit and delete ids cannot reach Supabase mutations', async () => {
  const { auth, calls } = harness();
  await auth.init();
  for (const id of ['invalid', '../id', '', '1']) {
    await assert.rejects(auth.updateInstructorCourse(id, {training_date:'2026-11-23',location_name:'Kraków',participant_count:1}), /identyfikator/);
    await assert.rejects(auth.deleteInstructorCourse(id), /identyfikator/);
  }
  assert.equal(calls.some(c => c[0] === 'update' || c[0] === 'delete'), false);
});

test('blocked accounts cannot edit or delete even if admin role is set', async () => {
  const { auth, calls } = harness({
    permission: {data:false,error:null},
    centralPermission: {data:true,error:null}
  });
  await auth.init();
  const id = '3a021c91-3541-4f6f-9b7f-16934d6f5d09';
  await assert.rejects(auth.updateInstructorCourse(id, {training_date:'2026-11-23',location_name:'Kraków',participant_count:1}), /aktywnej autoryzacji/);
  await assert.rejects(auth.deleteInstructorCourse(id), /aktywnej autoryzacji/);
  assert.equal(calls.some(c => c[0] === 'update' || c[0] === 'delete'), false);
});

test('no affected row or RLS error never reports successful update or deletion', async () => {
  const id = '3a021c91-3541-4f6f-9b7f-16934d6f5d09';
  const denied = harness({
    courseUpdate:{data:null,error:null},
    courseDelete:{data:null,error:null}
  });
  await denied.auth.init();
  await assert.rejects(denied.auth.updateInstructorCourse(id, {training_date:'2026-11-23',location_name:'Kraków',participant_count:1}), /Nie znaleziono/);
  await assert.rejects(denied.auth.deleteInstructorCourse(id), /Nie znaleziono/);
  const errors = harness({courseUpdate:{data:null,error:new Error('RLS')}});
  await errors.auth.init();
  await assert.rejects(errors.auth.updateInstructorCourse(id, {training_date:'2026-11-23',location_name:'Kraków',participant_count:1}), /Nie udało się zapisać zmian/);
});

test('course modifications are rejected if auth user session no longer verifies', async () => {
  const id = '3a021c91-3541-4f6f-9b7f-16934d6f5d09';
  const { auth, calls } = harness({getUser: async () => ({ data: {user:null},error:null })});
  await auth.init();
  // An authenticated user is necessary for mode=active; test session loss after init.
  // Here init will become guest, and mutations must not be issued.
  await assert.rejects(auth.deleteInstructorCourse(id));
  assert.equal(calls.some(c => c[0] === 'delete'), false);
});
