const ROWS = 6, COLS = 5;
const CYCLE = ['', 'grey', 'yellow', 'green'];

let grid       = [];
let currentRow = 0;
let currentCol = 0;
let submitted  = new Array(ROWS).fill(false);
let history    = [];

let validWords  = [];  // 14k — used for input validation
let answerWords = [];  // 3k  — used for suggestions
let candidates  = [];

const gridEl = document.getElementById('grid');

async function loadWords() {
  const [validRes, answerRes] = await Promise.all([
    fetch('Shitass word list (old).txt'),
    fetch('Shitass word list.txt'),
  ]);
  const parseList = async res =>
    (await res.text()).split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length === 5);

  validWords  = await parseList(validRes);
  answerWords = await parseList(answerRes);
  candidates  = [...answerWords];
}

/* ── BUILD GRID ── */
function buildGrid() {
  grid       = [];
  currentRow = 0;
  currentCol = 0;
  submitted  = new Array(ROWS).fill(false);
  history    = [];
  candidates = [...answerWords];
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

  // Validate against the 14k list
  if (!validWords.includes(guess.toLowerCase())) {
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

  filterCandidates(guess.toLowerCase(), tiles.map(t => t.colour));
  renderSuggestions(scoreCandidates());

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
async function handleTileClick(r, c) {
  if (!grid[r][c].letter || !submitted[r]) return;
  const cell = grid[r][c];
  const idx  = CYCLE.indexOf(cell.colour);
  const next = (idx + 1) % CYCLE.length;
  cell.colour = next === 0 ? CYCLE[1] : CYCLE[next];
  applyColour(r, c, cell.colour);

  const tiles = grid[r].map(c => ({ letter: c.letter, colour: c.colour }));
  const guess = grid[r].map(c => c.letter).join('');
  history[r]  = { guess, tiles };

  // Recompute from scratch using updated history
  candidates = [...answerWords];
  for (const entry of history)
    filterCandidates(entry.guess.toLowerCase(), entry.tiles.map(t => t.colour));
  renderSuggestions(scoreCandidates());
}

function applyColour(r, c, colour) {
  const tile = getTile(r, c);
  tile.classList.remove('state-grey', 'state-yellow', 'state-green');
  if (colour) tile.classList.add('state-' + colour);
}

/* ── FILTER + SCORE ── */
function filterCandidates(guess, colours) {
  const greens = {}, yellows = [], greys = {}, nonGreyCount = {};
  for (let i = 0; i < COLS; i++) {
    const l = guess[i], c = colours[i];
    if (c === 'green' || c === 'yellow') nonGreyCount[l] = (nonGreyCount[l] || 0) + 1;
  }
  for (let i = 0; i < COLS; i++) {
    const l = guess[i], c = colours[i];
    if (c === 'green')       greens[i] = l;
    else if (c === 'yellow') yellows.push({ letter: l, position: i });
    else                     greys[l]  = nonGreyCount[l] || 0;
  }
  candidates = candidates.filter(word => {
    for (const [pos, letter] of Object.entries(greens))
      if (word[pos] !== letter) return false;
    for (const { letter, position } of yellows) {
      if (!word.includes(letter)) return false;
      if (word[position] === letter) return false;
    }
    for (const [letter, maxCount] of Object.entries(greys))
      if (word.split('').filter(l => l === letter).length > maxCount) return false;
    return true;
  });
}

function scoreCandidates() {
  if (candidates.length === 0) return [];
  const freq = Array.from({ length: COLS }, () => ({}));
  for (const word of candidates)
    for (let i = 0; i < COLS; i++)
      freq[i][word[i]] = (freq[i][word[i]] || 0) + 1;
  const scored = candidates.map(word => {
    const seen = new Set();
    let score = 0;
    for (let i = 0; i < COLS; i++)
      if (!seen.has(word[i])) { score += freq[i][word[i]] || 0; seen.add(word[i]); }
    return { word: word.toUpperCase(), score };
  });
  scored.sort((a, b) => b.score - a.score);
  const max = scored[0].score;
  return scored.slice(0, 5).map(item => ({ word: item.word, score: max > 0 ? item.score / max : 0 }));
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

loadWords().then(() => buildGrid());