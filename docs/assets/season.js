var _____WB$wombat$assign$function_____=function(name){return (globalThis._wb_wombat && globalThis._wb_wombat.local_init && globalThis._wb_wombat.local_init(name))||globalThis[name];};if(!globalThis.__WB_pmw){globalThis.__WB_pmw=function(obj){this.__WB_source=obj;return this;}}{
let window = _____WB$wombat$assign$function_____("window");
let self = _____WB$wombat$assign$function_____("self");
let document = _____WB$wombat$assign$function_____("document");
let location = _____WB$wombat$assign$function_____("location");
let top = _____WB$wombat$assign$function_____("top");
let parent = _____WB$wombat$assign$function_____("parent");
let frames = _____WB$wombat$assign$function_____("frames");
let opener = _____WB$wombat$assign$function_____("opener");
// Quick Season page: pick a country, league and club from the 2026/27 database, pick your team the
// CM 97/98 way (a squad screen and a tactics screen with real positions: LB, CB, RM, ST…), then each
// matchday: the fixtures, the match as text commentary with a scorers log, the results, the league,
// and back to the team to deal with injuries and tiredness.
// Every screen fills the window under the title bar. A taster for phones, where the real game can't be played.
// The match engine started from splurge69/football-manager (xG from the strength gap plus home
// advantage, Poisson scorelines). Strength is Ability (shown as the rating, out of 200), adjusted for
// position, side, fitness and form. Data from make_web.season_data: assets/season-data.json, then
// assets/season/<league>.json.
{
  const root = document.getElementById('season');
  const v = new URL(document.currentScript.src).searchParams.get('v') || '';
  const e = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const FULL_GAME = 'quick-season.html';

  // ---------- the game's own lettering ----------
  // The original draws all text in its bitmap fonts at their own sizes, so every font pixel is the same
  // size: MS Sans Serif 13/16/20/24/29px (MY1-5.FNT) for most text, Lucida Sans 32px (MY6, bold MY7) for
  // titles. After each change to the page, each text takes the size its CSS asks for rounded to the
  // nearest of those, at one CSS pixel per font pixel, with the game's hard one-pixel shadow.
  const SANS = [13, 16, 20, 24, 29];
  function pixelFont(el) {
    if (el.dataset.fitted) return;   // a title already fitted to its bar (below)
    const cs = getComputedStyle(el), size = parseFloat(el.dataset.fs ||= cs.fontSize), bold = +cs.fontWeight >= 600;
    const title = el.matches('.daytitle, .cmhead h2, .mbar span, .mbar b, .mmin') || size >= 30.5 || (bold && size >= 21);
    const s = el.style;
    if (title) { s.fontFamily = "'CM Lucida', sans-serif"; s.fontSize = '32px'; s.fontWeight = bold || !el.matches('.daytitle') ? '700' : '400'; }
    else { const px = SANS.reduce((a, b) => Math.abs(b - size) < Math.abs(a - size) ? b : a); s.fontFamily = `'CM Sans ${px}', sans-serif`; s.fontSize = px + 'px'; s.fontWeight = '400'; }
    s.lineHeight = 'normal'; s.letterSpacing = '0';
    if (cs.textShadow !== 'none') s.textShadow = '1px 1px 0 #000';
  }
  function pixelSnap(scope) {
    for (const el of scope.querySelectorAll('*')) {
      if (el.matches('svg, svg *, script, style')) continue;
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) pixelFont(el);
    }
    // A title bar that won't fit on one line (a long date on a phone) steps down to the next size that
    // keeps every font pixel a whole number of screen pixels: on a 3x phone, 2 screen pixels instead of 3.
    // Not below 20px: then a shorter version of the title (data-short), at full size, steps down the same way.
    const dpr = Math.max(1, Math.round(devicePixelRatio || 1)), over = h => h.scrollWidth > h.clientWidth + 1;
    const fit = h => { for (let n = dpr - 1; over(h) && 32 * n / dpr >= 20; n--) h.style.fontSize = 32 * n / dpr + 'px'; };
    const TITLE = '700 32px "CM Lucida"';   // measuring before the font has arrived would fit the fallback's widths
    if (!document.fonts.check(TITLE)) { document.fonts.load(TITLE).then(() => pixelSnap(root)); return; }
    for (const h of scope.querySelectorAll('.cmhead h2')) {
      if (h.dataset.fitted) continue;
      h.dataset.fitted = 1; fit(h);
      if (over(h) && h.dataset.short) { h.textContent = h.dataset.short; h.style.fontSize = '32px'; fit(h); }
      if (over(h)) h.style.fontSize = Math.floor(parseFloat(getComputedStyle(h).fontSize) * h.clientWidth / h.scrollWidth) + 'px';   // last resort: just small enough
    }
  }
  let snapQueued = false;
  new MutationObserver(() => { if (!snapQueued) { snapQueued = true; requestAnimationFrame(() => { snapQueued = false; pixelSnap(root); }); } })
    .observe(root, { childList: true, subtree: true, characterData: true });

  // ---------- match engine ----------
  // Ability points per goal of xG gap: calibrated so a 20-club top flight's champions average ~88
  // points and the bottom club ~20.
  const PER_GOAL = 50, BASE_XG = 1.35, HOME_ADV = 0.25, MIN_XG = 0.2, MAX_XG = 4.5;
  const LINE_NAME = ['goalkeeper', 'defender', 'midfielder', 'forward'];
  const WEIGHT = { att: [0, 0.3, 0.8, 1.2], def: [1.5, 1, 0.6, 0.15] };   // how much each line counts going forward and at the back
  // Positions per formation, each line listed left to right as seen on the pitch. [name, line, side]
  // with lines 0 GK, 1 DEF, 2 MID, 3 FWD and sides L, C, R.
  const P = { GK: ['GK', 0, 'C'], LB: ['LB', 1, 'L'], CB: ['CB', 1, 'C'], RB: ['RB', 1, 'R'], LWBd: ['LWB', 1, 'L'], RWBd: ['RWB', 1, 'R'],
    LWB: ['LWB', 2, 'L'], RWB: ['RWB', 2, 'R'], LM: ['LM', 2, 'L'], CM: ['CM', 2, 'C'], RM: ['RM', 2, 'R'], LW: ['LW', 3, 'L'], ST: ['ST', 3, 'C'], RW: ['RW', 3, 'R'] };
  const FORMS = {
    '4-4-2': 'GK LB CB CB RB LM CM CM RM ST ST', '4-3-3': 'GK LB CB CB RB CM CM CM LW ST RW', '4-5-1': 'GK LB CB CB RB LM CM CM CM RM ST',
    '3-5-2': 'GK CB CB CB LWB CM CM CM RWB ST ST', '3-4-3': 'GK CB CB CB LM CM CM RM LW ST RW',
    '5-3-2': 'GK LWBd CB CB CB RWBd CM CM CM ST ST', '5-4-1': 'GK LWBd CB CB CB RWBd LM CM CM RM ST',
  };
  const FORMATIONS = Object.keys(FORMS);
  const slotsOf = f => FORMS[f].split(' ').map(k => ({ pos: P[k][0], line: P[k][1], side: P[k][2] }));
  const TACTICS = {   // multiply [your xG, opponent's xG]: defending pays against stronger sides, attacking against weaker
    defensive: { label: 'Defensive', xg: [0.85, 0.8] },
    balanced: { label: 'Balanced', xg: [1, 1] },
    attacking: { label: 'Attacking', xg: [1.2, 1.15] },
  };
  const STYLES = Object.keys(TACTICS);
  const TIRED = 75;          // condition below this: tired, and taken off around the hour if there's a sub
  const SHIRTS = 16;         // 11 starters (S.shirts[0-10], one per position) and 5 subs
  const MAX_SUBS = 3;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  function mulberry32(seed) {   // seeded PRNG; its state can be saved and restored with the season
    let a = seed >>> 0;
    const rng = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    rng.state = () => a; rng.set = x => { a = x; };
    return rng;
  }
  function poisson(lambda, rng) {
    const limit = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > limit);
    return k - 1;
  }
  const gauss = rng => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  function shuffle(list, rng) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // Round robin by the circle method: every club plays once a matchday; the second half swaps home and
  // away; 10-club leagues play each other four times, as in Scotland.
  function fixtures(ids, rounds, rng) {
    const t = shuffle(ids, rng);
    if (t.length % 2) t.push(null);   // bye
    const n = t.length, half = [];
    for (let r = 0; r < n - 1; r++) {
      const day = [];
      for (let i = 0; i < n / 2; i++) {
        const a = t[i], b = t[n - 1 - i];
        // home and away alternate as clubs move round the circle (the fixed club alternates by round)
        if (a !== null && b !== null) day.push((i === 0 ? r % 2 : i % 2) ? [a, b] : [b, a]);
      }
      half.push(day);
      t.splice(1, 0, t.pop());          // rotate everyone but the first club
    }
    const days = [];
    for (let k = 0; k < rounds; k++) days.push(...half.map(d => d.map(([h, a]) => k % 2 ? [a, h] : [h, a])));
    return days;
  }

  // ---------- your team ----------
  const starters = () => S.shirts.slice(0, 11);
  const sidesOf = p => p.sides ||= new Set((p.label.split(' ')[1] || 'C').split(''));
  function fitAt(p, slot) {   // % of his rating a player keeps in a position: his line, then his side
    if (slot.line === 0) return p.fit[0];
    const s = sidesOf(p);
    const side = s.has(slot.side) ? 1 : slot.side === 'C' ? 0.88 : s.has('C') ? 0.92 : 0.85;   // wrong flank costs most
    return p.fit[slot.line] * side;
  }
  const effective = (p, slot, form = 1) => p.a * fitAt(p, slot) / 100 * (0.75 + 0.25 * p.cond / 100) * form;
  const fitWord = f => f >= 95 ? '' : f >= 85 ? 'can play' : 'out of position';
  // What players see is each player's estimated value (as CM 97/98 shows it), never his ability. On Easy
  // and Normal the position pickers still list the best fits first; on Hard they're alphabetical.
  const worth = p => `<span class="rt val">${money(p.value)}</span>`;
  function strength(lineup, forms) {   // a lineup (squad index per position, null = down to ten) going forward and at the back
    const slots = slotsOf(S.formation), sum = { att: [0, 0], def: [0, 0] };
    lineup.forEach((pi, i) => {
      const eff = pi === null ? 0 : effective(S.squad[pi], slots[i], forms[pi]);
      for (const k of ['att', 'def']) { sum[k][0] += WEIGHT[k][slots[i].line] * eff; sum[k][1] += WEIGHT[k][slots[i].line]; }
    });
    const [d, , a] = S.formation.split('-').map(Number);
    return { att: sum.att[0] / sum.att[1], def: sum.def[0] / sum.def[1], plus: (a - 2) * 0.12, minus: (4 - d) * 0.1 };   // more forwards: more goals for; fewer defenders: more against
  }
  const problems = () => {
    const empty = starters().filter(x => x === null).length;
    if (empty) return `Pick ${empty} more player${empty === 1 ? '' : 's'} for the team`;
    const hurt = starters().map(pi => S.squad[pi]).find(unavailable);
    return hurt ? `${short(hurt.name)} is ${hurt.out ? 'injured' : 'suspended'}: pick someone else` : '';
  };
  // ---------- difficulty (chosen with a new game; CM 97/98 itself had none: Hard is how it played) ----------
  const DIFF = {
    easy: { label: 'Easy', bestFirst: true, auto: true, opp: 0, injuries: 0.7, autoTired: true, boardK: 3, sackAt: -1,
      blurb: 'Auto Pick, and player lists show the best fits first. Your assistant takes tired players off. A patient board.' },
    normal: { label: 'Normal', bestFirst: true, auto: true, opp: 4, injuries: 1, autoTired: false, boardK: 5, sackAt: 15,
      blurb: 'Auto Pick and best-fit lists, stronger opponents. Tired players stay on unless you change them. The board expect results.' },
    hard: { label: 'Hard', sub: 'Classic 97/98', bestFirst: false, auto: false, opp: 8, injuries: 1.3, autoTired: false, boardK: 7, sackAt: 30,
      blurb: 'No Auto Pick and no hints on who is best, as in the original. The strongest opponents, more injuries, and a board that sacks quickly.' },
  };
  const D = () => DIFF[S.difficulty || 'normal'];
  const injuryChance = p => (0.004 + (p.inj || 10) * 0.0012) * (1 + (100 - p.cond) / 50) * D().injuries;
  // Bookings and sendings-off, per player per half, by his Aggression (1-20; keepers far less): about 1.7
  // bookings a side a match. Two in a match is a sending-off (banned for 1 match), a straight red 3, and
  // every 5th booking of the season 1, as in the English game.
  const YELLOW = 0.075, RED = 0.0015, BOOKINGS_BAN = 5;
  const cardRate = (agg, keeper) => (0.4 + (agg || 10) * 0.06) * (keeper ? 0.3 : 1);
  const unavailable = p => p.out || p.ban;
  const whyOut = p => p.out ? `injured: out for ${p.out} match${p.out > 1 ? 'es' : ''}` : `suspended for ${p.ban} match${p.ban > 1 ? 'es' : ''}`;

  // ---------- a matchday: the other games at once, yours half by half (so half-time changes count) ----------
  function startDay() {
    const l = S.league, me = S.club.n, rng = S.rng;
    const r = Object.fromEntries(l.clubs.map(c => [c.n, c.n === me ? c.r : c.r + D().opp]));   // opponents get the difficulty's edge
    let G = null;
    S.pendingDay = S.days[S.md].map(([h, a]) => {
      if (h === me || a === me) { G = newGame(h, a, r[h === me ? a : h] * (1 + gauss(rng) * 0.03)); return [h, a, 0, 0]; }
      const diff = (r[h] * (1 + gauss(rng) * 0.03) - r[a] * (1 + gauss(rng) * 0.03)) / PER_GOAL;
      return [h, a, poisson(clamp(BASE_XG + diff + HOME_ADV, MIN_XG, MAX_XG), rng), poisson(clamp(BASE_XG - diff, MIN_XG, MAX_XG), rng)];
    });
    return G;
  }
  function newGame(h, a, opp) {
    const me = S.club.n, slots = slotsOf(S.formation), oppClub = h === me ? a : h;
    const spans = new Map(), line = new Map();   // who was on when (minutes), and in which line
    starters().forEach((pi, i) => { spans.set(pi, [0, 90]); line.set(pi, slots[i].line); });
    const oppXI = lineup(oppClub).map(p => ({ name: p.name, line: p.fit.indexOf(Math.max(...p.fit)), agg: p.agg }));
    return { h, a, side: h === me ? 'h' : 'a', opp, forms: S.squad.map(p => 1 + gauss(S.rng) * (21 - (p.con || 10)) * 0.005),
      lineup: starters(), spans, line, oppXI, tactic: S.tactic, subsLeft: MAX_SUBS, score: [0, 0], events: [], injured: [], used: new Set(), halves: 0,
      booked: new Set(), sentOff: [], oppBooked: new Set(), oppOff: new Set() };
  }
  function expected(G) {   // both sides' xG for the rest of the match with both teams as they are now
    const s = strength(G.lineup, G.forms), [tf, ta] = TACTICS[G.tactic].xg, home = G.side === 'h';
    const opp = G.opp * (1 - G.oppOff.size / 11);   // each opponent sent off takes his share of their strength with him
    return [(BASE_XG + (s.att - opp) / PER_GOAL + s.plus + (home ? HOME_ADV : 0)) * tf, (BASE_XG + (opp - s.def) / PER_GOAL + s.minus + (home ? 0 : HOME_ADV)) * ta];
  }
  function substitute(G, i, sub, m) {   // shirt place i: off goes the player there, on comes sub (or no one)
    const out = G.lineup[i];
    if (out !== null) G.spans.get(out)[1] = m;
    G.lineup[i] = sub;
    if (sub !== null) { G.spans.set(sub, [m, 90]); G.line.set(sub, slotsOf(S.formation)[i].line); G.subsLeft--; }
    return out;
  }
  const bench = G => S.shirts.slice(11).filter(pi => pi !== null && !unavailable(S.squad[pi]) && !G.spans.has(pi));
  const men = G => G.lineup.filter(pi => pi !== null).length;
  // One half: injuries (and on Easy, tired players around the hour) bring the best-fitting sub on;
  // bookings and sendings-off on both sides (no one comes on for a player sent off); then goals and
  // chances for each side from the xG of each spell, with scorers who were on the pitch.
  function playHalf(G) {
    const rng = S.rng, from = G.halves * 45, to = from + 45, slots = slotsOf(S.formation), changes = [], events = [];
    const mine = G.side, theirs = mine === 'h' ? 'a' : 'h';
    const when = () => from + 1 + Math.floor(rng() * 44);
    const card = (agg, keeper) => { const r = rng(), k = cardRate(agg, keeper); return r < RED * k ? 'red' : r < (RED + YELLOW) * k ? 'yellow' : null; };
    G.lineup.forEach((pi, i) => {
      if (pi === null) return;
      if (rng() < injuryChance(S.squad[pi]) / 2) changes.push({ m: when(), i, pi, why: 'injury' });
      const c = card(S.squad[pi].attrs?.[1], i === 0); if (c) changes.push({ m: when(), i, pi, why: c });
    });
    G.oppXI.forEach((p, i) => { const c = !G.oppOff.has(p.name) && card(p.agg, i === 0); if (c) changes.push({ m: when(), opp: p, why: c }); });
    if (G.halves === 1 && D().autoTired) G.lineup.forEach((pi, i) => { if (i && pi !== null && S.squad[pi].cond < TIRED && !changes.some(x => x.i === i)) changes.push({ m: 55 + Math.floor(rng() * 20), i, pi, why: 'tired' }); });
    changes.sort((x, y) => x.m - y.m);
    let xg = [0, 0], t = from;
    const spell = until => { const [f, o] = expected(G); xg[0] += f * (until - t) / 90; xg[1] += o * (until - t) / 90; t = until; };
    for (const x of changes) {
      spell(x.m);
      if (x.opp) {   // the opposition's cards: a second booking is a sending-off too
        const off = x.why === 'red' || G.oppBooked.has(x.opp.name);
        (off ? G.oppOff : G.oppBooked).add(x.opp.name); G.used.add(x.m);
        events.push({ m: x.m, side: theirs, kind: off ? 'sentoff' : 'booked', p: { name: x.opp.name }, two: off && x.why === 'yellow', men: 11 - G.oppOff.size });
        continue;
      }
      if (G.lineup[x.i] !== x.pi) continue;   // he's already gone off
      if (x.why === 'yellow' || x.why === 'red') {
        const two = x.why === 'yellow' && G.booked.has(x.pi);
        if (x.why === 'yellow' && !two) G.booked.add(x.pi);
        else { substitute(G, x.i, null, x.m); G.sentOff.push([x.pi, two ? 1 : 3]); }
        G.used.add(x.m);
        events.push({ m: x.m, side: mine, kind: x.why === 'yellow' && !two ? 'booked' : 'sentoff', p: { name: S.squad[x.pi].name }, two, men: men(G) });
        continue;
      }
      const options = G.subsLeft ? bench(G).sort((a, b) => effective(S.squad[b], slots[x.i]) - effective(S.squad[a], slots[x.i])) : [];
      if (x.why === 'tired' && !options.length) continue;   // no sub left: a tired player stays on
      const sub = options[0] ?? null, out = substitute(G, x.i, sub, x.m);
      if (x.why === 'injury') G.injured.push(out);
      G.used.add(x.m);
      events.push({ m: x.m, side: G.side, kind: x.why, p: { name: S.squad[out].name }, sub, men: men(G) });
    }
    spell(to);
    const minute = () => { let m; do m = from + 1 + Math.floor(rng() * 44); while (G.used.has(m)); G.used.add(m); return m; };
    const onPitch = (side, m) => side === mine
      ? [...G.spans].filter(([pi, [on, off]]) => pi !== G.lineup[0] && on < m && m <= off).map(([pi]) => ({ name: S.squad[pi].name, line: G.line.get(pi) }))
      : G.oppXI.slice(1).filter(p => !G.oppOff.has(p.name));   // (roughly: one sent off this half scores in none of it)
    const weight = p => [0.05, 0.6, 2.5, 6][p.line];
    const pick = (side, m) => { const ps = onPitch(side, m), tot = ps.reduce((s, p) => s + weight(p), 0); let x = rng() * tot; return ps.find(p => (x -= weight(p)) < 0) || ps[0] || { name: 'Unknown' }; };
    for (const [side, x] of [[mine, clamp(xg[0], 0.05, MAX_XG / 2)], [theirs, clamp(xg[1], 0.05, MAX_XG / 2)]]) {
      for (let g = poisson(x, rng); g > 0; g--) { const m = minute(); events.push({ m, side, kind: 'goal', p: pick(side, m) }); }
      for (let c = poisson(0.6 + x * 1.4, rng); c > 0; c--) { const m = minute(); events.push({ m, side, kind: rng() < 0.45 ? 'save' : 'miss', p: pick(side, m) }); }
    }
    events.sort((x, y) => x.m - y.m);
    events.forEach(ev => { if (ev.kind === 'goal') G.score[ev.side === 'h' ? 0 : 1]++; });
    G.events.push(...events); G.halves++;
    return events;
  }
  const keeperName = (G, side) => side === G.side ? S.squad[G.lineup[0] ?? starters()[0]]?.name || 'the keeper' : G.oppXI[0]?.name || 'the keeper';

  // Full time: the matchday's results, then tiredness by minutes played, injuries, the board's verdict.
  function finishDay(G) {
    const day = S.pendingDay, rng = S.rng, news = [];
    if (G) day[day.findIndex(x => x[0] === G.h)] = [G.h, G.a, ...G.score];
    S.results.push(day); S.md++; S.pendingDay = null;
    S.squad.forEach(p => { if (p.out) p.out--; });
    if (G) {
      G.spans.forEach(([on, off], pi) => {
        const p = S.squad[pi], tire = Math.max(3, 22 - (p.sta || 10)) * (off - on) / 90;
        p.cond -= G.line.get(pi) === 0 ? tire / 3 : tire;   // goalkeepers barely tire
      });
      G.injured.forEach(pi => {
        const p = S.squad[pi];
        p.out = 1 + Math.floor(rng() ** 2 * 8); S.injuries++;
        news.push(`${short(p.name)} injured: out for ${p.out} match${p.out > 1 ? 'es' : ''}`);
      });
      S.squad.forEach(p => { if (p.ban) p.ban--; });   // bans are served in your own matches (this one counts), then today's are handed out
      G.sentOff.forEach(([pi, n]) => {
        const p = S.squad[pi];
        p.ban = Math.max(p.ban, n); S.reds++;
        news.push(`${short(p.name)} sent off: suspended for ${n} match${n > 1 ? 'es' : ''}`);
      });
      G.booked.forEach(pi => {
        const p = S.squad[pi]; if (G.sentOff.some(([x]) => x === pi)) return;   // a second booking: the sending-off covers it
        p.yel++; S.bookings++;
        if (p.yel % BOOKINGS_BAN === 0) { p.ban = Math.max(p.ban, 1); news.push(`${short(p.name)} booked for the ${ord(p.yel)} time: suspended for 1 match`); }
      });
      S.subsUsed += MAX_SUBS - G.subsLeft;
      boardAfter(G);
    }
    S.squad.forEach(p => { p.cond = Math.min(100, p.cond + 9); p.tired = p.cond < TIRED ? true : p.cond >= 85 ? false : p.tired; });
    S.news = news;
  }

  // ---------- the board (CM 97/98's Board Confidence: not shown after matches; the Board Confidence tile gives their verdict in words) ----------
  // After each match the board compare your points with what a squad ranked like yours should get
  // (about 2.1 a game for the strongest, 0.7 for the weakest). Fall low enough and, on Normal or Hard, you're sacked.
  function boardAfter(G) {
    const n = S.league.clubs.length, p = predicted(S.league, S.club), expect = 2.1 - 1.4 * (p - 1) / Math.max(1, n - 1);
    const [us, them] = G.side === 'h' ? G.score : [...G.score].reverse(), pts = us > them ? 3 : us === them ? 1 : 0;
    S.board = clamp(S.board + (pts - expect) * D().boardK, 0, 100);
    if (D().sackAt >= 0 && S.md >= 6 && S.board <= D().sackAt) S.sacked = true;
  }

  // Your assistant at work. Best player-and-position pairs first, so a striker isn't used up at full-back.
  function fillPositions(candidates) {
    const slots = slotsOf(S.formation);
    for (;;) {
      let best = null;
      for (let i = 0; i < 11; i++) if (S.shirts[i] === null) for (const pi of candidates()) {
        const score = effective(S.squad[pi], slots[i]);
        if (!best || score > best.score) best = { i, pi, score };
      }
      if (!best) return;
      const bench = S.shirts.indexOf(best.pi);
      if (bench >= 0) S.shirts[bench] = null;   // a sub promoted to the team leaves his place on the bench
      S.shirts[best.i] = best.pi;
    }
  }
  const available = () => S.squad.map((p, pi) => pi).filter(pi => !unavailable(S.squad[pi]) && !starters().includes(pi));
  // Auto Pick: fills every empty or injured position with the best available player, then the empty
  // places on the bench: a keeper, one each for defence, midfield and attack, then the best left.
  // Players you've already picked stay where they are.
  function autoFill() {
    S.shirts.forEach((pi, n) => { if (pi !== null && unavailable(S.squad[pi])) S.shirts[n] = null; });   // injured and suspended players make way
    fillPositions(available);
    const free = () => available().filter(pi => !S.shirts.includes(pi));
    for (const line of [0, 1, 2, 3, null, null]) {
      const n = S.shirts.indexOf(null, 11); if (n < 0) break;
      if (line !== null && S.shirts.slice(11).some(pi => pi !== null && S.squad[pi].fit[line] >= 95)) continue;   // that line is already covered
      const worth = pi => (line === null ? Math.max(...S.squad[pi].fit) : S.squad[pi].fit[line]) * S.squad[pi].a;
      const pick = free().sort((x, y) => worth(y) - worth(x))[0];
      if (pick !== undefined) S.shirts[n] = pick;
    }
    S.autoFills++;
    if (S.md > 0) S.changes++;
  }
  function setFormation(f) {   // the same eleven, each moved to the position in the new shape that suits him best
    const team = starters().filter(pi => pi !== null);
    S.formation = f;
    for (let i = 0; i < 11; i++) S.shirts[i] = null;
    fillPositions(() => team.filter(pi => !starters().includes(pi)));
  }

  function table(league, days) {
    const rows = Object.fromEntries(league.clubs.map(c => [c.n, { club: c, p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, pts: 0 }]));
    days.flat().forEach(([h, a, hg, ag]) => {
      const H = rows[h], A = rows[a];
      H.p++; A.p++; H.f += hg; H.a += ag; A.f += ag; A.a += hg;
      if (hg > ag) { H.w++; H.pts += 3; A.l++; }
      else if (hg < ag) { A.w++; A.pts += 3; H.l++; }
      else { H.d++; A.d++; H.pts++; A.pts++; }
    });
    return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.f - y.a) - (x.f - x.a) || y.f - x.f || x.club.n.localeCompare(y.club.n));
  }

  // ---------- how the season went ----------
  const ranked = league => [...league.clubs].sort((a, b) => b.r - a.r);
  const predicted = (league, club) => ranked(league).indexOf(club) + 1;
  const topFlight = league => league.up === 0;
  function verdict(league, pred, pos) {
    const n = league.clubs.length;
    const down = league.down && pos > n - league.down, up = league.up && pos <= league.up;
    if (pos === 1) return ['good', topFlight(league) ? 'Champions! The board are over the moon.' : 'Champions, and promoted! The board are over the moon.'];
    if (down && pred <= n - league.down) return ['bad', 'Relegated. The board have seen enough: you are sacked.'];
    if (down) return ['bad', 'Relegated, as everyone expected. The board thank you for trying.'];
    if (up && pred > league.up) return ['good', 'Promoted against the odds! The board are delighted.'];
    if (pred - pos >= 3) return ['good', `Finished ${ord(pos)}, ${pred - pos} places better than the squad suggested. The board are delighted.`];
    if (pos - pred >= 3) return ['bad', `Finished ${ord(pos)}, ${pos - pred} places worse than the squad suggested. The board are disappointed.`];
    return ['', `Finished ${ord(pos)}. The board are satisfied.`];
  }
  const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const light = c => { const [r, g, b] = [1, 3, 5].map(i => parseInt(c.bg.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b > 170; };   // white or yellow shirts: no text shadow
  const lit = c => light(c) ? ' light' : '';
  const surname = name => name.split(' ').slice(-1)[0];
  const short = name => { const w = name.split(' '); return w.length > 1 ? `${w.slice(1).join(' ')} ${w[0][0]}` : name; };   // CM style: "Newell P"
  const clubBy = name => S.league.clubs.find(c => c.n === name);

  // ---------- screens ----------
  // Each screen fills the window under the title bar: a header, a body (which scrolls when it must)
  // and a row of big grey buttons at the bottom. Moving between screens dips quickly to black, as in CM 97/98.
  let data, S = {};   // S: everything about the current club and season
  const squads = {};  // league code -> squads, fetched when first picked
  const NAVY = { fg: '#ffffff', bg: '#0627ac' };
  const header = (title, tag = '', c = S.club || NAVY) => `<div class="cmhead${lit(c)}${tag ? '' : ' notag'}" style="--fg:${c.fg};--bg:${c.bg}"><h2>${title}</h2>${tag ? `<span class="datetag2">${e(tag)}</span>` : ''}</div>`;
  const bar = (buttons, issue = '') => `<div class="qs-bar">${issue ? `<p class="qs-issue">${e(issue)}</p>` : ''}<div class="qs-btns">${buttons}</div></div>`;
  const btn = (go, label, cls = '', extra = '') => `<button class="cmbtn ${cls}" data-go="${go}"${extra}>${label}</button>`;
  // Every screen has the same photo behind it (site.css: assets/photos/bg.png, made by site_photos.py).
  const screen = (head, body, foot = '', cls = '', move = '') => {
    root.innerHTML = `<div class="qs-screen ${cls}${move ? ' fade' : ''}">${head}<div class="qs-body">${body}</div>${foot}</div>`;
    save();   // every screen change keeps the saved season up to date
  };

  // ---------- saving: the season lives in this browser until you start a new game ----------
  // Players are saved by name (not by place in the squad), so a later database update can't mix them
  // up; a save whose league or clubs no longer match the data is ignored.
  const SAVE_KEY = 'cm2627-quick-season';
  const names = list => list.map(pi => pi === null ? null : S.squad[pi].name);
  function save() {
    if (!S.club || !S.days) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, league: S.league.code, club: S.club.n, formation: S.formation, tactic: S.tactic,
        shirts: names(S.shirts), undo: S.undo && { ...S.undo, shirts: names(S.undo.shirts) },
        squad: S.squad.map(p => [p.name, p.cond, p.out, p.tired, p.ban, p.yel]), days: S.days, results: S.results, md: S.md, started: S.started, finished: S.finished,
        seed: S.seed, rng: S.rng.state(), changes: S.changes, injuries: S.injuries, reds: S.reds, bookings: S.bookings, subsUsed: S.subsUsed, autoFills: S.autoFills, fast: S.fast, news: S.news,
        difficulty: S.difficulty, board: S.board, sacked: S.sacked, htChanges: S.htChanges }));
    } catch {}   // private browsing or storage full: the game still plays, it just won't be kept
  }
  const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch {} };
  function loadSave() {
    let sv; try { sv = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
    const l = sv?.v === 1 && data.leagues.find(x => x.code === sv.league);
    const known = n => l.clubs.some(c => c.n === n);
    return l && known(sv.club) && sv.days.every(d => d.every(([h, a]) => known(h) && known(a))) ? sv : null;
  }
  function resumeScreen(sv) {   // the first screen when a season is saved: carry on, or start again
    S.club = null;
    const l = data.leagues.find(x => x.code === sv.league), c = l.clubs.find(x => x.n === sv.club);
    const where = sv.sacked ? 'Sacked' : !sv.started ? 'Pre-season' : sv.md === sv.days.length ? 'Season over' : `Matchday ${sv.md + 1} of ${sv.days.length}`;
    screen(header('Quick Season', 'Welcome back'), `<div class="choose resume">
        <button class="clubpick${lit(c)}" data-go="resume" style="--fg:${c.fg};--bg:${c.bg}"><span class="big">Continue</span><span class="cname">${e(c.n)}</span><b>${e(l.name)} · ${where}</b></button>
        <button data-go="fresh"><span class="big">New Game</span></button></div>`);
  }
  async function resume() {
    const sv = loadSave(); if (!sv) return countries();
    S.league = data.leagues.find(x => x.code === sv.league);
    if (!await buildSquad(sv.club)) return;
    const index = Object.fromEntries(S.squad.map((p, pi) => [p.name, pi])), at = list => list.map(n => n === null ? null : index[n] ?? null);
    sv.squad.forEach(([n, cond, out, tired, ban = 0, yel = 0]) => { const p = S.squad[index[n]]; if (p) Object.assign(p, { cond, out, tired, ban, yel }); });
    Object.assign(S, { formation: sv.formation, tactic: sv.tactic, shirts: at(sv.shirts), days: sv.days, results: sv.results, md: sv.md, started: sv.started,
      finished: sv.finished, seed: sv.seed, rng: mulberry32(0), changes: sv.changes, injuries: sv.injuries, reds: sv.reds || 0, bookings: sv.bookings || 0, subsUsed: sv.subsUsed, autoFills: sv.autoFills, fast: sv.fast, news: sv.news || [],
      difficulty: sv.difficulty || 'normal', board: sv.board ?? 60, sacked: !!sv.sacked, htChanges: sv.htChanges || 0 });
    S.rng.set(sv.rng);
    S.undo = sv.undo ? { ...sv.undo, shirts: at(sv.undo.shirts) } : null; if (!S.undo) snapshot();
    S.sacked ? sackedScreen() : S.started && S.md === S.days.length ? final() : hubScreen('fwd');
  }
  // Sideways on a phone the game is covered by "Turn your phone upright" (site.css); a match waits until it's upright again.
  const sideways = matchMedia('(orientation: landscape) and (max-height: 500px)');   // on a phone: window.cmTouchOnly, as in site.css
  const sleep = async ms => { await new Promise(r => setTimeout(r, ms)); while (sideways.matches && window.cmTouchOnly) await new Promise(r => setTimeout(r, 300)); };

  function countries(move = 'fwd') {
    S.club = null;
    const byCountry = {};
    data.leagues.forEach(l => (byCountry[l.country] ||= []).push(l));
    screen(header('Quick Season', 'Choose a country'), `<div class="choose">${Object.entries(byCountry).map(([c, ls]) =>
      `<button data-country="${e(c)}"><span>${e(c)}</span></button>`).join('')}</div>`, '', '', move);
  }

  function leagues(move = 'fwd') {
    S.club = null;
    screen(header(e(S.country), 'Choose a league'), `<div class="choose">${data.leagues.filter(l => l.country === S.country).map(l =>
      `<button data-league="${l.code}"><span>${e(l.name)}</span></button>`).join('')}</div>`, bar(btn('countries', 'Back', '', ' data-move="back"')), '', move);
  }

  // Clubs strongest first, with the team rating (its best eleven, out of 200). Tap one to select it,
  // then Start New Season (greyed out until a club is selected).
  function clubs(move = 'fwd') {
    const l = S.league;
    S.club = null; S.picked = null;
    screen(header(e(l.name), 'Choose a club'),
      `<div class="choose clubs">${ranked(l).map(c => `<button class="clubpick${lit(c)}" data-club="${e(c.n)}" style="--fg:${c.fg};--bg:${c.bg}">
         <span class="cname">${e(c.n)}</span><b>${Math.round(c.r)}</b></button>`).join('')}</div>`,
      bar(btn('leagues', 'Back', '', ' data-move="back"') + btn('newseason', 'Start New Season', 'go', ' disabled')), '', move);
  }
  // Difficulty, after the club (one tap, then Start New Season).
  function difficultyScreen() {
    S.pickedLevel = null;
    screen(header(e(S.picked), 'Choose difficulty', S.league.clubs.find(c => c.n === S.picked)),
      `<div class="choose levels">${Object.entries(DIFF).map(([k, d]) => `<button data-level="${k}"><span>${d.label}${d.sub ? ` <i>${d.sub}</i>` : ''}</span><small>${d.blurb}</small></button>`).join('')}</div>`,
      bar(btn('clubs', 'Back', '', ' data-move="back"') + btn('begin', 'Start New Season', 'go', ' disabled')), '', 'fwd');
  }

  // Sacked (CM 97/98: "Sacked as manager of …"): the season ends there; a new game is the way on.
  function sackedScreen() {
    const l = S.league, rows = table(l, S.results), pos = rows.findIndex(r => r.club.n === S.club.n) + 1, my = rows[pos - 1];
    screen(header(e(S.club.n), dayLabel(Math.max(0, S.md - 1))), `<h3 class="daytitle">Sacked</h3>
      <div class="confirmbox">The board have decided that your services are no longer required. You have been sacked as manager of ${e(S.club.n)},
        ${ord(pos)} in the ${e(l.name)} after ${my.p} matches (won ${my.w}, drawn ${my.d}, lost ${my.l}).</div>`,
      `<div class="qs-bar"><div class="qs-btns">${btn('newgame', 'Start a New Game', 'go')}</div></div>`, '', 'fwd');
  }

  function selectClub(b) {
    S.picked = b.dataset.club;
    root.querySelectorAll('.clubpick').forEach(x => x.classList.toggle('on', x === b));
    root.querySelector('[data-go="newseason"]').disabled = false;
  }

  async function buildSquad(name) {   // the club's players from the league's squad file (fetched once)
    const l = S.league;
    if (!squads[l.code]) {
      try { squads[l.code] = await (await fetch(`assets/season/${l.code}.json?v=${v}`)).json(); }
      catch { alert('Could not load the squad: check your connection and try again'); return false; }
    }
    S.club = l.clubs.find(c => c.n === name);
    S.squad = (squads[l.code][name] || []).map(([name, label, a, fit, sta, inj, con, age, nat, attrs, born, caps, goals, value]) =>
      ({ name, label: label.replace(/^GK [RLC]+$/, 'GK'), a, fit, sta, inj, con, age, nat, attrs, born, caps, goals, value: value || 0, cond: 100, out: 0, ban: 0, yel: 0, tired: false }));
    return true;
  }
  async function pickClub(name) {
    if (!await buildSquad(name)) return;
    S.formation = '4-4-2'; S.shirts = Array(SHIRTS).fill(null); S.tactic = 'balanced'; S.autoFills = 0; newSeason(); snapshot();
    hubScreen('fwd');
  }

  // ---------- your team: CM 97/98's Squad and Tactics screens ----------
  // Picking a club locks it in. Each matchday: the fixtures, then the team (Done), then Confirm Selection.
  // Grey bars above and below, as in the original. Undo Changes puts the team back as it was when you
  // came to it.
  const cycle = (go, label, sub, on = false) => `<div class="cycler${on ? ' on' : ''}"><button data-go="${go}-" aria-label="Previous">‹</button><span>${label}<small>${sub}</small></span><button data-go="${go}+" aria-label="Next">›</button></div>`;
  const VIEWS = { positions: 'Playing Positions', condition: 'Physical Condition', value: 'Estimated Value' };
  // Money as CM 97/98 shows it: £142.5m, £72.5m, £28m, £5.75m, £2.2m, £850K (value in £10,000 units)
  function money(v) {
    const m = v / 100, step = m >= 50 ? 2.5 : m >= 10 ? 1 : m >= 5 ? 0.25 : 0.1;
    return m >= 1 ? `£${+(Math.round(m / step) * step).toFixed(2)}m` : `£${Math.max(10, Math.round(v) * 10)}K`;
  }
  function teamTop(here) {
    return `<div class="qs-bar top"><div class="qs-btns">${here === 'squad'
      ? cycle('view', ...VIEWS[S.sqView].split(' '), S.sqView !== 'positions') + btn('tactics', 'Match<br>Tactics') + (D().auto ? btn('auto', 'Auto<br>Pick') : '')
      : cycle('formation', S.formation, 'Formation') + cycle('style', TACTICS[S.tactic].label, 'Style') + (D().auto ? btn('auto', 'Auto<br>Pick') : '')}</div></div>`;
  }
  const views = () => Object.keys(VIEWS);   // values show on every difficulty: the original shows them, while hiding ability
  // Done: back to the main screen when you came from it; on the way to a match, Start Season or Done (then Confirm Selection).
  function teamFoot(here) {
    const issue = problems(), off = issue ? ' disabled' : '';
    const done = S.teamMode === 'hub' ? btn('hub', 'Done', 'go', ' data-move="back"') : !S.started ? btn('start', 'Start Season', 'go', off) : btn('done', 'Done', 'go', off);
    const row = here === 'squad' ? btn('mine', 'Fixtures &amp;<br>Results') + (S.started ? btn('league', 'View<br>League') : '')
      : btn('squad', 'Squad') + btn('undo', 'Undo<br>Changes');
    const together = here === 'squad' && !S.started;   // pre-season: Fixtures & Results beside the one button
    return `<div class="qs-bar">${issue ? `<p class="qs-issue">${e(issue)}</p>` : ''}${together ? `<div class="qs-btns">${row}${done}</div>`
      : `<div class="qs-btns">${row}</div><div class="qs-btns">${done}</div>`}</div>`;
  }
  const snapshot = () => { S.undo = { shirts: [...S.shirts], formation: S.formation, tactic: S.tactic }; };
  const tag = () => S.started ? dayLabel(S.md) : 'Pre-season';
  const posOf = n => n < 0 ? '–' : n < 11 ? slotsOf(S.formation)[n].pos : 'SUB';

  // Squad: two columns reading down, a position box (tap: choose his position; drag: swap), a badge
  // (Inj, or fitness when tired), the name (tap: his player page) and, by the view at the top, his
  // positions, physical condition or rating.
  // Arriving from the main screen or the fixtures it always opens on Playing Positions; it keeps your choice
  // while you go to Tactics or a player page and back.
  function squadScreen(move = '') {
    S.view = 'squad'; if (!views().includes(S.sqView)) S.sqView = 'positions';
    const order = S.squad.map((p, pi) => pi);
    if (S.sqView === 'condition') order.sort((x, y) => (unavailable(S.squad[y]) ? -1 : S.squad[y].cond) - (unavailable(S.squad[x]) ? -1 : S.squad[x].cond));
    if (S.sqView === 'value') order.sort((x, y) => S.squad[y].value - S.squad[x].value);
    const rows = order.map(pi => {
      const p = S.squad[pi], n = S.shirts.indexOf(pi);
      const badge = p.out ? `<span class="badge2 inj">Inj</span>` : p.ban ? `<span class="badge2 sus">Sus</span>` : p.cond < TIRED ? `<span class="badge2 tir">Tir</span>` : '<span class="badge2"></span>';
      const value = S.sqView === 'condition' ? (unavailable(p) ? '–' : `${Math.round(p.cond)}%`) : S.sqView === 'value' ? money(p.value) : e(p.label);
      return `<button class="sqrow${n >= 0 ? ' picked' : ''}${n >= 11 ? ' sub' : ''}" data-player="${pi}"><span class="num">${posOf(n)}</span>${badge}<span class="nm">${e(short(p.name))}</span><span class="ps">${value}</span></button>`;
    }).join('');
    screen(header(e(S.club.n), tag(), S.club) + teamTop('squad'),
      `${S.news?.length && S.md ? `<div class="newsbar">${S.news.map(e).join(' · ')}</div>` : ''}<div class="sqlist" style="--rows:${Math.ceil(S.squad.length / 2)}">${rows}</div>`, teamFoot('squad'), '', move);
  }

  // Tactics: the pitch, with each position and his name (tap a position to choose who plays there).
  // On a wide screen the team list sits beside it, as in the original.
  function tacticsScreen(move = '') {
    S.view = 'tactics';
    const slots = slotsOf(S.formation);
    const rows = [3, 2, 1, 0].map(line => `<div class="pitchrow" style="top:${LINE_Y[line]}%">${slots.map((s, i) => [s, i]).filter(([s]) => s.line === line).map(([s, i]) => {
      const pi = S.shirts[i], p = pi === null ? null : S.squad[pi];
      const cls = ['spot', p && unavailable(p) ? 'hurt' : p && p.cond < TIRED ? 'tired' : '', p && fitAt(p, s) < 95 ? 'oop' : '', p ? '' : 'empty'].join(' ');
      return `<button class="${cls}" data-slot="${i}"><b>${s.pos}</b><span>${p ? e(surname(p.name)) : '–'}</span></button>`;
    }).join('')}</div>`).join('');
    const list = S.shirts.map((pi, n) => `<div class="tlrow${n >= 11 ? ' sub' : ''}"><span class="num">${posOf(n)}</span><span>${pi === null ? '' : e(S.squad[pi].name)}</span>${pi === null ? '' : worth(S.squad[pi])}</div>`).join('');
    const subs = S.shirts.slice(11).map((pi, k) => `<span data-n="${11 + k}">${pi === null ? '–' : e(surname(S.squad[pi].name))}</span>`).join('');
    screen(header(e(S.club.n), tag(), S.club) + teamTop('tactics'),
      `<div class="tactics"><div class="tlist">${list}</div><div class="cmpitch"><div class="pitchbox">${PITCH}${rows}</div></div></div>
       <div class="subs">Subs ${subs}</div>`, teamFoot('tactics'), 'fit', move);
  }

  // The pitch at real proportions (68 x 105 m, so the centre circle stays round), and how far up it
  // each line of players stands (% from the top: forwards, midfield, defence, keeper).
  const LINE_Y = [89, 66, 41, 16];
  const PITCH = `<svg class="lines" viewBox="0 0 68 105" aria-hidden="true">
    <rect x="1" y="1" width="66" height="103"/><line x1="1" y1="52.5" x2="67" y2="52.5"/><circle cx="34" cy="52.5" r="9.15"/><circle class="spotm" cx="34" cy="52.5" r=".5"/>
    <rect x="13.85" y="1" width="40.3" height="16.5"/><rect x="24.85" y="1" width="18.3" height="5.5"/><path d="M26.7 17.5 A9.15 9.15 0 0 0 41.3 17.5"/>
    <rect x="13.85" y="87.5" width="40.3" height="16.5"/><rect x="24.85" y="98.5" width="18.3" height="5.5"/><path d="M26.7 87.5 A9.15 9.15 0 0 1 41.3 87.5"/>
    <line class="d" x1="1" y1="35" x2="67" y2="35"/><line class="d" x1="1" y1="70" x2="67" y2="70"/><line class="d" x1="13.85" y1="17.5" x2="13.85" y2="87.5"/><line class="d" x1="54.15" y1="17.5" x2="54.15" y2="87.5"/></svg>`;

  // Confirm Selection, as in CM 97/98, between Done and the match.
  function confirmScreen() {
    S.view = 'confirm';
    screen(header(e(S.club.n), dayLabel(S.md), S.club), `<h3 class="daytitle">Confirm Selection</h3><div class="confirmbox">Go ahead and play match ?</div>`,
      `<div class="qs-bar"><div class="qs-btns">${btn('yes', 'Yes')}${btn('no', 'No', 'wide')}</div></div>`, '', 'fwd');
  }

  // ---------- the main screen (CM 97/98's "Season #1" menu) ----------
  // Between matches everything starts here: the date of your next match as the title, then the tiles.
  // Done goes on to the next matchday (pre-season: pick your team and Start Season), as in the original.
  const longDate = d => `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()]} ${ord(d.getUTCDate())} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
  const shortDate = d => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${ord(d.getUTCDate())} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;   // for a narrow phone
  const GREEN = { fg: '#fcfe02', bg: '#004000' };
  function hubScreen(move = '') {
    S.view = 'hub'; S.teamMode = 'hub';
    const tile = hubTile;   // just the date above the tiles (the original's "Season #1" line can join it once seasons carry on)
    const d = S.started && dateOf(S.md);
    screen(header(d ? longDate(d) : 'Pre-season', '', GREEN).replace('<h2>', `<h2${d ? ` data-short="${shortDate(d)}"` : ''}>`),
      `<div class="choose hub">${tile('cont', 'Done')}${tile('sqd', 'Squad<br>Details')}${tile('comp', 'Competition<br>Info')}${tile('board', 'Board<br>Confidence')}${tile('settings', 'Settings')}</div>`,
      `<div class="qs-bar"><div class="qs-btns"><span class="cmbtn please">Please Select</span></div></div>`, '', move);
  }
  // Competition Info, as in CM 97/98: the league's name in yellow on navy, then Next Fixtures (the coming
  // matchday), Last Results (the last one played) and League Table.
  const NAVY_BAR = { fg: '#fcfe02', bg: '#001060' };
  function compScreen(move = '') {
    S.view = 'comp';
    const tile = (go, label, off) => `<button data-go="${go}"${off ? ' disabled' : ''}><span>${label}</span></button>`;
    screen(header(e(S.league.name), tag(), NAVY_BAR), `<h3 class="daytitle">Competition Info</h3>
       <div class="choose hub">${tile('nextfx', 'Next<br>Fixtures', S.md >= S.days.length)}${tile('lastres', 'Last<br>Results', !S.md)}${tile('league', 'League<br>Table')}</div>`,
      bar(btn('hub', 'Done', 'go', ' data-move="back"')), '', move);
  }

  // Settings (a main screen tile), after CM 97/98's Save Game & Options: match commentary speed, starting
  // again, and Credits. No Save Game tile: the season saves itself.
  const hubTile = (go, label) => `<button data-go="${go}"><span>${label}</span></button>`;
  function settings(move = 'fwd') {
    S.view = 'settings';
    screen(header('Settings', '', GREEN), `<h3 class="daytitle">Please Select</h3>
       <div class="choose hub">${hubTile('speed', `Match<br>Commentary<small>${S.fast ? 'Fast' : 'Normal'} speed</small>`)}${hubTile('newgame', 'Start a<br>New Game')}${hubTile('credits', 'Credits')}</div>`,
      bar(btn('hub', 'Done', 'go', ' data-move="back"')), '', move);
  }
  // Credits: who made what, and (the easter egg) a football fact, a different one each time; tap it for another.
  const FACTS = [
    'Red and yellow cards were first used at the 1970 World Cup. Referee Ken Aston came up with them while waiting at a set of traffic lights.',
    'The first international match, Scotland v England in 1872, finished 0-0.',
    'Preston North End won the first Football League in 1888/89 without losing a game, and the FA Cup too: the original Invincibles.',
    'Arsenal went the whole 2003/04 Premier League season unbeaten: 26 wins and 12 draws.',
    "Derby County's 11 points in 2007/08 is still the lowest total in Premier League history.",
    "Manchester City's 100 points in 2017/18 is the Premier League record.",
    'Alan Shearer is the Premier League\'s all-time top scorer, with 260 goals.',
    'The fastest Premier League goal: Shane Long, after 7.69 seconds for Southampton at Watford in 2019.',
    'Sadio Mané scored a hat-trick in 2 minutes 56 seconds for Southampton against Aston Villa in 2015, a Premier League record.',
    'Goal nets were patented in 1890 by a Liverpool engineer, John Brodie.',
    'The penalty kick was the idea of William McCrum, a goalkeeper from County Armagh. It came into the game in 1891.',
    'Substitutes only arrived in the Football League in 1965. The first was Keith Peacock of Charlton.',
    'England only gave three points for a win from 1981. Before that it was two.',
    'The back-pass rule, stopping keepers handling a deliberate pass from a team-mate, came in in 1992.',
    'Leicester City won the 2015/16 Premier League after starting the season as 5,000-1 outsiders.',
    'Brighton reached the 1983 FA Cup final and drew 2-2 with Manchester United, before losing the replay 4-0.',
    'Championship Manager was created by two brothers, Paul and Oliver Collyer.',
    'Just Fontaine scored 13 goals at the 1958 World Cup, still the record for a single tournament.',
    'Miroslav Klose holds the record for World Cup goals, with 16.',
    "Celtic's 1967 European Cup winners, the Lisbon Lions, were all born within about 30 miles of Celtic Park.",
    'Nottingham Forest have won the European Cup twice, in 1979 and 1980: more than their one league title.',
    'Bert Trautmann played on in goal for Manchester City in the 1956 FA Cup final with a broken neck.',
    "Wimbledon's Dave Beasant was the first goalkeeper to save a penalty in an FA Cup final, against Liverpool in 1988.",
    'Peter Shilton won 125 England caps, still the record.',
    'Sir Alex Ferguson won 13 Premier League titles with Manchester United.',
    'The Football League began in 1888 with 12 clubs, the idea of Aston Villa director William McGregor.',
  ];
  const fact = () => FACTS[Math.floor(Math.random() * FACTS.length)];   // not the season's RNG: the results stay as they would be
  function creditsScreen() {
    S.view = 'credits';
    screen(header('Credits', '', GREEN), `<div class="credits">
        <p><b>Championship Manager 26/27</b>Quick Season<br>An unofficial fan project, not for profit</p>
        <p><b>Championship Manager 97/98</b>Sports Interactive<br>Published by Eidos Interactive</p>
        <button class="fact" data-go="fact"><b>Did you know?</b><span>${e(fact())}</span></button></div>`,
      bar(btn('settings', 'Done', 'go', ' data-move="back"')), '', 'fwd');
  }
  // Board Confidence (a main screen tile), as CM 97/98's Overall Performance screen: the directors' verdict in words.
  function boardScreen() {
    const who = `The ${S.club.n} directors`, b = S.board;
    const text = !S.md ? `${who} wish you the best of luck for the season ahead.`
      : b >= 75 ? `${who} are very pleased with your overall performance as manager. Keep up the good work !`
      : b >= 55 ? `${who} are pleased with your overall performance as manager.`
      : b >= 35 ? `${who} are concerned about your overall performance as manager. Results must improve.`
      : `${who} are very unhappy with your overall performance as manager. Your job is under threat !`;
    S.view = 'board';
    screen(header(e(S.club.n), tag(), S.club), `<h3 class="daytitle">Overall Performance</h3><div class="confirmbox">${e(text)}</div>`,
      `<div class="qs-bar"><div class="qs-btns">${btn('hub', 'Done', 'go', ' data-move="back"')}</div></div>`, '', 'fwd');
  }

  // The player page, after CM 97/98's Playing Skills screen: name (club), his positions in words, born,
  // age and nation, then his attributes in two columns and his physical condition. Done goes back.
  const ATTRS = ['Adaptability', 'Aggression', 'Creativity', 'Determination', 'Dribbling', 'Flair', 'Heading', 'Influence', 'Injury proneness', 'Off the ball',
    'Pace', 'Passing', 'Positioning', 'Set pieces', 'Shooting', 'Stamina', 'Strength', 'Tackling', 'Technique'];
  // Each column as [label, index in ATTRS]. Keepers, as in CM 97/98: the game keeps their skills in outfield
  // slots (Heading = Aerial ability, Pace = Rushing out, Tackling = Shot stopping; pcwizard.def), and shows
  // the attacking skills as '–' (null).
  const OUTFIELD_SKILLS = [[...Array(11).keys()], [11, 12, 13, 14, 15, 16, 17, 18]].map(col => col.map(k => [ATTRS[k], k]));
  const GK_SKILLS = [
    [['Adaptability', 0], ['Aerial ability', 6], ['Aggression', 1], ['Determination', 3], ['Influence', 7], ['Injury proneness', 8], ['Passing', 11],
      ['Positioning', 12], ['Rushing Out', 10], ['Stamina', 15], ['Shot stopping', 17]],
    [['Strength', 16], ['Technique', 18], ['Creativity', null], ['Dribbling', null], ['Flair', null], ['Off the ball', null], ['Set pieces', null], ['Shooting', null]],
  ];
  const ROLE_WORDS = { GK: 'Goalkeeper', SW: 'Sweeper', D: 'Defender', DM: 'Defensive Midfielder', M: 'Midfielder', AM: 'Attacking Midfielder', F: 'Forward', S: 'Striker' };
  function positionWords(label) {   // "D/M C" -> "Defender/Midfielder (Centre)"
    const [roles, sides = ''] = label.split(' ');
    const side = sides.split('').map(c => ({ R: 'Right', L: 'Left', C: 'Centre' })[c]).join('/');
    return roles.split('/').map(r => ROLE_WORDS[r] || r).join('/') + (side && label !== 'GK' ? ` (${side})` : '');
  }
  function playerScreen(pi) {
    S.back = S.view === 'tactics' ? 'tactics' : 'squad'; S.view = 'player';
    const p = S.squad[pi], at = p.attrs || [];
    const cell = ([label, k]) => `<tr${k === null ? ' class="na"' : ''}><td>${label}</td><td class="n">${k === null ? '–' : at[k] ?? '–'}</td></tr>`;
    const [left, right] = (p.label === 'GK' ? GK_SKILLS : OUTFIELD_SKILLS).map(col => col.map(cell).join(''));
    const condition = unavailable(p) ? whyOut(p).replace(/^./, c => c.toUpperCase()) : `Physical condition ${Math.round(p.cond)}%`;
    const intl = p.caps ? ` (${p.caps} caps/${p.goals} gls)` : '';
    screen(header(`${e(p.name)} (${e(S.club.s)})`, tag(), S.club),
      `<div class="posbar">${e(positionWords(p.label))}</div>
       <p class="born">${p.born ? `Born ${e(p.born)} (Age ${p.age}). ` : p.age ? `Age ${p.age}. ` : ''}${e(p.nat || '')}${intl}.</p>
       <div class="skills"><table>${left}</table>
         <table>${right}<tr><td colspan="2" class="cond ${unavailable(p) ? 'bad' : ''}">${condition}</td></tr>${p.yel ? `<tr><td colspan="2" class="cond">Bookings this season ${p.yel}</td></tr>` : ''}</table></div>`,
      `<div class="qs-bar"><div class="qs-btns">${btn(S.back, 'Done', 'go', ' data-move="back"')}</div></div>`, '', 'fwd');
  }

  // Drag and drop to swap places. Squad: a player's position box onto another player. Tactics: a
  // position onto another position, or between the pitch and the subs line. Either way the two swap
  // (team, bench or left out); a tap without dragging still opens the chooser.
  const DRAGGABLE = '.sqrow .num, .spot, .subs [data-n]', TARGET = '.sqrow, .spot, .subs [data-n]';
  function placeOf(el) {   // [place in S.shirts (-1: not picked), player (null: empty place)]
    if (el.matches('.sqrow')) { const pi = +el.dataset.player; return [S.shirts.indexOf(pi), pi]; }
    const n = +(el.dataset.slot ?? el.dataset.n); return [n, S.shirts[n]];
  }
  function swapPlaces(from, to) {
    const [na, pa] = placeOf(from), [nb, pb] = placeOf(to);
    if (na < 0 && nb < 0) return;
    if (na >= 0) S.shirts[na] = pb;
    if (nb >= 0) S.shirts[nb] = pa;
    if (S.md > 0) S.changes++;
  }
  let drag = null;
  root.addEventListener('pointerdown', ev => {
    const handle = ev.target.closest(DRAGGABLE); if (!handle) return;
    const el = handle.closest('.sqrow') || handle;
    drag = { el, x: ev.clientX, y: ev.clientY, moved: false };
    try { handle.setPointerCapture(ev.pointerId); } catch {}
  });
  root.addEventListener('pointermove', ev => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 8) return;
      drag.moved = true;
      drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add('dragghost');
      drag.ghost.style.width = drag.el.offsetWidth + 'px';
      document.body.appendChild(drag.ghost); drag.el.classList.add('dragging');
    }
    const r = drag.el.getBoundingClientRect();
    drag.ghost.style.transform = `translate(${ev.clientX - r.width / 2}px, ${ev.clientY - r.height / 2}px)`;
    root.querySelectorAll('.droptarget').forEach(x => x.classList.remove('droptarget'));
    const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(TARGET);
    if (over && over !== drag.el) over.classList.add('droptarget');
    const list = root.querySelector('.qs-body'), lr = list.getBoundingClientRect();   // near the top or bottom: scroll the list
    if (ev.clientY < lr.top + 40) list.scrollTop -= 12; else if (ev.clientY > lr.bottom - 40) list.scrollTop += 12;
  });
  root.addEventListener('pointerup', ev => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    d.ghost.remove(); d.el.classList.remove('dragging');
    const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(TARGET);
    S.dragged = true; setTimeout(() => { S.dragged = false; });   // the click that follows the drag isn't a tap
    if (over && over !== d.el) { const scroll = root.querySelector('.qs-body').scrollTop; swapPlaces(d.el, over); redraw(); root.querySelector('.qs-body').scrollTop = scroll; }
    else root.querySelectorAll('.droptarget').forEach(x => x.classList.remove('droptarget'));
  });

  // A sheet over the screen: choose without leaving it.
  function sheet(title, body, { sub = '', foot = '', full = false } = {}) {
    root.querySelector('.sheet')?.remove();   // one at a time
    root.insertAdjacentHTML('beforeend', `<div class="sheet${full ? ' full' : ''}" data-go="close"><div class="sheet-box" role="dialog" aria-label="${e(title)}">
      <h2>${e(title)}<button class="btn sm" data-go="close">Close</button></h2>${sub ? `<div class="sheet-sub">${sub}</div>` : ''}
      <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div></div>`);
  }
  function placeSheet(pi) {   // squad screen: which position for this player, or the bench
    const p = S.squad[pi], slots = slotsOf(S.formation);
    const cell = n => {
      const who = S.shirts[n], s = slots[n];
      return `<button class="shirt${who === pi ? ' on' : ''}" data-shirt="${n}"${unavailable(p) ? ' disabled' : ''}><b>${n < 11 ? s.pos : 'SUB'}</b><span>${who === null ? '–' : e(surname(S.squad[who].name))}</span></button>`;
    };
    sheet(`${short(p.name)} · ${p.label} · ${money(p.value)}${unavailable(p) ? ` · ${p.out ? 'injured' : 'suspended'} for ${p.out || p.ban}` : ''}`, `<div class="shirts">${Array.from({ length: SHIRTS }, (_, n) => cell(n)).join('')}</div>
      ${S.shirts.includes(pi) ? '<p class="ctr"><button class="btn" data-shirt="-1">Leave him out</button></p>' : ''}`);
    S.sheetPlayer = pi;
  }
  function giveShirt(pi, n) {   // the player in place n swaps to pi's old place (or out)
    const was = S.shirts.indexOf(pi);
    if (n < 0) { if (was >= 0) S.shirts[was] = null; }
    else { if (was >= 0) S.shirts[was] = S.shirts[n]; S.shirts[n] = pi; }
    if (S.md > 0) S.changes++;
  }
  function slotSheet(i) {   // tactics screen: who plays in this position, best first
    const slot = slotsOf(S.formation)[i];
    const row = ([p, pi]) => {
      const n = S.shirts.indexOf(pi), fit = fitWord(fitAt(p, slot));
      const status = p.out ? `<span class="bad">Injured · ${p.out}</span>` : p.ban ? `<span class="bad">Suspended · ${p.ban}</span>` : `<span class="${p.cond < TIRED ? 'warn' : ''}">${Math.round(p.cond)}%</span>`;
      return `<button class="prow${n >= 0 ? ' in' : ''}" data-pick="${pi}"${unavailable(p) ? ' disabled' : ''}><span class="pname">${e(short(p.name))}${n >= 0 ? ` <i>${posOf(n)}</i>` : ''}</span><span class="plabel">${e(p.label)}${fit ? ` · <em>${fit}</em>` : ''} · ${status}</span>${worth(p)}</button>`;
    };
    const all = S.squad.map((p, pi) => [p, pi]);
    const groups = [['Natural', x => x >= 95], ['Can play here', x => x >= 85 && x < 95], ['Out of position', x => x < 85]];
    sheet(`${slot.pos}: pick a ${LINE_NAME[slot.line]}`, groups.map(([title, ok]) => {
      const g = all.filter(([p]) => ok(fitAt(p, slot))).sort(([x], [y]) => D().bestFirst ? effective(y, slot) - effective(x, slot) : x.name.localeCompare(y.name));   // Hard: no best-first hint
      return g.length ? `<h3>${title}</h3><div class="plist">${g.map(row).join('')}</div>` : '';
    }).join(''));
    S.sheetSlot = i;
  }

  // A new season's fixtures, drawn up as soon as you take over (so pre-season can show them); Start
  // Season kicks it off.
  function newSeason() {
    S.seed = Date.now() % 2147483647; S.rng = mulberry32(S.seed);
    S.days = fixtures(S.league.clubs.map(c => c.n), S.league.rounds, S.rng);
    S.results = []; S.md = 0; S.started = false; S.finished = false;
  }

  function start() {
    S.started = true;
    S.results = []; S.md = 0; S.changes = 0; S.injuries = 0; S.reds = 0; S.bookings = 0; S.subsUsed = 0; S.news = []; S.log = [];
    S.board = 60; S.sacked = false; S.htChanges = 0;   // the board start out willing to give you a chance
    S.squad.forEach(p => { p.cond = 100; p.out = 0; p.ban = 0; p.yel = 0; p.tired = false; });
    dayScreen(0, 'pre', 'fwd');
  }

  // ---------- the matchday screen (CM 97/98's Fixtures / Results) ----------
  // Matchdays are spread from mid-August to mid-May, on the weekday they land on.
  // As in the real calendar: league games on Saturdays from 15 Aug 2026 to 15 May 2027 (40 weekends);
  // a longer season (the 46-game Championship) adds Tuesday games spread through it.
  const DAY = 86400000, SEASON_START = Date.UTC(2026, 7, 15), WEEKENDS = 40, calendars = {};
  function calendar(total) {
    if (calendars[total]) return calendars[total];
    const sats = Array.from({ length: Math.min(total, WEEKENDS) }, (_, w) => SEASON_START + Math.round(w * (WEEKENDS - 1) / Math.max(1, Math.min(total, WEEKENDS) - 1)) * 7 * DAY);
    const extra = Math.max(0, total - WEEKENDS);
    const tues = Array.from({ length: extra }, (_, i) => SEASON_START + (Math.round((i + 1) * WEEKENDS / (extra + 1)) * 7 + 3) * DAY);
    return calendars[total] = [...sats, ...tues].sort((a, b) => a - b);
  }
  const dateOf = k => new Date(calendar(S.days.length)[Math.min(k, S.days.length - 1)]);
  const ddmmyy = d => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCFullYear()).slice(2)}`;
  const dayLabel = k => { const d = dateOf(k); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${ddmmyy(d)}`; };

  // One matchday's games, home sides in alphabetical order, each with its current league position.
  // 'pre': the upcoming fixtures (Done: pick your team); 'post': straight after your match (View League, Next Match).
  function dayScreen(k = S.md, mode = S.dayMode, move = '') {
    S.view = 'day'; S.dayK = k; S.dayMode = mode;
    const me = S.club.n, total = S.days.length, played = k < S.md;
    const games = [...(played ? S.results[k] : S.days[k])].sort((x, y) => clubBy(x[0]).s.localeCompare(clubBy(y[0]).s));
    const pos = Object.fromEntries(table(S.league, S.results).map((r, i) => [r.club.n, S.md ? ord(i + 1) : '–']));   // no positions before a ball is kicked
    const name = n => `<td class="${n === me ? 'meclub' : ''}">${e(clubBy(n).s)}</td>`;
    const rows = games.map(([h, a, hg, ag]) => `<tr><td class="pb"><span class="posbox">${pos[h]}</span></td>${name(h)}<td class="sc">${played ? `${hg} : ${ag}` : 'v'}</td>${name(a)}<td class="pb"><span class="posbox">${pos[a]}</span></td></tr>`).join('');
    const last = S.md === total;
    const foot = mode === 'post' ? (last ? btn('final', 'End of Season', 'go') : btn('hub', 'Done', 'go'))
      : mode === 'browse' ? btn('comp', 'Done', 'go', ' data-move="back"') : btn('pickteam', 'Done', 'go');
    screen(`<div class="cmhead navyhead"><span class="datetag2 left">Matchday ${k + 1} of ${total}</span><h2>${e(S.league.name)}</h2><span class="datetag2">${dayLabel(k)}</span></div>`,
      `<div class="daynav"><button class="cmbtn sm" data-go="day-"${k ? '' : ' disabled'}>&laquo; Date</button><button class="cmbtn sm" data-go="day+"${k < total - 1 ? '' : ' disabled'}>Date &raquo;</button>
         <span class="daystate">${played ? 'PLAYED' : 'TO BE PLAYED'}<br>${ddmmyy(dateOf(k))}</span></div>
       <h3 class="daytitle">${played ? 'Results' : 'Fixtures'}</h3>
       <table class="dayt">${rows}</table>`,
      bar(foot), '', move);
  }

  const backTo = () => ({ day: 'backday', tactics: 'tactics', hub: 'hub', comp: 'comp' })[S.view] || 'squad';
  // Your season, after CM 97/98's club Fixtures screen: date box, opponent, H/A, competition, score.
  const shortDay = k => { const d = dateOf(k); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.${String(d.getUTCFullYear()).slice(2)}`; };
  const shortComp = name => name.replace(/League/g, 'Lge').replace(/Championship/, 'Champ\'ship');
  function clubFixtures() {
    S.back = backTo(); S.view = 'mine';
    const me = S.club.n, comp = e(shortComp(S.league.name));
    const rows = S.days.map((d, k) => {
      const g = d.find(x => x[0] === me || x[1] === me); if (!g) return '';
      const home = g[0] === me, res = S.results[k]?.find(x => x[0] === g[0]);
      return `<tr class="${k === S.md ? 'next' : ''}"><td class="dt"><span>${shortDay(k)}</span></td><td class="op">${e(clubBy(home ? g[1] : g[0]).s)}</td>` +
        `<td class="ha">${home ? 'H' : 'A'}</td><td class="cp">${comp}</td><td class="rs"><span>${res ? `${res[2]}:${res[3]}` : '—'}</span></td></tr>`;
    }).join('');
    screen(header(`${e(me)} Fixtures 2026/7`, dayLabel(Math.min(S.md, S.days.length - 1))), `<div class="ltable"><table class="cfx">${rows}</table></div>`,
      bar(btn(S.back, 'Done', 'go', ' data-move="back"')), '', 'fwd');
    root.querySelector('tr.next')?.scrollIntoView({ block: 'center' });
  }

  // ---------- the match: CM 97/98 style text commentary ----------
  function lineup(club) {   // an opponent's XI for the commentary: best keeper plus the ten best outfield players
    const sq = (squads[S.league.code][club] || []).map(([name, , a, fit, , , , , , attrs]) => ({ name, a, fit, agg: attrs?.[1] }));
    const keeper = sq.filter(p => p.fit[0] === 100).sort((x, y) => y.a - x.a)[0];
    return [keeper, ...sq.filter(p => p !== keeper).sort((x, y) => y.a - x.a).slice(0, 10)].filter(Boolean);
  }
  const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  function lines(ev, G, rng) {   // what the commentary box says for one event
    const A = surname(ev.p.name), K = surname(keeperName(G, ev.side === 'h' ? 'a' : 'h'));
    const any = xs => xs[Math.floor(rng() * xs.length)];
    if (ev.kind === 'goal') return [any([`${A} on the ball…`, `${A} breaks into the box…`, `A cross comes in for ${A}…`]), any([`Just ${K} to beat…`, `${A} shoots…`, `${A} gets his head to it…`]), 'GOAL'];
    if (ev.kind === 'save') return [any([`${A} finds some space…`, `${A} lets fly from distance…`, `${A} is through…`]), any([`Just ${K} to beat…`, `${A} shoots…`]), any([`Saved by ${K}!`, `${K} tips it over the bar!`, `Great save by ${K}!`])];
    if (ev.kind === 'miss') return [any([`${A} tries his luck…`, `${A} has a chance…`, `${A} meets the cross…`]), any(['Wide!', 'Over the bar!', 'Off the post!', 'Into the side netting!'])];
    const sub = ev.sub === null || ev.sub === undefined ? null : surname(S.squad[ev.sub].name);
    if (ev.kind === 'change') return [`Substitution: ${sub} on for ${A}`];
    if (ev.kind === 'tired') return [`${A} is tiring…`, `Substitution: ${sub} on for ${A}`];
    const tackle = any([`${A} goes in late…`, `${A} clatters into his man…`, `${A} pulls back his man…`]);
    const down = `Down to ${NUMBERS[ev.men] || ev.men} men!`;
    if (ev.kind === 'booked') return [tackle, `${A} is booked`];
    if (ev.kind === 'sentoff') return ev.two ? [tackle, `A second booking for ${A}…`, `${A} is sent off! ${down}`]
      : [any([`${A} with a terrible tackle…`, `${A} lashes out…`, `${A} with a two-footed challenge…`]), `Straight red card! ${A} is sent off! ${down}`];
    return [`${A} is down injured…`, sub ? `Substitution: ${sub} on for ${A}` : `${A} has to go off: ${down.toLowerCase()}`];
  }

  async function play() {
    if (problems()) return squadScreen();
    const G = startDay();
    if (!G) { finishDay(null); return dayScreen(S.md - 1, 'post', 'fwd'); }
    await match(G);
  }

  // The match screen, as in CM 97/98: the big box keeps the log (scorers and injuries with the minute,
  // then the attendance) at its top left, and each commentary line is a band across its middle in the
  // attacking side's colours. You press to kick off each half; at half time you can change your tactics
  // and make substitutions before the second half is played.
  async function match(G) {
    const H = clubBy(G.h), away = clubBy(G.a);
    const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const near = (x, y) => rgb(x).reduce((s, v, i) => s + Math.abs(v - rgb(y)[i]), 0) < 120;
    // Colour clash (about 1 fixture in 5): the away side wears its away kit, as on the pitch.
    const A = near(H.bg, away.bg) && away.abg && !near(H.bg, away.abg) ? { ...away, fg: away.afg, bg: away.abg } : away;
    S.game = G; S.lastEvents = G.events;
    const token = S.matchToken = {}, live = () => S.matchToken === token;
    const speed = () => S.fast ? 0.35 : 1;
    const score = [0, 0];
    const awayBar = near(H.bg, A.bg) ? (near(H.bg, A.fg) ? '#dddddd' : A.fg) : A.bg;   // still too close (no usable away kit): the away side's other colour
    S.view = 'match';
    screen('', `<div class="mbars"><div class="mbar${lit(H)}" style="--fg:${H.fg};--bg:${H.bg}"><span>${e(H.s)}</span><b id="hs">0</b></div><div class="mbar${lit(A)}" style="--fg:${A.fg};--bg:${A.bg}"><span>${e(A.s)}</span><b id="as">0</b></div></div>
      <span class="mdate">${dayLabel(S.md)}</span>
      <div class="mrow"><span class="mtag" id="ht" style="visibility:hidden">0:0 HT</span><div class="mmin" id="mm">0</div><span class="mtag">${e(S.league.name)}</span></div>
      <div class="mbox" id="mb"><div id="ml"></div><div class="band" id="band" hidden></div></div>
      <div class="mposs"><small>Attacking Possession Last 5 Mins</small><div class="pbar"><i id="pb" style="--h:${H.bg};--a:${awayBar}"></i></div></div>
      <div class="mstatus" id="ms">Kick Off From ${e(H.st || 'the stadium')}</div>`,
      bar(''), 'fit match', 'fwd');
    const $ = id => document.getElementById(id);
    S.log = []; S.crowd = H.cap ? Math.round(H.cap * (0.72 + S.rng() * 0.27)) : 0;   // attendance: most of the ground
    S.crowdShown = false;   // as in CM 97/98, the attendance is announced once the second half is under way
    const box = (text, side) => {   // a commentary band in the attacking side's colours; text null: no band
      const b = $('band'); if (!b) return;
      const c = side === 'h' ? H : side === 'a' ? A : null;
      b.hidden = text === null; if (text === null) return;
      b.textContent = text; b.style.background = c ? c.bg : ''; b.style.color = c ? c.fg : ''; b.classList.toggle('light', !!c && light(c));
    };
    box(null); showLog();
    const whistle = (label, changes) => new Promise(go => {   // CM 97/98: you press to kick off each half
      S.whistle = go;
      root.querySelector('.qs-btns').innerHTML = btn('kickoff', label, 'go') + (changes ? btn('halftime', 'Half Time<br>Changes') : '') + btn('result', 'Skip to<br>Result');
    }).then(() => { root.querySelector('.qs-btns').innerHTML = btn('faster', S.fast ? 'Normal Speed' : 'Faster') + btn('result', 'Skip to Result', 'go'); });
    const share = () => { const [f, o] = expected(G); return G.side === 'h' ? f / (f + o) : o / (f + o); };
    async function run(events, from, to) {   // the clock from minute `from` to `to`, playing out each event
      let i = 0;
      for (let m = from; m <= to; m++) {
        if (!live()) return;
        $('mm').textContent = m;
        if (m % 5 === 0) $('pb').style.setProperty('--p', `${Math.round(clamp(share() + gauss(S.rng) * 0.12, 0.15, 0.85) * 100)}%`);
        while (i < events.length && events[i].m === m) {
          const ev = events[i++];
          for (const t of lines(ev, G, S.rng)) {
            if (!live()) return;
            if (t === 'GOAL') {   // CM 97/98: GOAL FOR ARSENAL !! flashing in the club's colours, then the score and the log
              const c = ev.side === 'h' ? H : A, k = ev.side === 'h' ? 0 : 1, b = $('band');
              box(`GOAL FOR ${c.n.toUpperCase()} !!`, ev.side); b.classList.add('goal');
              score[k]++; $(k ? 'as' : 'hs').textContent = score[k]; logEvent(ev);
              for (let f = 0; f < 10 && live(); f++) {
                b.style.background = f % 2 ? c.bg : c.fg; b.style.color = f % 2 ? c.fg : c.bg;
                await sleep(260 * speed());
              }
              b.classList.remove('goal');
              continue;
            }
            box(t, ev.side);
            await sleep(1000 * speed());
          }
          if (ev.kind === 'injury' || ev.kind === 'sentoff') logEvent(ev);
          box(null);
        }
        await sleep(130 * speed());
      }
    }
    await whistle('Kick Off'); if (!live()) return;
    $('ms').textContent = `First Half From ${H.st || 'the stadium'}`;
    await run(playHalf(G), 1, 45); if (!live()) return;
    $('ht').style.visibility = ''; $('ht').textContent = `${score[0]}:${score[1]} HT`; $('ms').textContent = 'Half Time';
    S.halfTime = true;
    await whistle('Second Half', true); if (!live()) return;
    S.halfTime = false; root.querySelector('.sheet')?.remove();
    S.crowdShown = true; showLog();
    $('ms').textContent = `Second Half From ${H.st || 'the stadium'}`;
    const changes = G.events.filter(ev => ev.kind === 'change' && !ev.shown);   // your half-time substitutions, announced as play restarts
    for (const ev of changes) { ev.shown = true; box(lines(ev, G, S.rng)[0], G.side); await sleep(1100 * speed()); if (!live()) return; }
    box(null);
    await run(playHalf(G), 46, 90); if (!live()) return;
    finishMatch(G);
  }
  function skipToResult() {   // play whatever is left of the match at once (no half-time changes)
    const G = S.game; S.matchToken = null; S.halfTime = false; root.querySelector('.sheet')?.remove();
    while (G.halves < 2) playHalf(G);
    finishMatch(G);
  }
  function finishMatch(G) {
    finishDay(G);
    endMatch([G.h, G.a, ...G.score]);
  }

  // Half time changes: your style for the second half, and substitutions (up to three in the match).
  // Each player on one line: position, name, match condition.
  const condCell = p => `<span class="rt cnd${p.cond < TIRED ? ' warn' : ''}">${Math.round(p.cond)}%</span>`;
  function halftime() {
    const G = S.game, slots = slotsOf(S.formation);
    const rows = G.lineup.map((pi, i) => pi === null ? '' : `<button class="prow" data-htoff="${i}"${G.subsLeft && bench(G).length ? '' : ' disabled'}>
      <span class="pname"><i>${slots[i].pos}</i> ${e(short(S.squad[pi].name))}</span>${condCell(S.squad[pi])}</button>`).join('');
    sheet('Half Time Changes', `<div class="cyclers one">${cycle('htstyle', TACTICS[G.tactic].label, 'Style')}</div>
      <h3>${G.subsLeft} substitution${G.subsLeft === 1 ? '' : 's'} left · tap a player to take him off</h3><div class="plist">${rows}</div>`);
  }
  function halftimeOff(i) {   // who comes on for the player in place i
    const G = S.game, slot = slotsOf(S.formation)[i], out = S.squad[G.lineup[i]];
    const opts = bench(G).map(pi => [S.squad[pi], pi]).sort(([x], [y]) => D().bestFirst ? effective(y, slot) - effective(x, slot) : fitAt(y, slot) - fitAt(x, slot) || x.name.localeCompare(y.name));
    sheet(`Replace ${short(out.name)} (${slot.pos})`, `<div class="plist">${opts.map(([p, pi]) =>
      `<button class="prow" data-hton="${pi}"><span class="pname"><i class="lbl">${e(p.label)}</i> ${e(short(p.name))}</span>${condCell(p)}</button>`).join('') || '<p>No substitutes available.</p>'}</div><p class="ctr"><button class="btn" data-go="halftime">Back</button></p>`);
    S.htSlot = i;
  }
  function halftimeOn(pi) {
    const G = S.game, out = substitute(G, S.htSlot, pi, 45);
    G.events.push({ m: 46, side: G.side, kind: 'change', p: { name: S.squad[out].name }, sub: pi });
    S.htChanges++;
    halftime();
  }

  function logEvent(ev) {   // goals, injuries and sendings-off, in the order they happened
    if (ev.logged) return;
    ev.logged = true; S.log.push(ev);
    showLog();
  }
  const LOGGED = { goal: ['', ''], injury: ['inj', ' injured'], sentoff: ['red', ' sent off'] };
  function showLog() {   // as in CM 97/98: home side's goals, injuries and sendings-off down the left, then the attendance; away side's down the right
    const b = document.getElementById('ml'); if (!b) return;
    const side = k => S.log.filter(ev => ev.side === k).map(ev => `<li class="${LOGGED[ev.kind][0]}"><span>${e(surname(ev.p.name))}${LOGGED[ev.kind][1]}</span><b>${ev.m}</b></li>`).join('');
    const crowd = S.crowd && S.crowdShown ? `<li class="crowd">Attendance ${S.crowd.toLocaleString('en-GB')}</li>` : '';
    b.innerHTML = `<div class="mlog2"><ul>${side('h')}${crowd}</ul><ul class="away">${side('a')}</ul></div>`;
  }
  function endMatch([h, a, hg, ag]) {
    S.matchToken = null;
    const set = (id, x) => { const n = document.getElementById(id); if (n) n.textContent = x; };
    set('hs', hg); set('as', ag); set('mm', 'FT'); set('ms', 'Full Time');
    (S.lastEvents || []).filter(ev => LOGGED[ev.kind]).forEach(logEvent);   // Result skipped ahead: fill in the log
    const band = document.getElementById('band'); if (band) band.hidden = true;
    S.crowdShown = true; showLog();
    const ht = document.getElementById('ht');
    if (ht) {   // "0:0 HT 0:1 FT"
      const half = (S.lastEvents || []).filter(ev => ev.kind === 'goal' && ev.m <= 45);
      ht.style.visibility = ''; ht.textContent = `${half.filter(x => x.side === 'h').length}:${half.filter(x => x.side === 'a').length} HT ${hg}:${ag} FT`;
    }
    const footer = root.querySelector('.qs-btns');
    if (footer) footer.innerHTML = btn('continue', 'Done', 'go');
  }

  // The league table, after CM 97/98: "Overall Record" over grey P W D L F A Pts boxes, a blue position box,
  // your club in yellow, cyan figures, points in a blue box, and dashed lines under the title or promotion
  // places and above the relegation places.
  function rowsHtml(rows, me) {
    const l = S.league, n = rows.length, top = l.up || 1;
    return `<div class="ltable"><table class="lt"><tr class="rec"><td colspan="2"></td><td colspan="7">Overall Record</td></tr>
      <tr class="hd"><td colspan="2"></td>${['P', 'W', 'D', 'L', 'F', 'A', 'Pts'].map(h => `<th>${h}</th>`).join('')}</tr>` +
      rows.map((r, i) => {
        const cut = i === top - 1 || (l.down && i === n - l.down - 1) ? ' cut' : '';
        return `<tr class="${r.club.n === me ? 'me' : ''}${cut}"><td class="pb"><span class="posbox">${ord(i + 1)}</span></td><td class="cl">${e(r.club.s)}</td>` +
          [r.p, r.w, r.d, r.l, r.f, r.a].map(x => `<td class="n">${x}</td>`).join('') + `<td class="pt"><span>${r.pts}</span></td></tr>`;
      }).join('') + '</table></div>';
  }

  function leagueScreen() {
    S.back = backTo(); S.view = 'league';
    screen(`<div class="cmhead navyhead"><span class="datetag2 left">After matchday ${S.md}</span><h2>${e(S.league.name)}</h2><span class="datetag2">${dayLabel(Math.max(0, S.md - 1))}</span></div>`,
      rowsHtml(table(S.league, S.results), S.club.n),
      bar(btn(S.back, 'Back', '', ' data-move="back"')), '', 'fwd');
    root.querySelector('tr.me')?.scrollIntoView({ block: 'center' });
  }

  function final() {
    S.view = 'final';
    const l = S.league, me = S.club.n, rows = table(l, S.results);
    const pos = rows.findIndex(r => r.club.n === me) + 1, my = rows[pos - 1], pred = predicted(l, S.club);
    const [tone, text] = verdict(l, pred, pos);
    S.share = `I took ${me} to ${ord(pos)} in the ${l.name} (${my.pts} pts) in Championship Manager 26/27's Quick Season`;
    S.finished = true;
    screen(header('End of Season', l.name), `
        <p class="verdict ${tone}">${e(text)}</p>
        ${rowsHtml(rows, me)}
        <p class="muted ctr">The full game plays in a desktop or laptop browser. <button class="linkish" data-go="link">Send yourself the link</button></p>`,
      bar(btn('share', 'Share') + btn('countries', 'New Club') + btn('again', 'Play Again', 'go')), '', 'fwd');
  }

  async function share(text, url, kind) {
    try {
      if (navigator.share) { await navigator.share({ text, url }); return; }
    } catch (err) { if (err.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`.trim()); alert('Copied: paste it wherever you like'); }
    catch { prompt('Copy this link', url); }
  }

  const redraw = () => (S.view === 'tactics' ? tacticsScreen : squadScreen)();
  const turn = (list, now, step) => list[(list.indexOf(now) + step + list.length) % list.length];
  root.addEventListener('click', ev => {
    const b = ev.target.closest('button, .sheet'); if (!b || b.disabled) return;
    if (b.classList.contains('sheet') && ev.target !== b) return;   // a tap inside the sheet, not on the dimmed page
    const d = b.dataset, move = d.move || 'fwd';
    if (d.country) { S.country = d.country; leagues(); }
    else if (d.league) { S.league = data.leagues.find(l => l.code === d.league); clubs(); }
    else if (d.club) selectClub(b);
    else if (d.level) { S.pickedLevel = d.level; root.querySelectorAll('[data-level]').forEach(x => x.classList.toggle('on', x === b)); root.querySelector('[data-go="begin"]').disabled = false; }
    else if (d.htoff) halftimeOff(+d.htoff);
    else if (d.hton) halftimeOn(+d.hton);
    else if (d.player) { if (S.dragged) S.dragged = false; else if (ev.target.closest('.nm')) playerScreen(+d.player); else placeSheet(+d.player); }
    else if (d.place) placeSheet(+d.place);
    else if (d.shirt) { giveShirt(S.sheetPlayer, +d.shirt); redraw(); }
    else if (d.slot) { if (S.dragged) S.dragged = false; else slotSheet(+d.slot); }
    else if (d.pick) { giveShirt(+d.pick, S.sheetSlot); redraw(); }
    else ({
      countries: () => countries(move), leagues: () => leagues(move), clubs: () => clubs(move), close: () => root.querySelector('.sheet')?.remove(),
      squad: () => squadScreen(S.view === 'tactics' ? '' : 'back'), tactics: () => tacticsScreen(),
      'formation-': () => { setFormation(turn(FORMATIONS, S.formation, -1)); tacticsScreen(); }, 'formation+': () => { setFormation(turn(FORMATIONS, S.formation, 1)); tacticsScreen(); },
      'style-': () => { S.tactic = turn(STYLES, S.tactic, -1); tacticsScreen(); }, 'style+': () => { S.tactic = turn(STYLES, S.tactic, 1); tacticsScreen(); },
      auto: () => { autoFill(); redraw(); },
      'view-': () => { S.sqView = turn(views(), S.sqView, -1); squadScreen(); }, 'view+': () => { S.sqView = turn(views(), S.sqView, 1); squadScreen(); },
      undo: () => { Object.assign(S, { shirts: [...S.undo.shirts], formation: S.undo.formation, tactic: S.undo.tactic }); redraw(); },
      pickteam: () => { S.teamMode = 'match'; snapshot(); S.sqView = 'positions'; squadScreen('fwd'); }, done: confirmScreen, yes: play, no: () => squadScreen('back'),
      start, play, final, newseason: () => S.picked && difficultyScreen(),
      begin: () => S.pickedLevel && (S.difficulty = S.pickedLevel, pickClub(S.picked)),
      result: skipToResult, halftime,
      'htstyle-': () => { S.game.tactic = turn(STYLES, S.game.tactic, -1); S.htChanges++; halftime(); }, 'htstyle+': () => { S.game.tactic = turn(STYLES, S.game.tactic, 1); S.htChanges++; halftime(); },
      newgame: () => { if (confirm('Start a new game? This season will be lost.')) { clearSave(); countries('back'); } },
      resume, fresh: () => { if (confirm('Start a new game? Your saved season will be lost.')) { clearSave(); countries(); } },
      speed: () => { S.fast = !S.fast; settings(''); }, board: boardScreen, settings: () => settings(move), credits: creditsScreen,
      fact: () => { const n = root.querySelector('.fact span'), was = n.textContent; let f; do f = fact(); while (f === was); n.textContent = f; }, hub: () => hubScreen(move), comp: () => compScreen(move),
      cont: () => S.started && S.md === S.days.length ? final() : S.started ? dayScreen(S.md, 'pre', 'fwd') : (S.teamMode = 'match', snapshot(), S.sqView = 'positions', squadScreen('fwd')),
      sqd: () => { snapshot(); S.sqView = 'positions'; squadScreen('fwd'); }, nextfx: () => dayScreen(S.md, 'browse', 'fwd'), lastres: () => dayScreen(S.md - 1, 'browse', 'fwd'),
      kickoff: () => S.whistle?.(),
      continue: () => S.sacked ? sackedScreen() : dayScreen(S.md - 1, 'post', 'fwd'),
      'day-': () => dayScreen(S.dayK - 1, S.dayMode, 'back'), 'day+': () => dayScreen(S.dayK + 1, S.dayMode, 'fwd'),
      mine: clubFixtures, backday: () => dayScreen(S.dayK, S.dayMode, 'back'), league: leagueScreen,
      again: () => { newSeason(); S.news = []; S.squad.forEach(p => { p.cond = 100; p.out = 0; p.ban = 0; p.yel = 0; p.tired = false; }); hubScreen('fwd'); },   // same club: a new season from the main screen
      faster: () => { S.fast = !S.fast; b.textContent = S.fast ? 'Normal Speed' : 'Faster'; },
      share: () => share(S.share, window.location.href, 'mobile_result_shared'),
      link: () => share('Championship Manager 26/27: play the full game in your browser', FULL_GAME, 'mobile_full_game_link'),
    })[d.go]?.();
  });

  fetch(`assets/season-data.json?v=${v}`).then(r => r.json()).then(d => { data = d; const sv = loadSave(); sv ? resumeScreen(sv) : countries(''); })
    .catch(() => { root.innerHTML = '<p class="qs-hint">Could not load the leagues. Refresh the page to try again.</p>'; });
}

}

/*
     FILE ARCHIVED ON 09:52:31 Oct 14, 2026 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 20:46:38 Oct 15, 2026.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  capture_cache.get: 0.41
  captures_list: 0.633
  exclusion.robots: 0.071
  exclusion.robots.policy: 0.059
  esindex: 0.012
  cdx.remote: 7.563
  LoadShardBlock: 79.577 (3)
  PetaboxLoader3.datanode: 61.188 (4)
  PetaboxLoader3.resolve: 68.828 (3)
  load_resource: 94.99
*/