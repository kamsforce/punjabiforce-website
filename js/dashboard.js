/* ==========================================================================
   Punjabiforce - member dashboard
   Shows the signed-in member their own pairings only. RLS enforces this;
   the queries below simply ask for what the member is allowed to see.
   ========================================================================== */

(function () {
  'use strict';

  if (!document.getElementById('dash-loading')) return;

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let me = null;

  const PERSON_FIELDS =
    'id, first_name, last_name, title, company, city, country, bio, linkedin_url, avatar_url';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    me = await PF_AUTH.requireAuth();
    if (!me) return;

    document.getElementById('greeting').textContent =
      'Welcome back, ' + me.first_name + '.';

    const roles = [];
    if (me.is_mentee) roles.push('mentee');
    if (me.is_mentor) roles.push('mentor');
    document.getElementById('role-line').textContent = roles.length
      ? 'You are registered as a ' + roles.join(' and ') + '.'
      : 'Your membership is being set up.';

    await Promise.all([loadAsMentee(), loadAsMentor(), loadHistory()]);

    document.getElementById('dash-loading').hidden = true;
    wireFeedbackModal();
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
