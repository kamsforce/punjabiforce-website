/* ==========================================================================
   Punjabiforce - gallery
   Shows our Medium articles as cards. Rows live in `gallery_posts`; the
   `medium-sync` Edge Function tops the table up from the Medium feed so older
   articles stay here after Medium's feed (latest 10 only) drops them.
   ========================================================================== */

(function () {
  'use strict';

  const grid = document.getElementById('gal-grid');
  if (!grid) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const day = iso => new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric'
  });

  /* Only ever link to Medium, whatever is in the table. */
  const safe = (url, host) => {
    try { const u = new URL(url); return u.protocol === 'https:' && host.test(u.hostname) ? u.href : ''; }
    catch (e) { return ''; }
  };

  function card(p) {
    const link = safe(p.link, /(^|\.)medium\.com$/);
    const img = safe(p.image_url, /(^|\.)medium\.com$/);
    if (!link) return '';
    const full = img.replace(/\/max\/\d+\//, '/max/2400/');
    return '<article class="gal-card">' +
      (img ? '<button class="gal-thumb" type="button" data-full="' + esc(full) +
        '" aria-label="Enlarge image for ' + esc(p.title) + '">' +
        '<img src="' + esc(img) + '" alt="" loading="lazy"></button>' : '') +
      '<div class="gal-body">' +
        '<p class="gal-date">' + esc(day(p.published_at)) + '</p>' +
        '<h3>' + esc(p.title) + '</h3>' +
        '<a class="gal-link" href="' + esc(link) +
          '" target="_blank" rel="noopener">Read on Medium &rarr;</a>' +
      '</div></article>';
  }

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

  async function render() {
    const { data, error } = await sb.from('gallery_posts')
      .select('title,link,image_url,published_at')
      .order('published_at', { ascending: false });
    if (error) {
      console.error('Gallery error:', error);
      grid.innerHTML = '<p class="muted-note">Stories could not be loaded right now.</p>';
      return;
    }
    grid.innerHTML = data.length ? data.map(card).join('')
      : '<p class="muted-note">Our first photo story is on its way.</p>';
  }

  async function load() {
    if (typeof sb === 'undefined' || !sb) {
      grid.innerHTML = '<p class="muted-note">Stories could not be loaded right now.</p>';
      return;
    }
    await render();
    /* Ask the server to check Medium for anything new, then refresh if it found some. */
    try {
      const { data } = await sb.functions.invoke('medium-sync');
      if (data && data.changed) await render();
    } catch (e) { /* the saved stories are already on screen */ }
  }

  document.addEventListener('DOMContentLoaded', () => { wireLightbox(); load(); });
})();
