// --- DOM refs ---
const eventSelect     = document.getElementById('event');
const athleteSelect   = document.getElementById('athlete');
const playerNameInput = document.getElementById('playerName');
const windToggle      = document.getElementById('windToggle');
const throwBtn        = document.getElementById('throwBtn');
const newRoundBtn     = document.getElementById('newRoundBtn');
const resetBtn        = document.getElementById('resetBtn');

const eventDescription = document.getElementById('eventDescription');
const lastThrow        = document.getElementById('lastThrow');
const bestThrow        = document.getElementById('bestThrow');
const attemptsEl       = document.getElementById('attempts');
const roundAttemptEl   = document.getElementById('roundAttempt');
const windEl           = document.getElementById('wind');
const statusEl         = document.getElementById('status');
const historyEl        = document.getElementById('history');
const rankingEl        = document.getElementById('ranking');
const recordsList      = document.getElementById('records');
const lbTabs           = document.getElementById('lbTabs');
const leaderboardEl    = document.getElementById('leaderboard');
const throwAnimEl      = document.getElementById('throwAnim');

// Timing meter DOM refs
const angleMeterGroup = document.getElementById('angleMeterGroup');
const angleMeter      = document.getElementById('angleMeter');
const angleCursor     = document.getElementById('angleCursor');
const angleSweetZone  = document.getElementById('angleSweetZone');
const angleMeterVal   = document.getElementById('angleMeterVal');
const idealAngleHint  = document.getElementById('idealAngleHint');
const anglePrecBadge  = document.getElementById('anglePrecBadge');

const powerMeterGroup = document.getElementById('powerMeterGroup');
const powerMeter      = document.getElementById('powerMeter');
const powerCursor     = document.getElementById('powerCursor');
const powerSweetZone  = document.getElementById('powerSweetZone');
const powerMeterVal   = document.getElementById('powerMeterVal');
const powerPrecBadge  = document.getElementById('powerPrecBadge');

const phaseAngleStep = document.getElementById('phaseAngleStep');
const phasePowerStep = document.getElementById('phasePowerStep');
const phaseThrowStep = document.getElementById('phaseThrowStep');

// --- Constants ---
const RECORDS_KEY     = 'throwers-game-records-v1';
const LEADERBOARD_KEY = 'throwers-game-lb-v1';
const MAX_ROUND       = 6;
const LB_MAX          = 10;
const POWER_SWEET_MIN = 82;
const POWER_SWEET_MAX = 94;
const POWER_MIN       = 40;
const POWER_MAX       = 100;

// --- Event & athlete profiles ---
const EVENT_PROFILES = {
  discus: {
    name: 'Discus',
    emoji: '🥏',
    baseVelocity: 26,
    idealAngle: 37,
    anglePenalty: 0.03,
    variability: 2.8,
    foulAngleRange: [26, 47],
    description: 'Discus rewards smooth technique and a medium release angle.',
    // cursor speed in units per animation frame (~60fps)
    speeds: { angle: 0.28, power: 0.44 }
  },
  shotPut: {
    name: 'Shot Put',
    emoji: '⚫',
    baseVelocity: 17,
    idealAngle: 39,
    anglePenalty: 0.04,
    variability: 1.9,
    foulAngleRange: [30, 49],
    description: 'Shot put favors raw force and compact, explosive form.',
    speeds: { angle: 0.20, power: 0.32 }
  },
  hammer: {
    name: 'Hammer Throw',
    emoji: '🔨',
    baseVelocity: 29,
    idealAngle: 43,
    anglePenalty: 0.025,
    variability: 3.2,
    foulAngleRange: [31, 50],
    description: 'Hammer throw has the highest potential but demands fast reflexes.',
    speeds: { angle: 0.52, power: 0.70 }
  },
  javelin: {
    name: 'Javelin',
    emoji: '🏹',
    baseVelocity: 31,
    idealAngle: 34,
    anglePenalty: 0.02,
    variability: 2.4,
    foulAngleRange: [22, 43],
    description: 'Javelin rewards precise release with efficient aerodynamics.',
    speeds: { angle: 0.36, power: 0.52 }
  }
};

const ATHLETE_PROFILES = {
  balanced:  { velocityBoost: 1,    control: 1,    label: 'Balanced' },
  power:     { velocityBoost: 1.08, control: 0.88, label: 'Power Specialist' },
  technique: { velocityBoost: 0.94, control: 1.15, label: 'Technique Specialist' }
};

// --- App state ---
const state = {
  attempts: 0,
  roundAttempt: 0,
  best: 0,
  log: [],
  roundDistances: [],
  wind: 0,
  records: loadRecords(),
  leaderboard: loadLeaderboard(),
  activeLbEvent: 'discus'
};

// --- Timing game state ---
const timing = {
  phase: 'idle', // 'idle' | 'angle' | 'power'
  angle: { current: 35, dir: 1 },
  power: { current: POWER_MIN, dir: 1 },
  lockedAngle: null,
  lockedPower: null,
  animFrame: null
};

// --- Persistence ---
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) ?? {}; }
  catch { return {}; }
}

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(state.records));
}

function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) ?? {}; }
  catch { return {}; }
}

function saveLeaderboard() {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(state.leaderboard));
}

// --- Audio (Web Audio API) ---
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', gain = 0.25) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);
    vol.gain.setValueAtTime(gain, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* audio blocked – silent fail */ }
}

function soundLock() {
  playTone(1200, 0.06, 'square', 0.10);
}

function soundLockPerfect() {
  playTone(880, 0.05, 'sine', 0.14);
  setTimeout(() => playTone(1320, 0.08, 'sine', 0.12), 55);
}

function soundThrow() {
  playTone(220, 0.18, 'sawtooth', 0.2);
  setTimeout(() => playTone(330, 0.25, 'sine', 0.15), 80);
}

function soundRecord() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 'sine', 0.2), i * 80));
}

function soundFoul() {
  playTone(180, 0.35, 'square', 0.18);
  setTimeout(() => playTone(140, 0.3, 'square', 0.15), 150);
}

// --- Throw animation overlay ---
function animateThrow(foul, isRecord) {
  throwAnimEl.classList.remove('animate', 'animate-foul');
  void throwAnimEl.offsetWidth;
  if (foul) {
    throwAnimEl.textContent = '❌';
    throwAnimEl.classList.add('animate-foul');
  } else if (isRecord) {
    throwAnimEl.textContent = '🏆';
    throwAnimEl.classList.add('animate');
  } else {
    throwAnimEl.textContent = EVENT_PROFILES[eventSelect.value].emoji;
    throwAnimEl.classList.add('animate');
  }
}

// --- Physics ---
const toRadians = (deg) => (deg * Math.PI) / 180;

function isFoul(event, angleDegrees, powerPercent, athlete) {
  const [min, max] = event.foulAngleRange;
  return angleDegrees < min || angleDegrees > max || (powerPercent > 96 && athlete.control < 0.95);
}

function calculateThrow(eventKey, athleteKey, power, angle) {
  const event   = EVENT_PROFILES[eventKey];
  const athlete = ATHLETE_PROFILES[athleteKey];

  if (isFoul(event, angle, power, athlete)) return { foul: true, distance: 0 };

  const windBoost       = 1 + state.wind * 0.015;
  const releaseVelocity = event.baseVelocity * (power / 100) * athlete.velocityBoost * windBoost;
  const angleOffset     = Math.abs(angle - event.idealAngle);
  const angleEfficiency = Math.max(0.76, 1 - angleOffset * event.anglePenalty * athlete.control);
  const randomTerm      = (Math.random() - 0.5) * event.variability * (2 - athlete.control);
  const raw             = (releaseVelocity ** 2 * Math.sin(2 * toRadians(angle))) / 9.81;
  const distance        = Math.max(1, raw * angleEfficiency + randomTerm);

  return { foul: false, distance };
}

const fmt = (m) => `${m.toFixed(2)} m`;

// --- Wind ---
function generateWind() {
  if (!windToggle.checked) {
    state.wind = 0;
    windEl.textContent = 'Off (arcade)';
    return;
  }
  state.wind = Number((Math.random() * 8 - 4).toFixed(1));
  const dir = state.wind >= 0 ? '+' : '';
  windEl.textContent = `${dir}${state.wind.toFixed(1)} m/s`;
}

// --- Leaderboard ---
function submitToLeaderboard(eventKey, name, distance) {
  if (!state.leaderboard[eventKey]) state.leaderboard[eventKey] = [];
  state.leaderboard[eventKey].push({ name: name.trim() || 'Athlete', distance });
  state.leaderboard[eventKey].sort((a, b) => b.distance - a.distance);
  if (state.leaderboard[eventKey].length > LB_MAX) state.leaderboard[eventKey].length = LB_MAX;
  saveLeaderboard();
}

// --- Render ---
function renderDescription() {
  eventDescription.textContent = EVENT_PROFILES[eventSelect.value].description;
}

function renderHistory() {
  historyEl.innerHTML = '';
  [...state.log].reverse().forEach((e) => {
    const li = document.createElement('li');
    if (e.foul) {
      li.textContent = `#${e.attempt} ${e.event} (${e.athlete}) → FOUL at ${e.angle}° / ${e.power}%`;
      li.className = 'entry-foul';
    } else {
      const rec  = e.isRecord ? ' ★ PR!' : '';
      const wind = windToggle.checked ? ` (wind ${e.wind >= 0 ? '+' : ''}${e.wind.toFixed(1)} m/s)` : '';
      li.textContent = `#${e.attempt} ${e.event} (${e.athlete}) → ${fmt(e.distance)} at ${e.angle}°/${e.power}%${wind}${rec}`;
      if (e.isRecord) li.className = 'entry-record';
    }
    historyEl.appendChild(li);
  });
}

function renderRanking() {
  rankingEl.innerHTML = '';
  if (!state.roundDistances.length) {
    rankingEl.innerHTML = '<li>No legal throws yet.</li>';
    return;
  }
  [...state.roundDistances].sort((a, b) => b - a).slice(0, 3).forEach((d, i) => {
    const li = document.createElement('li');
    li.textContent = `#${i + 1}: ${fmt(d)}`;
    rankingEl.appendChild(li);
  });
}

function renderRecords() {
  recordsList.innerHTML = '';
  Object.keys(EVENT_PROFILES).forEach((k) => {
    const li = document.createElement('li');
    const v  = state.records[k];
    li.textContent = v ? `${EVENT_PROFILES[k].name}: ${fmt(v)}` : `${EVENT_PROFILES[k].name}: --`;
    recordsList.appendChild(li);
  });
}

function buildLbTabs() {
  lbTabs.innerHTML = '';
  Object.keys(EVENT_PROFILES).forEach((k) => {
    const btn = document.createElement('button');
    btn.textContent = EVENT_PROFILES[k].name;
    btn.className = 'lb-tab' + (k === state.activeLbEvent ? ' active' : '');
    btn.addEventListener('click', () => {
      state.activeLbEvent = k;
      buildLbTabs();
      renderLeaderboard();
    });
    lbTabs.appendChild(btn);
  });
}

function renderLeaderboard() {
  const currentPlayer = playerNameInput.value.trim() || 'Athlete';
  const entries = state.leaderboard[state.activeLbEvent] ?? [];
  leaderboardEl.innerHTML = '';
  if (!entries.length) {
    leaderboardEl.innerHTML = '<li style="list-style:none;opacity:0.6">No entries yet.</li>';
    return;
  }
  entries.forEach((e, i) => {
    const li    = document.createElement('li');
    const isYou = e.name === currentPlayer;
    if (isYou) li.className = 'lb-you';
    li.innerHTML = `<span class="lb-name">${i + 1}. ${e.name}${isYou ? ' (you)' : ''}</span><span class="lb-dist">${fmt(e.distance)}</span>`;
    leaderboardEl.appendChild(li);
  });
}

// --- Timing game helpers ---

function speedMultiplier() {
  // Gently increases speed across the round (1.0 → 1.25 by attempt 5)
  return 1.0 + Math.min(state.roundAttempt * 0.05, 0.30);
}

function positionSweetZones() {
  const event = EVENT_PROFILES[eventSelect.value];
  const [minA, maxA] = event.foulAngleRange;
  const rangeA    = maxA - minA;
  const zoneHalfA = 4; // ±4° sweet zone
  const leftA  = Math.max(0, ((event.idealAngle - zoneHalfA - minA) / rangeA) * 100);
  const widthA = Math.min(100 - leftA, (zoneHalfA * 2 / rangeA) * 100);
  angleSweetZone.style.left  = `${leftA}%`;
  angleSweetZone.style.width = `${widthA}%`;
  idealAngleHint.textContent = event.idealAngle;

  const powerRange = POWER_MAX - POWER_MIN;
  const leftP  = ((POWER_SWEET_MIN - POWER_MIN) / powerRange) * 100;
  const widthP = ((POWER_SWEET_MAX - POWER_SWEET_MIN) / powerRange) * 100;
  powerSweetZone.style.left  = `${leftP}%`;
  powerSweetZone.style.width = `${widthP}%`;
}

function showPrecBadge(el, value, ideal, tolerance) {
  const diff = Math.abs(value - ideal);
  let label, cls;
  if (diff <= tolerance * 0.25)      { label = 'PERFECT!'; cls = 'prec-perfect'; soundLockPerfect(); }
  else if (diff <= tolerance * 0.55) { label = 'GREAT';    cls = 'prec-great';   soundLock(); }
  else if (diff <= tolerance)        { label = 'GOOD';      cls = 'prec-good';    soundLock(); }
  else                               { label = 'OFF';       cls = 'prec-off';     soundLock(); }

  el.textContent = label;
  el.className   = `prec-badge ${cls} visible`;
  setTimeout(() => { el.className = 'prec-badge'; }, 1800);
}

function setPhaseActive(phase) {
  phaseAngleStep.className = 'phase-step' +
    (phase === 'angle' ? ' active' : (phase === 'power' || phase === 'done' ? ' done' : ''));
  phasePowerStep.className = 'phase-step' +
    (phase === 'power' ? ' active' : (phase === 'done' ? ' done' : ''));
  phaseThrowStep.className = 'phase-step' + (phase === 'done' ? ' active' : '');

  angleMeterGroup.className = 'meter-group' +
    (phase === 'angle' ? ' meter-active' : (phase === 'power' || phase === 'done' ? ' meter-locked' : ''));
  powerMeterGroup.className = 'meter-group' +
    (phase === 'power' ? ' meter-active' : (phase === 'done' ? ' meter-locked' : ''));
}

function resetTimingUI() {
  angleCursor.classList.remove('locked');
  powerCursor.classList.remove('locked');
  angleCursor.style.left  = '0%';
  powerCursor.style.left  = '0%';
  angleMeterVal.textContent = '--°';
  powerMeterVal.textContent = '--%';
  anglePrecBadge.className = 'prec-badge';
  powerPrecBadge.className = 'prec-badge';
}

function lockControls(locked) {
  eventSelect.disabled   = locked;
  athleteSelect.disabled = locked;
}

// --- Timing phases ---

function startAnglePhase() {
  if (state.roundAttempt >= MAX_ROUND) return;

  cancelAnimationFrame(timing.animFrame);
  timing.phase        = 'angle';
  timing.lockedAngle  = null;
  timing.lockedPower  = null;

  const event = EVENT_PROFILES[eventSelect.value];
  const [minA, maxA] = event.foulAngleRange;
  timing.angle.current = minA;
  timing.angle.dir     = 1;

  resetTimingUI();
  positionSweetZones();
  setPhaseActive('angle');
  throwBtn.textContent = 'Lock Angle!';
  lockControls(true);

  const speed = event.speeds.angle * speedMultiplier();

  (function animate() {
    if (timing.phase !== 'angle') return;

    timing.angle.current += speed * timing.angle.dir;
    if (timing.angle.current >= maxA) { timing.angle.current = maxA; timing.angle.dir = -1; }
    else if (timing.angle.current <= minA) { timing.angle.current = minA; timing.angle.dir = 1; }

    const pct = ((timing.angle.current - minA) / (maxA - minA)) * 100;
    angleCursor.style.left    = `${pct}%`;
    angleMeterVal.textContent = `${Math.round(timing.angle.current)}°`;

    timing.animFrame = requestAnimationFrame(animate);
  })();
}

function lockAngleStartPower() {
  if (timing.phase !== 'angle') return;
  cancelAnimationFrame(timing.animFrame);

  timing.lockedAngle = timing.angle.current;
  timing.phase       = 'power';

  angleCursor.classList.add('locked');

  const event = EVENT_PROFILES[eventSelect.value];
  showPrecBadge(anglePrecBadge, timing.lockedAngle, event.idealAngle, 10);

  timing.power.current = POWER_MIN;
  timing.power.dir     = 1;
  powerCursor.classList.remove('locked');

  setPhaseActive('power');
  throwBtn.textContent = 'Lock Power!';

  const speed = event.speeds.power * speedMultiplier();

  (function animate() {
    if (timing.phase !== 'power') return;

    timing.power.current += speed * timing.power.dir;
    if (timing.power.current >= POWER_MAX) { timing.power.current = POWER_MAX; timing.power.dir = -1; }
    else if (timing.power.current <= POWER_MIN) { timing.power.current = POWER_MIN; timing.power.dir = 1; }

    const pct = ((timing.power.current - POWER_MIN) / (POWER_MAX - POWER_MIN)) * 100;
    powerCursor.style.left    = `${pct}%`;
    powerMeterVal.textContent = `${Math.round(timing.power.current)}%`;

    timing.animFrame = requestAnimationFrame(animate);
  })();
}

function lockPowerAndThrow() {
  if (timing.phase !== 'power') return;
  cancelAnimationFrame(timing.animFrame);

  timing.lockedPower = timing.power.current;
  timing.phase       = 'idle';

  powerCursor.classList.add('locked');

  const powerIdeal = (POWER_SWEET_MIN + POWER_SWEET_MAX) / 2;
  showPrecBadge(powerPrecBadge, timing.lockedPower, powerIdeal, 15);

  setPhaseActive('done');
  throwBtn.textContent = 'Start Throw!';
  lockControls(false);

  executeThrow(Math.round(timing.lockedAngle), Math.round(timing.lockedPower));
}

function handleThrowBtn() {
  if (timing.phase === 'idle')  startAnglePhase();
  else if (timing.phase === 'angle') lockAngleStartPower();
  else if (timing.phase === 'power') lockPowerAndThrow();
}

// --- Core throw execution ---
function executeThrow(angle, power) {
  const eventKey   = eventSelect.value;
  const athleteKey = athleteSelect.value;
  const playerName = playerNameInput.value.trim() || 'Athlete';

  const result = calculateThrow(eventKey, athleteKey, power, angle);

  state.attempts     += 1;
  state.roundAttempt += 1;
  attemptsEl.textContent     = state.attempts;
  roundAttemptEl.textContent = state.roundAttempt;

  let isRecord = false;

  if (result.foul) {
    statusEl.textContent = 'FOUL – too far outside the legal zone!';
    statusEl.className   = 'foul';
    soundFoul();
    animateThrow(true, false);
  } else {
    const prev = state.records[eventKey] ?? 0;
    isRecord = result.distance > prev;

    state.best = Math.max(state.best, result.distance);
    lastThrow.textContent = fmt(result.distance);
    bestThrow.textContent = fmt(state.best);
    state.roundDistances.push(result.distance);

    if (isRecord) {
      state.records[eventKey] = result.distance;
      saveRecords();
      renderRecords();
      statusEl.textContent = `New personal record! ${fmt(result.distance)}`;
      statusEl.className   = '';
      soundRecord();
    } else {
      statusEl.textContent = `Legal throw: ${fmt(result.distance)}`;
      statusEl.className   = '';
      soundThrow();
    }

    submitToLeaderboard(eventKey, playerName, result.distance);
    renderLeaderboard();
    animateThrow(false, isRecord);
  }

  state.log.push({
    attempt: state.attempts,
    event:   EVENT_PROFILES[eventKey].name,
    athlete: ATHLETE_PROFILES[athleteKey].label,
    power, angle,
    wind: state.wind,
    foul: result.foul,
    distance: result.distance,
    isRecord
  });

  renderHistory();
  renderRanking();
  generateWind();

  if (state.roundAttempt >= MAX_ROUND) {
    throwBtn.disabled    = true;
    throwBtn.textContent = 'Start Throw!';
    statusEl.textContent = 'Round complete. Start a new 6-throw round.';
    statusEl.className   = '';
  }
}

// --- Round / session control ---
function startNewRound() {
  cancelAnimationFrame(timing.animFrame);
  timing.phase = 'idle';

  state.roundAttempt   = 0;
  state.roundDistances = [];
  roundAttemptEl.textContent = '0';
  throwBtn.disabled    = false;
  throwBtn.textContent = 'Start Throw!';
  lockControls(false);
  setPhaseActive('idle');
  resetTimingUI();
  statusEl.textContent = 'New round started. Good luck!';
  statusEl.className   = '';
  renderRanking();
  generateWind();
}

function resetSession() {
  cancelAnimationFrame(timing.animFrame);
  timing.phase = 'idle';

  state.attempts       = 0;
  state.roundAttempt   = 0;
  state.best           = 0;
  state.log            = [];
  state.roundDistances = [];

  attemptsEl.textContent     = '0';
  roundAttemptEl.textContent = '0';
  lastThrow.textContent      = '-- m';
  bestThrow.textContent      = '-- m';
  throwBtn.disabled           = false;
  throwBtn.textContent        = 'Start Throw!';
  lockControls(false);
  setPhaseActive('idle');
  resetTimingUI();
  statusEl.textContent = 'Session reset. Press Start Throw!';
  statusEl.className   = '';

  renderHistory();
  renderRanking();
  renderRecords();
  generateWind();
}

// --- Event listeners ---
eventSelect.addEventListener('change', () => {
  if (timing.phase === 'idle') renderDescription();
});
windToggle.addEventListener('change', generateWind);
playerNameInput.addEventListener('input', renderLeaderboard);
throwBtn.addEventListener('click', handleThrowBtn);
newRoundBtn.addEventListener('click', startNewRound);
resetBtn.addEventListener('click', resetSession);

// Click directly on a meter to lock in
angleMeter.addEventListener('click', () => { if (timing.phase === 'angle') lockAngleStartPower(); });
powerMeter.addEventListener('click', () => { if (timing.phase === 'power') lockPowerAndThrow(); });

// Spacebar lock-in (prevents page scroll)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && timing.phase !== 'idle') {
    e.preventDefault();
    handleThrowBtn();
  }
});

// --- Init ---
renderDescription();
renderRanking();
renderRecords();
buildLbTabs();
renderLeaderboard();
generateWind();
setPhaseActive('idle');

// ── Canvas field ──────────────────────────────────────────────────────────

const fieldCanvas = document.getElementById('fieldCanvas');
const fctx        = fieldCanvas.getContext('2d');
let   fieldW = 0, fieldH = 0;

const fieldState = {
  landingMarkers: [],  // { dist, foul }
  ballTrail: [],       // last N { bx, by } positions for comet trail
  animMaxBy: 20,       // peak height used for vertical scaling
  animating: false,
};

// Keep HUD event label in sync with the select
function syncHudEvent() {
  const el = document.getElementById('hudEventLabel');
  if (el) el.textContent = EVENT_PROFILES[eventSelect.value].name.toUpperCase();
}
eventSelect.addEventListener('change', syncHudEvent);
syncHudEvent();

function resizeField() {
  fieldW = fieldCanvas.width  = fieldCanvas.offsetWidth;
  fieldH = fieldCanvas.height = fieldCanvas.offsetHeight;
  drawFieldScene();
}
window.addEventListener('resize', resizeField);
resizeField();

function groundY() { return Math.round(fieldH * 0.70); }
function throwerX() { return Math.round(fieldW * 0.10); }
function distToCanvasX(dist) {
  return throwerX() + (dist / 100) * (fieldW * 0.85);
}

// ── Main field renderer ────────────────────────────────────────────────────
function drawFieldScene() {
  if (!fctx || fieldW === 0) return;
  const gy = groundY();
  const ox = throwerX();

  // Sky
  const sky = fctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0,   '#09141e');
  sky.addColorStop(0.5, '#0d2318');
  sky.addColorStop(1,   '#153320');
  fctx.fillStyle = sky;
  fctx.fillRect(0, 0, fieldW, gy);

  // Grass mowing stripes
  const sw = Math.max(28, fieldW / 20);
  for (let x = 0; x < fieldW; x += sw) {
    fctx.fillStyle = Math.floor(x / sw) % 2 === 0 ? '#294e17' : '#2c5419';
    fctx.fillRect(x, gy, sw, fieldH - gy);
  }

  // Sector fill (legal throwing cone)
  const ev = EVENT_PROFILES[eventSelect.value];
  const [minA, maxA] = ev.foulAngleRange;
  const sLen = fieldW * 1.3;
  fctx.save();
  fctx.beginPath();
  fctx.moveTo(ox, gy);
  fctx.lineTo(ox + sLen * Math.cos(minA * Math.PI/180), gy - sLen * Math.sin(minA * Math.PI/180));
  fctx.lineTo(ox + sLen * Math.cos(maxA * Math.PI/180), gy - sLen * Math.sin(maxA * Math.PI/180));
  fctx.closePath();
  fctx.fillStyle = 'rgba(160, 255, 100, 0.045)';
  fctx.fill();

  // Sector boundary lines (dashed white)
  fctx.strokeStyle = 'rgba(255,255,255,0.22)';
  fctx.lineWidth = 1.5;
  fctx.setLineDash([7, 5]);
  [minA, maxA].forEach(a => {
    const r = a * Math.PI / 180;
    fctx.beginPath();
    fctx.moveTo(ox, gy);
    fctx.lineTo(ox + sLen * Math.cos(r), gy - sLen * Math.sin(r));
    fctx.stroke();
  });
  fctx.setLineDash([]);
  fctx.restore();

  // Ground horizon line
  fctx.strokeStyle = 'rgba(255,255,255,0.10)';
  fctx.lineWidth = 1;
  fctx.beginPath();
  fctx.moveTo(0, gy); fctx.lineTo(fieldW, gy);
  fctx.stroke();

  // Distance arc bands on grass (semi-circles from thrower)
  fctx.save();
  for (let d = 20; d <= 100; d += 20) {
    const r = (d / 100) * fieldW * 0.85;
    fctx.strokeStyle = d % 40 === 0 ? 'rgba(255,220,80,0.18)' : 'rgba(255,255,255,0.08)';
    fctx.lineWidth = d % 40 === 0 ? 1.5 : 1;
    fctx.beginPath();
    fctx.arc(ox, gy, r, -Math.PI * 0.55, -Math.PI * 0.05);
    fctx.stroke();
  }
  fctx.restore();

  // Distance tick marks + labels on ground
  fctx.save();
  fctx.textAlign = 'center';
  for (let d = 20; d <= 90; d += 10) {
    const tx = distToCanvasX(d);
    fctx.strokeStyle = 'rgba(255,255,255,0.18)';
    fctx.lineWidth = 1;
    fctx.beginPath(); fctx.moveTo(tx, gy - 4); fctx.lineTo(tx, gy + 6); fctx.stroke();
    fctx.fillStyle = d % 20 === 0 ? 'rgba(255,220,80,0.55)' : 'rgba(255,255,255,0.25)';
    fctx.font = d % 20 === 0 ? 'bold 10px monospace' : '9px monospace';
    fctx.fillText(d + 'm', tx, gy + 18);
  }
  fctx.restore();

  // Throw circle — concrete pad
  fctx.save();
  fctx.fillStyle = '#5a6570';
  fctx.beginPath(); fctx.arc(ox, gy, 16, 0, Math.PI * 2); fctx.fill();
  fctx.strokeStyle = '#9aabb8'; fctx.lineWidth = 2;
  fctx.beginPath(); fctx.arc(ox, gy, 16, 0, Math.PI * 2); fctx.stroke();
  // hash marks
  fctx.strokeStyle = '#7a8b98'; fctx.lineWidth = 1;
  for (let a = 0; a < 360; a += 45) {
    const r = a * Math.PI / 180;
    fctx.beginPath();
    fctx.moveTo(ox + 11 * Math.cos(r), gy + 11 * Math.sin(r));
    fctx.lineTo(ox + 16 * Math.cos(r), gy + 16 * Math.sin(r));
    fctx.stroke();
  }
  fctx.restore();

  // Canvas HUD overlay
  fctx.save();
  // Attempt counter — top left
  fctx.font = 'bold 13px monospace';
  fctx.textAlign = 'left';
  fctx.fillStyle = state.roundAttempt >= MAX_ROUND ? '#e05c5c' : 'rgba(255,255,255,0.55)';
  fctx.fillText(`${state.roundAttempt} / 6`, 10, 20);
  // Event name — top center
  fctx.textAlign = 'center';
  fctx.fillStyle = 'rgba(255, 200, 87, 0.75)';
  fctx.font = 'bold 12px monospace';
  fctx.fillText(ev.name.toUpperCase(), fieldW / 2, 20);
  // Best throw — top right
  if (state.best > 0) {
    fctx.textAlign = 'right';
    fctx.fillStyle = 'rgba(103, 209, 122, 0.65)';
    fctx.font = '11px monospace';
    fctx.fillText('PB ' + state.best.toFixed(2) + ' m', fieldW - 10, 20);
  }
  fctx.restore();

  // Previous landing markers (fading)
  fieldState.landingMarkers.slice(-8).forEach((m, i, arr) => {
    drawLandingX(m.dist, m.foul, 0.12 + (i / arr.length) * 0.55);
  });

  // Idle athlete (only when not animating)
  if (!fieldState.animating) {
    drawAthlete('idle');
  }
}

// ── Landing marker ────────────────────────────────────────────────────────
function drawLandingX(dist, foul, alpha = 1) {
  if (dist <= 0) return;
  const x  = distToCanvasX(dist);
  const gy = groundY();
  fctx.save();
  fctx.globalAlpha = alpha;
  fctx.strokeStyle = foul ? '#e05c5c' : '#ff5533';
  fctx.lineWidth   = alpha >= 0.85 ? 2.5 : 1.5;
  const s = 7;
  fctx.beginPath();
  fctx.moveTo(x-s, gy-s); fctx.lineTo(x+s, gy+s);
  fctx.moveTo(x+s, gy-s); fctx.lineTo(x-s, gy+s);
  fctx.stroke();
  if (alpha >= 0.85 && !foul) {
    fctx.fillStyle = '#ff5533';
    fctx.font      = 'bold 12px monospace';
    fctx.textAlign = 'left';
    fctx.shadowColor = '#000'; fctx.shadowBlur = 4;
    fctx.fillText(dist.toFixed(2) + ' m', x + 10, gy - 2);
  }
  fctx.restore();
}

// ── Athlete stick figure ──────────────────────────────────────────────────
function drawAthlete(pose) {
  const x  = throwerX();
  const gy = groundY();
  fctx.save();
  fctx.strokeStyle = '#ffc857';
  fctx.lineWidth   = 3;
  fctx.lineCap     = 'round';
  fctx.lineJoin    = 'round';

  // Head
  fctx.beginPath(); fctx.arc(x, gy - 56, 9, 0, Math.PI * 2); fctx.stroke();
  // Body
  fctx.beginPath(); fctx.moveTo(x, gy-47); fctx.lineTo(x, gy-20); fctx.stroke();

  if (pose === 'idle') {
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-17, gy-26); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+17, gy-26); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-11, gy);    fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+11, gy);    fctx.stroke();
  } else if (pose === 'throw') {
    // Throwing arm raised, wide power stance
    fctx.strokeStyle = '#ffe090';
    fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+26, gy-58); fctx.stroke();
    fctx.strokeStyle = '#ffc857'; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-16, gy-26); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-16, gy);    fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+8,  gy);    fctx.stroke();
  } else { // follow-through
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+24, gy-34); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-14, gy-28); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-11, gy);    fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+15, gy);    fctx.stroke();
  }
  fctx.restore();
}

// ── Ball with comet trail ─────────────────────────────────────────────────
function drawBallWithTrail() {
  if (fieldState.ballTrail.length === 0) return;
  const gy     = groundY();
  const ox     = throwerX();
  const scaleX = (fieldW * 0.85) / 100;
  const peakH  = fieldH * 0.62;
  const maxBy  = fieldState.animMaxBy;

  // Trail
  fieldState.ballTrail.forEach((p, i) => {
    const frac = i / fieldState.ballTrail.length;
    const sx   = ox + p.bx * scaleX;
    const sy   = gy - (p.by / maxBy) * peakH;
    fctx.save();
    fctx.globalAlpha = frac * 0.45;
    fctx.fillStyle   = '#fff';
    fctx.beginPath();
    fctx.arc(sx, sy, 2 + frac * 4, 0, Math.PI * 2);
    fctx.fill();
    fctx.restore();
  });

  // Ball head
  const last = fieldState.ballTrail[fieldState.ballTrail.length - 1];
  const sx = ox + last.bx * scaleX;
  const sy = gy - (last.by / maxBy) * peakH;

  // Ground shadow (scales with height)
  const shadowScale = Math.max(0, 1 - last.by / maxBy);
  fctx.save();
  fctx.globalAlpha = 0.3 * shadowScale;
  fctx.fillStyle = '#000';
  fctx.beginPath();
  fctx.ellipse(sx, gy + 4, 9 * shadowScale + 3, 2.5, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.restore();

  // Glowing ball
  fctx.save();
  const glow = fctx.createRadialGradient(sx, sy, 0, sx, sy, 12);
  glow.addColorStop(0,   'rgba(255,255,255,1)');
  glow.addColorStop(0.4, 'rgba(255,240,180,0.7)');
  glow.addColorStop(1,   'rgba(255,200,80,0)');
  fctx.fillStyle = glow;
  fctx.beginPath(); fctx.arc(sx, sy, 12, 0, Math.PI * 2); fctx.fill();
  fctx.fillStyle = '#ffffff';
  fctx.beginPath(); fctx.arc(sx, sy, 6, 0, Math.PI * 2);  fctx.fill();
  fctx.restore();
}

// ── Wrap executeThrow to drive the canvas ─────────────────────────────────
const _origExecuteThrow = executeThrow;
executeThrow = function(angle, power) {
  _origExecuteThrow(angle, power);

  const entry = state.log[state.log.length - 1];
  if (!entry) return;

  if (entry.foul || entry.distance <= 0) {
    fieldState.landingMarkers.push({ dist: 0, foul: true });
    fieldState.animating = true;
    drawFieldScene(); drawAthlete('throw');
    setTimeout(() => { fieldState.animating = false; drawFieldScene(); }, 600);
    return;
  }

  const dist    = entry.distance;
  const rad     = angle * Math.PI / 180;
  const v0      = power * 0.013;
  const v0x     = v0 * Math.cos(rad);
  const v0y     = v0 * Math.sin(rad);
  const g       = 0.003;
  const peakT   = v0y / g;
  fieldState.animMaxBy = Math.max(8, v0y * peakT - 0.5 * g * peakT * peakT);
  fieldState.ballTrail = [];
  fieldState.animating = true;

  let t = 0;
  (function step() {
    const bx = v0x * t;
    const by = v0y * t - 0.5 * g * t * t;

    fieldState.ballTrail.push({ bx, by });
    if (fieldState.ballTrail.length > 22) fieldState.ballTrail.shift();

    drawFieldScene();
    drawAthlete(t < 14 ? 'throw' : 'follow');
    drawBallWithTrail();

    if (by < 0 || bx >= dist) {
      fieldState.landingMarkers.push({ dist, foul: false });
      fieldState.ballTrail = [];
      fieldState.animating = false;
      drawFieldScene();
      drawAthlete('follow');
      drawLandingX(dist, false, 1);
      return;
    }
    t += 1;
    requestAnimationFrame(step);
  })();
};
