/* ==========================================================================
   Punjabiforce - join form
   Writes a row into `applications`. The public can insert but never read,
   and the database forces every new row to status 'new'.
   ========================================================================== */

(function () {
  'use strict';

  const form = document.getElementById('join-form');
  if (!form) return;

  const status = form.querySelector('.form-status');

  if (!sb) {
    status.textContent = 'The signup service is unavailable right now. ' +
      'Please reach us on LinkedIn instead.';
    status.className = 'form-status show error';
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  function say(msg, ok) {
    status.textContent = msg;
    status.className = 'form-status show ' + (ok ? 'ok' : 'error');
    if (!ok) status.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function picklist(field) {
    const { data, error } = await sb
      .from('picklist_values')
      .select('value,label')
      .eq('field_name', field)
      .eq('active', true)
      .order('sort_order');
    return error ? null : data;
  }

  /* Pre-tick a type passed in the URL, e.g. join.html?type=volunteer */
  function preselectType() {
    const want = new URLSearchParams(window.location.search).get('type');
    if (!want) return;
    form.querySelectorAll('input[name="types"]').forEach(cb => {
      if (cb.value === want) cb.checked = true;
    });
  }
  preselectType();

  /* Participation checkboxes. The HTML ships with fallback options so the form
     still works if this request fails; on success they are replaced. */
  (async function loadTypes() {
    const group = document.querySelector('[data-render="type-options"]');
    if (!group) return;
    const rows = await picklist('application_type');
    if (!rows || !rows.length) return;

    group.querySelectorAll('label.check').forEach(el => el.remove());
    rows.forEach(r => {
      const label = document.createElement('label');
      label.className = 'check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'types';
      input.value = r.value;
      const span = document.createElement('span');
      span.textContent = r.label;
      label.append(input, ' ', span);
      group.appendChild(label);
    });
    preselectType();
    if (window.__pfFocusSync) window.__pfFocusSync();
  })();

  /* "How did you hear about us?" */
  (async function loadSources() {
    const select = document.querySelector('[data-render="source-options"]');
    if (!select) return;
    const rows = await picklist('application_source');
    (rows || []).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.value;
      opt.textContent = r.label;
      select.appendChild(opt);
    });
  })();

  /* Volunteer focus area: options from data.js, visible only when Volunteer is ticked */
  (function volunteerFocus() {
    const select = form.querySelector('[data-render="volunteer-focus"]');
    const wrap = form.querySelector('[data-volunteer-only]');
    if (!select || !wrap) return;
    if (typeof PF_DATA !== 'undefined' && PF_DATA.roles) {
      PF_DATA.roles.forEach(r => {
        const o = document.createElement('option');
        o.value = r.focus; o.textContent = r.focus;
        select.appendChild(o);
      });
    }
    const sync = () => {
      const vol = form.querySelector('input[name="types"][value="volunteer"]');
      wrap.hidden = !(vol && vol.checked);
    };
    form.addEventListener('change', e => { if (e.target.name === 'types') sync(); });
    sync();
    window.__pfFocusSync = sync;
  })();

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fd = new FormData(form);
    const val = k => (fd.get(k) || '').toString().trim();
    const types = fd.getAll('types');

    if (!val('last_name')) return say('Please add your last name.', false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email')))
      return say('Please add a valid email address.', false);
    if (!/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(val('linkedin_url')))
      return say('Please add a full LinkedIn profile URL, starting with https://', false);
    if (!val('company')) return say('Please add your company.', false);
    if (!types.length) return say('Please pick at least one way to take part.', false);
    if (!fd.get('consent'))
      return say('Please confirm you agree to us storing these details.', false);

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Submitting\u2026';

    const { error } = await sb.from('applications').insert({
      first_name: val('first_name') || null,
      last_name: val('last_name'),
      email: val('email'),
      linkedin_url: val('linkedin_url'),
      company: val('company'),
      title: val('title') || null,
      city: val('city') || null,
      country: val('country') || null,
      types: types,
      source: val('source') || null,
      description: [
        types.includes('volunteer') && val('volunteer_focus')
          ? 'Volunteer focus: ' + val('volunteer_focus') : '',
        val('description')
      ].filter(Boolean).join('\n\n') || null,
      consent_given_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION
    });

    btn.disabled = false;
    btn.innerHTML = 'Submit &rarr;';

    if (error) {
      console.error('Application error:', error);
      if (error.code === '23505') {
        return say('It looks like you have already applied with that email. ' +
                   'Get in touch if you would like to change anything.', false);
      }
      return say('Something went wrong saving that: ' + error.message, false);
    }

    // Swap the whole form area for a centred thank-you panel.
    // To apply again the visitor clicks Join us, which loads a fresh form.
    const first = val('first_name');
    document.getElementById('thanks-title').textContent =
      'Thanks' + (first ? ', ' + first : '') + '. Your application is in.';
    document.getElementById('thanks-email').textContent = val('email');
    form.reset();
    document.getElementById('join-area').hidden = true;
    const thanks = document.getElementById('join-thanks');
    thanks.hidden = false;
    thanks.scrollIntoView({ behavior: 'smooth', block: 'center' });
    thanks.querySelector('.thanks-panel').focus({ preventScroll: true });
  });
})();
