/* ==========================================================================
   Punjabiforce - admin
   Admins see everything. Helpdesk Admins see Applications (read only),
   Members (fix contact details) and Attendees (book, cancel, check in).
   Hiding tabs here is only for convenience: the database enforces every rule.
   ========================================================================== */

(function () {
  'use strict';

  if (!document.getElementById('panel-applications')) return;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmt = d => d ? new Date(d).toLocaleDateString('en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  /* Table cell with a label, so tables turn into cards on phones */
  const td = (label, html, cls) =>
    '<td' + (label ? ' data-label="' + esc(label) + '"' : '') +
    (cls ? ' class="' + cls + '"' : '') + '>' + html + '</td>';

  const ROLES = [
    ['event_attendee', 'Event Attendee'], ['volunteer', 'Volunteer'], ['mentee', 'Mentee'],
    ['mentor', 'Mentor'], ['sponsor', 'Sponsor'], ['speaker', 'Speaker'], ['advisory', 'Advisory']
  ];
  const ROLE_LABEL = Object.fromEntries(ROLES);
  const LEVEL_LABEL = { individual: 'Individual', helpdesk: 'Helpdesk Admin', admin: 'Admin' };

  let me = null;
  let isAdmin = false;
  let people = [];          // all profiles
  let mentees = [];
  let mentors = [];
  let statusLabels = {};
  let applicationsCache = [];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    me = await PF_AUTH.requireAuth({ staff: true });
    if (!me) return;
    isAdmin = !!me.is_admin;

    if (!isAdmin) {
      document.querySelectorAll('[data-admin-only]').forEach(el => el.remove());
      const who = document.getElementById('admin-who');
      who.textContent = 'You are signed in as a Helpdesk Admin.';
      who.hidden = false;
    }

    wireTabs();
    wireMemberModal();
    wireApplicationModal();
    wireAttendees();
    if (isAdmin) { wirePairingModal(); wireEventModal(); }

    await loadStatusFilter();
    await loadMembers();
    await Promise.all([
      loadApplications(),
      loadAttendeeEvents(),
      isAdmin ? loadPairings() : null,
      isAdmin ? loadFeedback() : null,
      isAdmin ? loadEvents() : null,
      isAdmin ? loadActivity() : null
    ]);
  }

  /* ---------------- tabs ---------------- */

  function wireTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t =>
          t.classList.toggle('active', t === tab));
        document.querySelectorAll('.admin-panel').forEach(p =>
          p.classList.toggle('active', p.id === 'panel-' + tab.dataset.panel));
        if (tab.dataset.panel === 'activity') loadActivity();
      });
    });
  }

  /* Close any modal: background click, Cancel button, or Esc */
  document.addEventListener('click', e => {
    const m = e.target.closest('.modal');
    if (m && (e.target === m || e.target.closest('[data-close-modal]'))) m.hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
  });

  function formSay(form, msg, ok) {
    const s = form.querySelector('.form-status');
    s.textContent = msg;
    s.className = 'form-status show ' + (ok ? 'ok' : 'error');
  }
  const validLinkedIn = u => /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(u);

  /* ---------------- applications ---------------- */

  async function loadStatusFilter() {
    const sel = document.getElementById('application-filter');
    const { data } = await sb.from('picklist_values')
      .select('value,label').eq('field_name', 'application_status')
      .eq('active', true).order('sort_order');
    (data || []).forEach(r => {
      statusLabels[r.value] = r.label;
      const o = document.createElement('option');
      o.value = r.value; o.textContent = r.label;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => loadApplications());
  }

  async function loadApplications() {
    const filter = document.getElementById('application-filter').value;
    let q = sb.from('applications').select('*')
      .order('created_at', { ascending: false });
    if (filter) q = q.eq('status', filter);

    const { data, error } = await q;
    const table = document.getElementById('applications-table');

    if (error) {
      table.innerHTML = '<tbody><tr><td>' + (isAdmin ? 'Could not load applications.'
        : 'Applications are visible to Admins only.') + '</td></tr></tbody>';
      return;
    }
    applicationsCache = data;
    if (!data.length) {
      table.innerHTML = '<tbody><tr><td class="empty-row">No applications here.</td></tr></tbody>';
      return;
    }

    table.innerHTML =
      '<thead><tr><th>Name</th><th>Email</th><th>LinkedIn</th><th>Company</th><th>Applied as</th>' +
      '<th>Status</th><th>Received</th><th></th></tr></thead><tbody>' +
      data.map(a => '<tr>' +
        td('Name', '<strong>' + esc([a.first_name, a.last_name].filter(Boolean).join(' ')) + '</strong>') +
        td('Email', esc(a.email)) +
        td('LinkedIn', linkCell(a.linkedin_url)) +
        td('Company', esc(a.company)) +
        td('Applied as', (a.types || []).map(t =>
          '<span class="chip">' + esc(t) + '</span>').join(' ')) +
        td('Status', '<span class="pill pill-' + esc(a.status) + '">' +
          esc(statusLabels[a.status] || a.status) + '</span>') +
        td('Received', fmt(a.created_at)) +
        td('', applicationActions(a), 'row-actions') +
      '</tr>').join('') + '</tbody>';

    table.querySelectorAll('[data-app-status]').forEach(b => {
      b.addEventListener('click', () =>
        setApplicationStatus(b.dataset.id, b.dataset.appStatus, b));
    });
    table.querySelectorAll('[data-edit-app]').forEach(b =>
      b.addEventListener('click', () => openApplicationModal(b.dataset.editApp)));
  }

  function linkCell(url) {
    if (!url) return '<span class="muted">None</span>';
    const short = url.replace(/^https?:\/\/(www\.)?linkedin\.com/i, '').replace(/\/$/, '') || url;
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener" class="li-link">' + esc(short) + '</a>';
  }

  function applicationActions(a) {
    if (!isAdmin) return '';
    const btn = (status, label, cls) =>
      '<button class="btn-mini ' + (cls || '') + '" data-app-status="' + status +
      '" data-id="' + esc(a.id) + '">' + label + '</button>';
    const edit = '<button class="btn-mini btn-mini-quiet" data-edit-app="' + esc(a.id) + '">Edit</button>';

    if (a.status === 'new') return btn('approved', 'Approve') + ' ' + btn('rejected', 'Reject', 'btn-mini-quiet') + ' ' + edit;
    if (a.status === 'rejected') return btn('approved', 'Approve') + ' ' + edit;
    if (a.status === 'approved') return '<span class="muted-note">Waiting for sign in</span> ' + edit;
    return edit;
  }

  async function setApplicationStatus(id, status, button) {
    button.disabled = true;
    const { error } = await sb.from('applications').update({ status }).eq('id', id);
    if (error) {
      button.disabled = false;
      alert('Could not update that application: ' + error.message);
      return;
    }
    await loadApplications();
    if (status === 'approved') await loadMembers();
  }

  function openApplicationModal(id) {
    const a = applicationsCache.find(x => x.id === id);
    if (!a) return;
    const form = document.getElementById('application-form');
    form.reset();
    form.querySelector('.form-status').className = 'form-status';
    ['id', 'first_name', 'last_name', 'email', 'linkedin_url', 'title', 'company']
      .forEach(k => { form[k].value = a[k] || ''; });
    document.getElementById('application-modal').hidden = false;
  }

  function wireApplicationModal() {
    const form = document.getElementById('application-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const v = k => (fd.get(k) || '').toString().trim();
      if (!v('last_name') || !v('company')) return formSay(form, 'Last name and company are required.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return formSay(form, 'Please enter a valid email.');
      if (!validLinkedIn(v('linkedin_url'))) return formSay(form, 'Please enter a full LinkedIn URL, starting with https://');

      const { error } = await sb.from('applications').update({
        first_name: v('first_name') || null, last_name: v('last_name'), email: v('email'),
        linkedin_url: v('linkedin_url'), title: v('title') || null, company: v('company')
      }).eq('id', v('id'));
      if (error) return formSay(form, error.code === '23505'
        ? 'Another application already uses that email.' : 'Could not save: ' + error.message);
      formSay(form, 'Saved.', true);
      await loadApplications();
      setTimeout(() => { document.getElementById('application-modal').hidden = true; }, 700);
    });
  }

  /* ---------------- members ---------------- */

  async function loadMembers() {
    const { data, error } = await sb.from('profiles')
      .select('*').order('first_name', { ascending: true });

    const table = document.getElementById('members-table');
    if (error || !data) {
      table.innerHTML = '<tbody><tr><td>Could not load members.</td></tr></tbody>';
      return;
    }
    people = data;
    mentees = data.filter(p => p.is_mentee);
    mentors = data.filter(p => p.is_mentor);
    renderMembers();
  }

  function renderMembers() {
    const table = document.getElementById('members-table');
    const q = (document.getElementById('member-search').value || '').toLowerCase().trim();
    const rows = people.filter(p => !q ||
      [p.first_name, p.last_name, p.email, p.company, p.title].join(' ').toLowerCase().includes(q));

    if (!rows.length) {
      table.innerHTML = '<tbody><tr><td class="empty-row">' +
        (people.length ? 'No members match that search.' : 'No members yet.') + '</td></tr></tbody>';
      return;
    }

    table.innerHTML =
      '<thead><tr><th>Name</th><th>Email</th><th>LinkedIn</th><th>Job title</th><th>Company</th>' +
      '<th>Roles</th><th>Permission</th><th></th></tr></thead><tbody>' +
      rows.map(p => '<tr>' +
        td('Name', '<strong>' + esc(p.first_name + ' ' + p.last_name) + '</strong>') +
        td('Email', esc(p.email)) +
        td('LinkedIn', linkCell(p.linkedin_url)) +
        td('Job title', esc(p.title || '')) +
        td('Company', esc(p.company || '')) +
        td('Roles', (p.roles || []).map(r =>
          '<span class="chip">' + esc(ROLE_LABEL[r] || r) + '</span>').join(' ') || '<span class="muted">None</span>') +
        td('Permission', '<span class="pill pill-level-' + esc(p.access_level) + '">' +
          esc(LEVEL_LABEL[p.access_level] || p.access_level) + '</span>') +
        td('', '<button class="btn-mini" data-edit-member="' + esc(p.id) + '">Edit</button>', 'row-actions') +
      '</tr>').join('') + '</tbody>';

    table.querySelectorAll('[data-edit-member]').forEach(b =>
      b.addEventListener('click', () => openMemberModal(b.dataset.editMember)));
  }

  function openMemberModal(id) {
    const p = people.find(x => x.id === id);
    if (!p) return;
    const form = document.getElementById('member-form');
    form.reset();
    form.querySelector('.form-status').className = 'form-status';
    document.getElementById('member-email').textContent = p.email;
    ['id', 'first_name', 'last_name', 'linkedin_url', 'title', 'company']
      .forEach(k => { form[k].value = p[k] || ''; });

    if (isAdmin) {
      document.getElementById('member-roles').innerHTML = ROLES.map(([v, l]) =>
        '<label class="check"><input type="checkbox" name="roles" value="' + v + '"' +
        ((p.roles || []).includes(v) ? ' checked' : '') + '> <span>' + l + '</span></label>').join('');
      form.access_level.value = p.access_level || 'individual';
      form.access_level.disabled = p.id === me.id;
      form.access_level.title = p.id === me.id ? 'You cannot change your own permission' : '';
    }
    document.getElementById('member-modal').hidden = false;
  }

  function wireMemberModal() {
    document.getElementById('member-search').addEventListener('input', renderMembers);
    const form = document.getElementById('member-form');

    const delBtn = document.getElementById('member-delete');
    if (delBtn) delBtn.addEventListener('click', async () => {
      const id = form.id.value;
      const p = people.find(x => x.id === id);
      if (!p) return;
      if (p.id === me.id) return formSay(form, 'You cannot delete your own account here.');
      if (p.access_level === 'admin') return formSay(form, 'Change their permission from Admin first.');
      const typed = prompt('This permanently deletes ' + p.first_name + ' ' + p.last_name +
        ', their bookings and application. Type DELETE to confirm.');
      if ((typed || '').trim().toUpperCase() !== 'DELETE') return;
      delBtn.disabled = true;
      const { data, error } = await sb.functions.invoke('delete-account', { body: { confirm: 'DELETE', profile_id: id } });
      delBtn.disabled = false;
      if (error || !data || !data.ok) {
        let msg = 'Could not delete.';
        try { const j = error && error.context ? await error.context.json() : null; if (j && j.error) msg = j.error; } catch (x) {}
        return formSay(form, msg);
      }
      document.getElementById('member-modal').hidden = true;
      await loadMembers();
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const v = k => (fd.get(k) || '').toString().trim();
      if (!v('first_name') || !v('last_name')) return formSay(form, 'First and last name are required.');
      if (!validLinkedIn(v('linkedin_url'))) return formSay(form, 'Please enter a full LinkedIn URL, starting with https://');

      const patch = {
        first_name: v('first_name'), last_name: v('last_name'),
        linkedin_url: v('linkedin_url'), title: v('title') || null, company: v('company') || null
      };
      if (isAdmin) {
        patch.roles = fd.getAll('roles');
        if (!form.access_level.disabled) patch.access_level = form.access_level.value;
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const { error } = await sb.from('profiles').update(patch).eq('id', v('id'));
      btn.disabled = false;
      if (error) return formSay(form, 'Could not save: ' + error.message);

      formSay(form, 'Saved.', true);
      await loadMembers();
      setTimeout(() => { document.getElementById('member-modal').hidden = true; }, 700);
    });
  }

  /* ---------------- attendees ---------------- */

  let attEvents = [];
  let attRows = [];
  let attFilter = 'registered';

  const STATUS_LABEL = { booked: 'Booked', attended: 'Attended', no_show: 'No-show', cancelled: 'Cancelled' };
  const JOIN_LABEL = { attendee: 'Attendee', volunteer: 'Volunteer', speaker: 'Speaker' };

  async function loadAttendeeEvents() {
    const sel = document.getElementById('attendee-event');
    const keep = sel.value;
    const { data } = await sb.from('eventspf')
      .select('id,title,event_datetime,capacity,registration_url')
      .order('event_datetime', { ascending: false });
    attEvents = data || [];

    if (!attEvents.length) {
      sel.innerHTML = '<option value="">No events booked on this site yet</option>';
      document.getElementById('att-list').innerHTML =
        '<p class="muted-note">Once an event takes bookings on this site, its attendees appear here.</p>';
      return;
    }
    // Default: the next upcoming event, otherwise the most recent one
    const now = Date.now();
    const upcoming = attEvents.filter(e => new Date(e.event_datetime).getTime() >= now - 12 * 3600e3);
    const def = upcoming.length ? upcoming[upcoming.length - 1] : attEvents[0];

    sel.innerHTML = attEvents.map(e =>
      '<option value="' + esc(e.id) + '">' + esc(fmt(e.event_datetime) + ' · ' + e.title +
        (e.registration_url ? ' (external booking)' : '')) + '</option>').join('');
    sel.value = keep && attEvents.some(e => e.id === keep) ? keep : def.id;
    await loadAttendees();
  }

  async function loadAttendees() {
    const id = document.getElementById('attendee-event').value;
    if (!id) return;
    const { data, error } = await sb.from('event_bookings')
      .select('id,status,joining_as,booked_at,checked_in_at,profile_id,guest_id,imported,' +
              'profiles(first_name,last_name,email,linkedin_url,title,company),' +
              'guests(first_name,last_name,email,linkedin_url,title,company)')
      .eq('event_id', id);
    if (error) {
      document.getElementById('att-list').innerHTML = '<p class="muted-note">Could not load attendees.</p>';
      return;
    }
    // One "person" object whether the booking is a member's or a guest's
    (data || []).forEach(r => {
      const p = r.profiles || r.guests || {};
      r.person = {
        first_name: p.first_name || '', last_name: p.last_name || '',
        email: p.email || '', linkedin_url: p.linkedin_url || '',
        title: p.title || '', company: p.company || ''
      };
      if (!r.person.first_name && !r.person.last_name) r.person.first_name = r.person.email;
      r.isGuest = !!r.guest_id;
    });
    const name = r => (r.person.first_name + ' ' + r.person.last_name).trim();
    attRows = (data || []).sort((a, b) => name(a).localeCompare(name(b), 'en', { sensitivity: 'base' }));
    renderAttendees();
  }

  function renderAttendees() {
    const ev = attEvents.find(e => e.id === document.getElementById('attendee-event').value);
    const n = s => attRows.filter(r => r.status === s).length;
    const registered = n('booked') + n('attended') + n('no_show');

    document.getElementById('att-stats').innerHTML =
      stat('Registered', registered + (ev && ev.capacity != null ? ' / ' + ev.capacity : '')) +
      stat('Attended', n('attended')) +
      stat('Not yet here', n('booked')) +
      stat('No-show', n('no_show')) +
      stat('Cancelled', n('cancelled'));

    const q = (document.getElementById('att-search').value || '').toLowerCase().trim();
    const show = attRows.filter(r => {
      if (attFilter === 'registered' && r.status === 'cancelled') return false;
      if (attFilter !== 'registered' && r.status !== attFilter) return false;
      if (!q) return true;
      return [r.person.first_name, r.person.last_name, r.person.company, r.person.email].join(' ').toLowerCase().includes(q);
    });

    const list = document.getElementById('att-list');
    if (!show.length) {
      list.innerHTML = '<p class="muted-note">' + (attRows.length ? 'Nobody in this list.' : 'No bookings yet.') + '</p>';
      return;
    }

    list.innerHTML = show.map(r => {
      const p = r.person;
      const here = r.status === 'attended';
      const cancelled = r.status === 'cancelled';
      return '<div class="att-row' + (here ? ' is-here' : '') + (cancelled ? ' is-cancelled' : '') + '">' +
        '<label class="att-check">' +
          '<input type="checkbox" data-checkin="' + esc(r.id) + '"' + (here ? ' checked' : '') +
          (cancelled ? ' disabled' : '') + ' aria-label="Attended: ' + esc(p.first_name + ' ' + p.last_name) + '">' +
        '</label>' +
        '<div class="att-who">' +
          '<strong>' + esc(p.first_name + ' ' + p.last_name) + '</strong>' +
          '<span>' + esc([p.title, p.company].filter(Boolean).join(', ')) + '</span>' +
        '</div>' +
        '<div class="att-meta">' +
          (r.isGuest ? '<span class="chip chip-guest" title="Imported, no account yet">Guest</span>' : '') +
          (r.joining_as !== 'attendee' ? '<span class="chip">' + esc(JOIN_LABEL[r.joining_as]) + '</span>' : '') +
          '<span class="pill pill-bk-' + esc(r.status) + '">' + esc(STATUS_LABEL[r.status]) + '</span>' +
          (p.linkedin_url ? '<a href="' + esc(p.linkedin_url) + '" target="_blank" rel="noopener" class="att-li" aria-label="LinkedIn">in</a>' : '') +
          (cancelled ? '<button class="btn-mini btn-mini-quiet" data-rebook="' + esc(r.id) + '">Rebook</button>'
                     : '<button class="btn-mini btn-mini-quiet" data-att-cancel="' + esc(r.id) + '">Cancel</button>') +
        '</div>' +
      '</div>';
    }).join('');
  }

  const stat = (label, value) =>
    '<div class="att-stat"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';

  async function setBooking(id, status) {
    const { error } = await sb.from('event_bookings').update({ status }).eq('id', id);
    if (error) alert('Could not save: ' + error.message);
    await loadAttendees();
  }

  function wireAttendees() {
    document.getElementById('attendee-event').addEventListener('change', loadAttendees);
    document.getElementById('att-search').addEventListener('input', renderAttendees);
    document.querySelectorAll('[data-att-filter]').forEach(b => b.addEventListener('click', () => {
      attFilter = b.dataset.attFilter;
      document.querySelectorAll('[data-att-filter]').forEach(x => x.classList.toggle('active', x === b));
      renderAttendees();
    }));

    document.getElementById('att-list').addEventListener('change', e => {
      const cb = e.target.closest('[data-checkin]');
      if (!cb) return;
      cb.disabled = true;
      setBooking(cb.dataset.checkin, cb.checked ? 'attended' : 'booked');
    });
    document.getElementById('att-list').addEventListener('click', e => {
      const c = e.target.closest('[data-att-cancel]');
      if (c && confirm('Cancel this booking?')) { c.disabled = true; setBooking(c.dataset.attCancel, 'cancelled'); }
      const r = e.target.closest('[data-rebook]');
      if (r) { r.disabled = true; setBooking(r.dataset.rebook, 'booked'); }
    });

    document.getElementById('att-noshow').addEventListener('click', async () => {
      const ev = attEvents.find(e => e.id === document.getElementById('attendee-event').value);
      const left = attRows.filter(r => r.status === 'booked');
      if (!ev || !left.length) return alert('Nobody left to mark.');
      if (new Date(ev.event_datetime).getTime() > Date.now())
        return alert('This event has not started yet.');
      if (!confirm('Mark ' + left.length + ' people who have not checked in as no-show?')) return;
      const { error } = await sb.from('event_bookings').update({ status: 'no_show' })
        .in('id', left.map(r => r.id));
      if (error) alert('Could not save: ' + error.message);
      await loadAttendees();
    });

    const exportBtn = document.getElementById('att-export');
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);
    if (document.getElementById('att-import')) wireImport();

    /* Add an existing member to the event */
    const modal = document.getElementById('att-modal');
    const form = document.getElementById('att-form');
    document.getElementById('att-add').addEventListener('click', () => {
      const booked = new Set(attRows.filter(r => r.profile_id).map(r => r.profile_id));
      form.reset();
      form.querySelector('.form-status').className = 'form-status';
      form.profile_id.innerHTML = '<option value="">Choose a member</option>' +
        people.filter(p => !booked.has(p.id)).map(p =>
          '<option value="' + esc(p.id) + '">' + esc(p.first_name + ' ' + p.last_name +
          (p.company ? ' (' + p.company + ')' : '')) + '</option>').join('');
      modal.hidden = false;
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      if (!fd.get('profile_id')) return formSay(form, 'Choose a member.');
      const { error } = await sb.from('event_bookings').insert({
        event_id: document.getElementById('attendee-event').value,
        profile_id: fd.get('profile_id'),
        joining_as: fd.get('joining_as'),
        status: fd.get('checked_in') ? 'attended' : 'booked'
      });
      if (error) return formSay(form, error.code === '23505'
        ? 'That person is already on this event (check Cancelled).' : 'Could not add: ' + error.message);
      modal.hidden = true;
      await loadAttendees();
    });
  }


  /* ---------------- import CSV (Admin) ---------------- */

  /* Small CSV reader: handles quotes, commas and new lines inside quotes */
  function parseCsv(text) {
    const rows = []; let row = []; let cell = ''; let q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ''));
  }

  /* Match Eventbrite and common headings to our fields */
  const HEADER_MAP = {
    first_name: ['first name', 'firstname', 'first', 'given name', 'forename'],
    last_name: ['last name', 'lastname', 'surname', 'family name', 'last'],
    email: ['email', 'email address', 'e-mail', 'attendee email', 'buyer email'],
    linkedin_url: ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin profile url'],
    title: ['job title', 'title', 'role', 'position'],
    company: ['company', 'organisation', 'organization', 'employer', 'company name']
  };

  function mapRows(table) {
    if (table.length < 2) return { rows: [], missing: ['data'], found: [] };
    const head = table[0].map(h => h.trim().toLowerCase());
    const col = {};
    Object.entries(HEADER_MAP).forEach(([field, names]) => {
      const i = head.findIndex(h => names.includes(h));
      if (i >= 0) col[field] = i;
    });
    const missing = ['email'].filter(f => col[f] === undefined);
    const rows = table.slice(1).map(r => {
      const o = {};
      Object.entries(col).forEach(([f, i]) => { o[f] = (r[i] || '').trim(); });
      return o;
    });
    return { rows, missing, found: Object.keys(col) };
  }

  function wireImport() {
    const modal = document.getElementById('import-modal');
    const form = document.getElementById('import-form');
    const preview = document.getElementById('import-preview');
    const submit = form.querySelector('button[type="submit"]');
    let parsed = [];

    document.getElementById('att-import').addEventListener('click', () => {
      const ev = attEvents.find(e => e.id === document.getElementById('attendee-event').value);
      if (!ev) return alert('Choose an event first.');
      form.reset();
      parsed = [];
      preview.innerHTML = '';
      form.querySelector('.form-status').className = 'form-status';
      document.getElementById('import-event').textContent = fmt(ev.event_datetime) + ' · ' + ev.title;
      form.status.value = new Date(ev.event_datetime).getTime() < Date.now() ? 'attended' : 'booked';
      submit.disabled = true;
      modal.hidden = false;
    });

    form.file.addEventListener('change', async () => {
      const f = form.file.files[0];
      parsed = [];
      submit.disabled = true;
      form.querySelector('.form-status').className = 'form-status';
      if (!f) { preview.innerHTML = ''; return; }
      const m = mapRows(parseCsv(await f.text()));
      if (m.missing.length) {
        preview.innerHTML = '<p class="form-status show error">No <strong>Email</strong> column found. ' +
          'The first row must be the headings, for example First Name, Last Name, Email.</p>';
        return;
      }
      const ok = m.rows.filter(r => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email || ''));
      const seen = new Set();
      parsed = ok.filter(r => {
        const k = r.email.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      preview.innerHTML =
        '<p><strong>' + parsed.length + '</strong> people ready to import' +
        (m.rows.length - ok.length ? ', ' + (m.rows.length - ok.length) + ' rows without a valid email will be skipped' : '') +
        (ok.length - parsed.length ? ', ' + (ok.length - parsed.length) + ' duplicate emails removed' : '') + '.</p>' +
        '<p class="muted">Columns found: ' + esc(m.found.join(', ').replace(/_/g, ' ')) + '</p>' +
        '<div class="import-sample">' + parsed.slice(0, 5).map(r =>
          '<div>' + esc([r.first_name, r.last_name].filter(Boolean).join(' ') || '(no name)') +
          ' <span class="muted">' + esc(r.email) + '</span></div>').join('') +
        (parsed.length > 5 ? '<div class="muted">and ' + (parsed.length - 5) + ' more</div>' : '') + '</div>';
      submit.disabled = !parsed.length;
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!parsed.length) return;
      submit.disabled = true;
      submit.textContent = 'Importing…';
      const { data, error } = await sb.rpc('import_guests', {
        p_event: document.getElementById('attendee-event').value,
        p_rows: parsed,
        p_status: form.status.value
      });
      submit.textContent = 'Import';
      if (error) { submit.disabled = false; return formSay(form, 'Import failed: ' + error.message); }
      const d = data || {};
      formSay(form, 'Done. ' + (d.new_guests || 0) + ' new guests, ' + (d.known_guests || 0) +
        ' guests already known, ' + (d.members || 0) + ' existing members, ' +
        (d.already_on_event || 0) + ' already on this event' +
        (d.skipped ? ', ' + d.skipped + ' skipped' : '') + '. No emails were sent.', true);
      parsed = [];
      await loadAttendees();
    });
  }

  function exportCsv() {
    const ev = attEvents.find(e => e.id === document.getElementById('attendee-event').value);
    if (!ev) return;
    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['First name', 'Last name', 'Email', 'LinkedIn', 'Job title', 'Company',
                    'Type', 'Joining as', 'Status', 'Booked at', 'Checked in at'].map(cell).join(',')];
    attRows.forEach(r => {
      const p = r.person;
      lines.push([p.first_name, p.last_name, p.email, p.linkedin_url, p.title, p.company,
        r.isGuest ? 'Guest' : 'Member', JOIN_LABEL[r.joining_as], STATUS_LABEL[r.status], r.booked_at, r.checked_in_at].map(cell).join(','));
    });
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendees-' + (ev.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------------- activity (audit log) ---------------- */

  async function loadActivity() {
    if (!isAdmin) return;
    const table = document.getElementById('activity-table');
    const { data, error } = await sb.from('audit_log')
      .select('*').order('created_at', { ascending: false }).limit(200);
    if (error) {
      table.innerHTML = '<tbody><tr><td>Could not load activity.</td></tr></tbody>';
      return;
    }
    if (!data.length) {
      table.innerHTML = '<tbody><tr><td class="empty-row">No changes recorded yet.</td></tr></tbody>';
      return;
    }

    // Names for booking rows
    const bookingIds = data.filter(r => r.table_name === 'event_bookings').map(r => r.record_id);
    const bookings = {};
    if (bookingIds.length) {
      const { data: b } = await sb.from('event_bookings')
        .select('id, profiles(first_name,last_name), eventspf(title)').in('id', bookingIds);
      (b || []).forEach(x => { bookings[x.id] = x; });
    }
    const person = id => {
      const p = people.find(x => x.id === id);
      return p ? p.first_name + ' ' + p.last_name : 'Removed person';
    };
    const what = r => {
      if (r.table_name === 'profiles') return 'Profile: ' + person(r.record_id);
      const b = bookings[r.record_id];
      return 'Booking: ' + (b && b.profiles ? b.profiles.first_name + ' ' + b.profiles.last_name : 'removed') +
        (b && b.eventspf ? ' · ' + b.eventspf.title : '');
    };
    const changes = r => {
      if (r.action !== 'update') return r.action === 'insert' ? 'Created' : 'Deleted';
      return Object.entries(r.changes || {}).filter(([k]) => !/_at$/.test(k)).map(([k, v]) =>
        esc(k.replace(/_/g, ' ')) + ': ' + esc(show(v.from)) + ' → ' + esc(show(v.to))).join('<br>') || 'Updated';
    };
    const show = v => Array.isArray(v) ? v.join(', ') || 'none' : (v == null || v === '' ? 'empty' : v);

    table.innerHTML =
      '<thead><tr><th>When</th><th>Who</th><th>What</th><th>Change</th></tr></thead><tbody>' +
      data.map(r => '<tr>' +
        td('When', esc(new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London',
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))) +
        td('Who', esc(person(r.actor_id))) +
        td('What', esc(what(r))) +
        td('Change', changes(r), 'wrap-cell') +
      '</tr>').join('') + '</tbody>';
  }

  /* ---------------- pairings ---------------- */

  async function loadPairings() {
    const { data, error } = await sb.from('mentorships')
      .select('*, mentor:profiles!mentorships_mentor_id_fkey(first_name,last_name), ' +
              'mentee:profiles!mentorships_mentee_id_fkey(first_name,last_name), ' +
              'expertise_areas(label)')
      .order('created_at', { ascending: false });

    const table = document.getElementById('pairings-table');
    if (error) {
      table.innerHTML = '<tbody><tr><td>Could not load pairings.</td></tr></tbody>';
      return;
    }
    if (!data.length) {
      table.innerHTML = '<tbody><tr><td class="empty-row">No pairings yet.</td></tr></tbody>';
      return;
    }

    const name = p => p ? p.first_name + ' ' + p.last_name : '';

    table.innerHTML =
      '<thead><tr><th>Mentee</th><th>Mentor</th><th>Area</th><th>#</th>' +
      '<th>Status</th><th>Started</th><th></th></tr></thead><tbody>' +
      data.map(m => '<tr>' +
        '<td>' + esc(name(m.mentee)) + '</td>' +
        '<td>' + esc(name(m.mentor)) + '</td>' +
        '<td>' + esc(m.expertise_areas ? m.expertise_areas.label : '') + '</td>' +
        '<td>' + esc(m.sequence_number) + '</td>' +
        '<td><span class="pill pill-' + esc(m.status) + '">' + esc(m.status) + '</span></td>' +
        '<td>' + fmt(m.started_at) + '</td>' +
        '<td>' + statusActions(m) + '</td>' +
      '</tr>').join('') + '</tbody>';

    table.querySelectorAll('[data-setstatus]').forEach(b => {
      b.addEventListener('click', () => setStatus(b.dataset.id, b.dataset.setstatus));
    });
  }

  function statusActions(m) {
    if (m.status === 'proposed')
      return '<button class="btn-mini" data-setstatus="active" data-id="' +
             esc(m.id) + '">Start</button>';
    if (m.status === 'active')
      return '<button class="btn-mini" data-setstatus="completed" data-id="' +
             esc(m.id) + '">Complete</button>';
    return '';
  }

  async function setStatus(id, status) {
    const patch = { status: status };
    if (status === 'active') patch.started_at = new Date().toISOString().slice(0, 10);
    if (status === 'completed') patch.ended_at = new Date().toISOString().slice(0, 10);

    const { error } = await sb.from('mentorships').update(patch).eq('id', id);

    if (error) {
      // The database blocks completion until the mentee has left feedback.
      alert(/feedback/i.test(error.message)
        ? 'This mentorship cannot be completed yet. The mentee needs to give ' +
          'feedback first.'
        : 'Could not update that pairing: ' + error.message);
      return;
    }
    loadPairings();
  }

  /* ---------------- new pairing ---------------- */

  function wirePairingModal() {
    const modal = document.getElementById('pairing-modal');
    const form = document.getElementById('pairing-form');
    const status = form.querySelector('.form-status');

    document.getElementById('new-pairing-btn').addEventListener('click', async () => {
      await fillPairingSelects(form);
      status.className = 'form-status';
      modal.hidden = false;
    });

    document.addEventListener('click', e => {
      if (e.target.closest('[data-close-modal]')) modal.hidden = true;
      if (e.target === modal) modal.hidden = true;
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);

      if (!fd.get('mentee_id') || !fd.get('mentor_id')) {
        status.textContent = 'Pick both a mentee and a mentor.';
        status.className = 'form-status show error';
        return;
      }
      if (fd.get('mentee_id') === fd.get('mentor_id')) {
        status.textContent = 'Mentee and mentor must be different people.';
        status.className = 'form-status show error';
        return;
      }

      // Next number in this mentee's sequence.
      const { count } = await sb.from('mentorships')
        .select('id', { count: 'exact', head: true })
        .eq('mentee_id', fd.get('mentee_id'));

      const { error } = await sb.from('mentorships').insert({
        mentee_id: fd.get('mentee_id'),
        mentor_id: fd.get('mentor_id'),
        expertise_area_id: fd.get('expertise_area_id') || null,
        focus_area: (fd.get('focus_area') || '').toString().trim() || null,
        admin_notes: (fd.get('admin_notes') || '').toString().trim() || null,
        sequence_number: (count || 0) + 1,
        assigned_by: me.id,
        status: 'proposed'
      });

      if (error) {
        status.textContent = error.code === '23505'
          ? 'That mentee already has a live mentorship. Complete it first.'
          : 'Could not create that pairing: ' + error.message;
        status.className = 'form-status show error';
        return;
      }

      status.textContent = 'Pairing created.';
      status.className = 'form-status show ok';
      loadPairings();
      setTimeout(() => { modal.hidden = true; form.reset(); }, 1200);
    });
  }

  async function fillPairingSelects(form) {
    const fill = (sel, rows, label, placeholder) => {
      sel.innerHTML = '<option value="">' + placeholder + '</option>';
      rows.forEach(r => {
        const o = document.createElement('option');
        o.value = r.id;
        o.textContent = label(r);
        sel.appendChild(o);
      });
    };

    fill(form.mentee_id, mentees,
      p => p.first_name + ' ' + p.last_name + (p.company ? ' (' + p.company + ')' : ''),
      'Select a mentee');

    fill(form.mentor_id, mentors.filter(p => p.accepting_mentees),
      p => p.first_name + ' ' + p.last_name + ' - up to ' + p.mentor_capacity,
      'Select a mentor');

    const { data } = await sb.from('expertise_areas')
      .select('id,label').eq('active', true).order('sort_order');
    fill(form.expertise_area_id, data || [], a => a.label, 'Not specified');
  }

  /* ---------------- events ---------------- */

  const EV_STATUS = { registration_open: 'Registration open', planning: 'Coming soon', completed: 'Completed' };
  const EV_WHERE = { in_person: 'In person', virtual: 'Virtual' };
  let eventsCache = [];

  const ukDate = iso => new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  /* ISO -> value for <input type="datetime-local"> in the admin's local time */
  function toLocalInput(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function slugify(title, iso) {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return base + '-' + iso.slice(0, 10);
  }

  async function loadEvents() {
    const table = document.getElementById('events-table');
    const { data, error } = await sb.from('eventspf')
      .select('*').order('event_datetime', { ascending: false });

    if (error) {
      table.innerHTML = '<tbody><tr><td>Could not load events.</td></tr></tbody>';
      return;
    }
    eventsCache = data;
    const { data: c } = await sb.rpc('event_booking_counts');
    const counts = {};
    (c || []).forEach(r => { counts[r.event_id] = r; });
    if (!data.length) {
      table.innerHTML = '<tbody><tr><td class="empty-row">No events yet.</td></tr></tbody>';
      return;
    }

    table.innerHTML =
      '<thead><tr><th>Date (UK)</th><th>Title</th><th>Where</th>' +
      '<th>Status</th><th>Booked</th><th></th></tr></thead><tbody>' +
      data.map(e => {
        const k = counts[e.id] || {};
        const booked = e.registration_url ? 'External link'
          : (k.booked || 0) + (e.capacity != null ? ' / ' + e.capacity : '');
        return '<tr>' +
          td('Date', esc(ukDate(e.event_datetime))) +
          td('Title', esc(e.title)) +
          td('Where', esc(EV_WHERE[e.where_type] || e.where_type)) +
          td('Status', '<span class="pill">' + esc(EV_STATUS[e.status] || e.status) + '</span>') +
          td('Booked', esc(booked)) +
          td('', '<button class="btn-mini" data-edit-event="' + esc(e.id) + '">Edit</button>') +
        '</tr>';
      }).join('') + '</tbody>';

    table.querySelectorAll('[data-edit-event]').forEach(b =>
      b.addEventListener('click', () => openEventModal(b.dataset.editEvent)));
  }

  function openEventModal(id) {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    form.reset();
    form.querySelector('.form-status').className = 'form-status';
    document.getElementById('event-modal-title').textContent = id ? 'Edit event' : 'Add event';

    const e = id ? eventsCache.find(x => x.id === id) : null;
    form.id.value = e ? e.id : '';
    if (e) {
      ['title', 'community', 'status', 'where_type', 'location', 'summary',
       'image_url', 'registration_url', 'recording_url'].forEach(k => {
        form[k].value = e[k] || (k === 'status' ? 'planning' : k === 'where_type' ? 'in_person' : '');
      });
      form.event_datetime.value = toLocalInput(e.event_datetime);
      form.event_end.value = e.event_end ? toLocalInput(e.event_end) : '';
      form.capacity.value = e.capacity == null ? '' : e.capacity;
    }
    modal.hidden = false;
  }

  function wireEventModal() {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    const status = form.querySelector('.form-status');

    document.getElementById('new-event-btn')
      .addEventListener('click', () => openEventModal(null));

    // Suggest an end time 2 hours after the start, if none is set yet
    form.event_datetime.addEventListener('change', () => {
      if (form.event_end.value || !form.event_datetime.value) return;
      const d = new Date(form.event_datetime.value);
      d.setHours(d.getHours() + 2);
      form.event_end.value = toLocalInput(d.toISOString());
    });

    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('[data-close-modal]')) modal.hidden = true;
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const v = k => (fd.get(k) || '').toString().trim();

      if (!v('title') || !v('event_datetime')) {
        status.textContent = 'Title and date are required.';
        status.className = 'form-status show error';
        return;
      }

      const iso = new Date(v('event_datetime')).toISOString();
      const endIso = v('event_end') ? new Date(v('event_end')).toISOString() : null;
      if (endIso && endIso <= iso) {
        status.textContent = 'The end time must be after the start time.';
        status.className = 'form-status show error';
        return;
      }
      const row = {
        title: v('title'),
        community: v('community') || null,
        event_datetime: iso,
        event_end: endIso,
        status: v('status'),
        where_type: v('where_type'),
        location: v('location') || null,
        summary: v('summary') || null,
        image_url: v('image_url') || null,
        registration_url: v('registration_url') || null,
        recording_url: v('recording_url') || null,
        capacity: v('capacity') === '' ? null : Math.max(0, parseInt(v('capacity'), 10) || 0)
      };

      const id = v('id');
      const q = id
        ? sb.from('eventspf').update(row).eq('id', id)
        : sb.from('eventspf').insert({ ...row, slug: slugify(row.title, iso) });

      const { error } = await q;
      if (error) {
        status.textContent = 'Could not save: ' + error.message;
        status.className = 'form-status show error';
        return;
      }

      status.textContent = 'Saved.';
      status.className = 'form-status show ok';
      await loadEvents();
      await loadAttendeeEvents();
      setTimeout(() => { modal.hidden = true; }, 800);
    });
  }

  /* ---------------- feedback ---------------- */

  async function loadFeedback() {
    const { data, error } = await sb.from('mentorship_feedback')
      .select('*, profiles!mentorship_feedback_given_by_fkey(first_name,last_name)')
      .order('created_at', { ascending: false });

    const table = document.getElementById('feedback-table');
    if (error) {
      table.innerHTML = '<tbody><tr><td>Could not load feedback.</td></tr></tbody>';
      return;
    }
    if (!data.length) {
      table.innerHTML = '<tbody><tr><td class="empty-row">No feedback yet.</td></tr></tbody>';
      return;
    }

    table.innerHTML =
      '<thead><tr><th>From</th><th>As</th><th>Rating</th><th>Comments</th>' +
      '<th>Recommend</th><th>Date</th></tr></thead><tbody>' +
      data.map(f => '<tr>' +
        '<td>' + esc(f.profiles
          ? f.profiles.first_name + ' ' + f.profiles.last_name : '') + '</td>' +
        '<td><span class="chip">' + esc(f.role) + '</span></td>' +
        '<td>' + esc(f.rating) + ' / 5</td>' +
        '<td class="wrap-cell">' + esc(f.comments || '') + '</td>' +
        '<td>' + (f.would_recommend ? 'Yes' : 'No') + '</td>' +
        '<td>' + fmt(f.created_at) + '</td>' +
      '</tr>').join('') + '</tbody>';
  }
})();
