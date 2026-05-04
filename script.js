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

// Per-event visual config: distinct sky palette, grass, ground line, distance scale
const EVENT_CANVAS = {
  discus:  { maxDist: 80,  skyA: '#07111c', skyB: '#0d2018', skyC: '#142c1c', grassA: '#255018', grassB: '#285a1a', groundPct: 0.68 },
  shotPut: { maxDist: 26,  skyA: '#14100c', skyB: '#221808', skyC: '#1a2808', grassA: '#1e3e0e', grassB: '#224412', groundPct: 0.73 },
  hammer:  { maxDist: 88,  skyA: '#060c18', skyB: '#0a1824', skyC: '#10281c', grassA: '#224e12', grassB: '#265216', groundPct: 0.67 },
  javelin: { maxDist: 98,  skyA: '#091420', skyB: '#0e2218', skyC: '#153020', grassA: '#2b5a1a', grassB: '#2f621c', groundPct: 0.69 },
};

const fieldState = {
  landingMarkers: [],
  ballTrail: [],
  animMaxBy: 20,
  animating: false,
  rotFrame: 0,
  lastVx: 1,
  lastVy: 0,
};

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

function groundY() { return Math.round(fieldH * EVENT_CANVAS[eventSelect.value].groundPct); }
function throwerX() { return Math.round(fieldW * 0.10); }
function distToCanvasX(dist) {
  return throwerX() + (dist / EVENT_CANVAS[eventSelect.value].maxDist) * (fieldW * 0.85);
}

// ── Main field renderer ────────────────────────────────────────────────────
function drawFieldScene() {
  if (!fctx || fieldW === 0) return;
  const gy    = groundY();
  const ox    = throwerX();
  const ev    = EVENT_PROFILES[eventSelect.value];
  const ec    = EVENT_CANVAS[eventSelect.value];
  const evKey = eventSelect.value;

  // Sky gradient
  const sky = fctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0,   ec.skyA);
  sky.addColorStop(0.5, ec.skyB);
  sky.addColorStop(1,   ec.skyC);
  fctx.fillStyle = sky;
  fctx.fillRect(0, 0, fieldW, gy);

  // Stadium bleachers silhouette
  const standH = gy * 0.20;
  fctx.fillStyle = 'rgba(12,22,40,0.55)';
  fctx.fillRect(0, gy - standH, fieldW, standH);
  fctx.strokeStyle = 'rgba(255,255,255,0.03)';
  fctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    fctx.beginPath();
    fctx.moveTo(0, gy - standH * i / 5);
    fctx.lineTo(fieldW, gy - standH * i / 5);
    fctx.stroke();
  }

  // Grass mowing stripes
  const sw = Math.max(26, fieldW / 22);
  for (let x = 0; x < fieldW; x += sw) {
    fctx.fillStyle = Math.floor(x / sw) % 2 === 0 ? ec.grassA : ec.grassB;
    fctx.fillRect(x, gy, sw, fieldH - gy);
  }

  // Sector fill + boundary lines
  const [minA, maxA] = ev.foulAngleRange;
  const sLen = fieldW * 1.3;
  fctx.save();
  fctx.beginPath();
  fctx.moveTo(ox, gy);
  fctx.lineTo(ox + sLen * Math.cos(minA * Math.PI/180), gy - sLen * Math.sin(minA * Math.PI/180));
  fctx.lineTo(ox + sLen * Math.cos(maxA * Math.PI/180), gy - sLen * Math.sin(maxA * Math.PI/180));
  fctx.closePath();
  fctx.fillStyle = 'rgba(160,255,100,0.045)';
  fctx.fill();
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

  // Horizon line
  fctx.strokeStyle = 'rgba(255,255,255,0.10)';
  fctx.lineWidth = 1;
  fctx.beginPath(); fctx.moveTo(0, gy); fctx.lineTo(fieldW, gy); fctx.stroke();

  // Distance arcs scaled per event
  const maxD    = ec.maxDist;
  const arcStep = maxD <= 30 ? 5 : maxD <= 55 ? 10 : 20;
  fctx.save();
  for (let d = arcStep; d <= maxD; d += arcStep) {
    const r     = (d / maxD) * fieldW * 0.85;
    const major = d % (arcStep * 2) === 0;
    fctx.strokeStyle = major ? 'rgba(255,220,80,0.18)' : 'rgba(255,255,255,0.08)';
    fctx.lineWidth   = major ? 1.5 : 1;
    fctx.beginPath();
    fctx.arc(ox, gy, r, -Math.PI * 0.55, -Math.PI * 0.05);
    fctx.stroke();
  }
  fctx.restore();

  // Distance labels
  fctx.save();
  fctx.textAlign = 'center';
  for (let d = arcStep; d <= maxD - arcStep * 0.5; d += arcStep) {
    const tx    = distToCanvasX(d);
    const major = d % (arcStep * 2) === 0;
    fctx.strokeStyle = 'rgba(255,255,255,0.18)';
    fctx.lineWidth = 1;
    fctx.beginPath(); fctx.moveTo(tx, gy - 4); fctx.lineTo(tx, gy + 6); fctx.stroke();
    fctx.fillStyle = major ? 'rgba(255,220,80,0.55)' : 'rgba(255,255,255,0.25)';
    fctx.font = major ? 'bold 10px monospace' : '9px monospace';
    fctx.fillText(d + 'm', tx, gy + 18);
  }
  fctx.restore();

  // Throw circle or javelin runway
  fctx.save();
  if (evKey === 'javelin') {
    fctx.fillStyle = '#5a6570';
    fctx.fillRect(ox - 8, gy - 3, 52, 6);
    fctx.strokeStyle = '#9aabb8'; fctx.lineWidth = 1.5;
    fctx.strokeRect(ox - 8, gy - 3, 52, 6);
    // scratch board
    fctx.fillStyle = '#c8a070';
    fctx.fillRect(ox + 44, gy - 4, 7, 8);
  } else {
    fctx.fillStyle = '#5a6570';
    fctx.beginPath(); fctx.arc(ox, gy, 16, 0, Math.PI * 2); fctx.fill();
    fctx.strokeStyle = '#9aabb8'; fctx.lineWidth = 2;
    fctx.beginPath(); fctx.arc(ox, gy, 16, 0, Math.PI * 2); fctx.stroke();
    fctx.strokeStyle = '#7a8b98'; fctx.lineWidth = 1;
    for (let a = 0; a < 360; a += 45) {
      const r = a * Math.PI / 180;
      fctx.beginPath();
      fctx.moveTo(ox + 11 * Math.cos(r), gy + 11 * Math.sin(r));
      fctx.lineTo(ox + 16 * Math.cos(r), gy + 16 * Math.sin(r));
      fctx.stroke();
    }
  }
  fctx.restore();

  // HUD overlay
  fctx.save();
  fctx.font = 'bold 13px monospace';
  fctx.textAlign = 'left';
  fctx.fillStyle = state.roundAttempt >= MAX_ROUND ? '#e05c5c' : 'rgba(255,255,255,0.55)';
  fctx.fillText(`${state.roundAttempt} / 6`, 10, 20);
  fctx.textAlign = 'center';
  fctx.fillStyle = 'rgba(255,200,87,0.75)';
  fctx.font = 'bold 12px monospace';
  fctx.fillText(ev.name.toUpperCase(), fieldW / 2, 20);
  if (state.best > 0) {
    fctx.textAlign = 'right';
    fctx.fillStyle = 'rgba(103,209,122,0.65)';
    fctx.font = '11px monospace';
    fctx.fillText('PB ' + state.best.toFixed(2) + ' m', fieldW - 10, 20);
  }
  fctx.restore();

  // Landing markers
  fieldState.landingMarkers.slice(-8).forEach((m, i, arr) => {
    drawLandingMarker(m.dist, m.foul, 0.12 + (i / arr.length) * 0.55);
  });

  if (!fieldState.animating) drawAthlete('idle');
}

// ── Landing marker ─────────────────────────────────────────────────────────
function drawLandingMarker(dist, foul, alpha = 1) {
  if (dist <= 0) return;
  const x  = distToCanvasX(dist);
  const gy = groundY();
  fctx.save();
  fctx.globalAlpha = alpha;
  if (eventSelect.value === 'javelin' && !foul && alpha >= 0.85) {
    // Javelin sticks upright in the ground
    fctx.strokeStyle = '#d4b84a';
    fctx.lineWidth = 2;
    fctx.beginPath();
    fctx.moveTo(x + 14, gy - 22);
    fctx.lineTo(x, gy);
    fctx.stroke();
    fctx.fillStyle = '#e8e8f0';
    fctx.beginPath();
    fctx.moveTo(x + 14, gy - 22);
    fctx.lineTo(x + 22, gy - 24);
    fctx.lineTo(x + 14, gy - 18);
    fctx.closePath();
    fctx.fill();
    fctx.fillStyle = '#ffc857';
    fctx.font = 'bold 12px monospace';
    fctx.textAlign = 'left';
    fctx.shadowColor = '#000'; fctx.shadowBlur = 4;
    fctx.fillText(dist.toFixed(2) + ' m', x + 24, gy - 16);
  } else {
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
  }
  fctx.restore();
}
// backwards-compat alias used in a few places
function drawLandingX(dist, foul, alpha = 1) { drawLandingMarker(dist, foul, alpha); }

// ── Event implement shapes ─────────────────────────────────────────────────

function drawDiscus(cx, cy, frame) {
  // Flat disc spinning in the air — perspective tilt oscillates with rotation
  const tilt = Math.abs(Math.sin(frame * 0.22)) * 8 + 2;
  fctx.save();
  fctx.translate(cx, cy);
  fctx.globalAlpha = 0.32;
  fctx.fillStyle = '#000';
  fctx.beginPath(); fctx.ellipse(0, 10, 8, 2, 0, 0, Math.PI * 2); fctx.fill();
  fctx.globalAlpha = 1;
  const g = fctx.createRadialGradient(-3, -3, 0, 0, 0, 11);
  g.addColorStop(0,   '#d0d4e8');
  g.addColorStop(0.5, '#6870a0');
  g.addColorStop(1,   '#2c3058');
  fctx.fillStyle = g;
  fctx.beginPath(); fctx.ellipse(0, 0, 11, tilt, 0, 0, Math.PI * 2); fctx.fill();
  fctx.strokeStyle = 'rgba(180,190,255,0.55)';
  fctx.lineWidth = 1;
  fctx.beginPath(); fctx.ellipse(0, 0, 11, tilt, 0, 0, Math.PI * 2); fctx.stroke();
  // Spin line to show rotation
  const sa = frame * 0.22;
  fctx.strokeStyle = 'rgba(140,150,210,0.45)';
  fctx.lineWidth = 0.8;
  fctx.beginPath(); fctx.moveTo(0, 0); fctx.lineTo(9 * Math.cos(sa), tilt * 0.8 * Math.sin(sa)); fctx.stroke();
  fctx.fillStyle = '#505890';
  fctx.beginPath(); fctx.arc(0, 0, 2.5, 0, Math.PI * 2); fctx.fill();
  fctx.restore();
}

function drawHammerBall(cx, cy, frame) {
  // Metal ball on a wire that curves back to the athlete's hands
  const ox = throwerX(), gy = groundY();
  const wa = frame * 0.12;
  const handX = ox + 12 + 18 * Math.cos(wa - 0.8);
  const handY = gy - 48 + 6 * Math.sin(wa);
  fctx.save();
  fctx.strokeStyle = '#b8a060';
  fctx.lineWidth = 1.5;
  fctx.beginPath();
  fctx.moveTo(handX, handY);
  const mx = (handX + cx) * 0.5 + Math.sin(wa) * 10;
  const my = (handY + cy) * 0.5 - 14;
  fctx.quadraticCurveTo(mx, my, cx, cy);
  fctx.stroke();
  // Handle grip knob
  fctx.fillStyle = '#c0a860';
  fctx.beginPath(); fctx.arc(handX, handY, 3, 0, Math.PI * 2); fctx.fill();
  // Ball with warm gold sheen
  const bg = fctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, 9);
  bg.addColorStop(0,   '#f0e090');
  bg.addColorStop(0.4, '#c08030');
  bg.addColorStop(1,   '#5a3810');
  fctx.fillStyle = bg;
  fctx.beginPath(); fctx.arc(cx, cy, 8, 0, Math.PI * 2); fctx.fill();
  fctx.fillStyle = 'rgba(255,240,140,0.28)';
  fctx.beginPath(); fctx.arc(cx - 3, cy - 3, 3, 0, Math.PI * 2); fctx.fill();
  fctx.restore();
}

function drawShotPutBall(cx, cy) {
  // Heavy steel sphere with matte finish and surface contour lines
  fctx.save();
  const g = fctx.createRadialGradient(cx - 4, cy - 4, 0, cx, cy, 11);
  g.addColorStop(0,    '#d0d4e0');
  g.addColorStop(0.45, '#7c7c8c');
  g.addColorStop(1,    '#303038');
  fctx.fillStyle = g;
  fctx.beginPath(); fctx.arc(cx, cy, 10, 0, Math.PI * 2); fctx.fill();
  fctx.strokeStyle = 'rgba(255,255,255,0.12)';
  fctx.lineWidth = 0.8;
  fctx.beginPath(); fctx.arc(cx, cy, 10, Math.PI * 0.8, Math.PI * 1.6); fctx.stroke();
  fctx.beginPath(); fctx.arc(cx, cy, 6,  Math.PI * 0.6, Math.PI * 1.4); fctx.stroke();
  fctx.fillStyle = 'rgba(255,255,255,0.22)';
  fctx.beginPath(); fctx.arc(cx - 3, cy - 3, 4, 0, Math.PI * 2); fctx.fill();
  fctx.restore();
}

function drawJavelinInFlight(cx, cy, vx, vy) {
  // Spear oriented along velocity vector; nose-down at end of flight
  const angle = Math.atan2(-vy, vx);
  const len = 30;
  fctx.save();
  fctx.translate(cx, cy);
  fctx.rotate(angle);
  // Tail fins
  fctx.strokeStyle = '#9a8850';
  fctx.lineWidth = 1;
  fctx.beginPath(); fctx.moveTo(-len * 0.45, 0); fctx.lineTo(-len * 0.45 - 5, -5); fctx.stroke();
  fctx.beginPath(); fctx.moveTo(-len * 0.45, 0); fctx.lineTo(-len * 0.45 - 5,  5); fctx.stroke();
  // Shaft
  fctx.strokeStyle = '#d0b440';
  fctx.lineWidth = 2.5;
  fctx.beginPath(); fctx.moveTo(-len * 0.45, 0); fctx.lineTo(len * 0.6, 0); fctx.stroke();
  // Grip wrap
  fctx.strokeStyle = '#7a5e20';
  fctx.lineWidth = 4;
  fctx.beginPath(); fctx.moveTo(-len * 0.1, 0); fctx.lineTo(len * 0.15, 0); fctx.stroke();
  // Metal tip
  fctx.fillStyle = '#e0e4f0';
  fctx.beginPath();
  fctx.moveTo(len * 0.6, 0);
  fctx.lineTo(len * 0.6 + 10, 0);
  fctx.lineTo(len * 0.6, -2);
  fctx.closePath();
  fctx.fill();
  fctx.restore();
}

// ── Athlete stick figure (event-specific poses) ───────────────────────────
function drawAthlete(pose) {
  const x     = throwerX();
  const gy    = groundY();
  const evKey = eventSelect.value;
  const gold  = '#ffc857';
  const light = '#ffe090';
  fctx.save();
  fctx.lineCap  = 'round';
  fctx.lineJoin = 'round';
  // Head + torso shared across all events
  fctx.strokeStyle = gold; fctx.lineWidth = 3;
  fctx.beginPath(); fctx.arc(x, gy - 56, 9, 0, Math.PI * 2); fctx.stroke();
  fctx.beginPath(); fctx.moveTo(x, gy - 47); fctx.lineTo(x, gy - 20); fctx.stroke();
  if      (evKey === 'discus')  drawDiscusAthlete(x, gy, pose, gold, light);
  else if (evKey === 'hammer')  drawHammerAthlete(x, gy, pose, gold, light);
  else if (evKey === 'shotPut') drawShotAthlete(x, gy, pose, gold, light);
  else                          drawJavelinAthlete(x, gy, pose, gold, light);
  fctx.restore();
}

function drawDiscusAthlete(x, gy, pose, gold, light) {
  if (pose === 'idle') {
    // Right arm down holding disc at hip
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-17, gy-27); fctx.stroke();
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+20, gy-28); fctx.stroke();
    // Disc in hand
    const dg = fctx.createRadialGradient(x+25, gy-26, 0, x+25, gy-26, 7);
    dg.addColorStop(0, '#a0a8c8'); dg.addColorStop(1, '#383868');
    fctx.fillStyle = dg;
    fctx.beginPath(); fctx.ellipse(x+25, gy-26, 7, 3, -0.3, 0, Math.PI*2); fctx.fill();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-12, gy); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+12, gy); fctx.stroke();
  } else if (pose === 'throw') {
    // Full spin: throwing arm swept back-and-up, wide aggressive stance
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+30, gy-50); fctx.stroke();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-20, gy-32); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-18, gy+2); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+14, gy); fctx.stroke();
  } else {
    // Follow-through: arm extended forward, weight on front foot
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+28, gy-38); fctx.stroke();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-16, gy-30); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-12, gy); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+14, gy); fctx.stroke();
  }
}

function drawHammerAthlete(x, gy, pose, gold, light) {
  if (pose === 'idle') {
    // Holding handle, wire hangs with ball low
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-16, gy-28); fctx.stroke();
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+18, gy-30); fctx.stroke();
    // Wire + ball hanging at side
    fctx.strokeStyle = '#b0a070'; fctx.lineWidth = 1.5;
    fctx.beginPath(); fctx.moveTo(x+22, gy-28); fctx.lineTo(x+32, gy-8); fctx.stroke();
    const bg = fctx.createRadialGradient(x+30, gy-6, 0, x+32, gy-5, 6);
    bg.addColorStop(0, '#e0c060'); bg.addColorStop(1, '#604010');
    fctx.fillStyle = bg;
    fctx.beginPath(); fctx.arc(x+32, gy-5, 6, 0, Math.PI*2); fctx.fill();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-13, gy); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+13, gy); fctx.stroke();
  } else if (pose === 'throw') {
    // Extended spinning stance, both arms pulling the chain outward
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+32, gy-52); fctx.stroke();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-24, gy-34); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-20, gy+2); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+16, gy); fctx.stroke();
    // Wire from extended hand toward flying ball
    fctx.strokeStyle = '#c0a870'; fctx.lineWidth = 1.5;
    fctx.beginPath(); fctx.moveTo(x+32, gy-52); fctx.lineTo(x+56, gy-76); fctx.stroke();
  } else {
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+28, gy-42); fctx.stroke();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-18, gy-30); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-14, gy); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+16, gy); fctx.stroke();
  }
}

function drawShotAthlete(x, gy, pose, gold, light) {
  if (pose === 'idle') {
    // Ball tucked at neck, low wide glide stance
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-18, gy-28); fctx.stroke();
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+14, gy-46); fctx.stroke();
    const sg = fctx.createRadialGradient(x+14, gy-50, 0, x+14, gy-50, 6);
    sg.addColorStop(0, '#ccd0e0'); sg.addColorStop(1, '#383840');
    fctx.fillStyle = sg;
    fctx.beginPath(); fctx.arc(x+14, gy-49, 6, 0, Math.PI*2); fctx.fill();
    fctx.fillStyle = 'rgba(255,255,255,0.18)';
    fctx.beginPath(); fctx.arc(x+12, gy-52, 2, 0, Math.PI*2); fctx.fill();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-18, gy+2); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+10, gy); fctx.stroke();
  } else if (pose === 'throw') {
    // Explosive push: arm fully extended upward-forward from shoulder
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-14, gy-27); fctx.stroke();
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-40); fctx.lineTo(x+30, gy-55); fctx.stroke();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-16, gy+2); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+10, gy); fctx.stroke();
  } else {
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+22, gy-46); fctx.stroke();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-14, gy-28); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-12, gy); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+14, gy); fctx.stroke();
  }
}

function drawJavelinAthlete(x, gy, pose, gold, light) {
  if (pose === 'idle') {
    // Running approach: arm raised holding javelin overhead
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-16, gy-26); fctx.stroke();
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+22, gy-60); fctx.stroke();
    // Javelin shaft
    fctx.strokeStyle = '#d0b440'; fctx.lineWidth = 2;
    fctx.beginPath(); fctx.moveTo(x-14, gy-57); fctx.lineTo(x+42, gy-68); fctx.stroke();
    fctx.fillStyle = '#e0e4f0';
    fctx.beginPath();
    fctx.moveTo(x+42, gy-68); fctx.lineTo(x+50, gy-70); fctx.lineTo(x+42, gy-66);
    fctx.closePath(); fctx.fill();
    // Running stride legs
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-20, gy-5); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+14, gy); fctx.stroke();
  } else if (pose === 'throw') {
    // Plant-and-whip: arm fully extended forward-up
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-14, gy-26); fctx.stroke();
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+28, gy-60); fctx.stroke();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-18, gy+2); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+10, gy); fctx.stroke();
  } else {
    fctx.strokeStyle = light; fctx.lineWidth = 3.5;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x+28, gy-50); fctx.stroke();
    fctx.strokeStyle = gold; fctx.lineWidth = 3;
    fctx.beginPath(); fctx.moveTo(x, gy-38); fctx.lineTo(x-14, gy-30); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x-12, gy); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy-20); fctx.lineTo(x+16, gy+2); fctx.stroke();
  }
}

// ── Implement + trail composite ────────────────────────────────────────────
function drawImplementWithTrail() {
  if (fieldState.ballTrail.length === 0) return;
  const gy     = groundY();
  const ox     = throwerX();
  const ec     = EVENT_CANVAS[eventSelect.value];
  const evKey  = eventSelect.value;
  const scaleX = (fieldW * 0.85) / ec.maxDist;
  const peakH  = fieldH * 0.62;
  const maxBy  = fieldState.animMaxBy;

  // Color-coded trail per event
  const trailColors = { discus: '#a0b0e0', hammer: '#f0d080', shotPut: '#b0b0c8', javelin: '#d4c060' };
  const tCol = trailColors[evKey] || '#ffffff';

  fieldState.ballTrail.forEach((p, i) => {
    const frac = i / fieldState.ballTrail.length;
    const sx   = ox + p.bx * scaleX;
    const sy   = gy - (p.by / maxBy) * peakH;
    fctx.save();
    fctx.globalAlpha = frac * 0.38;
    fctx.fillStyle = tCol;
    fctx.beginPath(); fctx.arc(sx, sy, 1.5 + frac * 3.5, 0, Math.PI * 2); fctx.fill();
    fctx.restore();
  });

  const last = fieldState.ballTrail[fieldState.ballTrail.length - 1];
  const sx = ox + last.bx * scaleX;
  const sy = gy - (last.by / maxBy) * peakH;

  // Ground shadow (grows as implement falls)
  const shadowScale = Math.max(0, 1 - last.by / maxBy);
  fctx.save();
  fctx.globalAlpha = 0.25 * shadowScale;
  fctx.fillStyle = '#000';
  fctx.beginPath(); fctx.ellipse(sx, gy + 4, 9 * shadowScale + 3, 2, 0, 0, Math.PI * 2); fctx.fill();
  fctx.restore();

  fieldState.rotFrame++;
  if      (evKey === 'discus')  drawDiscus(sx, sy, fieldState.rotFrame);
  else if (evKey === 'hammer')  drawHammerBall(sx, sy, fieldState.rotFrame);
  else if (evKey === 'shotPut') drawShotPutBall(sx, sy);
  else                          drawJavelinInFlight(sx, sy, fieldState.lastVx, fieldState.lastVy);
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

  const dist  = entry.distance;
  const rad   = angle * Math.PI / 180;
  const v0    = power * 0.013;
  const v0x   = v0 * Math.cos(rad);
  const v0y   = v0 * Math.sin(rad);
  const g     = 0.003;
  const peakT = v0y / g;
  fieldState.animMaxBy = Math.max(8, v0y * peakT - 0.5 * g * peakT * peakT);
  fieldState.ballTrail = [];
  fieldState.animating = true;
  fieldState.rotFrame  = 0;

  let t = 0;
  (function step() {
    const bx = v0x * t;
    const by = v0y * t - 0.5 * g * t * t;
    const vy = v0y - g * t;

    fieldState.lastVx = v0x;
    fieldState.lastVy = vy;
    fieldState.ballTrail.push({ bx, by });
    if (fieldState.ballTrail.length > 22) fieldState.ballTrail.shift();

    drawFieldScene();
    drawAthlete(t < 14 ? 'throw' : 'follow');
    drawImplementWithTrail();

    if (by < 0 || bx >= dist) {
      fieldState.landingMarkers.push({ dist, foul: false });
      fieldState.ballTrail = [];
      fieldState.animating = false;
      drawFieldScene();
      drawAthlete('follow');
      drawLandingMarker(dist, false, 1);
      return;
    }
    t += 1;
    requestAnimationFrame(step);
  })();
};
