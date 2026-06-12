const COLS = 7;
const INIT_SEEDS = 5;
const SOWING_DELAY = 180;

let state = {};
let isSowing = false;

function initGame() {
  state = {
    board: [
      Array(COLS).fill(INIT_SEEDS),
      Array(COLS).fill(INIT_SEEDS)
    ],
    scores: [0, 0],
    currentPlayer: 1,
    isOver: false,
  };
  isSowing = false;
  render();
  setMsg('Choisissez une case pour commencer');
}

// --- Circuit ---
function posToCell(pos) {
  if (pos < COLS) return { player: 1, col: pos };
  else return { player: 0, col: COLS - 1 - (pos - COLS) };
}

function cellToPos(player, col) {
  if (player === 1) return col;
  else return COLS + (COLS - 1 - col);
}

// --- Grenier (case avec plus de 13 graines) ---
async function sowGrenier(player, col) {
  let seeds = state.board[player][col];
  state.board[player][col] = 0;
  render();

  let pos = cellToPos(player, col);
  let lastCell = null;
  let distributed = 0;
  const totalCells = COLS * 2;

  // Tour complet sans remettre dans la case source
  const maxDist = totalCells - 1;

  while (distributed < maxDist && seeds > 0) {
    pos = (pos + 1) % totalCells;
    const check = posToCell(pos);
    if (check.player === player && check.col === col) continue;

    state.board[check.player][check.col]++;
    seeds--;
    distributed++;
    lastCell = check;

    render();
    highlightCell(check.player, check.col);
    await delay(SOWING_DELAY);
  }

  // Le reste va uniquement dans le camp adverse
  const adverse = 1 - player;
  const firstAdverse = firstAdverseCol(player);
  const step = player === 1 ? -1 : 1;
  let acol = player === 1 ? COLS - 1 : 0;

  while (seeds > 0) {
    const check = { player: adverse, col: acol };

    // Règle grenier : si dernière graine tombe sur la première case adverse protégée
    if (seeds === 1 && acol === firstAdverseCol(player)) {
      state.scores[player] += 1;
      seeds--;
      highlightCapture(adverse, acol);
      render();
      await delay(SOWING_DELAY);
      lastCell = null;
      break;
    }

    state.board[adverse][acol]++;
    seeds--;
    lastCell = { player: adverse, col: acol };

    render();
    highlightCell(adverse, acol);
    await delay(SOWING_DELAY);

    acol += step;
    if (acol < 0 || acol >= COLS) break;
  }

  return lastCell;
}

// --- Semaille normale ---
async function sow(player, col) {
  let seeds = state.board[player][col];
  if (seeds === 0) return null;

  // Grenier ?
  if (seeds > 13) {
    setMsg('Grenier ! Semaille spéciale...');
    return await sowGrenier(player, col);
  }

  state.board[player][col] = 0;
  render();

  let pos = cellToPos(player, col);
  let lastCell = null;

  while (seeds > 0) {
    pos = (pos + 1) % (COLS * 2);
    const check = posToCell(pos);
    if (check.player === player && check.col === col) {
      pos = (pos + 1) % (COLS * 2);
    }

    const cell = posToCell(pos);
    state.board[cell.player][cell.col]++;
    seeds--;
    lastCell = cell;

    render();
    highlightCell(cell.player, cell.col);
    await delay(SOWING_DELAY);
  }

  return lastCell;
}

// --- Solidarité ---
// Si le camp adverse est vide, le joueur actif doit le nourrir
function campEstVide(player) {
  return state.board[player].every(c => c === 0);
}

function peutNourrir(player) {
  const adverse = 1 - player;
  // Cherche une case qui, en semant, atteint le camp adverse
  for (let col = 0; col < COLS; col++) {
    const seeds = state.board[player][col];
    if (seeds === 0) continue;
    // Simule la semaille pour voir si une graine atteint l'adverse
    let pos = cellToPos(player, col);
    let s = seeds;
    let atteint = false;
    while (s > 0) {
      pos = (pos + 1) % (COLS * 2);
      const check = posToCell(pos);
      if (check.player === player && check.col === col) continue;
      if (check.player === adverse) { atteint = true; break; }
      s--;
    }
    if (atteint) return true;
  }
  return false;
}

function coupsDonnerAuMoins7(player) {
  // Retourne les colonnes qui donnent au moins 7 graines à l'adverse
  const adverse = 1 - player;
  const coups = [];
  for (let col = 0; col < COLS; col++) {
    const seeds = state.board[player][col];
    if (seeds === 0) continue;
    // Compte combien vont dans le camp adverse
    let pos = cellToPos(player, col);
    let s = seeds;
    let versAdverse = 0;
    while (s > 0) {
      pos = (pos + 1) % (COLS * 2);
      const check = posToCell(pos);
      if (check.player === player && check.col === col) continue;
      if (check.player === adverse) versAdverse++;
      s--;
    }
    if (versAdverse >= 7) coups.push(col);
  }
  return coups;
}

// --- Prises ---
function firstAdverseCol(player) {
  return player === 1 ? 0 : COLS - 1;
}

function canCapture(player, lastCell) {
  const adverse = 1 - player;
  if (!lastCell || lastCell.player !== adverse) return false;
  const count = state.board[adverse][lastCell.col];
  if (count < 2 || count > 4) return false;
  if (lastCell.col === firstAdverseCol(player)) return false;
  const totalAdverse = state.board[adverse].reduce((a, b) => a + b, 0);
  if (totalAdverse === count) return false;
  return true;
}

async function chainCapture(player, startCol) {
  const adverse = 1 - player;
  let captured = 0;
  const step = player === 1 ? -1 : 1;
  let col = startCol;

  while (col >= 0 && col < COLS) {
    const count = state.board[adverse][col];
    if (count < 2 || count > 4) break;
    const totalAdverse = state.board[adverse].reduce((a, b) => a + b, 0);
    if (totalAdverse - count === 0) break;

    captured += count;
    state.board[adverse][col] = 0;
    highlightCapture(adverse, col);
    render();
    await delay(SOWING_DELAY + 50);

    col += step;
  }

  return captured;
}

// --- Tour de jeu ---
async function handleClick(player, col) {
  if (state.isOver || isSowing) return;
  if (state.currentPlayer !== player) return;
  if (state.board[player][col] === 0) return;

  // Solidarité : si camp adverse vide, vérifier que ce coup nourrit
  const adverse = 1 - player;
  if (campEstVide(adverse)) {
    const coupsOk = coupsDonnerAuMoins7(player);
    if (coupsOk.length > 0 && !coupsOk.includes(col)) {
      setMsg('Tu dois nourrir l\'adversaire avec au moins 7 graines !');
      return;
    }
  }

  isSowing = true;
  setMsg('Semaille en cours...');

  const lastCell = await sow(player, col);

  if (lastCell && canCapture(player, lastCell)) {
    const finalCount = state.board[1 - player][lastCell.col];
    let totalCaptured = 0;

    if (finalCount >= 2 && finalCount <= 4) {
      const totalAdverse = state.board[adverse].reduce((a, b) => a + b, 0);
      if (totalAdverse - finalCount > 0) {
        state.scores[player] += finalCount;
        state.board[adverse][lastCell.col] = 0;
        totalCaptured += finalCount;
        highlightCapture(adverse, lastCell.col);
        render();
        await delay(SOWING_DELAY + 50);
      }
    }

    const step = player === 1 ? -1 : 1;
    const nextCol = lastCell.col + step;
    if (nextCol >= 0 && nextCol < COLS) {
      const chained = await chainCapture(player, nextCol);
      totalCaptured += chained;
      state.scores[player] += chained;
    }

    if (totalCaptured > 0) {
      const nom = player === 0 ? (window.nomNord || 'Nord') : (window.nomSud || 'Sud');
      setMsg(nom + ' capture ' + totalCaptured + ' graines !');
    }
  }

  checkEnd();

  if (!state.isOver) {
    state.currentPlayer = 1 - player;
    const nom = state.currentPlayer === 0 ? (window.nomNord || 'Nord') : (window.nomSud || 'Sud');

    // Solidarité : si le nouveau joueur actif a un camp vide
    if (campEstVide(state.currentPlayer)) {
      if (!peutNourrir(1 - state.currentPlayer)) {
        endGame('Partie terminée — impossible de nourrir l\'adversaire !');
      } else {
        setMsg('Tour de ' + nom);
      }
    } else {
      setMsg('Tour de ' + nom);
    }
  }

  isSowing = false;
  render();
}

// --- Fin de partie ---
function checkEnd() {
  const total = state.board[0].reduce((a, b) => a + b, 0)
              + state.board[1].reduce((a, b) => a + b, 0);

  if (state.scores[0] >= 40) {
    endGame((window.nomNord || 'Nord') + ' gagne avec ' + state.scores[0] + ' graines !');
  } else if (state.scores[1] >= 40) {
    endGame((window.nomSud || 'Sud') + ' gagne avec ' + state.scores[1] + ' graines !');
  } else if (total < 10) {
    state.scores[0] += state.board[0].reduce((a, b) => a + b, 0);
    state.scores[1] += state.board[1].reduce((a, b) => a + b, 0);
    state.board = [Array(COLS).fill(0), Array(COLS).fill(0)];
    const n0 = window.nomNord || 'Nord';
    const n1 = window.nomSud  || 'Sud';
    const winner = state.scores[0] > state.scores[1] ? n0 : n1;
    endGame(winner + ' gagne ! (' + state.scores[0] + ' vs ' + state.scores[1] + ')');
  }
}

function endGame(msg) {
  state.isOver = true;
  setMsg(msg);
}

// --- Rendu ---
function render() {
  renderRow('nord', 0);
  renderRow('sud', 1);
  document.getElementById('score-nord').textContent = state.scores[0];
  document.getElementById('score-sud').textContent  = state.scores[1];
  const n0 = window.nomNord || 'Nord';
  const n1 = window.nomSud  || 'Sud';
  document.getElementById('turn-msg').textContent = state.isOver
    ? 'Partie terminée'
    : 'Tour de ' + (state.currentPlayer === 0 ? n0 : n1);
}

function renderRow(side, player) {
  const container = document.getElementById('cells-' + side);
  container.innerHTML = '';
  const isActive = state.currentPlayer === player && !state.isOver && !isSowing;

  for (let i = 0; i < COLS; i++) {
    const count = state.board[player][i];
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.id = 'cell-' + player + '-' + i;

    if (!isActive || count === 0) cell.classList.add('disabled');
    if (count > 13) cell.classList.add('grenier');

    const num = document.createElement('span');
    num.className = 'cell-count';
    num.textContent = count;
    cell.appendChild(num);

    const seeds = document.createElement('div');
    seeds.className = 'cell-seeds';
    const dots = Math.min(count, 9);
    for (let d = 0; d < dots; d++) {
      const s = document.createElement('div');
      s.className = 'seed';
      seeds.appendChild(s);
    }
    cell.appendChild(seeds);

    if (isActive && count > 0) {
      cell.addEventListener('click', () => handleClick(player, i));
    }
    container.appendChild(cell);
  }
}

function highlightCell(player, col) {
  const el = document.getElementById('cell-' + player + '-' + col);
  if (!el) return;
  el.classList.add('receiving');
  setTimeout(() => el.classList.remove('receiving'), SOWING_DELAY - 20);
}

function highlightCapture(player, col) {
  const el = document.getElementById('cell-' + player + '-' + col);
  if (!el) return;
  el.classList.add('captured');
  setTimeout(() => el.classList.remove('captured'), 400);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setMsg(txt) {
  document.getElementById('msg-bar').textContent = txt;
}

// --- Navigation ---
function lancerPartie() {
  const nomNord = document.getElementById('nom-nord').value.trim();
  const nomSud  = document.getElementById('nom-sud').value.trim();
  const err     = document.getElementById('form-error');

  if (!nomNord || !nomSud) {
    err.textContent = 'Veuillez entrer les noms des deux joueurs.';
    return;
  }
  if (nomNord === nomSud) {
    err.textContent = 'Les deux joueurs doivent avoir des noms différents.';
    return;
  }
  err.textContent = '';

  document.getElementById('label-nord').textContent       = nomNord;
  document.getElementById('label-sud').textContent        = nomSud;
  document.getElementById('score-label-nord').textContent = nomNord;
  document.getElementById('score-label-sud').textContent  = nomSud;

  window.nomNord = nomNord;
  window.nomSud  = nomSud;

  document.getElementById('page-accueil').classList.add('hidden');
  document.getElementById('page-regles').classList.add('hidden');
  document.getElementById('page-jeu').classList.remove('hidden');
  initGame();
}

function retourAccueil() {
  document.getElementById('page-jeu').classList.add('hidden');
  document.getElementById('page-regles').classList.add('hidden');
  document.getElementById('page-accueil').classList.remove('hidden');
}

function voirRegles() {
  document.getElementById('page-accueil').classList.add('hidden');
  document.getElementById('page-regles').classList.remove('hidden');
}

function retourAccueilDepuisRegles() {
  document.getElementById('page-regles').classList.add('hidden');
  document.getElementById('page-accueil').classList.remove('hidden');
}