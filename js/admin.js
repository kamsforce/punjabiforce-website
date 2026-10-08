/* ==========================================================================
   Punjabiforce - admin
   Visible only to profiles with is_admin = true. The redirect below is a
   convenience; RLS is what actually stops a non-admin reading these tables.
   ========================================================================== */

(function () {
  'use strict';

  if (!document.getElementById('panel-applications')) return;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmt = d => d ? new Date(d).toLocaleDateString('en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  let me = null;
  let mentees = [];
  let mentors = [];
  let statusLabels = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    me = await PF_AUTH.requireAuth({ admin: true });
    if (!me) return;

    wireTabs();
    wirePairingModal();
    wireEventModal();

    await loadStatusFilter();
    await Promise.all([
      loadApplications(),
      loadMembers(),
      loadPairings(),
      loadFeedback(),
      loadEvents()
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
      });
    });
  }

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
      table.innerHTML = '<tbody><tr><td>Could not load applications.</td></tr></tbody>';
      return;
    }
    if (!data.length) {
      table.innerHTML = '<tbody><tr><td class="empty-row">No applications here.</td></tr></tbody>';
      return;
    }

    table.innerHTML =
      '<thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Applied as</th>' +
      '<th>Status</th><th>Received</th><th></th></tr></thead><tbody>' +
      data.map(a => '<tr>' +
        '<td><a href="' + esc(a.linkedin_url) + '" target="_blank" rel="noopener">' +
          esc([a.first_name, a.last_name].filter(Boolean).join(' ')) + '</a></td>' +
        '<td>' + esc(a.email) + '</td>' +
        '<td>' + esc(a.company) + '</td>' +
        '<td>' + (a.types || []).map(t =>
          '<span class="chip">' + esc(t) + '</span>').join(' ') + '</td>' +
        '<td><span class="pill pill-' + esc(a.status) + '">' +
          esc(statusLabels[a.status] || a.status) + '</span></td>' +
        '<td>' + fmt(a.created_at) + '</td>' +
        '<td class="row-actions">' + applicationActions(a) + '</td>' +
      '</tr>').join('') + '</tbody>';

    table.querySelectorAll('[data-app-status]').forEach(b => {
      b.addEventListener('click', () =>
        setApplicationStatus(b.dataset.id, b.dataset.appStatus, b));
    });
  }

  function applicationActions(a) {
    const btn = (status, label, cls) =>
      '<button class="btn-mini ' + (cls || '') + '" data-app-status="' + status +
      '" data-id="' + esc(a.id) + '">' + label + '</button>';

    if (a.status === 'new') return btn('approved', 'Approve') + ' ' + btn('rejected', 'Reject', 'btn-mini-quiet');
    if (a.status === 'rejected') return btn('approved', 'Approve');
    if (a.status === 'approved') return '<span class="muted-note">Waiting for sign in</span>';
    return '';
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
    // Approving someone who has already signed in creates their profile at once.
    if (status === 'approved') await loadMembers();
  }

  /* ---------------- members ---------------- */

  async function loadMembers() {
    const { data, error } = await sb.from('profiles')
      .select('*').order('created_at', { ascending: false });

    const table = document.getElementById('members-table');
    if (error || !data) {
      table.innerHTML = '<tbody><tr><td>Could not load members.</td></tr></tbody>';
      return;
    }

    mentees = data.filter(p => p.is_mentee);
    mentors = data.filter(p => p.is_mentor);

    if (!data.length) {
      table.innerHTML =
        '<tbody><tr><td class="empty-row">No members yet. Approve an application, ' +
        'then the person signs in once.</td></tr></tbody>';
      return;
    }

    const toggle = (p, field, label) => {
      const self = p.id === me.id && field === 'is_admin';
      return '<label class="toggle" title="' + (self
          ? 'You cannot remove your own admin access' : label) + '">' +
        '<input type="checkbox" data-member="' + esc(p.id) + '" data-field="' + field + '"' +
        (p[field] ? ' checked' : '') + (self ? ' disabled' : '') + '>' +
        '<span>' + label + '</span></label>';
    };

    table.innerHTML =
      '<thead><tr><th>Name</th><th>Email</th><th>Company</th>' +
      '<th>Roles</th><th>Status</th></tr></thead><tbody>' +
      data.map(p => '<tr>' +
        '<td><a href="' + esc(p.linkedin_url) + '" target="_blank" rel="noopener">' +
          esc(p.first_name + ' ' + p.last_name) + '</a></td>' +
        '<td>' + esc(p.email) + '</td>' +
        '<td>' + esc(p.company || '') + '</td>' +
        '<td class="toggle-cell">' +
          toggle(p, 'is_mentor', 'Mentor') +
          toggle(p, 'is_mentee', 'Mentee') +
          toggle(p, 'is_admin', 'Admin') +
        '</td>' +
        '<td><span class="pill">' + esc(p.status) + '</span></td>' +
      '</tr>').join('') + '</tbody>';

    table.querySelectorAll('[data-member]').forEach(cb => {
      cb.addEventListener('change', () => saveRole(cb));
    });
  }

  /* Saves the moment a box is ticked. Reverts the box if the database refuses. */
  async function saveRole(cb) {
    const value = cb.checked;
    cb.disabled = true;

    const { error } = await sb.from('profiles')
      .update({ [cb.dataset.field]: value })
      .eq('id', cb.dataset.member);

    cb.disabled = false;

    if (error) {
      cb.checked = !value;
      alert('Could not save that change: ' + error.message);
      return;
    }

    // Keep the pairing dropdowns in step with the new roles.
    const { data } = await sb.from('profiles').select('*');
    if (data) {
      mentees = data.filter(p => p.is_mentee);
      mentors = data.filter(p => p.is_mentor);
    }
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
    if (!data.length) {
      table.innerHTML = '<tbody><tr><td class="empty-row">No events yet.</td></tr></tbody>';
      return;
    }

    table.innerHTML =
      '<thead><tr><th>Date (UK)</th><th>Title</th><th>Community</th><th>Where</th>' +
      '<th>Status</th><th></th></tr></thead><tbody>' +
      data.map(e => '<tr>' +
        '<td>' + esc(ukDate(e.event_datetime)) + '</td>' +
        '<td>' + esc(e.title) + '</td>' +
        '<td>' + esc(e.community || '') + '</td>' +
        '<td>' + esc(EV_WHERE[e.where_type] || e.where_type) + '</td>' +
        '<td><span class="pill">' + esc(EV_STATUS[e.status] || e.status) + '</span></td>' +
        '<td><button class="btn-mini" data-edit-event="' + esc(e.id) + '">Edit</button></td>' +
      '</tr>').join('') + '</tbody>';

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
    }
    modal.hidden = false;
  }

  function wireEventModal() {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    const status = form.querySelector('.form-status');

    document.getElementById('new-event-btn')
      .addEventListener('click', () => openEventModal(null));

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
      const row = {
        title: v('title'),
        community: v('community') || null,
        event_datetime: iso,
        status: v('status'),
        where_type: v('where_type'),
        location: v('location') || null,
        summary: v('summary') || null,
        image_url: v('image_url') || null,
        registration_url: v('registration_url') || null,
        recording_url: v('recording_url') || null
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
