const eventSelect = document.getElementById('event');
const athleteSelect = document.getElementById('athlete');
const powerInput = document.getElementById('power');
const angleInput = document.getElementById('angle');
const powerValue = document.getElementById('powerValue');
const angleValue = document.getElementById('angleValue');
const throwBtn = document.getElementById('throwBtn');
const newRoundBtn = document.getElementById('newRoundBtn');
const resetBtn = document.getElementById('resetBtn');

const eventDescription = document.getElementById('eventDescription');
const lastThrow = document.getElementById('lastThrow');
const bestThrow = document.getElementById('bestThrow');
const attempts = document.getElementById('attempts');
const roundAttemptEl = document.getElementById('roundAttempt');
const windEl = document.getElementById('wind');
const statusEl = document.getElementById('status');
const history = document.getElementById('history');
const ranking = document.getElementById('ranking');
const recordsList = document.getElementById('records');

const RECORDS_KEY = 'throwers-game-records-v1';
const MAX_ROUND_ATTEMPTS = 6;

const EVENT_PROFILES = {
  discus: {
    name: 'Discus',
    baseVelocity: 26,
    idealAngle: 37,
    anglePenalty: 0.03,
    variability: 2.8,
    foulAngleRange: [26, 47],
    description: 'Discus rewards smooth technique and a medium release angle.'
  },
  shotPut: {
    name: 'Shot Put',
    baseVelocity: 17,
    idealAngle: 39,
    anglePenalty: 0.04,
    variability: 1.9,
    foulAngleRange: [30, 49],
    description: 'Shot put favors raw force and compact, explosive form.'
  },
  hammer: {
    name: 'Hammer Throw',
    baseVelocity: 29,
    idealAngle: 43,
    anglePenalty: 0.025,
    variability: 3.2,
    foulAngleRange: [31, 50],
    description: 'Hammer throw has high speed potential but variable timing.'
  },
  javelin: {
    name: 'Javelin',
    baseVelocity: 31,
    idealAngle: 34,
    anglePenalty: 0.02,
    variability: 2.4,
    foulAngleRange: [22, 43],
    description: 'Javelin rewards precise release with efficient aerodynamics.'
  }
};

const ATHLETE_PROFILES = {
  balanced: { velocityBoost: 1, control: 1, label: 'Balanced' },
  power: { velocityBoost: 1.08, control: 0.88, label: 'Power Specialist' },
  technique: { velocityBoost: 0.94, control: 1.15, label: 'Technique Specialist' }
};

const state = {
  attempts: 0,
  roundAttempt: 0,
  best: 0,
  log: [],
  roundDistances: [],
  wind: 0,
  records: loadRecords()
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(state.records));
}

function updateLiveValues() {
  powerValue.textContent = powerInput.value;
  angleValue.textContent = angleInput.value;
}

function updateDescription() {
  const event = EVENT_PROFILES[eventSelect.value];
  eventDescription.textContent = event.description;
}

function formatDistance(meters) {
  return `${meters.toFixed(2)} m`;
}

function generateWind() {
  const raw = (Math.random() * 8 - 4).toFixed(1);
  state.wind = Number(raw);
  windEl.textContent = `${state.wind.toFixed(1)} m/s`;
}

function isFoul(event, angleDegrees, powerPercent, athlete) {
  const [minAngle, maxAngle] = event.foulAngleRange;
  const outOfRange = angleDegrees < minAngle || angleDegrees > maxAngle;
  const unstablePower = powerPercent > 96 && athlete.control < 0.95;
  return outOfRange || unstablePower;
}

function calculateThrowDistance(eventKey, athleteKey, powerPercent, angleDegrees) {
  const event = EVENT_PROFILES[eventKey];
  const athlete = ATHLETE_PROFILES[athleteKey];

  if (isFoul(event, angleDegrees, powerPercent, athlete)) {
    return { foul: true, distance: 0 };
  }

  const gravity = 9.81;
  const windBoost = 1 + state.wind * 0.015;
  const releaseVelocity = event.baseVelocity * (powerPercent / 100) * athlete.velocityBoost * windBoost;

  const angleOffset = Math.abs(angleDegrees - event.idealAngle);
  const angleEfficiency = Math.max(0.76, 1 - angleOffset * event.anglePenalty * athlete.control);

  const randomTerm = (Math.random() - 0.5) * event.variability * (2 - athlete.control);
  const projectileDistance = ((releaseVelocity ** 2) * Math.sin(2 * toRadians(angleDegrees))) / gravity;
  const finalDistance = Math.max(1, projectileDistance * angleEfficiency + randomTerm);

  return { foul: false, distance: finalDistance };
}

function renderHistory() {
  history.innerHTML = '';

  [...state.log].reverse().forEach((entry) => {
    const li = document.createElement('li');
    if (entry.foul) {
      li.textContent = `#${entry.attempt} ${entry.event} (${entry.athlete}) → FOUL at ${entry.angle}° / ${entry.power}%`;
    } else {
      li.textContent = `#${entry.attempt} ${entry.event} (${entry.athlete}) → ${formatDistance(entry.distance)} at ${entry.angle}° / ${entry.power}% (wind ${entry.wind.toFixed(1)} m/s)`;
    }
    history.appendChild(li);
  });
}

function renderRanking() {
  ranking.innerHTML = '';

  if (state.roundDistances.length === 0) {
    ranking.innerHTML = '<li>No legal throws yet.</li>';
    return;
  }

  const top = [...state.roundDistances].sort((a, b) => b - a).slice(0, 3);
  top.forEach((distance, index) => {
    const li = document.createElement('li');
    li.textContent = `#${index + 1}: ${formatDistance(distance)}`;
    ranking.appendChild(li);
  });
}

function renderRecords() {
  recordsList.innerHTML = '';
  Object.keys(EVENT_PROFILES).forEach((eventKey) => {
    const li = document.createElement('li');
    const eventName = EVENT_PROFILES[eventKey].name;
    const value = state.records[eventKey];
    li.textContent = value ? `${eventName}: ${formatDistance(value)}` : `${eventName}: --`;
    recordsList.appendChild(li);
  });
}

function updateStats(throwResult) {
  state.attempts += 1;
  state.roundAttempt += 1;

  attempts.textContent = String(state.attempts);
  roundAttemptEl.textContent = String(state.roundAttempt);

  if (throwResult.foul) {
    lastThrow.textContent = 'FOUL';
    statusEl.textContent = 'Foul throw. Adjust angle/power for the next attempt.';
    return;
  }

  state.best = Math.max(state.best, throwResult.distance);
  lastThrow.textContent = formatDistance(throwResult.distance);
  bestThrow.textContent = formatDistance(state.best);
  state.roundDistances.push(throwResult.distance);
  statusEl.textContent = 'Legal throw recorded.';
}

function maybeSaveRecord(eventKey, throwResult) {
  if (throwResult.foul) {
    return;
  }

  const current = state.records[eventKey] ?? 0;
  if (throwResult.distance > current) {
    state.records[eventKey] = throwResult.distance;
    saveRecords();
    renderRecords();
  }
}

function lockRoundIfNeeded() {
  if (state.roundAttempt < MAX_ROUND_ATTEMPTS) {
    return;
  }

  throwBtn.disabled = true;
  statusEl.textContent = 'Round complete. Start a new 6-throw round.';
}

function handleThrow() {
  if (state.roundAttempt >= MAX_ROUND_ATTEMPTS) {
    statusEl.textContent = 'Round already complete. Click "Start New 6-Throw Round".';
    return;
  }

  const eventKey = eventSelect.value;
  const athleteKey = athleteSelect.value;
  const power = Number(powerInput.value);
  const angle = Number(angleInput.value);

  const throwResult = calculateThrowDistance(eventKey, athleteKey, power, angle);

  updateStats(throwResult);
  maybeSaveRecord(eventKey, throwResult);

  state.log.push({
    attempt: state.attempts,
    event: EVENT_PROFILES[eventKey].name,
    athlete: ATHLETE_PROFILES[athleteKey].label,
    power,
    angle,
    wind: state.wind,
    foul: throwResult.foul,
    distance: throwResult.distance
  });

  renderHistory();
  renderRanking();
  generateWind();
  lockRoundIfNeeded();
}

function startNewRound() {
  state.roundAttempt = 0;
  state.roundDistances = [];
  roundAttemptEl.textContent = '0';
  throwBtn.disabled = false;
  statusEl.textContent = 'New round started. Good luck!';
  renderRanking();
  generateWind();
}

function resetSession() {
  state.attempts = 0;
  state.roundAttempt = 0;
  state.best = 0;
  state.log = [];
  state.roundDistances = [];

  attempts.textContent = '0';
  roundAttemptEl.textContent = '0';
  lastThrow.textContent = '-- m';
  bestThrow.textContent = '-- m';
  throwBtn.disabled = false;
  statusEl.textContent = 'Session reset. Round ready.';

  renderHistory();
  renderRanking();
  renderRecords();
  generateWind();
}

powerInput.addEventListener('input', updateLiveValues);
angleInput.addEventListener('input', updateLiveValues);
eventSelect.addEventListener('change', updateDescription);
throwBtn.addEventListener('click', handleThrow);
newRoundBtn.addEventListener('click', startNewRound);
resetBtn.addEventListener('click', resetSession);

updateLiveValues();
updateDescription();
renderRanking();
renderRecords();
generateWind();
