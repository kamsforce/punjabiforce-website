/* ==========================================================================
   Punjabiforce - auth and navigation state

   Three visibility tiers:
     public  - not signed in
     member  - signed in, mentor and/or mentee
     admin   - signed in with is_admin = true

   IMPORTANT: hiding nav links and redirecting is convenience only. Anyone can
   type a URL. The real protection is the Row Level Security policies in the
   database, which return nothing to a user who should not see a row.
   ========================================================================== */

const PF_AUTH = (function () {
  'use strict';

  let cachedProfile = null;

  /** Current session, or null. Returns null if the library failed to load. */
  async function getSession() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session || null;
  }

  /** The signed-in user's profile row, or null. Cached per page load. */
  async function getProfile() {
    if (!sb) return null;
    if (cachedProfile !== null) return cachedProfile;

    const session = await getSession();
    if (!session) {
      cachedProfile = false;
      return null;
    }

    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Profile lookup failed:', error.message);
      cachedProfile = false;
      return null;
    }

    cachedProfile = data || false;
    return data || null;
  }

  /** Show or hide nav items based on who is signed in. */
  async function applyNavState() {
    const profile = await getProfile();
    const session = await getSession();

    document.querySelectorAll('[data-show="member"]').forEach(el => {
      el.hidden = !profile;
    });
    document.querySelectorAll('[data-show="admin"]').forEach(el => {
      el.hidden = !(profile && profile.is_admin);
    });
    document.querySelectorAll('[data-show="guest"]').forEach(el => {
      el.hidden = !!session;
    });
  }

  /** Redirect away if not signed in. Optionally require admin. */
  async function requireAuth(opts) {
    const needAdmin = opts && opts.admin;

    if (!sb) {
      offlineMessage();
      return null;
    }

    const session = await getSession();

    if (!session) {
      window.location.href = 'login.html?next=' +
        encodeURIComponent(window.location.pathname.split('/').pop());
      return null;
    }

    const profile = await getProfile();

    if (!profile) {
      // Signed in but no profile row yet.
      document.body.innerHTML =
        '<div class="wrap" style="padding:120px 32px;text-align:center">' +
        '<h1 style="font-family:var(--font-display)">Application pending</h1>' +
        '<p style="margin:16px 0 24px;color:var(--muted)">You are signed in, but your ' +
        'application has not been approved yet. Once the team approves it, sign in ' +
        'again and your dashboard will be ready. If you have not applied, please ' +
        '<a href="join.html">join the community</a> first.</p>' +
        '<a class="btn btn-primary" href="index.html">Back to the site</a></div>';
      return null;
    }

    if (needAdmin && !profile.is_admin) {
      window.location.href = 'dashboard.html';
      return null;
    }

    return profile;
  }

  /** Shown when the Supabase library could not load at all. */
  function offlineMessage() {
    document.body.innerHTML =
      '<div class="wrap" style="padding:120px 32px;text-align:center">' +
      '<h1 style="font-family:var(--font-display)">Can\u2019t reach the member area</h1>' +
      '<p style="margin:16px 0 24px;color:var(--muted)">We could not load the ' +
      'sign-in service. Check your connection and try again.</p>' +
      '<a class="btn btn-primary" href="index.html">Back to the site</a></div>';
  }

  async function signOut() {
    if (!sb) { window.location.href = 'index.html'; return; }
    await sb.auth.signOut();
    window.location.href = 'index.html';
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyNavState();
    document.querySelectorAll('[data-signout]').forEach(el => {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        signOut();
      });
    });
  });

  return { getSession, getProfile, requireAuth, signOut, applyNavState };
})();
