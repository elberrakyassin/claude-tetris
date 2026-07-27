'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#5c9ce6', // J - pale blue
  '#ffb74d', // L - orange
  '#ffd700', // Hollow 3x3 - dorado
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Hollow 3x3
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const pauseMainView = document.getElementById('pause-main-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const startingLevelSelect = document.getElementById('starting-level-select');

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const startLeaderboardList = document.getElementById('start-leaderboard-list');
const startBestCombo = document.getElementById('start-best-combo');
const startMaxLines = document.getElementById('start-max-lines');
const resetRecordsStartBtn = document.getElementById('reset-records-start-btn');

const overlayStats = document.getElementById('overlay-stats');
const overlayBestCombo = document.getElementById('overlay-best-combo');
const overlayMaxLines = document.getElementById('overlay-max-lines');
const newRecordForm = document.getElementById('new-record-form');
const playerNameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const overlayLeaderboardWrap = document.getElementById('overlay-leaderboard-wrap');
const overlayLeaderboardList = document.getElementById('overlay-leaderboard-list');
const resetRecordsOverlayBtn = document.getElementById('reset-records-overlay-btn');

let board, current, next, score, lines, level, combo, bestCombo, maxLinesInClear, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let startingLevel;
let pendingScoreEntry = null;
let gameStarted = false;

const THEME_KEY = 'tetris-theme';
const STARTING_LEVEL_KEY = 'tetris-starting-level';
const LEADERBOARD_KEY = 'tetris-leaderboard';
const STATS_KEY = 'tetris-stats';
const MAX_LEADERBOARD_ENTRIES = 5;

function getThemeColor(varName) {
  return getComputedStyle(document.body).getPropertyValue(varName).trim();
}

function applyTheme(isLight) {
  document.body.classList.toggle('light-theme', isLight);
  themeToggle.checked = isLight;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light');
}

themeToggle.addEventListener('change', () => {
  const isLight = themeToggle.checked;
  applyTheme(isLight);
  localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
});

initTheme();

function initStartingLevel() {
  const saved = parseInt(localStorage.getItem(STARTING_LEVEL_KEY), 10);
  startingLevel = (Number.isInteger(saved) && saved >= 1 && saved <= 10) ? saved : 1;
  startingLevelSelect.value = String(startingLevel);
}

startingLevelSelect.addEventListener('change', () => {
  startingLevel = parseInt(startingLevelSelect.value, 10);
  localStorage.setItem(STARTING_LEVEL_KEY, String(startingLevel));
});

initStartingLevel();

// ---- Tabla de récords (localStorage) ----

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(list) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
}

function qualifiesForLeaderboard(scoreValue) {
  const list = loadLeaderboard();
  if (list.length < MAX_LEADERBOARD_ENTRIES) return true;
  return scoreValue > list[list.length - 1].score;
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { bestCombo: 0, maxLines: 0 };
    const parsed = JSON.parse(raw);
    return {
      bestCombo: Number(parsed.bestCombo) || 0,
      maxLines: Number(parsed.maxLines) || 0,
    };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStatsIfBetter(sessionBestCombo, sessionMaxLines) {
  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, sessionBestCombo);
  stats.maxLines = Math.max(stats.maxLines, sessionMaxLines);
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return stats;
}

function resetRecords() {
  localStorage.removeItem(LEADERBOARD_KEY);
  localStorage.removeItem(STATS_KEY);
}

function renderLeaderboardList(listEl, highlightIndex) {
  listEl.textContent = '';
  const list = loadLeaderboard();
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'leaderboard-empty';
    li.textContent = 'Sin récords todavía';
    listEl.appendChild(li);
    return;
  }
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'leaderboard-item';
    if (i === highlightIndex) li.classList.add('leaderboard-item-new');

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = `${i + 1}.`;

    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = entry.nombre || '---';

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'leaderboard-score';
    scoreSpan.textContent = Number(entry.score || 0).toLocaleString();

    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(scoreSpan);
    listEl.appendChild(li);
  });
}

function renderStatsInto(bestComboEl, maxLinesEl) {
  const stats = loadStats();
  bestComboEl.textContent = stats.bestCombo;
  maxLinesEl.textContent = stats.maxLines;
}

function renderStartScreen() {
  renderLeaderboardList(startLeaderboardList, -1);
  renderStatsInto(startBestCombo, startMaxLines);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    bestCombo = Math.max(bestCombo, combo);
    maxLinesInClear = Math.max(maxLinesInClear, cleared);
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = getThemeColor('--block-highlight');
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getThemeColor('--grid-line');
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  saveStatsIfBetter(bestCombo, maxLinesInClear);
  renderStatsInto(overlayBestCombo, overlayMaxLines);
  overlayStats.classList.remove('hidden');

  if (qualifiesForLeaderboard(score)) {
    pendingScoreEntry = { score, combo: bestCombo, lineas: maxLinesInClear };
    playerNameInput.value = '';
    newRecordForm.classList.remove('hidden');
    overlayLeaderboardWrap.classList.add('hidden');
    resetRecordsOverlayBtn.classList.add('hidden');
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    pendingScoreEntry = null;
    newRecordForm.classList.add('hidden');
    overlayLeaderboardWrap.classList.remove('hidden');
    resetRecordsOverlayBtn.classList.remove('hidden');
    renderLeaderboardList(overlayLeaderboardList, -1);
  }

  overlay.classList.remove('hidden');
}

function showPauseMainView() {
  pauseControlsView.classList.add('hidden');
  pauseMainView.classList.remove('hidden');
}

function saveScoreEntry() {
  if (!pendingScoreEntry) return;
  const rawName = playerNameInput.value.trim();
  const nombre = (rawName || 'Jugador').slice(0, 12);
  const entry = {
    nombre,
    score: pendingScoreEntry.score,
    combo: pendingScoreEntry.combo,
    lineas: pendingScoreEntry.lineas,
  };

  const list = loadLeaderboard();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_LEADERBOARD_ENTRIES);
  saveLeaderboard(trimmed);
  const highlightIndex = trimmed.indexOf(entry);
  pendingScoreEntry = null;

  newRecordForm.classList.add('hidden');
  overlayLeaderboardWrap.classList.remove('hidden');
  resetRecordsOverlayBtn.classList.remove('hidden');
  renderLeaderboardList(overlayLeaderboardList, highlightIndex);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMainView();
    pauseMenu.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      if (gameOver) return;
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  gameStarted = true;
  board = createBoard();
  score = 0;
  lines = 0;
  level = startingLevel;
  combo = 0;
  bestCombo = 0;
  maxLinesInClear = 0;
  paused = false;
  gameOver = false;
  pendingScoreEntry = null;
  dropInterval = Math.max(100, 1000 - (startingLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  startScreen.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!gameStarted) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
playBtn.addEventListener('click', init);

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  pauseMainView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
});
backBtn.addEventListener('click', showPauseMainView);

saveScoreBtn.addEventListener('click', saveScoreEntry);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.preventDefault();
    saveScoreEntry();
  }
});

resetRecordsStartBtn.addEventListener('click', () => {
  resetRecords();
  renderStartScreen();
});

resetRecordsOverlayBtn.addEventListener('click', () => {
  resetRecords();
  renderLeaderboardList(overlayLeaderboardList, -1);
  renderStatsInto(overlayBestCombo, overlayMaxLines);
});

renderStartScreen();
