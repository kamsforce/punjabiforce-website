/* ==========================================================================
   Punjabiforce - Supabase client
   The publishable key is designed to sit in browser code. Row Level Security
   in the database is what protects the data, not the secrecy of this key.
   Never put the secret / service_role key in here.
   ========================================================================== */

const SUPABASE_URL = 'https://upkmwxzkgixfwppuuneo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mTHUSHlQcay66uSY4KM03g_F1wV20J0';

/* If the Supabase library fails to load (CDN blocked, offline), the public
   pages must still work. `sb` stays null and the member pages say so rather
   than throwing on every script. */
const sb = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

if (!sb) {
  console.warn('Supabase library did not load. Member features are unavailable.');
}

/* Version string stored against each consent record, so you can tell which
   wording someone agreed to. Bump this whenever policies.html changes. */
const CONSENT_VERSION = '2026-10-02';
