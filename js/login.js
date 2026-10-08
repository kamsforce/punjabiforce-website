/* ==========================================================================
   Punjabiforce - sign in (magic link)
   ========================================================================== */

(function () {
  'use strict';

  const form = document.getElementById('login-form');
  if (!form) return;

  const status = form.querySelector('.form-status');

  if (!sb) {
    status.textContent = 'Sign-in is unavailable right now. Please try again shortly.';
    status.className = 'form-status show error';
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  function say(msg, ok) {
    status.textContent = msg;
    status.className = 'form-status show ' + (ok ? 'ok' : 'error');
  }

  /* Already signed in? Go straight through. */
  (async function () {
    const session = await PF_AUTH.getSession();
    if (session) {
      const profile = await PF_AUTH.getProfile();
      window.location.href = (profile && profile.is_admin)
        ? 'admin.html' : 'dashboard.html';
    }
  })();

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = (new FormData(form).get('email') || '').toString().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return say('Please add a valid email address.', false);

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending\u2026';

    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || 'dashboard.html';

    /* Resolve against the folder this page sits in, so the site works whether
       it is served from the domain root or a subfolder such as
       /punjabiforce/ during local development. */
    const redirectTo = new URL(next, window.location.href).href;

    const { error } = await sb.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true    // access is granted by approval, not by the account
      }
    });

    btn.disabled = false;
    btn.innerHTML = 'Email me a sign-in link &rarr;';

    if (error) {
      console.error('Supabase sign-in error:', error);

      const msg = (error.message || '').toLowerCase();

      if (msg.includes('signups not allowed') || msg.includes('not found') ||
          msg.includes('user not found')) {
        return say('That email is not set up as a member yet. If you have not ' +
                   'joined, please use the join form first.', false);
      }
      if (msg.includes('rate') || msg.includes('limit') || error.status === 429) {
        return say('Too many sign-in emails have been sent recently. Supabase ' +
                   'limits this on the free plan. Wait an hour and try again.', false);
      }
      if (msg.includes('redirect')) {
        return say('This address is not in the allowed redirect list in Supabase ' +
                   '(Authentication > URL Configuration).', false);
      }

      // Anything else: show it, so the cause is visible rather than guessed at.
      return say('Could not send the link: ' + (error.message || 'unknown error'), false);
    }

    // Switch to the code box. The emailed link still works too.
    showCodeForm(email);
  });

  /* ---------------- code entry ---------------- */

  const codeForm = document.getElementById('code-form');
  const codeStatus = codeForm ? codeForm.querySelector('.form-status') : null;
  let pendingEmail = '';

  function codeSay(msg, ok) {
    codeStatus.textContent = msg;
    codeStatus.className = 'form-status show ' + (ok ? 'ok' : 'error');
  }

  function showCodeForm(email) {
    if (!codeForm) {
      say('Check your inbox. The link signs you in and expires after an hour.', true);
      return;
    }
    pendingEmail = email;
    form.hidden = true;
    codeForm.hidden = false;
    document.getElementById('code-sent-to').textContent =
      'We have emailed a code to ' + email + '. Enter it below, or click the link in the email.';
    codeForm.token.focus();
  }

  if (codeForm) {
    document.getElementById('code-restart').addEventListener('click', function (e) {
      e.preventDefault();
      codeForm.hidden = true;
      codeForm.reset();
      codeStatus.className = 'form-status';
      form.hidden = false;
      status.className = 'form-status';
    });

    codeForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const token = (codeForm.token.value || '').replace(/\s/g, '');
      if (!/^[0-9]{6,10}$/.test(token)) return codeSay('Please enter the code from the email.', false);

      const btn = codeForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Checking\u2026';

      const { error } = await sb.auth.verifyOtp({ email: pendingEmail, token: token, type: 'email' });

      btn.disabled = false;
      btn.innerHTML = 'Sign in &rarr;';

      if (error) {
        console.error('Code error:', error);
        return codeSay('That code did not work. It may have expired or already been used. ' +
                       'Use a different email to request a new one.', false);
      }

      const next = new URLSearchParams(window.location.search).get('next');
      // Fresh lookup: the auth helper cached "signed out" when this page loaded.
      const { data: sess } = await sb.auth.getSession();
      const { data: profile } = await sb.from('profiles')
        .select('is_admin').eq('id', sess.session.user.id).maybeSingle();
      window.location.href = next || ((profile && profile.is_admin) ? 'admin.html' : 'dashboard.html');
    });
  }
})();
