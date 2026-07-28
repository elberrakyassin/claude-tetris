'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKIN_PALETTES = {
  retro: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#5c9ce6', '#ffb74d', '#ffd700'],
  neon: [null, '#00f0ff', '#faff00', '#ff00e6', '#00ff7f', '#ff2d55', '#2d8bff', '#ff9500', '#ffe600'],
  pastel: [null, '#a8d8e8', '#fff2b8', '#dcbbea', '#bce8c3', '#f4bcbc', '#bcc9f0', '#f5d3a8', '#f5eba8'],
  pixel: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#5c9ce6', '#ffb74d', '#ffd700'],
};

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
const recordsListEl = document.getElementById('records-list');
const overlayRecordsListEl = document.getElementById('overlay-records-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const skinSelect = document.getElementById('skin-select');

const pauseOverlay = document.getElementById('pause-overlay');
const pauseMenu = document.getElementById('pause-menu');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const restartBtnPause = document.getElementById('restart-btn-pause');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, startLevel;
let combo, sessionMaxCombo, lastSavedId;

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';

function initStartLevel() {
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  startLevel = saved >= 1 && saved <= 10 ? saved : 1;
  startLevelSelect.value = String(startLevel);
}

startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
  localStorage.setItem(START_LEVEL_KEY, String(startLevel));
});

initStartLevel();

const SCORES_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';
const MAX_SCORES = 5;

function loadScores() {
  try {
    const data = JSON.parse(localStorage.getItem(SCORES_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveScoresList(scores) {
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
}

function loadStats() {
  try {
    const data = JSON.parse(localStorage.getItem(STATS_KEY));
    return { bestCombo: 0, maxLines: 0, ...data };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function qualifiesForTop(candidateScore) {
  const scores = loadScores();
  return scores.length < MAX_SCORES || candidateScore > scores[scores.length - 1].score;
}

function addScore(name, candidateScore) {
  const scores = loadScores();
  const id = Date.now() + Math.random();
  scores.push({ id, name: (name || 'AAA').slice(0, 10), score: candidateScore });
  scores.sort((a, b) => b.score - a.score);
  scores.splice(MAX_SCORES);
  saveScoresList(scores);
  lastSavedId = id;
  renderRecords();
}

function renderRecordsList(listEl) {
  const scores = loadScores();
  listEl.innerHTML = '';
  if (scores.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin puntuaciones';
    li.className = 'empty';
    listEl.appendChild(li);
    return;
  }
  scores.forEach((entry, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${entry.name} — ${entry.score.toLocaleString()}`;
    if (entry.id === lastSavedId) li.classList.add('highlight');
    listEl.appendChild(li);
  });
}

function renderRecords() {
  renderRecordsList(recordsListEl);
  renderRecordsList(overlayRecordsListEl);
  const stats = loadStats();
  bestComboEl.textContent = stats.bestCombo;
  maxLinesEl.textContent = stats.maxLines;
}

function updateGlobalStats() {
  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, sessionMaxCombo);
  stats.maxLines = Math.max(stats.maxLines, lines);
  saveStats(stats);
}

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Resetear todos los records?')) return;
  localStorage.removeItem(SCORES_KEY);
  localStorage.removeItem(STATS_KEY);
  lastSavedId = null;
  renderRecords();
});

saveScoreBtn.addEventListener('click', () => {
  addScore(nameInput.value.trim(), score);
  nameEntry.classList.add('hidden');
});

nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveScoreBtn.click();
});

const SKIN_KEY = 'tetris-skin';
let currentSkin = 'retro';

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

function applySkin(skin) {
  currentSkin = SKIN_PALETTES[skin] ? skin : 'retro';
  document.body.classList.remove('skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixel');
  document.body.classList.add(`skin-${currentSkin}`);
  skinSelect.value = currentSkin;
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(saved || 'retro');
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  localStorage.setItem(SKIN_KEY, currentSkin);
  if (next) drawNext();
});

initTheme();
initSkin();

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
    combo++;
    sessionMaxCombo = Math.max(sessionMaxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
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
  clearLines();
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

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + percent);
  const g = clamp(((num >> 8) & 0xff) + percent);
  const b = clamp((num & 0xff) + percent);
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawRetroBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = getThemeColor('--block-highlight');
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeonBlock(context, px, py, size, color) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = size * 0.5;
  context.fillStyle = '#0a0a0a';
  context.fillRect(px + 2, py + 2, size - 4, size - 4);
  context.shadowBlur = size * 0.35;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5);
  context.restore();
}

function drawPastelBlock(context, px, py, size, color) {
  const r = size * 0.2;
  roundRectPath(context, px + 2, py + 2, size - 4, size - 4, r);
  context.fillStyle = color;
  context.fill();
  roundRectPath(context, px + 2, py + 2, size - 4, (size - 4) / 2, r);
  context.fillStyle = 'rgba(255, 255, 255, 0.45)';
  context.fill();
}

function drawPixelBlock(context, px, py, size, color) {
  const baseAlpha = context.globalAlpha;
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  const px8 = Math.max(2, Math.floor(size / 6));
  const light = shadeColor(color, 35);
  const dark = shadeColor(color, -35);
  for (let yy = 0; yy < size - 2; yy += px8) {
    for (let xx = 0; xx < size - 2; xx += px8) {
      const checker = ((xx / px8) + (yy / px8)) % 2 === 0;
      context.fillStyle = checker ? light : dark;
      context.globalAlpha = baseAlpha * 0.18;
      context.fillRect(px + 1 + xx, py + 1 + yy, px8, px8);
    }
  }
  context.globalAlpha = baseAlpha;
  context.strokeStyle = shadeColor(color, -50);
  context.lineWidth = 2;
  context.strokeRect(px + 1, py + 1, size - 2, size - 2);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKIN_PALETTES[currentSkin][colorIndex];
  const px = x * size;
  const py = y * size;
  context.globalAlpha = alpha ?? 1;
  switch (currentSkin) {
    case 'neon':
      drawNeonBlock(context, px, py, size, color);
      break;
    case 'pastel':
      drawPastelBlock(context, px, py, size, color);
      break;
    case 'pixel':
      drawPixelBlock(context, px, py, size, color);
      break;
    default:
      drawRetroBlock(context, px, py, size, color);
  }
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
  updateGlobalStats();
  lastSavedId = null;
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  if (qualifiesForTop(score)) {
    nameEntry.classList.remove('hidden');
    nameInput.value = '';
    renderRecords();
    nameInput.focus();
  } else {
    nameEntry.classList.add('hidden');
    renderRecords();
  }
  overlay.classList.remove('hidden');
}

function showPauseMenu() {
  pauseControls.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
    pauseOverlay.classList.remove('hidden');
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
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  combo = 0;
  sessionMaxCombo = 0;
  lastSavedId = null;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  renderRecords();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
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

resumeBtn.addEventListener('click', togglePause);
restartBtnPause.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  pauseMenu.classList.add('hidden');
  pauseControls.classList.remove('hidden');
});
backBtn.addEventListener('click', showPauseMenu);

init();
