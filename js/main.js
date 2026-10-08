/* ==========================================================================
   Punjabiforce — main script
   Renders content from data.js, handles nav, mobile menu, reveals, form.
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------
     Small helpers
     -------------------------------------------------------------------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /** Escape text before injecting into HTML. */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Render into a target if it exists on this page. */
  function render(selector, html) {
    const el = $(selector);
    if (el) el.innerHTML = html;
  }

  /* --------------------------------------------------------------------
     Mobile nav toggle
     -------------------------------------------------------------------- */
  function initNav() {
    const toggle = $('.nav-toggle');
    const links = $('.nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    // Close the menu when a link is tapped
    $$('a', links).forEach(a => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /** Community dropdown: click to open, closes on outside click or Esc. */
  function initNavDrop() {
    $$('.nav-drop').forEach(drop => {
      const btn = $('.nav-drop-btn', drop);
      if (!btn) return;
      const set = open => {
        drop.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', String(open));
      };
      btn.addEventListener('click', e => {
        e.stopPropagation();
        set(!drop.classList.contains('open'));
      });
      document.addEventListener('click', e => { if (!drop.contains(e.target)) set(false); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
      // Highlight the parent when one of its pages is the current page
      if ($('a.active', drop)) btn.classList.add('active');
    });
  }

  /** Mark the current page in the nav. */
  function markActiveNav() {
    let path = window.location.pathname.split('/').pop();
    if (!path) path = 'index.html';
    $$('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path) a.classList.add('active');
    });
  }

  /* --------------------------------------------------------------------
     Renderers — each only fires if its container is on the page
     -------------------------------------------------------------------- */

  function renderPillars() {
    const html = PF_DATA.pillars.map((p, i) => `
      <article class="pillar">
        <div class="num">${String(i + 1).padStart(2, '0')}</div>
        <div>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.text)}</p>
        </div>
      </article>`).join('');
    render('[data-render="pillars"]', html);
  }

  /** LinkedIn glyph — returns '' when no URL is set, so nothing renders. */
  function linkedinIcon(url, name) {
    if (!url) return '';
    return `<a class="li-badge" href="${esc(url)}" target="_blank" rel="noopener"
      aria-label="${esc(name)} on LinkedIn" title="${esc(name)} on LinkedIn">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0zM.4 8.4h4.2V24H.4V8.4zm7.6 0h4v2.1h.06c.56-1.06 1.93-2.18 3.97-2.18 4.25 0 5.03 2.8 5.03 6.43V24h-4.2v-7.4c0-1.77-.03-4.04-2.46-4.04-2.46 0-2.84 1.92-2.84 3.91V24H8V8.4z"/>
      </svg>
    </a>`;
  }

  function renderFounders() {
    const html = PF_DATA.founders.map(f => `
      <article class="founder-card">
        <div class="avatar-wrap">
          <img src="${esc(f.photo)}" alt="${esc(f.name)}" loading="lazy" width="84" height="84">
          ${linkedinIcon(f.linkedin, f.name)}
        </div>
        <div>
          <h3>${esc(f.name)}</h3>
          <p class="role">${esc(f.role)}</p>
          <p>${esc(f.bio)}</p>
        </div>
      </article>`).join('');
    render('[data-render="founders"]', html);
  }

  function renderTeam() {
    const html = PF_DATA.team.map(m => `
      <article class="team-card">
        <div class="avatar-wrap">
          <img src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy" width="76" height="76">
          ${linkedinIcon(m.linkedin, m.name)}
        </div>
        <h3>${esc(m.name)}</h3>
        <p class="title">${esc(m.title)}</p>
        <p class="meta">${esc(m.meta)}</p>
      </article>`).join('');
    render('[data-render="team"]', html);
  }

  function renderEvents() {
    const html = PF_DATA.events.map(e => `
      <article class="event-item">
        <div class="when">${esc(e.when)}</div>
        <div>
          <h3>${esc(e.title)}</h3>
          <p>${esc(e.text)}</p>
          ${e.tag ? `<span class="tag">${esc(e.tag)}</span>` : ''}
        </div>
      </article>`).join('');
    render('[data-render="events"]', html);
  }

  function renderRoles() {
    const html = PF_DATA.roles.map(r => `
      <article class="role-card">
        <p class="focus">${esc(r.focus)}</p>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.text)}</p>
        <ul>${r.points.map(pt => `<li>${esc(pt)}</li>`).join('')}</ul>
      </article>`).join('');
    render('[data-render="roles"]', html);
  }

  function renderStats() {
    const html = PF_DATA.stats.map(s => `
      <div class="stat">
        <div class="num">${esc(s.num)}</div>
        <div class="label">${esc(s.label)}</div>
      </div>`).join('');
    render('[data-render="stats"]', html);
  }

  function renderSponsors() {
    const html = PF_DATA.sponsors
      .map(s => `<div class="sponsor-name">${esc(s)}</div>`).join('');
    render('[data-render="sponsors"]', html);
  }

  /** Populate the volunteer form's focus-area dropdown from the same data. */
  function renderRoleOptions() {
    const select = $('[data-render="role-options"]');
    if (!select) return;
    PF_DATA.roles.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.focus;
      opt.textContent = r.focus;
      select.appendChild(opt);
    });
  }

  /* --------------------------------------------------------------------
     Reveal on scroll
     -------------------------------------------------------------------- */
  function initReveal() {
    const items = $$('.reveal');
    if (!items.length) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('visible'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    items.forEach(el => io.observe(el));
  }

  /* --------------------------------------------------------------------
     Forms — client-side validation only (no backend wired up yet)
     -------------------------------------------------------------------- */
  function initForms() {
    $$('form[data-form]').forEach(form => {
      const status = $('.form-status', form);

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        const name = $('[name="name"]', form);
        const email = $('[name="email"]', form);
        const message = $('[name="message"]', form);

        function fail(msg) {
          if (!status) return;
          status.textContent = msg;
          status.className = 'form-status error show';
        }

        if (name && !name.value.trim()) return fail('Please add your name.');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
          return fail('Please add a valid email address.');
        }
        if (message && !message.value.trim()) return fail('Please add a short message.');

        if (status) {
          status.textContent =
            'Thanks — this form isn\u2019t connected to an inbox yet, so nothing was sent. ' +
            'Reach us on LinkedIn in the meantime.';
          status.className = 'form-status ok show';
        }
        form.reset();
      });
    });
  }

  /* --------------------------------------------------------------------
     Year in footer
     -------------------------------------------------------------------- */
  function setYear() {
    $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
  }

  /* --------------------------------------------------------------------
     Boot
     -------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    markActiveNav();
    initNavDrop();

    renderPillars();
    renderFounders();
    renderTeam();
    renderEvents();
    renderRoles();
    renderStats();
    renderSponsors();
    renderRoleOptions();

    initReveal();
    initForms();
    setYear();
  });

})();
