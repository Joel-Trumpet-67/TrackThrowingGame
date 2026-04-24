// --- DOM refs ---
const eventSelect      = document.getElementById('event');
const athleteSelect    = document.getElementById('athlete');
const playerNameInput  = document.getElementById('playerName');
const powerInput       = document.getElementById('power');
const angleInput       = document.getElementById('angle');
const windToggle       = document.getElementById('windToggle');
const powerValue       = document.getElementById('powerValue');
const angleValue       = document.getElementById('angleValue');
const throwBtn         = document.getElementById('throwBtn');
const newRoundBtn      = document.getElementById('newRoundBtn');
const resetBtn         = document.getElementById('resetBtn');

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

// --- Constants ---
const RECORDS_KEY     = 'throwers-game-records-v1';
const LEADERBOARD_KEY = 'throwers-game-lb-v1';
const MAX_ROUND       = 6;
const LB_MAX          = 10;

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
    description: 'Discus rewards smooth technique and a medium release angle.'
  },
  shotPut: {
    name: 'Shot Put',
    emoji: '⚫',
    baseVelocity: 17,
    idealAngle: 39,
    anglePenalty: 0.04,
    variability: 1.9,
    foulAngleRange: [30, 49],
    description: 'Shot put favors raw force and compact, explosive form.'
  },
  hammer: {
    name: 'Hammer Throw',
    emoji: '🔨',
    baseVelocity: 29,
    idealAngle: 43,
    anglePenalty: 0.025,
    variability: 3.2,
    foulAngleRange: [31, 50],
    description: 'Hammer throw has high speed potential but variable timing.'
  },
  javelin: {
    name: 'Javelin',
    emoji: '🏹',
    baseVelocity: 31,
    idealAngle: 34,
    anglePenalty: 0.02,
    variability: 2.4,
    foulAngleRange: [22, 43],
    description: 'Javelin rewards precise release with efficient aerodynamics.'
  }
};

const ATHLETE_PROFILES = {
  balanced:  { velocityBoost: 1,    control: 1,    label: 'Balanced' },
  power:     { velocityBoost: 1.08, control: 0.88, label: 'Power Specialist' },
  technique: { velocityBoost: 0.94, control: 1.15, label: 'Technique Specialist' }
};

// --- State ---
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

// --- Audio (Web Audio API, no files needed) ---
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
  } catch { /* audio blocked by browser – silent fail */ }
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

// --- Animation ---
function animateThrow(foul, isRecord) {
  throwAnimEl.classList.remove('animate', 'animate-foul');
  void throwAnimEl.offsetWidth; // reflow to restart animation
  if (foul) {
    throwAnimEl.textContent = '❌';
    throwAnimEl.classList.add('animate-foul');
  } else if (isRecord) {
    throwAnimEl.textContent = '🏆';
    throwAnimEl.classList.add('animate');
  } else {
    const ev = EVENT_PROFILES[eventSelect.value];
    throwAnimEl.textContent = ev.emoji;
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

// --- Formatting ---
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

// --- Leaderboard helpers ---
function submitToLeaderboard(eventKey, name, distance) {
  if (!state.leaderboard[eventKey]) state.leaderboard[eventKey] = [];
  state.leaderboard[eventKey].push({ name: name.trim() || 'Athlete', distance });
  state.leaderboard[eventKey].sort((a, b) => b.distance - a.distance);
  if (state.leaderboard[eventKey].length > LB_MAX)
    state.leaderboard[eventKey].length = LB_MAX;
  saveLeaderboard();
}

// --- Render functions ---
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
      const rec = e.isRecord ? ' ★ PR!' : '';
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
    const v = state.records[k];
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
    const li = document.createElement('li');
    const isYou = e.name === currentPlayer;
    if (isYou) li.className = 'lb-you';
    li.innerHTML = `<span class="lb-name">${i + 1}. ${e.name}${isYou ? ' (you)' : ''}</span><span class="lb-dist">${fmt(e.distance)}</span>`;
    leaderboardEl.appendChild(li);
  });
}

// --- Core throw handler ---
function handleThrow() {
  if (state.roundAttempt >= MAX_ROUND) {
    statusEl.textContent = 'Round complete. Click "Start New 6-Throw Round".';
    return;
  }

  const eventKey   = eventSelect.value;
  const athleteKey = athleteSelect.value;
  const power      = Number(powerInput.value);
  const angle      = Number(angleInput.value);
  const playerName = playerNameInput.value.trim() || 'Athlete';

  const result = calculateThrow(eventKey, athleteKey, power, angle);

  state.attempts      += 1;
  state.roundAttempt  += 1;
  attemptsEl.textContent     = state.attempts;
  roundAttemptEl.textContent = state.roundAttempt;

  let isRecord = false;

  if (result.foul) {
    statusEl.textContent = 'FOUL – adjust angle or power.';
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
    statusEl.textContent = 'Round complete. Start a new 6-throw round.';
    statusEl.className   = '';
  }
}

function startNewRound() {
  state.roundAttempt   = 0;
  state.roundDistances = [];
  roundAttemptEl.textContent = '0';
  throwBtn.disabled    = false;
  statusEl.textContent = 'New round started. Good luck!';
  statusEl.className   = '';
  renderRanking();
  generateWind();
}

function resetSession() {
  state.attempts       = 0;
  state.roundAttempt   = 0;
  state.best           = 0;
  state.log            = [];
  state.roundDistances = [];

  attemptsEl.textContent     = '0';
  roundAttemptEl.textContent = '0';
  lastThrow.textContent      = '-- m';
  bestThrow.textContent      = '-- m';
  throwBtn.disabled          = false;
  statusEl.textContent       = 'Session reset. Round ready.';
  statusEl.className         = '';

  renderHistory();
  renderRanking();
  renderRecords();
  generateWind();
}

// --- Event listeners ---
powerInput.addEventListener('input', () => { powerValue.textContent = powerInput.value; });
angleInput.addEventListener('input', () => { angleValue.textContent = angleInput.value; });
eventSelect.addEventListener('change', renderDescription);
windToggle.addEventListener('change', generateWind);
playerNameInput.addEventListener('input', renderLeaderboard);
throwBtn.addEventListener('click', handleThrow);
newRoundBtn.addEventListener('click', startNewRound);
resetBtn.addEventListener('click', resetSession);

// --- Init ---
renderDescription();
renderRanking();
renderRecords();
buildLbTabs();
renderLeaderboard();
generateWind();
