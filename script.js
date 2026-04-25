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
  landingMarkers: [], // { dist, foul }
  ballAnim: null,     // active throw animation
  athletePose: 'idle' // 'idle' | 'throw' | 'follow'
};

function resizeField() {
  fieldW = fieldCanvas.width  = fieldCanvas.offsetWidth;
  fieldH = fieldCanvas.height = fieldCanvas.offsetHeight;
  drawFieldScene();
}

window.addEventListener('resize', resizeField);
resizeField();

// Map a distance (metres) to a canvas X position
function distToCanvasX(dist) {
  const maxDist = 100;
  return fieldW * 0.09 + (dist / maxDist) * fieldW * 0.87;
}

function groundY() { return fieldH * 0.68; }

function drawFieldScene() {
  if (!fctx || fieldW === 0) return;
  const gy = groundY();

  // Sky gradient
  const sky = fctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, '#0d1f2d');
  sky.addColorStop(1, '#1a3020');
  fctx.fillStyle = sky;
  fctx.fillRect(0, 0, fieldW, gy);

  // Grass
  const grass = fctx.createLinearGradient(0, gy, 0, fieldH);
  grass.addColorStop(0, '#2d5a1b');
  grass.addColorStop(1, '#1e3d12');
  fctx.fillStyle = grass;
  fctx.fillRect(0, gy, fieldW, fieldH - gy);

  // Sector fan lines
  fctx.save();
  fctx.strokeStyle = '#c8b850';
  fctx.lineWidth = 1;
  fctx.globalAlpha = 0.28;
  const ox = fieldW * 0.09, oy = gy;
  for (let a = 22; a <= 50; a += 7) {
    const r   = fieldW * 1.1;
    const rad = a * Math.PI / 180;
    fctx.beginPath();
    fctx.moveTo(ox, oy);
    fctx.lineTo(ox + r * Math.cos(rad), oy - r * Math.sin(rad));
    fctx.stroke();
  }
  fctx.restore();

  // Distance tick marks + labels
  fctx.save();
  fctx.strokeStyle = '#c8b850';
  fctx.fillStyle   = 'rgba(255,255,255,0.35)';
  fctx.font        = '10px monospace';
  fctx.textAlign   = 'center';
  fctx.lineWidth   = 1;
  for (let d = 20; d <= 100; d += 10) {
    const tx = distToCanvasX(d);
    fctx.globalAlpha = 0.3;
    fctx.beginPath();
    fctx.moveTo(tx, gy - 5);
    fctx.lineTo(tx, gy + 5);
    fctx.stroke();
    fctx.globalAlpha = 0.35;
    fctx.fillText(d + 'm', tx, gy + 15);
  }
  fctx.restore();

  // Throw circle
  fctx.save();
  fctx.strokeStyle = '#aaa';
  fctx.lineWidth   = 2;
  fctx.beginPath();
  fctx.arc(fieldW * 0.09, gy, 14, 0, Math.PI * 2);
  fctx.stroke();
  fctx.restore();

  // Previous landing markers
  fieldState.landingMarkers.slice(-6).forEach((m, i, arr) => {
    const alpha = 0.15 + (i / arr.length) * 0.35;
    drawLandingX(m.dist, m.foul, alpha);
  });
}

function drawLandingX(dist, foul, alpha = 1) {
  const x  = distToCanvasX(dist);
  const gy = groundY();
  fctx.save();
  fctx.globalAlpha  = alpha;
  fctx.strokeStyle  = foul ? '#e05c5c' : '#ff4444';
  fctx.lineWidth    = alpha >= 0.9 ? 2.5 : 1.5;
  const s = 6;
  fctx.beginPath();
  fctx.moveTo(x - s, gy - s); fctx.lineTo(x + s, gy + s);
  fctx.moveTo(x + s, gy - s); fctx.lineTo(x - s, gy + s);
  fctx.stroke();
  if (alpha >= 0.9) {
    fctx.fillStyle = foul ? '#e05c5c' : '#ff4444';
    fctx.font      = 'bold 12px monospace';
    fctx.textAlign = 'left';
    fctx.fillText(dist.toFixed(2) + ' m', x + 9, gy - 3);
  }
  fctx.restore();
}

function drawAthlete(pose) {
  const x  = fieldW * 0.09;
  const gy = groundY();
  fctx.save();
  fctx.strokeStyle = '#ffc857';
  fctx.lineWidth   = 2.5;
  fctx.lineCap     = 'round';

  // Head
  fctx.beginPath();
  fctx.arc(x, gy - 50, 8, 0, Math.PI * 2);
  fctx.stroke();

  // Body
  fctx.beginPath();
  fctx.moveTo(x, gy - 42);
  fctx.lineTo(x, gy - 18);
  fctx.stroke();

  if (pose === 'idle') {
    fctx.beginPath(); fctx.moveTo(x, gy - 34); fctx.lineTo(x - 16, gy - 24); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy - 34); fctx.lineTo(x + 16, gy - 24); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy - 18); fctx.lineTo(x - 9,  gy);      fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy - 18); fctx.lineTo(x + 9,  gy);      fctx.stroke();
  } else if (pose === 'throw') {
    fctx.beginPath(); fctx.moveTo(x, gy - 34); fctx.lineTo(x + 22, gy - 50); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy - 34); fctx.lineTo(x - 14, gy - 24); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy - 18); fctx.lineTo(x - 13, gy);      fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy - 18); fctx.lineTo(x + 7,  gy);      fctx.stroke();
  } else { // follow
    fctx.beginPath(); fctx.moveTo(x, gy - 34); fctx.lineTo(x + 24, gy - 32); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy - 34); fctx.lineTo(x - 12, gy - 26); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy - 18); fctx.lineTo(x - 10, gy);      fctx.stroke();
    fctx.beginPath(); fctx.moveTo(x, gy - 18); fctx.lineTo(x + 13, gy);      fctx.stroke();
  }
  fctx.restore();
}

function drawBallAt(bx, by, totalDist) {
  const gy       = groundY();
  const maxDist  = 100;
  const scaleX   = (fieldW * 0.87) / maxDist;
  const peakH    = fieldH * 0.55;
  const maxBy    = Math.max(10, totalDist * 0.3);
  const ox       = fieldW * 0.09;

  const sx = ox + bx * scaleX;
  const sy = gy - (by / maxBy) * peakH;

  // Shadow
  fctx.save();
  fctx.fillStyle   = 'rgba(0,0,0,0.35)';
  fctx.beginPath();
  fctx.ellipse(sx, gy + 5, 7, 2.5, 0, 0, Math.PI * 2);
  fctx.fill();

  // Ball
  fctx.fillStyle = '#ffffff';
  fctx.beginPath();
  fctx.arc(sx, sy, 6, 0, Math.PI * 2);
  fctx.fill();
  fctx.restore();
}

// Hook into the existing executeThrow to drive the canvas
const _origExecuteThrow = executeThrow;
executeThrow = function(angle, power) {
  // Run original game logic
  _origExecuteThrow(angle, power);

  // Pull the last log entry to get result
  const entry = state.log[state.log.length - 1];
  if (!entry) return;

  fieldState.athletePose = 'throw';

  if (entry.foul || entry.distance <= 0) {
    fieldState.landingMarkers.push({ dist: 0, foul: true });
    drawFieldScene();
    drawAthlete('throw');
    setTimeout(() => {
      drawFieldScene();
      drawAthlete('follow');
    }, 400);
    return;
  }

  // Animate ball arc
  const dist    = entry.distance;
  const radians = angle * Math.PI / 180;
  const v0      = power * 0.012; // scale to internal units
  const v0x     = v0 * Math.cos(radians);
  const v0y     = v0 * Math.sin(radians);
  const g       = 0.0025;

  let t = 0;
  let raf;

  function step() {
    const bx = v0x * t;
    const by = v0y * t - 0.5 * g * t * t;

    drawFieldScene();
    drawAthlete(t < 12 ? 'throw' : 'follow');

    if (by < 0 || bx >= dist) {
      fieldState.landingMarkers.push({ dist, foul: false });
      drawFieldScene();
      drawAthlete('follow');
      drawLandingX(dist, false, 1);
      return;
    }

    drawBallAt(bx, by, dist);
    t += 1;
    raf = requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
};
