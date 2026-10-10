/* ==========================================================================
   Punjabiforce - events page and booking
   Reads `eventspf` (public). Upcoming soonest first, past newest first.
   Booking writes to `event_bookings`; every rule (open, capacity, one place
   per person) is enforced in the database, not here.
   ========================================================================== */

(function () {
  'use strict';

  const upEl = document.getElementById('events-upcoming');
  const pastEl = document.getElementById('events-past');
  if (!upEl || !pastEl) return;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const STATUS = { registration_open: 'Registration open', planning: 'Coming soon', completed: 'Completed' };
  const WHERE = { in_person: 'In person', virtual: 'Virtual' };

  /* Always shown in UK time, whatever the visitor's timezone. */
  const when = iso => new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', day: 'numeric',
    month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  /* "Thu, 15 Jan 2027, 18:00 to 21:00" when there is an end time */
  const whenRange = e => when(e.event_datetime) + (e.event_end
    ? ' to ' + new Date(e.event_end).toLocaleTimeString('en-GB',
        { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }) : '');

  /* Page state */
  let events = [];
  const counts = {};       // event_id -> { capacity, booked, places_left }
  const mine = {};         // event_id -> my booking row
  let session = null;
  let profile = null;

  /* ---------------- rendering ---------------- */

  function thumb(e) {
    if (!e.image_url) return '';
    return '<button class="event-thumb" type="button" data-full="' + esc(e.image_url) +
      '" aria-label="Enlarge image for ' + esc(e.title) + '">' +
      '<img src="' + esc(e.image_url) + '" alt="" loading="lazy"></button>';
  }

  function isOpen(e) {
    return e.status === 'registration_open' && new Date(e.event_datetime).getTime() > Date.now();
  }

  /* "12 places left" / "Last few places" / "Full" */
  function placesTag(e) {
    const c = counts[e.id];
    if (!isOpen(e) || e.registration_url || !c || c.places_left == null) return '';
    if (c.places_left === 0) return '<span class="tag tag-full">Full</span> ';
    if (c.places_left <= 5) return '<span class="tag tag-few">Last few places</span> ';
    return '<span class="tag tag-ok">' + c.places_left + ' places left</span> ';
  }

  function bookingButtons(e) {
    if (e.registration_url) {
      return isOpen(e) ? '<a class="btn btn-primary" href="' + esc(e.registration_url) +
        '" target="_blank" rel="noopener">Register &rarr;</a>' : '';
    }
    if (e.status === 'planning') return '<span class="booking-note">Registration opens soon</span>';
    if (!isOpen(e)) return '';

    const b = mine[e.id];
    if (b && (b.status === 'booked' || b.status === 'attended')) {
      const label = b.joining_as === 'volunteer' ? 'You’re volunteering &#10003;' : 'You’re booked &#10003;';
      return '<span class="booked-badge">' + label + '</span>' +
        '<button class="btn btn-quiet" type="button" data-cancel="' + esc(e.id) + '">Cancel booking</button>';
    }
    const c = counts[e.id];
    const isVolunteer = profile && (profile.roles || []).includes('volunteer');
    const volunteerBtn = isVolunteer
      ? '<button class="btn btn-quiet" type="button" data-volunteer="' + esc(e.id) + '">Volunteer at this event</button>' : '';
    if (c && c.places_left === 0) {
      return '<button class="btn btn-quiet" type="button" disabled>Full</button>' + volunteerBtn;
    }
    return '<button class="btn btn-primary" type="button" data-book="' + esc(e.id) + '">Book a place &rarr;</button>' + volunteerBtn;
  }

  function details(e, upcoming) {
    const recording = e.recording_url
      ? '<a class="btn btn-quiet" href="' + esc(e.recording_url) +
        '" target="_blank" rel="noopener">Watch recording</a>' : '';
    const actions = (upcoming ? bookingButtons(e) : '') + recording;
    return '<h3>' + esc(e.title) + '</h3>' +
      (e.community ? '<p class="event-meta">' + esc(e.community) + '</p>' : '') +
      (e.summary ? '<p>' + esc(e.summary) + '</p>' : '') +
      '<span class="tag">' + esc(WHERE[e.where_type] || e.where_type) + '</span> ' +
      (e.location ? '<span class="tag">' + esc(e.location) + '</span> ' : '') +
      '<span class="tag">' + esc(STATUS[e.status] || e.status) + '</span> ' +
      (upcoming ? placesTag(e) : '') +
      (actions ? '<div class="btn-row event-actions">' + actions + '</div>' : '');
  }

  /* Upcoming: full-width list row */
  function row(e) {
    return '<article class="event-item" id="event-' + esc(e.id) + '">' +
      '<div class="when">' + esc(whenRange(e)) + '</div>' +
      '<div class="event-body">' + thumb(e) + '<div>' + details(e, true) + '</div></div>' +
    '</article>';
  }

  /* Past: card in a 2-column grid */
  function tile(e) {
    return '<article class="event-card">' + thumb(e) +
      '<div class="event-card-body">' +
        '<div class="when">' + esc(when(e.event_datetime)) + '</div>' +
        details(e, false) +
      '</div></article>';
  }

  function render() {
    const now = Date.now();
    const upcoming = events.filter(e =>
      e.status !== 'completed' && new Date(e.event_datetime).getTime() >= now);
    const past = events.filter(e => !upcoming.includes(e)).reverse();

    upEl.innerHTML = upcoming.length ? upcoming.map(row).join('')
      : '<p class="muted-note">Nothing scheduled right now. Follow us on ' +
        '<a href="https://www.linkedin.com/company/punjabiforcenet">LinkedIn</a> ' +
        'to hear about the next one.</p>';
    pastEl.innerHTML = past.length ? past.map(tile).join('')
      : '<p class="muted-note">No past events yet.</p>';
  }

  /* ---------------- data ---------------- */

  async function loadCounts() {
    const { data } = await sb.rpc('event_booking_counts');
    (data || []).forEach(c => { counts[c.event_id] = c; });
  }

  async function loadMine() {
    Object.keys(mine).forEach(k => delete mine[k]);
    if (!session) return;
    const { data } = await sb.from('event_bookings')
      .select('id,event_id,status,joining_as').eq('profile_id', session.user.id);
    (data || []).forEach(b => { mine[b.event_id] = b; });
  }

  async function loadProfile() {
    profile = null;
    if (!session) return;
    const { data } = await sb.from('profiles')
      .select('id,first_name,roles').eq('id', session.user.id).maybeSingle();
    profile = data || null;
  }

  async function refresh() {
    await Promise.all([loadCounts(), loadMine()]);
    render();
  }

  /* ---------------- modal ---------------- */

  const modal = document.getElementById('booking-modal');
  const panels = modal ? modal.querySelectorAll('[data-panel]') : [];
  let current = null;   // event being booked
  let joiningAs = 'attendee';

  function show(name) {
    panels.forEach(p => { p.hidden = p.dataset.panel !== name; });
    modal.hidden = false;
    const focusable = modal.querySelector('[data-panel="' + name + '"] input, [data-panel="' + name + '"] button');
    if (focusable) focusable.focus();
  }
  function closeModal() { if (modal) modal.hidden = true; }

  function say(panel, msg) {
    const s = modal.querySelector('[data-panel="' + panel + '"] .form-status');
    s.textContent = msg;
    s.className = 'form-status show error';
  }
  function clearSay(panel) {
    const s = modal.querySelector('[data-panel="' + panel + '"] .form-status');
    if (s) { s.textContent = ''; s.className = 'form-status'; }
  }

  function fillEvent(scope) {
    modal.querySelectorAll('[data-panel="' + scope + '"] [data-ev-title]')
      .forEach(el => { el.textContent = current.title; });
    modal.querySelectorAll('[data-panel="' + scope + '"] [data-ev-when]')
      .forEach(el => { el.textContent = whenRange(current) + ' (UK time)'; });
  }

  /* ---------------- booking flow ---------------- */

  async function startBooking(eventId, asVolunteer) {
    current = events.find(e => e.id === eventId);
    if (!current) return;
    joiningAs = asVolunteer ? 'volunteer' : 'attendee';
    const t = document.getElementById('booking-title');
    if (t) t.textContent = asVolunteer ? 'Volunteer at this event' : 'Book your place';

    if (!session) {
      const back = 'events.html?book=' + encodeURIComponent(eventId);
      window.location.href = 'login.html?next=' + encodeURIComponent(back);
      return;
    }
    if (!profile) {
      clearSay('details');
      fillEvent('details');
      modal.querySelector('[data-email]').textContent = session.user.email;
      show('details');
      prefillFromGuest();
      return;
    }
    clearSay('confirm');
    fillEvent('confirm');
    show('confirm');
  }

  /* If we already know this email from an imported list, fill in what we have */
  async function prefillFromGuest() {
    const { data } = await sb.rpc('my_guest_details');
    const g = Array.isArray(data) ? data[0] : data;
    if (!g) return;
    const form = modal.querySelector('#booking-details-form');
    ['first_name', 'last_name', 'linkedin_url', 'title', 'company'].forEach(k => {
      if (g[k] && !form[k].value) form[k].value = g[k];
    });
  }

  async function book() {
    const existing = mine[current.id];
    const q = existing
      ? sb.from('event_bookings').update({ status: 'booked' }).eq('id', existing.id)
      : sb.from('event_bookings').insert({ event_id: current.id, profile_id: session.user.id, joining_as: joiningAs });
    const { error } = await q;
    if (error) {
      console.error('Booking error:', error);
      if (error.code === '23505') return 'You already have a place at this event.';
      return error.message || 'Sorry, that did not work. Please try again.';
    }
    return null;
  }

  async function confirmBooking(panel, btn) {
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.textContent = 'Booking…';
    const err = await book();
    btn.disabled = false;
    btn.innerHTML = label;
    if (err) { say(panel, err); await refresh(); return; }

    fillEvent('done');
    modal.querySelector('[data-done-email]').textContent = session.user.email;
    show('done');
    await refresh();
  }

  async function cancelBooking(eventId, btn) {
    const e = events.find(x => x.id === eventId);
    const b = mine[eventId];
    if (!e || !b) return;
    if (!window.confirm('Cancel your place at ' + e.title + '?')) return;
    btn.disabled = true;
    const { error } = await sb.from('event_bookings').update({ status: 'cancelled' }).eq('id', b.id);
    if (error) {
      btn.disabled = false;
      window.alert(error.message || 'Sorry, that did not work. Please try again.');
      return;
    }
    await refresh();
  }

  /* Add to calendar: a small .ics file the visitor saves */
  function downloadIcs() {
    if (!current) return;
    const start = new Date(current.event_datetime);
    const end = current.event_end ? new Date(current.event_end)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const where = current.where_type === 'virtual' ? 'Online' : (current.location || 'In person');
    const clean = s => String(s || '').replace(/[\;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Punjabiforce//Events//EN',
      'BEGIN:VEVENT',
      'UID:' + current.id + '@punjabiforce',
      'DTSTAMP:' + f(new Date()),
      'DTSTART:' + f(start), 'DTEND:' + f(end),
      'SUMMARY:' + clean(current.title),
      'LOCATION:' + clean(where),
      'DESCRIPTION:' + clean(current.summary),
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = (current.slug || 'punjabiforce-event') + '.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function wireModal() {
    if (!modal) return;

    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('[data-close-modal]')) closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    modal.querySelector('[data-confirm-book]').addEventListener('click', function () {
      confirmBooking('confirm', this);
    });
    modal.querySelector('[data-ics]').addEventListener('click', downloadIcs);

    /* First-time details form: create the profile, then book */
    const form = modal.querySelector('#booking-details-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      const val = k => (fd.get(k) || '').toString().trim();

      if (!val('first_name') || !val('last_name')) return say('details', 'Please add your first and last name.');
      if (!/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(val('linkedin_url')))
        return say('details', 'Please add a full LinkedIn profile URL, starting with https://');
      if (!fd.get('consent')) return say('details', 'Please confirm you agree to us storing your details.');

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Saving…';

      const { data, error } = await sb.rpc('create_attendee_profile', {
        p_first_name: val('first_name'),
        p_last_name: val('last_name'),
        p_linkedin_url: val('linkedin_url'),
        p_title: val('title'),
        p_company: val('company'),
        p_consent_version: typeof CONSENT_VERSION !== 'undefined' ? CONSENT_VERSION : 'unknown'
      });

      btn.disabled = false;
      btn.innerHTML = 'Book my place &rarr;';

      if (error) {
        console.error('Profile error:', error);
        return say('details', error.message || 'Sorry, that did not work. Please try again.');
      }
      profile = data;
      await confirmBooking('details', btn);
    });
  }

  /* ---------------- lightbox ---------------- */

  /* Click any thumbnail to see it full size. Esc or click closes. */
  function wireLightbox() {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.innerHTML = '<img alt=""><button class="lightbox-close" aria-label="Close">&times;</button>';
    document.body.appendChild(box);
    const img = box.querySelector('img');
    const close = () => { box.hidden = true; img.src = ''; };

    document.addEventListener('click', e => {
      const t = e.target.closest('[data-full]');
      if (t) { img.src = t.dataset.full; box.hidden = false; return; }
      if (!box.hidden && (e.target === box || e.target.closest('.lightbox-close'))) close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });
  }

  /* ---------------- start ---------------- */

  async function load() {
    if (typeof sb === 'undefined' || !sb) {
      upEl.innerHTML = '<p class="muted-note">Events could not be loaded right now.</p>';
      return;
    }

    const { data: s } = await sb.auth.getSession();
    session = s.session || null;

    const [{ data, error }] = await Promise.all([
      sb.from('eventspf').select('*').order('event_datetime', { ascending: true }),
      loadCounts(), loadMine(), loadProfile()
    ]);

    if (error) {
      console.error('Events error:', error);
      upEl.innerHTML = '<p class="muted-note">Events could not be loaded right now.</p>';
      return;
    }
    events = data || [];
    render();

    /* Back from sign-in with ?book=<id>: carry on with that booking */
    const params = new URLSearchParams(window.location.search);
    const want = params.get('book');
    if (want) {
      history.replaceState(null, '', window.location.pathname);
      const el = document.getElementById('event-' + want);
      if (el) el.scrollIntoView({ block: 'center' });
      if (session && !(mine[want] && mine[want].status === 'booked')) startBooking(want);
    }
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-book]');
    if (b) { startBooking(b.dataset.book); return; }
    const v = e.target.closest('[data-volunteer]');
    if (v) { startBooking(v.dataset.volunteer, true); return; }
    const c = e.target.closest('[data-cancel]');
    if (c) cancelBooking(c.dataset.cancel, c);
  });

  document.addEventListener('DOMContentLoaded', () => { wireLightbox(); wireModal(); load(); });
})();
