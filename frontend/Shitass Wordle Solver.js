const API = {
  validate:    '/api/validate',     // POST { guess } → { valid: bool }
  submitGuess: '/api/guess',        // POST { guess, tiles: [{letter, colour}], history: [...] }
  suggestions: '/api/suggestions',  // POST { history } → { words: [{word, score}] }
};

const ROWS = 6, COLS = 5;
const CYCLE = ['', 'grey', 'yellow', 'green'];

let grid       = [];
let currentRow = 0;
let currentCol = 0;
let submitted  = new Array(ROWS).fill(false);
let history    = [];  // stateless: full guess history sent with every request

const gridEl = document.getElementById('grid');

/* ── BUILD GRID ── */
function buildGrid() {
  grid       = [];
  currentRow = 0;
  currentCol = 0;
  submitted  = new Array(ROWS).fill(false);
  history    = [];
  gridEl.innerHTML = '';

  for (let r = 0; r < ROWS; r++) {
    grid.push([]);
    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    rowEl.dataset.row = r;

    for (let c = 0; c < COLS; c++) {
      grid[r].push({ letter: '', colour: '' });
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.row = r;
      tile.dataset.col = c;
      tile.addEventListener('click', () => handleTileClick(r, c));
      rowEl.appendChild(tile);
    }
    gridEl.appendChild(rowEl);
  }

  getTile(0, 0).classList.add('active');
}

/* ── KEYBOARD ── */
document.addEventListener('keydown', e => {
  if (currentRow >= ROWS) return;
  if (document.getElementById('status').classList.contains('error')) setStatus('');

  if (e.key === 'Enter')              handleEnter();
  else if (e.key === 'Backspace')     handleBackspace();
  else if (/^[a-zA-Z]$/.test(e.key)) handleLetter(e.key.toUpperCase());
});

function handleLetter(letter) {
  if (currentCol >= COLS || submitted[currentRow]) return;
  grid[currentRow][currentCol].letter = letter;
  const tile = getTile(currentRow, currentCol);
  tile.textContent = letter;
  tile.classList.add('filled');
  tile.classList.remove('active');
  currentCol++;
  if (currentCol < COLS) getTile(currentRow, currentCol).classList.add('active');
}

function handleBackspace() {
  if (submitted[currentRow] || currentCol === 0) return;
  if (currentCol < COLS) getTile(currentRow, currentCol).classList.remove('active');
  currentCol--;
  grid[currentRow][currentCol].letter = '';
  const tile = getTile(currentRow, currentCol);
  tile.textContent = '';
  tile.classList.remove('filled');
  tile.classList.add('active');
}

async function handleEnter() {
  if (submitted[currentRow]) return;
  if (currentCol < COLS) {
    shakeRow(currentRow);
    setStatus('not enough letters', 'error');
    return;
  }

  const guess = grid[currentRow].map(c => c.letter).join('');

  setStatus('checking…');
  const valid = await callValidate(guess);
  if (!valid) {
    shakeRow(currentRow);
    setStatus('not a valid word', 'error');
    return;
  }

  for (let c = 0; c < COLS; c++) {
    if (!grid[currentRow][c].colour) {
      grid[currentRow][c].colour = 'grey';
      applyColour(currentRow, c, 'grey');
    }
  }

  const tiles = grid[currentRow].map(c => ({ letter: c.letter, colour: c.colour }));
  history.push({ guess, tiles });

  submitted[currentRow] = true;
  if (currentCol > 0) getTile(currentRow, currentCol - 1).classList.remove('active');

  setStatus('sending…');
  await callSubmitGuess(guess, tiles);
  await fetchSuggestions();

  currentRow++;
  currentCol = 0;

  if (currentRow < ROWS) {
    getTile(currentRow, 0).classList.add('active');
    setStatus('');
  } else {
    setStatus('board full', 'ok');
  }
}

/* ── TILE COLOUR CYCLING ── */
function handleTileClick(r, c) {
  if (!grid[r][c].letter) return;
  const cell = grid[r][c];
  const idx  = CYCLE.indexOf(cell.colour);
  const next = (idx + 1) % CYCLE.length;
  cell.colour = next === 0 ? CYCLE[1] : CYCLE[next];
  applyColour(r, c, cell.colour);
}

function applyColour(r, c, colour) {
  const tile = getTile(r, c);
  tile.classList.remove('state-grey', 'state-yellow', 'state-green');
  if (colour) tile.classList.add('state-' + colour);
}

/* ── API CALLS ── */
async function callValidate(guess) {
  /* TODO: replace with real fetch
  const res  = await fetch(API.validate, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guess }),
  });
  const data = await res.json();
  return data.valid;
  */
  console.log('[MOCK] POST /api/validate', { guess });
  await delay(100);
  return true; // mock always passes — backend checks the real word list
}

// GUESS PAYLOAD LOOKS LIKE THIS for callSubmitGuess()
// {
//   "guess": "CRANE",
//   "tiles": [
//     { "letter": "C", "colour": "grey" },
//     { "letter": "R", "colour": "yellow" },
//     { "letter": "A", "colour": "green" },
//     { "letter": "N", "colour": "grey" },
//     { "letter": "E", "colour": "grey" }
//   ]
// }

async function callSubmitGuess(guess, tiles) {
  /* TODO: replace with real fetch
  await fetch(API.submitGuess, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guess, tiles, history }),
  });
  */
  console.log('[MOCK] POST /api/guess', { guess, tiles, history });
  await delay(150);
}

async function fetchSuggestions() {
  /* TODO: replace with real fetch
  const res  = await fetch(API.suggestions, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history }),
  });
  const data = await res.json();
  renderSuggestions(data.words);
  return;
  */
  console.log('[MOCK] POST /api/suggestions', { history });
  await delay(250);
  renderSuggestions([
    { word: 'CRANE', score: 0.94 },
    { word: 'SLATE', score: 0.89 },
    { word: 'TRACE', score: 0.83 },
    { word: 'CRATE', score: 0.79 },
    { word: 'STARE', score: 0.71 },
  ]);
}

/* ── RENDER SUGGESTIONS ── */
function renderSuggestions(words) {
  const el = document.getElementById('suggestions');
  el.innerHTML = '';
  words.slice(0, 5).forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `
      <span class="suggestion-rank">${i + 1}</span>
      <span class="suggestion-word">${item.word}</span>
      <span class="suggestion-score">${(item.score * 100).toFixed(0)}%</span>
    `;
    el.appendChild(div);
  });
}

/* ── HELPERS ── */
function getTile(r, c) {
  return gridEl.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
}

function shakeRow(r) {
  const row = gridEl.querySelector(`.row[data-row="${r}"]`);
  row.classList.add('shake');
  row.addEventListener('animationend', () => row.classList.remove('shake'), { once: true });
}

function setStatus(msg, type = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = type;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

buildGrid();