/* ==========================================================================
   Punjabiforce - member dashboard
   Everyone signed in sees their own details, bookings and past events.
   Mentors and mentees also see their pairings. RLS enforces all of this;
   the queries below only ask for what the person is allowed to see.
   ========================================================================== */

(function () {
  'use strict';

  if (!document.getElementById('dash-loading')) return;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let me = null;
  let bookings = [];

  const PERSON_FIELDS =
    'id, first_name, last_name, title, company, city, country, bio, linkedin_url, avatar_url';

  const ROLE_LABEL = {
    event_attendee: 'Event Attendee', volunteer: 'Volunteer', mentee: 'Mentee', mentor: 'Mentor',
    sponsor: 'Sponsor', speaker: 'Speaker', advisory: 'Advisory'
  };
  const JOIN_LABEL = { attendee: '', volunteer: 'Volunteering', speaker: 'Speaking' };

  const ukWhen = (startIso, endIso) => {
    const opt = { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short',
                  year: 'numeric', hour: '2-digit', minute: '2-digit' };
    let s = new Date(startIso).toLocaleString('en-GB', opt);
    if (endIso) s += ' to ' + new Date(endIso).toLocaleTimeString('en-GB',
      { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
    return s;
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    me = await PF_AUTH.requireAuth();
    if (!me) return;

    renderHeader();
    renderDetails();
    wireDetailsModal();
    document.getElementById('dash-top').hidden = false;

    await Promise.all([loadBookings(), loadAsMentee(), loadAsMentor(), loadHistory()]);

    document.getElementById('dash-loading').hidden = true;
    wireFeedbackModal();
    wireDeleteAccount();
  }

  /* ---------------- header and details ---------------- */

  function renderHeader() {
    document.getElementById('greeting').textContent = 'Welcome back, ' + me.first_name + '.';
    const roles = (me.roles || []).map(r => ROLE_LABEL[r] || r);
    document.getElementById('role-line').innerHTML = roles.length
      ? roles.map(r => '<span class="role-tag">' + esc(r) + '</span>').join(' ')
      : 'Your Punjabiforce account.';
  }

  function renderDetails() {
    const row = (k, v) => '<dt>' + k + '</dt><dd>' + (v || '<span class="muted">Not added</span>') + '</dd>';
    document.getElementById('details-list').innerHTML =
      row('Name', esc(me.first_name + ' ' + me.last_name)) +
      row('Email', esc(me.email)) +
      row('LinkedIn', me.linkedin_url
        ? '<a href="' + esc(me.linkedin_url) + '" target="_blank" rel="noopener">' +
          esc(me.linkedin_url.replace(/^https?:\/\/(www\.)?/, '')) + '</a>' : '') +
      row('Job title', esc(me.title || '')) +
      row('Company', esc(me.company || ''));
  }

  function wireDetailsModal() {
    const modal = document.getElementById('details-modal');
    const form = document.getElementById('details-form');
    const status = form.querySelector('.form-status');

    document.getElementById('edit-details').addEventListener('click', () => {
      ['first_name', 'last_name', 'linkedin_url', 'title', 'company']
        .forEach(k => { form[k].value = me[k] || ''; });
      status.className = 'form-status';
      modal.hidden = false;
    });
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('[data-close-modal]')) modal.hidden = true;
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const v = k => (fd.get(k) || '').toString().trim();
      const say = (m, ok) => { status.textContent = m; status.className = 'form-status show ' + (ok ? 'ok' : 'error'); };

      if (!v('first_name') || !v('last_name')) return say('Please add your first and last name.');
      if (!/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(v('linkedin_url')))
        return say('Please add a full LinkedIn profile URL, starting with https://');

      const patch = {
        first_name: v('first_name'), last_name: v('last_name'),
        linkedin_url: v('linkedin_url'), title: v('title') || null, company: v('company') || null
      };
      const { error } = await sb.from('profiles').update(patch).eq('id', me.id);
      if (error) return say('Could not save: ' + error.message);

      Object.assign(me, patch);
      renderHeader();
      renderDetails();
      say('Saved.', true);
      setTimeout(() => { modal.hidden = true; }, 700);
    });
  }

  /* ---------------- bookings ---------------- */

  async function loadBookings() {
    const { data, error } = await sb.from('event_bookings')
      .select('id,status,joining_as,eventspf(id,slug,title,event_datetime,event_end,where_type,location,summary)')
      .eq('profile_id', me.id);
    // event_end arrives with task 3; fall back gracefully if the column is not there yet
    if (error && /event_end/.test(error.message || '')) {
      const retry = await sb.from('event_bookings')
        .select('id,status,joining_as,eventspf(id,slug,title,event_datetime,where_type,location,summary)')
        .eq('profile_id', me.id);
      bookings = retry.data || [];
    } else {
      bookings = data || [];
    }
    bookings = bookings.filter(b => b.eventspf);
    renderUpcoming();
    renderPast();
  }

  function renderUpcoming() {
    const now = Date.now();
    const list = bookings
      .filter(b => b.status === 'booked' && new Date(b.eventspf.event_datetime).getTime() >= now - 3 * 3600e3)
      .sort((a, b) => new Date(a.eventspf.event_datetime) - new Date(b.eventspf.event_datetime));

    const el = document.getElementById('upcoming-list');
    if (!list.length) {
      el.innerHTML = '<p class="muted-note dash-empty">Nothing booked yet. ' +
        '<a href="events.html">See what’s coming up</a>.</p>';
      return;
    }
    el.innerHTML = list.map(b => {
      const e = b.eventspf;
      const where = e.where_type === 'virtual' ? 'Online' : (e.location || 'In person');
      return '<div class="dash-event">' +
        '<div class="dash-event-when">' + esc(ukWhen(e.event_datetime, e.event_end)) + '</div>' +
        '<h3>' + esc(e.title) + '</h3>' +
        '<p class="muted">' + esc(where) + (JOIN_LABEL[b.joining_as] ? ' · ' + esc(JOIN_LABEL[b.joining_as]) : '') + '</p>' +
        '<div class="btn-row dash-event-actions">' +
          '<button class="btn-mini" type="button" data-ics="' + esc(b.id) + '">Add to calendar</button>' +
          '<button class="btn-mini btn-mini-quiet" type="button" data-cancel="' + esc(b.id) + '">Cancel</button>' +
        '</div></div>';
    }).join('');
  }

  function renderPast() {
    const list = bookings
      .filter(b => b.status === 'attended')
      .sort((a, b) => new Date(b.eventspf.event_datetime) - new Date(a.eventspf.event_datetime));
    if (!list.length) return;

    document.getElementById('past-block').hidden = false;
    document.getElementById('past-title').textContent =
      list.length === 1 ? '1 event attended.' : list.length + ' events attended.';
    document.getElementById('past-list').innerHTML = list.map(b =>
      '<div class="dash-past-item">' +
        '<span class="dash-event-when">' + esc(new Date(b.eventspf.event_datetime).toLocaleDateString('en-GB',
          { day: 'numeric', month: 'short', year: 'numeric' })) + '</span>' +
        '<strong>' + esc(b.eventspf.title) + '</strong>' +
        (JOIN_LABEL[b.joining_as] ? '<span class="chip">' + esc(JOIN_LABEL[b.joining_as]) + '</span>' : '') +
      '</div>').join('');
  }

  document.addEventListener('click', async e => {
    const c = e.target.closest('[data-cancel]');
    if (c) {
      const b = bookings.find(x => x.id === c.dataset.cancel);
      if (!b || !confirm('Cancel your place at ' + b.eventspf.title + '?')) return;
      c.disabled = true;
      const { error } = await sb.from('event_bookings').update({ status: 'cancelled' }).eq('id', b.id);
      if (error) { c.disabled = false; alert(error.message || 'Sorry, that did not work.'); return; }
      b.status = 'cancelled';
      renderUpcoming();
      return;
    }
    const i = e.target.closest('[data-ics]');
    if (i) {
      const b = bookings.find(x => x.id === i.dataset.ics);
      if (b) downloadIcs(b.eventspf);
    }
  });

  function downloadIcs(ev) {
    const start = new Date(ev.event_datetime);
    const end = ev.event_end ? new Date(ev.event_end) : new Date(start.getTime() + 2 * 3600e3);
    const f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const clean = s => String(s || '').replace(/[\;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
    const where = ev.where_type === 'virtual' ? 'Online' : (ev.location || 'In person');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Punjabiforce//Events//EN', 'BEGIN:VEVENT',
      'UID:' + ev.id + '@punjabiforce', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(start), 'DTEND:' + f(end),
      'SUMMARY:' + clean(ev.title), 'LOCATION:' + clean(where), 'DESCRIPTION:' + clean(ev.summary),
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = (ev.slug || 'punjabiforce-event') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------------- delete account ---------------- */

  function wireDeleteAccount() {
    const modal = document.getElementById('delete-modal');
    const form = document.getElementById('delete-form');
    const status = form.querySelector('.form-status');
    const say = m => { status.textContent = m; status.className = 'form-status show error'; };

    document.getElementById('delete-account-btn').addEventListener('click', () => {
      if (me.is_admin) {
        alert('Admins cannot delete their own account. Ask the other Admin to remove your Admin permission first.');
        return;
      }
      form.reset();
      status.className = 'form-status';
      modal.hidden = false;
      form.confirm.focus();
    });
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('[data-close-modal]')) modal.hidden = true;
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if ((form.confirm.value || '').trim().toUpperCase() !== 'DELETE') return say('Please type DELETE to confirm.');
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Deleting\u2026';

      const { data, error } = await sb.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
      if (error || !data || !data.ok) {
        let msg = 'Sorry, that did not work. Please contact us.';
        try { const j = error && error.context ? await error.context.json() : null; if (j && j.error) msg = j.error; } catch (x) {}
        btn.disabled = false;
        btn.textContent = 'Delete my account';
        return say(msg);
      }
      try { await sb.auth.signOut(); } catch (x) {}
      document.querySelector('main').innerHTML =
        '<section><div class="wrap"><div class="thanks-panel">' +
        '<div class="thanks-tick" aria-hidden="true">&#10003;</div>' +
        '<h2>Your account has been deleted.</h2>' +
        '<p>Your details and bookings have been removed. We have emailed you a confirmation.</p>' +
        '<a class="btn btn-primary" href="index.html">Back to the site</a></div></div></section>';
      window.scrollTo(0, 0);
    });
  }

  /* ---------------- mentee view ---------------- */

  async function loadAsMentee() {
    if (!me.is_mentee) return;

    const { data, error } = await sb
      .from('mentorships')
      .select('id, status, focus_area, started_at, sequence_number, ' +
              'mentor:profiles!mentorships_mentor_id_fkey(' + PERSON_FIELDS + '), ' +
              'expertise_areas(label)')
      .eq('mentee_id', me.id)
      .in('status', ['proposed', 'active', 'paused'])
      .maybeSingle();

    const block = document.getElementById('mentee-block');
    const target = document.getElementById('mentee-pairing');
    block.hidden = false;

    if (error) {
      target.innerHTML = '<p class="muted-note">Could not load your pairing.</p>';
      return;
    }

    if (!data) {
      target.innerHTML =
        '<div class="empty-card"><h3>No mentor assigned yet</h3>' +
        '<p>Once the team pairs you with a mentor they will appear here, ' +
        'along with their LinkedIn so you can connect.</p></div>';
      return;
    }

    target.innerHTML = personCard(data.mentor, {
      badge: 'Mentorship ' + data.sequence_number,
      status: data.status,
      focus: data.focus_area,
      area: data.expertise_areas ? data.expertise_areas.label : null,
      started: data.started_at,
      feedbackFor: data.status === 'active' ? data.id : null,
      feedbackRole: 'mentee'
    });
  }

  /* ---------------- mentor view ---------------- */

  async function loadAsMentor() {
    if (!me.is_mentor) return;

    const { data, error } = await sb
      .from('mentorships')
      .select('id, status, focus_area, started_at, ' +
              'mentee:profiles!mentorships_mentee_id_fkey(' + PERSON_FIELDS + '), ' +
              'expertise_areas(label)')
      .eq('mentor_id', me.id)
      .in('status', ['proposed', 'active', 'paused'])
      .order('started_at', { ascending: true });

    const block = document.getElementById('mentor-block');
    const target = document.getElementById('mentor-pairings');
    block.hidden = false;

    if (error || !data || !data.length) {
      target.innerHTML =
        '<div class="empty-card"><h3>No mentees right now</h3>' +
        '<p>You are listed as a mentor. When the team pairs someone with you ' +
        'they will show up here.</p></div>';
      return;
    }

    target.innerHTML = data.map(m => personCard(m.mentee, {
      status: m.status,
      focus: m.focus_area,
      area: m.expertise_areas ? m.expertise_areas.label : null,
      started: m.started_at,
      feedbackFor: m.status === 'active' ? m.id : null,
      feedbackRole: 'mentor',
      compact: true
    })).join('');
  }

  /* ---------------- completed history ---------------- */

  async function loadHistory() {
    if (!me.is_mentee && !me.is_mentor) return;
    const { data } = await sb
      .from('mentorships')
      .select('id, status, started_at, ended_at, sequence_number, focus_area, ' +
              'mentor:profiles!mentorships_mentor_id_fkey(first_name,last_name), ' +
              'mentee:profiles!mentorships_mentee_id_fkey(first_name,last_name)')
      .eq('status', 'completed')
      .order('ended_at', { ascending: false });

    if (!data || !data.length) return;

    document.getElementById('history-block').hidden = false;
    document.getElementById('history-list').innerHTML = data.map(m => {
      const other = m.mentor && m.mentor.first_name && m.mentee &&
        (me.is_mentee ? m.mentor : m.mentee);
      const name = other ? other.first_name + ' ' + other.last_name : 'Mentorship';
      const when = [m.started_at, m.ended_at].filter(Boolean).join(' to ') || '';
      return '<article class="event-item">' +
        '<div class="when">' + esc(when) + '</div>' +
        '<div><h3>' + esc(name) + '</h3>' +
        (m.focus_area ? '<p>' + esc(m.focus_area) + '</p>' : '') +
        '<span class="tag">Completed</span></div></article>';
    }).join('');
  }

  /* ---------------- rendering ---------------- */

  function personCard(p, opts) {
    if (!p) return '';
    opts = opts || {};
    const name = esc(p.first_name + ' ' + p.last_name);
    const meta = [p.title, p.company].filter(Boolean).join(', ');
    const place = [p.city, p.country].filter(Boolean).join(', ');

    return '<article class="pair-card">' +
      '<div class="pair-head">' +
        (p.avatar_url
          ? '<img src="' + esc(p.avatar_url) + '" alt="" width="72" height="72">'
          : '<div class="avatar-fallback">' +
              esc((p.first_name[0] || '') + (p.last_name[0] || '')) + '</div>') +
        '<div>' +
          '<h3>' + name + '</h3>' +
          (meta ? '<p class="role">' + esc(meta) + '</p>' : '') +
          (place ? '<p class="meta">' + esc(place) + '</p>' : '') +
        '</div>' +
        (opts.status
          ? '<span class="pill pill-' + esc(opts.status) + '">' +
            esc(opts.status) + '</span>' : '') +
      '</div>' +
      (p.bio ? '<p class="pair-bio">' + esc(p.bio) + '</p>' : '') +
      (opts.area ? '<p class="pair-line"><strong>Area:</strong> ' +
        esc(opts.area) + '</p>' : '') +
      (opts.focus ? '<p class="pair-line"><strong>Focus:</strong> ' +
        esc(opts.focus) + '</p>' : '') +
      '<div class="btn-row pair-actions">' +
        '<a class="btn btn-quiet" href="' + esc(p.linkedin_url) +
          '" target="_blank" rel="noopener">View LinkedIn</a>' +
        (opts.feedbackFor
          ? '<button class="btn btn-primary" data-feedback="' + esc(opts.feedbackFor) +
            '" data-role="' + esc(opts.feedbackRole) + '" data-name="' + name +
            '">Give feedback</button>'
          : '') +
      '</div>' +
    '</article>';
  }

  /* ---------------- feedback ---------------- */

  function wireFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    const form = document.getElementById('feedback-form');
    const status = form.querySelector('.form-status');

    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-feedback]');
      if (btn) {
        form.mentorship_id.value = btn.dataset.feedback;
        form.role.value = btn.dataset.role;
        document.getElementById('feedback-context').textContent =
          'Your mentorship with ' + btn.dataset.name + '.' +
          (btn.dataset.role === 'mentee'
            ? ' Only the Punjabiforce team sees this, never your mentor.'
            : '');
        status.className = 'form-status';
        modal.hidden = false;
      }
      if (e.target.closest('[data-close-modal]')) modal.hidden = true;
      if (e.target === modal) modal.hidden = true;
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(form);

      if (!fd.get('rating')) {
        status.textContent = 'Please choose a rating.';
        status.className = 'form-status show error';
        return;
      }

      const { error } = await sb.from('mentorship_feedback').insert({
        mentorship_id: fd.get('mentorship_id'),
        given_by: me.id,
        role: fd.get('role'),
        rating: Number(fd.get('rating')),
        comments: (fd.get('comments') || '').toString().trim() || null,
        would_recommend: !!fd.get('would_recommend')
      });

      if (error) {
        status.textContent = error.code === '23505'
          ? 'You have already given feedback for this mentorship.'
          : 'Could not save that. Please try again.';
        status.className = 'form-status show error';
        return;
      }

      status.textContent = 'Thanks, that is recorded.';
      status.className = 'form-status show ok';
      setTimeout(() => { modal.hidden = true; form.reset(); }, 1600);
    });
  }
})();
