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

// ---- Skins / temas visuales ----
// Cada skin define su propia paleta de colores por pieza, un color de fondo
// opcional para el tablero, y un "style" que determina cómo drawBlock()
// dibuja cada celda (plano, con glow, redondeado o con patrón pixel art).
const SKINS = {
  retro: {
    label: 'Retro',
    style: 'retro',
    background: null,
    colors: [
      null,
      '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784',
      '#e57373', '#5c9ce6', '#ffb74d', '#ffd700',
    ],
  },
  neon: {
    label: 'Neon',
    style: 'neon',
    background: '#000000',
    colors: [
      null,
      '#00fff2', '#faff00', '#ff21f5', '#39ff6a',
      '#ff2d55', '#3d8bff', '#ff9100', '#f8ff00',
    ],
  },
  pastel: {
    label: 'Pastel',
    style: 'pastel',
    background: null,
    colors: [
      null,
      '#a8dadc', '#fff3b8', '#dcc6ec', '#c1e7c1',
      '#f6b8b6', '#b8cdf0', '#ffd8ab', '#fff0a8',
    ],
  },
  pixel: {
    label: 'Pixel Art',
    style: 'pixel',
    background: null,
    colors: [
      null,
      '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784',
      '#e57373', '#5c9ce6', '#ffb74d', '#ffd700',
    ],
  },
};

let currentSkin = 'retro';
const SKIN_KEY = 'tetris-skin';

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
const skinSelect = document.getElementById('skin-select');

const viewGameover = document.getElementById('view-gameover');
const viewPause = document.getElementById('view-pause');
const viewControls = document.getElementById('view-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelOptionsEl = document.getElementById('level-options');
const recordsListEl = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const overlayGlobalRecordsEl = document.getElementById('overlay-global-records');
const nameFormEl = document.getElementById('name-form');
const nameInputEl = document.getElementById('name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const overlayRecordsEl = document.getElementById('overlay-records');
const overlayRecordsListEl = document.getElementById('overlay-records-list');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxComboThisGame;
let pendingNewRecord = null;

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const MAX_START_LEVEL = 10;

let startLevel = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
if (!Number.isInteger(startLevel) || startLevel < 1 || startLevel > MAX_START_LEVEL) {
  startLevel = 1;
}

function updateLevelButtonsActive() {
  for (const btn of levelOptionsEl.children) {
    btn.classList.toggle('active', Number(btn.textContent) === startLevel);
  }
}

function buildLevelOptions() {
  levelOptionsEl.innerHTML = '';
  for (let i = 1; i <= MAX_START_LEVEL; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'level-btn';
    btn.textContent = i;
    btn.addEventListener('click', () => {
      startLevel = i;
      localStorage.setItem(START_LEVEL_KEY, String(i));
      updateLevelButtonsActive();
    });
    levelOptionsEl.appendChild(btn);
  }
  updateLevelButtonsActive();
}

buildLevelOptions();

const RECORDS_KEY = 'tetris-top-scores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';
const MAX_RECORDS = 5;

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

/* ---- Tabla de records (localStorage) ---- */

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function getBestCombo() {
  return parseInt(localStorage.getItem(BEST_COMBO_KEY), 10) || 0;
}

function setBestCombo(value) {
  localStorage.setItem(BEST_COMBO_KEY, String(value));
}

function getMaxLines() {
  return parseInt(localStorage.getItem(MAX_LINES_KEY), 10) || 0;
}

function setMaxLines(value) {
  localStorage.setItem(MAX_LINES_KEY, String(value));
}

function qualifiesForTop(points) {
  const records = loadRecords();
  if (records.length < MAX_RECORDS) return true;
  return points > records[records.length - 1].score;
}

function insertRecord(name, points) {
  const records = loadRecords();
  const entry = { name: name || 'Jugador', score: points };
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  const trimmed = records.slice(0, MAX_RECORDS);
  saveRecords(trimmed);
  return { records: trimmed, entry };
}

function renderRecordsList(listEl, records, highlightEntry) {
  listEl.innerHTML = '';
  if (records.length === 0) {
    const li = document.createElement('li');
    li.className = 'record-empty';
    li.textContent = 'Sin records todavía';
    listEl.appendChild(li);
    return;
  }
  records.forEach((rec, i) => {
    const li = document.createElement('li');
    li.className = 'record-item';
    if (highlightEntry && rec === highlightEntry) li.classList.add('record-highlight');

    const rank = document.createElement('span');
    rank.className = 'record-rank';
    rank.textContent = `${i + 1}.`;

    const name = document.createElement('span');
    name.className = 'record-name';
    name.textContent = rec.name;

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'record-score';
    scoreSpan.textContent = rec.score.toLocaleString();

    li.append(rank, name, scoreSpan);
    listEl.appendChild(li);
  });
}

function refreshSidebarRecords() {
  renderRecordsList(recordsListEl, loadRecords(), null);
  bestComboEl.textContent = getBestCombo();
  maxLinesEl.textContent = getMaxLines();
}

resetRecordsBtn.addEventListener('click', () => {
  const ok = confirm('¿Seguro que quieres borrar todos los records?');
  if (!ok) return;
  localStorage.removeItem(RECORDS_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(MAX_LINES_KEY);
  refreshSidebarRecords();
});

function applySkin(skinId) {
  if (!SKINS[skinId]) skinId = 'retro';
  currentSkin = skinId;
  if (skinSelect) skinSelect.value = skinId;
  // Aplicación en caliente: si el juego ya está inicializado, redibujamos
  // inmediatamente para reflejar el nuevo skin sin esperar al próximo frame.
  if (typeof board !== 'undefined' && board) {
    draw();
    drawNext();
  }
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(saved && SKINS[saved] ? saved : 'retro');
}

if (skinSelect) {
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value);
    localStorage.setItem(SKIN_KEY, currentSkin);
  });
}

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
    if (combo > maxComboThisGame) maxComboThisGame = combo;
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

// Dibuja un rectángulo con esquinas redondeadas, usando ctx.roundRect si el
// navegador lo soporta, o trazando el path manualmente como fallback.
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.quadraticCurveTo(x + w, y, x + w, y + r);
  context.lineTo(x + w, y + h - r);
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  context.lineTo(x + r, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

// Patrón de "ruido" pixelado: un mini-tablero de 4x4 celdas con sombreado
// alterno sobre el color base, para dar sensación de textura retro-pixel.
function drawPixelPattern(context, px, py, size) {
  const cell = size / 4;
  context.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2 === 0) {
        context.fillRect(px + 1 + i * cell, py + 1 + j * cell, cell, cell);
      }
    }
  }
  context.fillStyle = 'rgba(255, 255, 255, 0.22)';
  context.fillRect(px + 1, py + 1, cell, cell);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS.retro;
  const color = skin.colors[colorIndex] || COLORS[colorIndex];
  const px = x * size;
  const py = y * size;

  context.save();
  context.globalAlpha = alpha ?? 1;

  switch (skin.style) {
    case 'neon': {
      context.shadowBlur = 14;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(255, 255, 255, 0.3)';
      context.fillRect(px + 1, py + 1, size - 2, 3);
      break;
    }
    case 'pastel': {
      const r = Math.max(3, size * 0.2);
      roundedRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, r);
      context.fillStyle = color;
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.45)';
      roundedRectPath(context, px + 4, py + 4, size - 8, (size - 8) / 2, r * 0.6);
      context.fill();
      break;
    }
    case 'pixel': {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      drawPixelPattern(context, px, py, size);
      context.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      context.lineWidth = 1;
      context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
      break;
    }
    default: {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = getThemeColor('--block-highlight');
      context.fillRect(px + 1, py + 1, size - 2, 4);
    }
  }

  context.restore();
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
  const skin = SKINS[currentSkin] || SKINS.retro;
  if (skin.background) {
    ctx.fillStyle = skin.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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
  const skin = SKINS[currentSkin] || SKINS.retro;
  if (skin.background) {
    nextCtx.fillStyle = skin.background;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function setOverlayView(view) {
  viewGameover.classList.toggle('hidden', view !== 'gameover');
  viewPause.classList.toggle('hidden', view !== 'pause');
  viewControls.classList.toggle('hidden', view !== 'controls');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  setOverlayView('gameover');

  // Records globales de combo y líneas (independientes del top 5)
  const newComboRecord = maxComboThisGame > getBestCombo();
  if (newComboRecord) setBestCombo(maxComboThisGame);
  const newLinesRecord = lines > getMaxLines();
  if (newLinesRecord) setMaxLines(lines);

  overlayGlobalRecordsEl.innerHTML = '';
  const comboSpan = document.createElement('span');
  comboSpan.textContent = `Mejor combo: ${getBestCombo()}${newComboRecord ? ' (¡nuevo récord!)' : ''}`;
  const linesSpan = document.createElement('span');
  linesSpan.textContent = `Líneas máx: ${getMaxLines()}${newLinesRecord ? ' (¡nuevo récord!)' : ''}`;
  overlayGlobalRecordsEl.append(comboSpan, linesSpan);

  pendingNewRecord = null;
  if (qualifiesForTop(score)) {
    nameFormEl.classList.remove('hidden');
    overlayRecordsEl.classList.add('hidden');
    nameInputEl.value = '';
    setTimeout(() => nameInputEl.focus(), 0);
  } else {
    nameFormEl.classList.add('hidden');
    overlayRecordsEl.classList.remove('hidden');
    renderRecordsList(overlayRecordsListEl, loadRecords(), null);
  }

  refreshSidebarRecords();
  overlay.classList.remove('hidden');
}

function confirmNameAndSaveRecord() {
  const name = nameInputEl.value.trim().slice(0, 12) || 'Jugador';
  const { records, entry } = insertRecord(name, score);
  pendingNewRecord = entry;
  nameFormEl.classList.add('hidden');
  overlayRecordsEl.classList.remove('hidden');
  renderRecordsList(overlayRecordsListEl, records, pendingNewRecord);
  refreshSidebarRecords();
}

saveNameBtn.addEventListener('click', confirmNameAndSaveRecord);
nameInputEl.addEventListener('keydown', e => {
  if (e.code === 'Enter') confirmNameAndSaveRecord();
});

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    setOverlayView('pause');
    overlay.classList.remove('hidden');
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
  combo = 0;
  maxComboThisGame = 0;
  pendingNewRecord = null;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  setOverlayView('gameover');
  overlay.classList.add('hidden');
  nameFormEl.classList.add('hidden');
  overlayRecordsEl.classList.add('hidden');
  overlayGlobalRecordsEl.innerHTML = '';
  refreshSidebarRecords();
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

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

pauseRestartBtn.addEventListener('click', init);

controlsToggleBtn.addEventListener('click', () => setOverlayView('controls'));
controlsBackBtn.addEventListener('click', () => setOverlayView('pause'));

init();
