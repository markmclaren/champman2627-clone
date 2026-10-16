// CM 26/27 site behaviour shared by every page. Pages are static HTML rendered by make_web.py.
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const body = document.body;

  // js-dos pauses the game whenever its tab is hidden, and reads that when js-dos.js loads, so this has
  // to run first (site.js loads before it). Telling it the tab is always visible keeps a new game's
  // setup or a long Continue going while the player looks at another tab.
  if (body.dataset.page === 'play') {
    Object.defineProperty(Document.prototype, 'hidden', { get: () => false });
    Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible' });
    $('#dos').before($('#status'));   // the save status sits right above the game
  }

  // Title bar: the game's name on the left (set in layout.html), today's date tag on the right ("Sun 04.10.26")
  const now = new Date();
  const part = o => now.toLocaleDateString('en-GB', o);
  $('#shortDate').textContent = `${part({ weekday: 'short' })} ${part({ day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.')}`;

  // Phones and tablets: the game needs a mouse and keyboard, so links to it say so instead of opening it
  // (play.html itself shows the same message, with a "Try anyway" link). The Quick Season tile next to
  // them (.touch-tile, shown by CSS on touch screens) is what phones can play.
  window.cmTouchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (window.cmTouchOnly && body.dataset.page !== 'play') $$('a[href="play"]').forEach(a => {
    a.classList.add('off'); a.setAttribute('aria-disabled', 'true');
    a.dataset.tip = 'The game needs a mouse and keyboard: open this site on a desktop or laptop to play';
    a.insertAdjacentHTML('beforeend', '<small>Needs a computer</small>');
    a.addEventListener('click', e => { e.preventDefault(); show(a.dataset.tip); });
  });

  // Play links: count clicks (including blocked ones on phones), sent as a beacon so it survives leaving the page
  if (body.dataset.page !== 'play') $$('a[href="play"], a[href="quick-season"]').forEach(a => a.addEventListener('click', () =>
    window.cmTrack('play_clicked', { from: body.dataset.page, link: a.firstChild?.textContent?.trim().slice(0, 40), to: a.getAttribute('href'), game: a.getAttribute('href') === 'quick-season' ? 'mobile' : 'core', touch: window.cmTouchOnly }, { transport: 'sendBeacon' })));

  // Home tiles: which ones people use (decides what earns a place there)
  if (body.dataset.page === 'home') $$('.menu .tile').forEach(a => a.addEventListener('click', () =>
    window.cmTrack('home_tile_clicked', { tile: a.firstChild?.textContent?.trim().slice(0, 40), to: a.getAttribute('href'), touch: window.cmTouchOnly }, { transport: 'sendBeacon' })));

  // Menu: mark the current page
  $$(`.minimenu [data-page="${body.dataset.page}"]`).forEach(a => a.classList.add('on'));

  // Status bar: "Please Select", or what the thing under the pointer does. Play sets its own base text.
  const status = $('#status');
  let base = { text: status.textContent, ok: false };
  // ok: true = good news (green), 'busy' = highlighted, and tooltips don't cover it until it changes
  const show = (text, ok) => { status.textContent = text; status.classList.toggle('ok', ok === true); status.classList.toggle('busy', ok === 'busy'); };
  window.cmStatus = (text, ok) => { base = { text, ok }; show(text, ok); };
  const tip = e => { const t = e.target.closest('[data-tip]'); t && base.ok !== 'busy' ? show(t.dataset.tip) : show(base.text, base.ok); };
  document.addEventListener('mouseover', tip);
  document.addEventListener('focusin', tip);

  // Player Info card (Home): players are embedded as JSON at build time
  const pdata = $('#players-data');
  if (pdata) {
    const players = JSON.parse(pdata.textContent);
    let i = Math.floor(Math.random() * players.length);
    const card = () => {
      const p = players[i];
      $('#pcardBody').innerHTML = `
        <div class="strip" style="background:${p.bg};color:${p.fg}"><span>${esc(p.name)}</span><span>${esc(p.club)}</span></div>
        <dl class="pdl"><dt>Position</dt><dd>${esc(p.pos)}</dd><dt>Age</dt><dd>${p.age}</dd><dt>Nationality</dt><dd>${esc(p.nation)}</dd></dl>
        <div class="attrs">${p.attrs.map(([k, v]) => `<div class="attr"><span>${esc(k)}</span><span class="bar"><i style="width:${v * 5}%"></i></span><b>${v}</b></div>`).join('')}</div>`;
    };
    $('#nextPlayer').addEventListener('click', () => { i = (i + 1) % players.length; card(); });
    card();
  }

  // News (What's Changed): list on the left, item on the right; #news-<date> picks one
  const items = $$('[data-news]');
  if (items.length) {
    const read = id => {
      if (!items.some(a => a.dataset.news === id)) id = items[0].dataset.news;
      items.forEach(a => a.hidden = a.dataset.news !== id);
      $$('[data-news-link]').forEach(li => li.classList.toggle('on', li.dataset.newsLink === id));
    };
    $$('[data-news-link]').forEach(li => li.addEventListener('click', () => { read(li.dataset.newsLink); history.replaceState(null, '', '#news-' + li.dataset.newsLink); }));
    read(location.hash.replace('#news-', ''));
  }

  // Known issues and planned ideas, live from GitHub issues via api/issues
  const lists = $$('[data-issues]');
  if (lists.length) {
    const fill = data => lists.forEach(el => {
      const rows = data[el.dataset.issues] || [];
      el.innerHTML = rows.length
        ? rows.map(r => `<div class="issue"><b>${esc(r.title)}</b>${r.note ? `<div class="muted">${esc(r.note)}</div>` : ''}</div>`).join('')
        : `<p class="muted">${esc(el.dataset.empty || 'Nothing listed right now.')}</p>`;
    });
    fetch('api/issues', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(fill)
      .catch(() => lists.forEach(el => el.innerHTML = '<p class="muted">Couldn\'t load the list just now.</p>'));
  }

  // Feedback form: posts to api/feedback, which opens a GitHub issue
  const form = $('#fb');
  if (form) {
    const kind = () => form.querySelector('input[name=kind]:checked').value;
    const EXAMPLES = {
      bug: 'e.g. The game stopped after I pressed Continue on 16 Nov 2026.',
      data: 'e.g. A player is listed at Brighton but joined Leeds in the summer.',
      idea: 'e.g. It would be great to manage in more leagues.',
      other: 'e.g. A question about the site, or anything that doesn\'t fit above.',
    };
    const hint = () => { $('#crashHint').hidden = kind() !== 'bug'; $('#what').placeholder = EXAMPLES[kind()]; };
    form.querySelectorAll('input[name=kind]').forEach(r => r.addEventListener('change', hint));
    hint();
    const ua = navigator.userAgent, browser = (ua.match(/(Firefox|Edg|Chrome|Safari)\//) || ['', 'Browser'])[1].replace('Edg', 'Edge');
    const os = /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'other';
    const from = /\/play(\.html)?$/.test(document.referrer && new URL(document.referrer).pathname) ? 'played in the browser' : 'from another page';
    const context = { build: body.dataset.build, browser, os, from };
    $('#ctx').textContent = `Game build version ${context.build} · ${browser} on ${os}`;
    // Screenshots: picked, dropped or pasted. Each is redrawn on a canvas, which drops photo metadata
    // (e.g. location) and keeps it small: at most 1600 px wide, PNG for game screens, JPEG for big photos.
    const MAX_SHOTS = 3, shots = [];
    const drop = $('#drop'), input = $('#shots'), thumbs = $('#thumbs');
    const redraw = file => new Promise((ok, no) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onerror = () => { URL.revokeObjectURL(url); no(new Error(`${file.name || 'that file'} isn't an image we can read`)); };
      img.onload = async () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, 1600 / img.naturalWidth), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = k < 1;
        g.drawImage(img, 0, 0, c.width, c.height);
        let out = await new Promise(r => c.toBlob(r, 'image/png'));
        if (out.size > 9e5) out = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
        ok(out);
      };
      img.src = url;
    });
    const showShots = () => {
      thumbs.innerHTML = '';
      shots.forEach((b, i) => {
        const fig = document.createElement('figure'), img = document.createElement('img'), x = document.createElement('button');
        img.src = URL.createObjectURL(b); img.alt = `Screenshot ${i + 1}`;
        x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', `Remove screenshot ${i + 1}`);
        x.onclick = () => { shots.splice(i, 1); showShots(); };
        fig.append(img, x); thumbs.append(fig);
      });
      drop.hidden = shots.length >= MAX_SHOTS;
    };
    const addShots = async files => {
      $('#fbErr').textContent = '';
      for (const file of [...files].filter(f => f.type.startsWith('image/'))) {
        if (shots.length >= MAX_SHOTS) { $('#fbErr').textContent = `Up to ${MAX_SHOTS} screenshots.`; break; }
        try { shots.push(await redraw(file)); } catch (err) { $('#fbErr').textContent = err.message; }
      }
      showShots();
    };
    input.addEventListener('change', () => { addShots(input.files); input.value = ''; });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); addShots(e.dataTransfer.files); });
    document.addEventListener('paste', e => { if (!form.hidden && e.clipboardData?.files.length) { e.preventDefault(); addShots(e.clipboardData.files); } });
    const dataUrl = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = form.elements, what = f.what.value.trim();
      if (!what) { $('#fbErr').textContent = 'Tell us what happened first.'; f.what.focus(); return; }
      const email = f.email.value.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#fbErr').textContent = 'That email doesn\'t look right. Check it, or leave it blank.'; f.email.focus(); return; }
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; $('#fbErr').textContent = '';
      try {
        const r = await fetch('api/feedback', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: kind(), what, gameDate: f.gameDate.value, club: f.club.value, name: f.player.value, email, website: f.website.value, context,
            images: await Promise.all(shots.map(dataUrl)) }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `error ${r.status}`);
        $('#sentNo').textContent = j.number ? `#${j.number}` : '';
        form.hidden = true; $('#sent').hidden = false;
        window.cmTrack('feedback_sent', { kind: kind(), from, images: shots.length });
      } catch (err) {
        $('#fbErr').textContent = `Couldn't send it (${err.message}). Please try again in a minute.`;
      } finally { btn.disabled = false; }
    });
    $('#again').addEventListener('click', () => { form.reset(); shots.length = 0; showShots(); hint(); form.hidden = false; $('#sent').hidden = true; });
  }
})();
