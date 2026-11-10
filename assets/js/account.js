(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.hash.slice(1));
  const activation = ['invite', 'recovery'].includes(params.get('type'));
  const failedLink = Boolean(params.get('error') || new URLSearchParams(location.search).get('error'));
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
    if (state.mode === 'unavailable') message('Nie można teraz potwierdzić uprawnień. Spróbuj ponownie później.');
    if (state.mode === 'guest' && !failedLink) message('Zaloguj się adresem e-mail wskazanym w zaproszeniu.');
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
      $('password-form').reset(); $('password-form').hidden = true;
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
  $('account-sign-out').addEventListener('click', async () => {
    try { renderState(await auth.signOut()); message('Wylogowano.'); }
    catch (error) { message(error.message); }
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
