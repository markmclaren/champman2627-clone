// CM 26/27 site behaviour shared by every page.
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const body = document.body;

  // Title bar: the game's name on the left, today's date tag on the right ("Sun 04.10.26")
  const shortDate = $('#shortDate');
  if (shortDate) {
    const now = new Date();
    const part = o => now.toLocaleDateString('en-GB', o);
    shortDate.textContent = `${part({ weekday: 'short' })} ${part({ day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.')}`;
  }

  // Menu: mark the current active page
  if (body.dataset.page) {
    $$(`.minimenu [data-page="${body.dataset.page}"]`).forEach(a => a.classList.add('on'));
  }

  // Status bar: "Please Select", or what the item under the pointer does
  const status = $('#status');
  if (status) {
    let base = { text: status.textContent, ok: false };
    const show = (text, ok) => {
      status.textContent = text;
      status.classList.toggle('ok', ok === true);
      status.classList.toggle('busy', ok === 'busy');
    };
    window.cmStatus = (text, ok) => { base = { text, ok }; show(text, ok); };
    const tip = e => {
      const t = e.target.closest('[data-tip]');
      t && base.ok !== 'busy' ? show(t.dataset.tip) : show(base.text, base.ok);
    };
    document.addEventListener('mouseover', tip);
    document.addEventListener('focusin', tip);
  }

  // Player Info card (Home & Database): cycle random star players
  const pdata = $('#players-data');
  if (pdata) {
    try {
      const players = JSON.parse(pdata.textContent);
      let i = Math.floor(Math.random() * players.length);
      const card = () => {
        const p = players[i];
        const cardBody = $('#pcardBody');
        if (cardBody) {
          cardBody.innerHTML = `
            <div class="strip" style="background:${p.bg || '#ffffff'};color:${p.fg || '#143cbe'}"><span>${esc(p.name)}</span><span>${esc(p.club)}</span></div>
            <dl class="pdl"><dt>Position</dt><dd>${esc(p.pos)}</dd><dt>Age</dt><dd>${p.age}</dd><dt>Nationality</dt><dd>${esc(p.nation)}</dd></dl>
            <div class="attrs">${p.attrs.map(([k, v]) => `<div class="attr"><span>${esc(k)}</span><span class="bar"><i style="width:${v * 5}%"></i></span><b>${v}</b></div>`).join('')}</div>`;
        }
      };
      const nextBtn = $('#nextPlayer');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => { i = (i + 1) % players.length; card(); });
      }
      card();
    } catch (_) {}
  }

  // News (What's Changed): list on the left, item on the right; #news-<date> picks one
  const items = $$('[data-news]');
  if (items.length) {
    const read = id => {
      if (!items.some(a => a.dataset.news === id)) id = items[0].dataset.news;
      items.forEach(a => a.hidden = a.dataset.news !== id);
      $$('[data-news-link]').forEach(li => li.classList.toggle('on', li.dataset.newsLink === id));
    };
    $$('[data-news-link]').forEach(li => li.addEventListener('click', () => {
      read(li.dataset.newsLink);
      history.replaceState(null, '', '#news-' + li.dataset.newsLink);
    }));
    read(location.hash.replace('#news-', ''));
  }
})();
