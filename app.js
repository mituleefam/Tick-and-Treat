'use strict';

/* ---------- Defaults ---------- */
const STORAGE_KEY = 'cutie.v1';
const DAY_START_HOUR = 4; // Staying up until 3am still counts as "today"
const EMPTY_DAY_MESSAGE = '🌙 No sessions this time. Resting is a kind thing to do for yourself too. See you tomorrow!';
const FALLBACK_GIFT = '🤗 A big squishy hug from Mochi';
const FALLBACK_NOTE = '💌 You showed up today, and that counts. Mochi is cheering for you!';

const defaultSettings = () => ({
  levels: [15, 25, 45, 60, 90],
  level: 25,
  unlockHour: 21,
  sound: { on: true, volume: 60, style: 'bubble' },
  motion: 'auto',
  messages: [
    '💌 No gift yet, but you got started, and that counts. Try one more session next time!',
    '🌱 Every seed starts out tiny. A little more watering and it will grow.',
    '🍵 Just a little note: you tried, and Mochi noticed.',
  ],
  tiers: [
    { name: 'Little gift', min: 30, gifts: [
      '🍬 A favorite snack',
      '🎵 A whole album you love',
      '☕ A warm drink',
      '🛁 A long, hot bath',
      '📱 15 minutes of guilt-free scrolling',
    ] },
    { name: 'Lovely gift', min: 90, gifts: [
      '🧋 A bubble tea',
      '🎬 One episode of your show',
      '🍦 An ice cream',
      '🎮 30 minutes of gaming',
      '📖 A story before bed',
    ] },
    { name: 'Big gift', min: 180, gifts: [
      '🍕 A really good meal',
      '🍿 A whole movie',
      '🌳 An evening walk with nothing to do',
      '🎮 A whole evening of games',
    ] },
    { name: 'Giant gift', min: 300, gifts: [
      '🛍️ Something from your wishlist',
      '🍣 A fancy dinner',
      '😴 Sleep in tomorrow, no alarm',
      '💆 A massage',
    ] },
  ],
});

const CHEERS = ['Yay, you did it!', 'Another cute stamp!', 'Mochi is so proud!', 'Look at you go!', 'Have a sip of water!', 'Nice! Take a tiny break.'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------- State ---------- */
function loadState() {
  const fallback = { settings: defaultSettings(), days: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw) return fallback;
    return { settings: { ...fallback.settings, ...raw.settings }, days: raw.days || {} };
  } catch {
    return fallback;
  }
}

let state = loadState();
let storageWarned = false;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    if (!storageWarned) showToast('This browser is blocking saves, so closing the tab will lose your stamps!');
    storageWarned = true;
  }
}

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function keyOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function todayKey(now = new Date()) {
  return keyOf(new Date(now.getTime() - DAY_START_HOUR * 3600e3));
}
function dateOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function shiftKey(key, delta) {
  const d = dateOf(key);
  d.setDate(d.getDate() + delta);
  return keyOf(d);
}
const shortDate = (key) => { const d = dateOf(key); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };
const longDate = (key) => { const d = dateOf(key); return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; };
const sessionsText = (n) => `${n} session${n === 1 ? '' : 's'}`;

function fmt(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}
function fmtShort(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h${pad(r)}` : `${h}h`;
}

const dayOf = (key) => state.days[key] || { sessions: [], reveals: [] };
function ensureDay(key) {
  if (!state.days[key]) state.days[key] = { sessions: [], reveals: [] };
  return state.days[key];
}
const totalOf = (day) => day.sessions.reduce((sum, s) => sum + s.m, 0);
const tierOf = (total) => state.settings.tiers.filter((t) => t.min <= total).length;
const bestRevealed = (day) => day.reveals.reduce((best, r) => Math.max(best, r.tier), -1);

function isUnlocked(now = new Date()) {
  const elapsed = (h) => (h - DAY_START_HOUR + 24) % 24;
  return elapsed(now.getHours()) >= elapsed(state.settings.unlockHour);
}

// Past days that earned a gift nobody opened. Past days with only a note don't wait in line.
function pendingPastDays() {
  const today = todayKey();
  return Object.keys(state.days).sort().filter((key) => {
    const day = state.days[key];
    const tier = tierOf(totalOf(day));
    return key < today && tier > 0 && tier > bestRevealed(day);
  });
}

function streak() {
  const today = todayKey();
  const reached = (key) => tierOf(totalOf(dayOf(key))) >= 1;
  let key = reached(today) ? today : shiftKey(today, -1);
  let n = 0;
  while (reached(key)) { n++; key = shiftKey(key, -1); }
  return n;
}

function splitGift(text) {
  const [first, ...rest] = text.trim().split(/\s+/);
  if (rest.length && !/[\p{L}\p{N}]/u.test(first)) return { icon: first, label: rest.join(' ') };
  return { icon: '🎁', label: text.trim() };
}

/* ---------- SVG ---------- */
function giftSVG(lidOpen = false) {
  const lid = lidOpen ? '' : `
    <path class="gift-bow" d="M50 28C40 8 22 12 26 22c2 6 14 7 24 6Zm0 0c10-20 28-16 24-6-2 6-14 7-24 6Z"/>
    <rect class="gift-lid" x="10" y="28" width="80" height="20" rx="6"/>
    <rect class="gift-ribbon" x="42" y="28" width="16" height="20"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <rect class="gift-box" x="16" y="44" width="68" height="50" rx="7"/>
    <rect class="gift-ribbon" x="42" y="44" width="16" height="50"/>${lid}
  </svg>`;
}

const STAMP_PATH = (() => {
  const bumps = 10;
  const R = 41;
  const point = (i) => {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    return `${(50 + R * Math.cos(a)).toFixed(2)} ${(50 + R * Math.sin(a)).toFixed(2)}`;
  };
  let d = `M${point(0)}`;
  for (let i = 1; i <= bumps; i++) d += `A14 14 0 0 1 ${point(i)}`;
  return `${d}Z`;
})();

function stampHTML(s, isNew) {
  const time = new Date(s.t);
  const label = `${fmt(s.m)} session at ${pad(time.getHours())}:${pad(time.getMinutes())}`;
  const size = s.m >= 100 ? ' style="font-size:23px"' : '';
  return `<button class="stamp${isNew ? ' new' : ''}" data-id="${s.t}" aria-label="${label}, tap to view or remove"
      style="--r:${(s.t % 21) - 10}deg;--c:var(--s${s.t % 5})">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path class="petal" d="${STAMP_PATH}"/>
      <circle class="eye" cx="40" cy="33" r="3"/><circle class="eye" cx="60" cy="33" r="3"/>
      <path class="smile" d="M46 37c2 3 6 3 8 0"/>
      <text x="50" y="69"${size}>${s.m}</text>
    </svg>
  </button>`;
}

/* ---------- Motion: follow the device, or the choice in Settings ---------- */
const reduceMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
function motionOff() {
  const { motion } = state.settings;
  return motion === 'off' || (motion !== 'on' && reduceMotionQuery.matches);
}
function applyMotion() {
  document.documentElement.classList.toggle('calm', motionOff());
}
reduceMotionQuery.addEventListener('change', applyMotion);

/* ---------- Sound: synthesized with Web Audio, so there are no files to load ---------- */
const SOUND_STYLES = {
  bubble: { label: 'Bubble', wave: 'sine', pitch: 1, decay: 0.16, rise: 0.6 },
  marimba: { label: 'Marimba', wave: 'triangle', pitch: 0.75, decay: 0.26, rise: 1 },
  chime: { label: 'Chime', wave: 'sine', pitch: 2, decay: 0.55, rise: 1 },
};

// Notes are [frequency in Hz, start time in seconds, optional loudness]. `thump` adds a soft low hit.
const SOUNDS = {
  tap: { level: 0.35, length: 0.6, notes: [[660, 0]] },
  stamp: { level: 0.7, length: 1.6, thump: true, notes: [[587, 0], [784, 0.06], [1175, 0.13], [2349, 0.18, 0.3]] },
  tier: { level: 0.62, length: 2, thump: true, notes: [[523, 0], [659, 0.08], [784, 0.16], [1047, 0.24], [1319, 0.32], [1047, 0.32, 0.7], [2093, 0.4, 0.35]] },
  undo: { level: 0.5, length: 0.8, notes: [[587, 0], [440, 0.08]] },
  shake1: { level: 0.6, length: 0.8, notes: [[392, 0]] },
  shake2: { level: 0.6, length: 0.8, notes: [[494, 0]] },
  reveal: { level: 0.5, length: 2.6, thump: true, notes: [[392, 0], [523, 0.1], [659, 0.2], [784, 0.3], [1047, 0.42], [1319, 0.42, 0.8], [1568, 0.42, 0.8], [2093, 0.56, 0.4], [2637, 0.64, 0.3]] },
  letter: { level: 0.6, length: 1.2, notes: [[659, 0], [523, 0.14]] },
};

function scheduleSound(ctx, name, { volume, style }) {
  const look = SOUND_STYLES[style] || SOUND_STYLES.bubble;
  const sound = SOUNDS[name];
  const peak = (volume / 100) ** 2 * sound.level;
  const start = ctx.currentTime;
  // Keeps stacked notes from distorting at high volume.
  const output = ctx.createDynamicsCompressor();
  output.connect(ctx.destination);

  if (sound.thump) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(200, start);
    osc.frequency.exponentialRampToValueAtTime(70, start + 0.09);
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
    osc.connect(gain).connect(output);
    osc.start(start);
    osc.stop(start + 0.15);
  }

  for (const [freq, delay, loudness = 1] of sound.notes) {
    const at = start + delay;
    const end = at + look.decay * sound.length;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = look.wave;
    osc.frequency.setValueAtTime(freq * look.pitch * look.rise, at);
    osc.frequency.exponentialRampToValueAtTime(freq * look.pitch, at + 0.05);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * loudness, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(output);
    osc.start(at);
    osc.stop(end + 0.02);
  }
}

let audioCtx = null;
function playSound(name) {
  const { sound } = state.settings;
  if (!sound.on || !sound.volume) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    scheduleSound(audioCtx, name, sound);
  } catch {
    // A missing sound should never get in the way of the app.
  }
}

/* ---------- Render: Today ---------- */
let sayTimer = 0;
let saying = '';

function idleLine(total, tier, count) {
  if (!count) return 'Focus for a while, then tap Finished to earn a stamp!';
  const next = state.settings.tiers[tier];
  if (!next) return 'Every milestone reached! You are the best!';
  const left = next.min - total;
  if (left <= 30) return `Almost at ${next.name}, just ${fmt(left)} to go!`;
  if (count === 1) return `You started! ${fmt(left)} to ${next.name}, nice and easy.`;
  if (tier) return `${state.settings.tiers[tier - 1].name} is in the bag! Next up: ${next.name}.`;
  return `${count} stamps already! ${fmt(left)} more to ${next.name}.`;
}

function say(text) {
  saying = text;
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => { saying = ''; renderHero(); }, 4000);
}

function renderHero() {
  const key = todayKey();
  const day = dayOf(key);
  const total = totalOf(day);
  const tier = tierOf(total);
  const count = day.sessions.length;
  const tiers = state.settings.tiers;

  const shown = dateOf(key);
  $('#date').setAttribute('aria-label', longDate(key));
  $('#date').innerHTML = `<span class="cal-month">${MONTHS[shown.getMonth()].slice(0, 3)}</span>
    <span class="cal-day">${shown.getDate()}</span>
    <span class="cal-week">${WEEKDAYS[shown.getDay()].slice(0, 3)}</span>`;
  const days = streak();
  $('#streak').hidden = days < 2;
  $('#streak').textContent = `🔥 ${days} day streak`;

  $('#total').textContent = fmt(total);
  $('#count').textContent = count ? `${sessionsText(count)} today` : 'today';

  const mochi = $('#mochi');
  mochi.dataset.tier = tier;
  if (!mochi.classList.contains('hop')) {
    mochi.dataset.mood = !count ? 'sleepy' : tier >= 3 ? 'happy' : 'awake';
  }
  $('#bubble').textContent = saying || idleLine(total, tier, count);

  const prev = tier ? tiers[tier - 1].min : 0;
  const next = tiers[tier];
  const pct = next ? ((tier + (total - prev) / (next.min - prev)) / tiers.length) * 100 : 100;
  $('#track').innerHTML = `
    <div class="track-fill" style="width:${pct}%"></div>
    ${tiers.map((t, i) => `
      <div class="node t${i + 1}${i < tier ? ' reached' : ''}" data-node="${i}" style="left:${((i + 1) / tiers.length) * 100}%">
        ${giftSVG()}<span>${fmtShort(t.min)}</span>
      </div>`).join('')}`;
  $('#trackNote').textContent = next
    ? `${fmt(next.min - total)} more to ${next.name}`
    : `You reached ${tiers[tiers.length - 1].name}!`;
}

function renderAction() {
  const { levels, level } = state.settings;
  $('#levels').innerHTML = levels.map((m) =>
    `<button class="chip" data-level="${m}" aria-pressed="${m === level}" aria-label="${fmt(m)}">${fmtShort(m)}</button>`
  ).join('') + '<button class="chip" id="customLevel">Other</button>';
  $('#addBtn').textContent = `✓ Finished ${fmt(level)}`;
  markChipOverflow();
}

// Fades the right edge when there are more chips than fit, so the row looks scrollable.
function markChipOverflow() {
  const row = $('#levels');
  const hiddenRight = row.scrollWidth - row.clientWidth - row.scrollLeft > 2;
  row.classList.toggle('more', hiddenRight);
}

function renderStamps(newId) {
  const sessions = dayOf(todayKey()).sessions;
  const perRow = window.innerWidth >= 860 ? 6 : 4;
  const slots = Math.max(perRow * 2, Math.ceil((sessions.length + 1) / perRow) * perRow);
  let html = sessions.map((s) => stampHTML(s, s.t === newId)).join('');
  for (let i = sessions.length; i < slots; i++) {
    html += i === sessions.length
      ? `<button class="slot next" data-add aria-label="Add a ${fmt(state.settings.level)} session"></button>`
      : '<div class="slot" aria-hidden="true"></div>';
  }
  $('#stamps').innerHTML = html;
  const today = dayOf(todayKey());
  $('#clearToday').hidden = !sessions.length && !today.reveals.length;
}

function renderGift() {
  const el = $('#gift');
  const card = (cls, iconHTML, title, sub, buttons) => {
    el.className = `card gift-card ${cls}`;
    el.innerHTML = `<div class="icon">${iconHTML}</div>
      <div class="txt"><h2>${title}</h2><p>${sub}</p>${buttons}</div>`;
  };

  const { tiers, unlockHour } = state.settings;
  const giftName = (tier) => esc(tiers[tier - 1].name);
  const noteIcon = '<div class="emoji icon" aria-hidden="true">💌</div>';
  const openAt = `${pad(unlockHour)}:00`;

  const pending = pendingPastDays();
  if (pending.length) {
    const key = pending[0];
    const day = dayOf(key);
    const tier = tierOf(totalOf(day));
    const more = pending.length > 1 ? ` · ${pending.length - 1} more waiting` : '';
    card(`ready t${tier}`, giftSVG(), `Your ${giftName(tier)} from ${shortDate(key)} is unopened!`,
      `${fmt(totalOf(day))} · ${sessionsText(day.sessions.length)}${more}`,
      `<button class="btn" data-open="${key}">Open gift</button>`);
    return;
  }

  const key = todayKey();
  const day = dayOf(key);
  const total = totalOf(day);
  const tier = tierOf(total);
  const best = bestRevealed(day);
  const last = day.reveals[day.reveals.length - 1];
  const upgrade = best >= 0 && tier > best;
  const summary = `Today: ${fmt(total)} · ${sessionsText(day.sessions.length)}`;

  if (upgrade) {
    card(`ready t${tier}`, giftSVG(), `${giftName(tier)} unlocked!`,
      best > 0 ? 'You kept going, so there is another gift to open.' : 'You kept going, so now there is a real gift to open.',
      `<button class="btn" data-open="${key}">Open gift</button>`);
    return;
  }

  if (best < 0) {
    if (tier && isUnlocked()) {
      card(`ready t${tier}`, giftSVG(), `Your ${giftName(tier)} is ready!`, summary,
        `<button class="btn" data-open="${key}">Open gift</button>`);
    } else if (tier) {
      card(`locked t${tier}`, giftSVG(), `${giftName(tier)} unlocked!`, `It opens at ${openAt}. What is inside is a secret.`,
        `<button class="btn-ghost" data-open="${key}">Done early? Open it now</button>`);
    } else if (isUnlocked()) {
      card('ready', noteIcon, 'No gift today',
        total ? `${fmt(total)} is not enough for a gift yet, so Mochi left you a note instead.` : 'No sessions today, so Mochi left you a note instead.',
        `<button class="btn" data-open="${key}">Read note</button>`);
    } else {
      card('locked t0', giftSVG(), 'No gift unlocked yet',
        `Focus ${fmt(tiers[0].min - total)} more to unlock a ${giftName(1)}. Gifts open at ${openAt}.`,
        total ? `<button class="btn-ghost" data-open="${key}">Done for today? Read Mochi's note</button>` : '');
    }
    return;
  }

  const shown = splitGift(last.text);
  const next = tiers[tier];
  if (last.tier > 0) {
    card(`opened t${last.tier}`, `<div class="emoji icon" aria-hidden="true">${esc(shown.icon)}</div>`, esc(shown.label),
      next ? `${fmt(next.min - total)} more to unlock a ${esc(next.name)}.` : 'The best gift of the day!', '');
  } else {
    card('opened', `<div class="emoji icon" aria-hidden="true">${esc(shown.icon)}</div>`, 'A note from Mochi',
      `${esc(shown.label)} Focus ${fmt(next.min - total)} more and a ${esc(next.name)} unlocks.`, '');
  }
}

function renderToday(newId) {
  applyMotion();
  renderHero();
  renderAction();
  renderStamps(newId);
  renderGift();
}

/* ---------- Session actions ---------- */
function addSession() {
  const key = todayKey();
  const day = ensureDay(key);
  const before = tierOf(totalOf(day));
  const m = state.settings.level;
  const session = { m, t: Date.now() };
  day.sessions.push(session);
  save();

  const after = tierOf(totalOf(day));
  say(after > before ? `${state.settings.tiers[after - 1].name} unlocked! Save it for tonight.` : pick(CHEERS));
  renderToday(session.t);
  hopMochi();
  playSound(after > before ? 'tier' : 'stamp');
  bumpTotal();
  if (after === before) stampBurst();
  if (after > before) {
    $(`[data-node="${after - 1}"]`).classList.add('pop');
    confetti(document.body);
  }

  showToast(`Added a ${fmt(m)} session`, 'Undo', () => removeSession(key, session.t));
}

function removeSession(key, id, offerUndo = false) {
  const day = dayOf(key);
  const index = day.sessions.findIndex((s) => s.t === id);
  if (index < 0) return;
  const [removed] = day.sessions.splice(index, 1);
  save();
  renderToday();
  if (offerUndo) {
    showToast(`Removed a ${fmt(removed.m)} stamp`, 'Undo', () => {
      ensureDay(key).sessions.splice(index, 0, removed);
      save();
      renderToday();
    });
  }
}

function clearToday() {
  const key = todayKey();
  const snapshot = state.days[key];
  const count = snapshot.sessions.length;
  delete state.days[key];
  save();
  renderToday();
  showToast(count ? `Cleared ${count} stamp${count === 1 ? '' : 's'}` : 'Cleared today', 'Undo', () => {
    state.days[key] = snapshot;
    save();
    renderToday();
  }, 10000);
}

function bumpTotal() {
  const total = $('#total');
  total.classList.remove('bump');
  void total.offsetWidth;
  total.classList.add('bump');
}

function stampBurst() {
  const stamp = $('.stamp.new');
  if (!stamp || motionOff()) return;
  const layer = document.createElement('span');
  layer.className = 'stamp-burst';
  const colors = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--primary)'];
  for (let i = 0; i < 10; i++) {
    const bit = document.createElement('i');
    const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 42 + Math.random() * 26;
    bit.style.setProperty('--c', pick(colors));
    bit.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
    bit.style.setProperty('--y', `${Math.sin(angle) * dist}px`);
    bit.style.setProperty('--a', `${Math.random() * 360}deg`);
    layer.append(bit);
  }
  stamp.append(layer);
  setTimeout(() => layer.remove(), 700);
}

function hopMochi() {
  const mochi = $('#mochi');
  mochi.classList.remove('hop');
  void mochi.offsetWidth;
  mochi.dataset.mood = 'happy';
  mochi.classList.add('hop');
  setTimeout(() => { mochi.classList.remove('hop'); renderHero(); }, 1200);
}

function addLevel(raw) {
  const m = Math.round(Number(raw));
  if (m >= 1 && m <= 600) {
    const { settings } = state;
    if (!settings.levels.includes(m)) settings.levels = [...settings.levels, m].sort((a, b) => a - b);
    settings.level = m;
    save();
  }
  renderAction();
  renderStamps();
}

function openCustomLevel(button) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = 1;
  input.max = 600;
  input.placeholder = 'min';
  input.className = 'chip chip-input';
  input.setAttribute('aria-label', 'Custom minutes');
  let done = false;
  const finish = (value) => { if (!done) { done = true; addLevel(value); } };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(input.value);
    if (e.key === 'Escape') finish('');
  });
  input.addEventListener('blur', () => finish(input.value));
  button.replaceWith(input);
  input.focus();
}

/* ---------- Toast ---------- */
let toastTimer = 0;
function showToast(msg, actLabel, act, duration = 5000) {
  const box = $('#toast');
  const btn = $('#toastAct');
  $('#toastMsg').textContent = msg;
  btn.hidden = !actLabel;
  btn.textContent = actLabel || '';
  btn.onclick = () => { box.hidden = true; act(); };
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, duration);
}

/* ---------- Confetti ---------- */
function confetti(host) {
  if (motionOff()) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  const colors = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--primary)'];
  for (let i = 0; i < 36; i++) {
    const bit = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 240;
    bit.style.setProperty('--c', pick(colors));
    bit.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
    bit.style.setProperty('--y', `${Math.sin(angle) * dist + 80}px`);
    bit.style.setProperty('--a', `${Math.random() * 720 - 360}deg`);
    layer.append(bit);
  }
  host.append(layer);
  setTimeout(() => layer.remove(), 1300);
}

/* ---------- Gift reveal ---------- */
// Placed after the main button so that button still gets focus when the dialog opens.
const REVEAL_CLOSE = '<button class="reveal-x" data-close aria-label="Close">&times;</button>';

function rollReveal(tier, total) {
  const { settings } = state;
  if (!total) return EMPTY_DAY_MESSAGE;
  const pool = tier ? settings.tiers[tier - 1].gifts : settings.messages;
  if (!pool.length) return tier ? FALLBACK_GIFT : FALLBACK_NOTE;
  const recent = Object.keys(state.days).sort().slice(-5)
    .flatMap((k) => state.days[k].reveals.map((r) => r.text));
  const fresh = pool.filter((text) => !recent.includes(text));
  return pick(fresh.length ? fresh : pool);
}

function startReveal(key) {
  const dlg = $('#reveal');
  const day = dayOf(key);
  const total = totalOf(day);
  const tier = tierOf(total);
  let taps = 0;

  if (!tier) {
    dlg.innerHTML = '';
    dlg.showModal();
    finishReveal(key, 0, total);
    return;
  }

  dlg.innerHTML = `
    <p class="eyebrow">${esc(longDate(key))}</p>
    <h2>${total ? `${fmt(total)} of focus` : 'A gentle day'}</h2>
    <button class="reveal-box t${tier}" aria-label="Tap to open the gift box">${giftSVG()}</button>
    <p class="hint">Tap 3 times to open</p>
    ${REVEAL_CLOSE}`;
  dlg.showModal();

  const box = dlg.querySelector('.reveal-box');
  const hint = dlg.querySelector('.hint');
  box.addEventListener('click', () => {
    taps++;
    if (taps >= 3) { finishReveal(key, tier, total); return; }
    box.classList.remove('shake1', 'shake2');
    void box.offsetWidth;
    box.classList.add(`shake${taps}`);
    playSound(`shake${taps}`);
    hint.textContent = taps === 1 ? 'Ooh, something moved…' : 'One more tap!';
  });
}

function finishReveal(key, tier, total) {
  const dlg = $('#reveal');
  const text = rollReveal(tier, total);
  ensureDay(key).reveals.push({ tier, text, t: Date.now() });
  save();

  const { icon, label } = splitGift(text);
  dlg.innerHTML = tier
    ? `<p class="eyebrow">Inside your ${esc(state.settings.tiers[tier - 1].name)}…</p>
       <div class="prize" aria-hidden="true">${esc(icon)}</div>
       <p class="prize-text">${esc(label)}</p>
       <button class="btn" data-close>Put it on the shelf</button>
       ${REVEAL_CLOSE}`
    : `<p class="eyebrow">A note from Mochi</p>
       <div class="prize" aria-hidden="true">${esc(icon)}</div>
       <p class="letter">${esc(label)}</p>
       <button class="btn" data-close>Thanks, Mochi</button>
       ${REVEAL_CLOSE}`;
  if (tier) confetti(dlg);
  playSound(tier ? 'reveal' : 'letter');
  renderToday();
}

/* ---------- Render: Gift shelf ---------- */
function renderShelf() {
  const today = todayKey();
  const keys = Object.keys(state.days).sort().reverse()
    .filter((k) => state.days[k].sessions.length || state.days[k].reveals.length);

  let week = 0;
  for (let i = 0; i < 7; i++) week += totalOf(dayOf(shiftKey(today, -i)));
  const gifts = keys.reduce((n, k) => n + state.days[k].reveals.filter((r) => r.tier > 0).length, 0);

  const rows = keys.map((key) => {
    const day = state.days[key];
    const total = totalOf(day);
    const meta = `${esc(longDate(key))} · ${fmt(total)}`;
    const opened = day.reveals.filter((r) => r.tier > 0);
    if (opened.length) {
      return opened.map((r) => {
        const { icon, label } = splitGift(r.text);
        return `<li class="entry"><div class="emoji" aria-hidden="true">${esc(icon)}</div>
          <div class="txt"><b>${esc(label)}</b><small>${meta}</small></div></li>`;
      }).reverse().join('');
    }
    const note = day.reveals[0];
    const tier = tierOf(total);
    const waiting = tier
      ? { icon: '🎁', label: `${state.settings.tiers[tier - 1].name} waiting to be opened` }
      : key === today ? { icon: '⏳', label: 'Still collecting stamps' } : { icon: '🌙', label: 'No gift that day' };
    const { icon, label } = note ? splitGift(note.text) : waiting;
    return `<li class="entry"><div class="emoji" aria-hidden="true">${esc(icon)}</div>
      <div class="txt"><b>${esc(label)}</b><small>${meta}</small></div></li>`;
  }).join('');

  $('#view-shelf').innerHTML = `
    <div class="stats">
      <div class="stat"><strong>${fmtShort(week)}</strong><span>last 7 days</span></div>
      <div class="stat"><strong>${streak()}</strong><span>day streak</span></div>
      <div class="stat"><strong>${gifts}</strong><span>${gifts === 1 ? 'gift' : 'gifts'}</span></div>
    </div>
    ${rows ? `<ul class="history">${rows}</ul>` : '<div class="card empty">The shelf is empty for now. Collect some stamps today and your first gift lands here tonight!</div>'}`;
}

/* ---------- Render: Settings ---------- */
function renderSettings() {
  const { settings } = state;
  const hours = [];
  for (let h = 12; h <= 23; h++) hours.push(h);
  $('#view-settings').innerHTML = `
    <div class="settings">
      <section class="card">
        <h2>Focus sessions</h2>
        <label for="setLevels">Session lengths (minutes)</label>
        <input class="field" id="setLevels" inputmode="numeric" value="${settings.levels.join(', ')}">
        <p class="help">Separate with commas, for example: 15, 25, 45.</p>
      </section>

      <section class="card">
        <h2>Gift time</h2>
        <label for="setHour">The gift box opens at</label>
        <select class="field" id="setHour">
          ${hours.map((h) => `<option value="${h}"${h === settings.unlockHour ? ' selected' : ''}>${pad(h)}:00</option>`).join('')}
        </select>
        <p class="help">A new day starts at ${pad(DAY_START_HOUR)}:00, so late nights still count as today.</p>
      </section>

      <section class="card">
        <h2>Gift milestones</h2>
        <p class="help">You get a random gift from the highest milestone your daily total reaches.</p>
        ${settings.tiers.map((t, i) => `
          <div class="tier-edit" style="margin-top:12px">
            <div class="tier-row">
              <div><label for="tierName${i}">Milestone ${i + 1} name</label><input class="field" id="tierName${i}" data-tier-name="${i}" value="${esc(t.name)}"></div>
              <div><label for="tierMin${i}">From (min)</label><input class="field" id="tierMin${i}" type="number" min="1" data-tier-min="${i}" value="${t.min}"></div>
            </div>
            <details>
              <summary>Gift list (peeking spoils the surprise 🙈)</summary>
              <label class="help" for="tierGifts${i}">One gift per line. A leading emoji becomes its picture.</label>
              <textarea class="field" id="tierGifts${i}" data-tier-gifts="${i}">${esc(t.gifts.join('\n'))}</textarea>
            </details>
          </div>`).join('')}
      </section>

      <section class="card">
        <h2>Notes when no milestone is reached</h2>
        <details>
          <summary>View and edit notes</summary>
          <label class="help" for="setMessages">One note per line.</label>
          <textarea class="field" id="setMessages">${esc(settings.messages.join('\n'))}</textarea>
        </details>
      </section>

      <section class="card">
        <h2>Animations</h2>
        <label for="setMotion">Show animations</label>
        <select class="field" id="setMotion">
          ${[['auto', 'Follow my device'], ['on', 'Always on'], ['off', 'Off']].map(([id, label]) =>
            `<option value="${id}"${id === settings.motion ? ' selected' : ''}>${label}</option>`).join('')}
        </select>
        <p class="help">${reduceMotionQuery.matches
          ? 'Your device asks apps to reduce motion, so "Follow my device" turns animations off. Pick "Always on" to see them.'
          : 'Stamps landing, Mochi hopping, gift boxes shaking and confetti.'}</p>
      </section>

      <section class="card">
        <h2>Sound</h2>
        <label class="check" for="setSoundOn">
          <input type="checkbox" id="setSoundOn" data-sound${settings.sound.on ? ' checked' : ''}>
          Play sounds when I click
        </label>
        <div class="tier-row sound-row">
          <div>
            <label for="setVolume">Volume</label>
            <input class="range" id="setVolume" data-sound type="range" min="0" max="100" step="5" value="${settings.sound.volume}"${settings.sound.on ? '' : ' disabled'}>
          </div>
          <div>
            <label for="setStyle">Style</label>
            <select class="field" id="setStyle" data-sound${settings.sound.on ? '' : ' disabled'}>
              ${Object.entries(SOUND_STYLES).map(([id, look]) => `<option value="${id}"${id === settings.sound.style ? ' selected' : ''}>${look.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <p class="help" style="margin-bottom:8px">Tap to hear each sound:</p>
        <div class="row-btns">
          ${[['stamp', 'Stamp'], ['tier', 'Milestone'], ['reveal', 'Gift'], ['letter', 'Note']].map(([id, label]) =>
            `<button class="btn-plain" data-try="${id}"${settings.sound.on ? '' : ' disabled'}>${label}</button>`).join('')}
        </div>
      </section>

      <section class="card">
        <h2>Data</h2>
        <p class="help" style="margin-bottom:10px">Everything is stored only in this browser.</p>
        <div class="row-btns">
          <button class="btn-plain" id="resetSettings">Restore default settings</button>
          <button class="btn-plain" id="wipeData">Delete all history</button>
        </div>
      </section>
    </div>`;
}

const toLines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);

function onSettingsChange(e) {
  const { settings } = state;
  const el = e.target;
  const { tierName, tierMin, tierGifts } = el.dataset;

  if (el.id === 'setLevels') {
    const levels = [...new Set((el.value.match(/\d+/g) || []).map(Number))]
      .filter((m) => m >= 1 && m <= 600).sort((a, b) => a - b);
    if (levels.length) {
      settings.levels = levels;
      if (!levels.includes(settings.level)) settings.level = levels[0];
    }
    el.value = settings.levels.join(', ');
  } else if (el.id === 'setHour') {
    settings.unlockHour = Number(el.value);
  } else if (el.id === 'setMessages') {
    settings.messages = toLines(el.value);
  } else if (el.id === 'setMotion') {
    settings.motion = el.value;
  } else if (el.dataset.sound !== undefined) {
    const on = $('#setSoundOn').checked;
    settings.sound = { on, volume: Number($('#setVolume').value), style: $('#setStyle').value };
    $('#setVolume').disabled = !on;
    $('#setStyle').disabled = !on;
    document.querySelectorAll('[data-try]').forEach((btn) => { btn.disabled = !on; });
    playSound('stamp');
  } else if (tierName !== undefined) {
    settings.tiers[tierName].name = el.value.trim() || settings.tiers[tierName].name;
    el.value = settings.tiers[tierName].name;
  } else if (tierGifts !== undefined) {
    settings.tiers[tierGifts].gifts = toLines(el.value);
  } else if (tierMin !== undefined) {
    const min = Math.round(Number(el.value));
    const tier = settings.tiers[tierMin];
    const taken = settings.tiers.some((t) => t.min === min && t !== tier);
    if (min >= 1 && !taken) {
      tier.min = min;
      const before = settings.tiers.slice();
      settings.tiers.sort((a, b) => a.min - b.min);
      // Only redraw when the milestones swapped places, so typing and tabbing keeps its focus.
      if (settings.tiers.some((t, i) => t !== before[i])) {
        renderSettings();
        showToast('Milestones re-sorted from smallest to biggest');
      }
    } else {
      el.value = tier.min;
      showToast(taken ? 'Another milestone already uses that number' : 'Milestones need at least 1 minute');
    }
  } else {
    return;
  }
  save();
  renderToday();
}

/* ---------- Navigation + events ---------- */
function showTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => {
    if (tab.dataset.tab === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  $('#view-today').hidden = name !== 'today';
  $('#view-shelf').hidden = name !== 'shelf';
  $('#view-settings').hidden = name !== 'settings';
  document.body.classList.toggle('on-today', name === 'today');
  $('#toast').hidden = true;
  if (name === 'shelf') renderShelf();
  if (name === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) showTab(tab.dataset.tab);
});

$('#addBtn').addEventListener('click', addSession);

// Everyday click sound. The add button and gift box play their own richer sounds.
document.addEventListener('click', (e) => {
  const el = e.target.closest('button, summary');
  if (!el || el.matches('#addBtn, [data-add], .reveal-box, [data-try]')) return;
  playSound(el.matches('#toastAct, #clearToday') ? 'undo' : 'tap');
});

$('#levels').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-level]');
  if (chip) {
    state.settings.level = Number(chip.dataset.level);
    save();
    renderAction();
    renderStamps();
  } else if (e.target.id === 'customLevel') {
    openCustomLevel(e.target);
  }
});

$('#clearToday').addEventListener('click', clearToday);

$('#stamps').addEventListener('click', (e) => {
  if (e.target.closest('[data-add]')) { addSession(); return; }
  const stamp = e.target.closest('.stamp');
  if (!stamp) return;
  const key = todayKey();
  const id = Number(stamp.dataset.id);
  const session = dayOf(key).sessions.find((s) => s.t === id);
  if (!session) return;
  const time = new Date(id);
  showToast(`${fmt(session.m)} stamp from ${pad(time.getHours())}:${pad(time.getMinutes())}`, 'Remove', () => removeSession(key, id, true));
});

$('#gift').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open]');
  if (btn) startReveal(btn.dataset.open);
});

$('#reveal').addEventListener('click', (e) => {
  const dlg = $('#reveal');
  const box = dlg.getBoundingClientRect();
  const outside = e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
  if (e.target.closest('[data-close]') || (e.target === dlg && outside)) dlg.close();
});

$('#view-settings').addEventListener('change', onSettingsChange);
$('#view-settings').addEventListener('click', (e) => {
  const preview = e.target.closest('[data-try]');
  if (preview) { playSound(preview.dataset.try); return; }
  if (e.target.id === 'resetSettings' && confirm('Reset session lengths, milestones and gift lists to the defaults?')) {
    state.settings = defaultSettings();
  } else if (e.target.id === 'wipeData' && confirm('Delete all stamps and opened gifts from every day? Your settings stay. This cannot be undone.')) {
    state.days = {};
  } else {
    return;
  }
  save();
  renderSettings();
  renderToday();
});

/* Catch a new day or gift time while the tab stays open */
let lastTick = `${todayKey()}|${isUnlocked()}`;
function tick() {
  const current = `${todayKey()}|${isUnlocked()}`;
  if (current !== lastTick) { lastTick = current; renderToday(); }
}
setInterval(tick, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) { state = loadState(); renderToday(); }
});

let lastPerRow = window.innerWidth >= 860;
window.addEventListener('resize', () => {
  markChipOverflow();
  const wide = window.innerWidth >= 860;
  if (wide !== lastPerRow) { lastPerRow = wide; renderStamps(); }
});
$('#levels').addEventListener('scroll', markChipOverflow, { passive: true });

document.body.classList.add('on-today');
renderToday();
// Web fonts change chip widths once they load.
document.fonts?.ready.then(markChipOverflow);
