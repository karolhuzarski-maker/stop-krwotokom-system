(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.hash.slice(1));
  const queryParams = new URLSearchParams(location.search);
  const activationKey = 'sks-pending-password';
  let activation = ['invite', 'recovery'].includes(params.get('type')) ||
    ['invite', 'recovery'].includes(queryParams.get('type'));
  // Store only the invite intent, never authentication tokens.
  // Supabase removes callback credentials from the URL during session initialization.
  try {
    const savedAt = Number(sessionStorage.getItem(activationKey) || 0);
    if (savedAt && Date.now() - savedAt < 30 * 60 * 1000) activation = true;
    else sessionStorage.removeItem(activationKey);
    if (activation) sessionStorage.setItem(activationKey, String(Date.now()));
  } catch (_) {}
  const failedLink = Boolean(params.get('error') || queryParams.get('error'));
  function clearActivation() {
    activation = false;
    try { sessionStorage.removeItem(activationKey); } catch (_) {}
  }
  const auth = window.SKAuth;
  let busy = false, token = '', captcha;
  function message(text) { $('account-message').textContent = text; }
  function buttons() {
    $('sign-in-submit').disabled = busy || (auth.needsCaptcha() && !token);
    $('reset-password').disabled = busy || (auth.needsCaptcha() && !token);
  }
  function renderState(state) {
    const isUser = ['active', 'blocked'].includes(state.mode);
    $('account-connected').hidden = !isUser;
    $('account-email').textContent = state.email;
    $('login-form').hidden = isUser || state.mode === 'disabled' || state.mode === 'unavailable';
    $('password-form').hidden = true;
    $('open-password-form').hidden = !isUser || activation;
    if (state.mode === 'unavailable') message('Nie można teraz potwierdzić uprawnień. Spróbuj ponownie później.');
    if (state.mode === 'guest' && !failedLink) message(activation ?
      'Nie udało się jeszcze potwierdzić zaproszenia. Jeżeli formularz ustawienia hasła się nie pojawi, otwórz ponownie link z e-maila.' :
      'Zaloguj się adresem e-mail wskazanym w zaproszeniu.');
    if (isUser && activation) {
      $('password-form').hidden = false;
      message('Potwierdzono adres. Ustaw własne hasło do konta.');
    } else if (isUser) {
      message(state.mode === 'active' ? 'Dostęp do konta jest aktywny.' : 'Dostęp wymaga aktywacji lub odnowienia przez organizatora.');
    }
  }
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity() || (auth.needsCaptcha() && !token)) return;
    busy = true; buttons(); message('Logowanie…');
    try {
      const state = await auth.signIn($('account-login-email').value, $('account-login-password').value, token);
      if (state.mode === 'unavailable') throw new Error('Nie można teraz potwierdzić uprawnień. Spróbuj ponownie później.');
      if (state.mode === 'guest') throw new Error('Nie udało się potwierdzić konta. Spróbuj ponownie.');
      renderState(state);
    } catch (error) { message(error.message); }
    finally { $('account-login-password').value = ''; busy = false; if (captcha) captcha.reset(); buttons(); }
  });
  $('password-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    if ($('account-new-password').value !== $('account-repeat-password').value) { message('Hasła muszą być jednakowe.'); return; }
    busy = true; $('set-password-submit').disabled = true;
    try {
      await auth.setPassword($('account-new-password').value);
      clearActivation();
      $('password-form').reset();
      renderState(auth.getState());
      history.replaceState(null, '', location.pathname);
      message('Hasło zostało zapisane. Możesz przejść do portalu.');
    } catch (error) { message(error.message); }
    finally { busy = false; $('set-password-submit').disabled = false; }
  });
  $('reset-password').addEventListener('click', async () => {
    if (busy || !$('account-login-email').reportValidity() || (auth.needsCaptcha() && !token)) return;
    busy = true; buttons();
    try {
      await auth.resetPassword($('account-login-email').value, token);
      message('Jeśli adres jest przypisany do konta, otrzymasz wiadomość z linkiem do zmiany hasła.');
    } catch (error) { message(error.message); }
    finally { busy = false; if (captcha) captcha.reset(); buttons(); }
  });
  $('open-password-form').addEventListener('click', () => {
    $('open-password-form').hidden = true;
    $('password-form').hidden = false;
    message('Ustaw nowe hasło do swojego konta.');
    $('account-new-password').focus();
  });
  $('account-sign-out').addEventListener('click', async () => {
    try { clearActivation(); renderState(await auth.signOut()); message('Wylogowano.'); }
    catch (error) { message(error.message); }
  });
  // On a confirmation redirect the session can arrive after the first render.
  window.addEventListener('sk:access', event => {
    if (event.detail) renderState(event.detail);
  });
  (async () => {
    try {
      const state = await auth.init();
      if (state.mode === 'disabled') { message('Logowanie zostanie udostępnione po uruchomieniu kont instruktorskich.'); return; }
      if (failedLink) { message('Link wygasł lub jest nieprawidłowy. Poproś organizatora o nowe zaproszenie.'); }
      renderState(state);
      if (auth.needsCaptcha()) captcha = await auth.mountCaptcha($('account-captcha'), value => { token = value; buttons(); });
      buttons();
    } catch (error) { $('login-form').hidden = true; $('password-form').hidden = true; message(error.message); }
  })();
})();
