/* ==========================================================================
   Punjabiforce - events page
   Reads `eventspf` (public read via RLS). Upcoming soonest first, past newest first.
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

  function thumb(e) {
    if (!e.image_url) return '';
    return '<button class="event-thumb" type="button" data-full="' + esc(e.image_url) +
      '" aria-label="Enlarge image for ' + esc(e.title) + '">' +
      '<img src="' + esc(e.image_url) + '" alt="" loading="lazy"></button>';
  }

  function details(e) {
    const register = e.status === 'registration_open' && e.registration_url
      ? '<a class="btn btn-primary" href="' + esc(e.registration_url) +
        '" target="_blank" rel="noopener">Register &rarr;</a>' : '';
    const recording = e.recording_url
      ? '<a class="btn btn-quiet" href="' + esc(e.recording_url) +
        '" target="_blank" rel="noopener">Watch recording</a>' : '';
    return '<h3>' + esc(e.title) + '</h3>' +
      (e.community ? '<p class="event-meta">' + esc(e.community) + '</p>' : '') +
      (e.summary ? '<p>' + esc(e.summary) + '</p>' : '') +
      '<span class="tag">' + esc(WHERE[e.where_type] || e.where_type) + '</span> ' +
      (e.location ? '<span class="tag">' + esc(e.location) + '</span> ' : '') +
      '<span class="tag">' + esc(STATUS[e.status] || e.status) + '</span>' +
      ((register || recording)
        ? '<div class="btn-row event-actions">' + register + recording + '</div>' : '');
  }

  /* Upcoming: full-width list row */
  function row(e) {
    return '<article class="event-item">' +
      '<div class="when">' + esc(when(e.event_datetime)) + '</div>' +
      '<div class="event-body">' + thumb(e) + '<div>' + details(e) + '</div></div>' +
    '</article>';
  }

  /* Past: card in a 2-column grid */
  function tile(e) {
    return '<article class="event-card">' + thumb(e) +
      '<div class="event-card-body">' +
        '<div class="when">' + esc(when(e.event_datetime)) + '</div>' +
        details(e) +
      '</div></article>';
  }

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

  async function load() {
    if (typeof sb === 'undefined' || !sb) {
      upEl.innerHTML = '<p class="muted-note">Events could not be loaded right now.</p>';
      return;
    }

    const { data, error } = await sb.from('eventspf')
      .select('*').order('event_datetime', { ascending: true });

    if (error) {
      console.error('Events error:', error);
      upEl.innerHTML = '<p class="muted-note">Events could not be loaded right now.</p>';
      return;
    }

    const now = Date.now();
    const upcoming = data.filter(e =>
      e.status !== 'completed' && new Date(e.event_datetime).getTime() >= now);
    const past = data.filter(e => !upcoming.includes(e)).reverse();

    upEl.innerHTML = upcoming.length ? upcoming.map(row).join('')
      : '<p class="muted-note">Nothing scheduled right now. Follow us on ' +
        '<a href="https://www.linkedin.com/company/punjabiforcenet">LinkedIn</a> ' +
        'to hear about the next one.</p>';
    pastEl.innerHTML = past.length ? past.map(tile).join('')
      : '<p class="muted-note">No past events yet.</p>';
  }

  document.addEventListener('DOMContentLoaded', () => { wireLightbox(); load(); });
})();
