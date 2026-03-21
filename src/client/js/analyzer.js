/**
 * Fae Chess – Game Analyzer
 * Load a faechess-v1 JSON report, step through moves, and see engine rankings.
 */
import * as GameModule from './game.js';
import { rankMoves } from './ai.js';

let report = null;
let positions = [];   // board state at each move index (0 = start)
let currentIdx = 0;   // 0 = starting position, 1 = after move 1, etc.
let analyses = [];     // cached analysis for each move

// DOM refs
const fileInput = document.getElementById('analyzer-file');
const infoSection = document.getElementById('analyzer-info');
const metaEl = document.getElementById('analyzer-meta');
const posEl = document.getElementById('az-position');
const moveListEl = document.getElementById('analyzer-move-list');
const playedEl = document.getElementById('az-played');
const evalFill = document.getElementById('az-eval-fill');
const rankedEl = document.getElementById('az-ranked-moves');

// ── File loading ───────────────────────────────────────────────

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.format !== 'faechess-v1') {
        alert('Unsupported format. Expected faechess-v1.');
        return;
      }
      loadReport(data);
    } catch (err) {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
});

function loadReport(data) {
  report = data;
  analyses = [];
  positions = [];

  // Rebuild board positions from move list
  let board = GameModule.initialBoard();
  positions.push(GameModule.cloneBoard(board));

  for (const move of report.moves) {
    const from = notationToCoord(move.from);
    const to = notationToCoord(move.to);
    const result = GameModule.applyMove(board, from, to);
    board = result.board;
    positions.push(GameModule.cloneBoard(board));
  }

  // Pre-compute analyses for each move
  for (let i = 0; i < report.moves.length; i++) {
    const boardBefore = positions[i];
    const color = report.moves[i].color;
    const ranked = rankMoves(boardBefore, color, 2);
    const from = notationToCoord(report.moves[i].from);
    const to = notationToCoord(report.moves[i].to);

    // Find the played move in the ranked list
    const playedIdx = ranked.findIndex(m =>
      m.from[0] === from[0] && m.from[1] === from[1] && m.from[2] === from[2] &&
      m.to[0] === to[0] && m.to[1] === to[1] && m.to[2] === to[2]
    );

    const bestScore = ranked.length > 0 ? ranked[0].score : 0;
    const playedScore = playedIdx >= 0 ? ranked[playedIdx].score : 0;
    const delta = bestScore - playedScore;

    let classification;
    if (playedIdx === 0 || delta <= 10) classification = 'best';
    else if (delta <= 50) classification = 'good';
    else if (delta <= 150) classification = 'inaccuracy';
    else classification = 'blunder';

    analyses.push({ ranked, playedIdx, bestScore, playedScore, delta, classification });
  }

  // Show UI
  infoSection.classList.remove('hidden');
  metaEl.innerHTML =
    `<div>Date: ${new Date(report.date).toLocaleDateString()}</div>` +
    `<div>Moves: ${report.totalMoves}</div>` +
    `<div>Result: ${report.result.replace('_', ' ')}</div>`;

  buildMoveList();
  currentIdx = 0;
  goToPosition(0);
}

// ── Notation conversion ────────────────────────────────────────

function notationToCoord(n) {
  // "a1A" → [0, 0, 0], "e5E" → [4, 4, 4]
  const x = n.charCodeAt(0) - 97;
  const y = parseInt(n[1], 10) - 1;
  const z = n.charCodeAt(2) - 65;
  return [x, y, z];
}

// ── Move list ──────────────────────────────────────────────────

function buildMoveList() {
  moveListEl.innerHTML = '';
  for (let i = 0; i < report.moves.length; i++) {
    const m = report.moves[i];
    const a = analyses[i];
    const div = document.createElement('div');
    div.className = 'az-move-entry';
    div.dataset.idx = i + 1;

    const badgeClass = 'az-badge-' + a.classification;
    const badgeLabel = a.classification.charAt(0).toUpperCase() + a.classification.slice(1);

    div.innerHTML =
      `<span class="az-move-num">${m.num}${m.color === 'w' ? '.' : '...'}</span>` +
      `<span class="az-move-notation">${m.notation}</span>` +
      `<span class="az-move-badge ${badgeClass}">${badgeLabel}</span>`;

    div.addEventListener('click', () => goToPosition(i + 1));
    moveListEl.appendChild(div);
  }
}

// ── Position navigation ────────────────────────────────────────

function goToPosition(idx) {
  currentIdx = Math.max(0, Math.min(idx, positions.length - 1));

  // Update board
  BoardRenderer.updatePieces(positions[currentIdx]);
  BoardRenderer.clearHighlights();

  // Update position label
  if (currentIdx === 0) {
    posEl.textContent = 'Start';
  } else {
    const m = report.moves[currentIdx - 1];
    posEl.textContent = `Move ${m.num} (${m.color === 'w' ? 'White' : 'Black'})`;
  }

  // Highlight active move in list
  moveListEl.querySelectorAll('.az-move-entry').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.idx) === currentIdx);
  });

  // Scroll active entry into view
  const activeEntry = moveListEl.querySelector('.az-move-entry.active');
  if (activeEntry) activeEntry.scrollIntoView({ block: 'nearest' });

  // Update analysis panel
  updateAnalysis();
}

function updateAnalysis() {
  if (currentIdx === 0 || !analyses[currentIdx - 1]) {
    playedEl.textContent = 'Select a move to see analysis.';
    rankedEl.innerHTML = '';
    evalFill.style.width = '50%';
    return;
  }

  const moveIdx = currentIdx - 1;
  const m = report.moves[moveIdx];
  const a = analyses[moveIdx];

  // Played move summary
  const rankText = a.playedIdx >= 0
    ? `Rank ${a.playedIdx + 1} of ${a.ranked.length}`
    : 'Unknown';
  const deltaText = a.delta > 0 ? ` (${a.delta}cp loss)` : '';
  const badgeClass = 'az-badge-' + a.classification;
  playedEl.innerHTML =
    `<strong>${m.notation}</strong> — ${rankText}${deltaText} ` +
    `<span class="az-move-badge ${badgeClass}">${a.classification}</span>`;

  // Eval bar: map score to 0-100% (clamped)
  const evalPct = Math.max(5, Math.min(95, 50 + (a.playedScore / 50)));
  evalFill.style.width = evalPct + '%';

  // Ranked moves table
  rankedEl.innerHTML = '';
  const showCount = Math.min(a.ranked.length, 15);
  for (let i = 0; i < showCount; i++) {
    const rm = a.ranked[i];
    const notation = getMoveNotation(rm);
    const isPlayed = i === a.playedIdx;
    const row = document.createElement('div');
    row.className = 'az-rank-row' + (isPlayed ? ' played' : '');
    row.innerHTML =
      `<span class="az-rank-num">${i + 1}.</span>` +
      `<span class="az-rank-notation">${notation}</span>` +
      `<span class="az-rank-score">${rm.score > 0 ? '+' : ''}${rm.score}</span>`;
    rankedEl.appendChild(row);
  }

  // If played move is beyond top 15, show it at the bottom
  if (a.playedIdx >= showCount) {
    const rm = a.ranked[a.playedIdx];
    const notation = getMoveNotation(rm);
    const row = document.createElement('div');
    row.className = 'az-rank-row played';
    row.innerHTML =
      `<span class="az-rank-num">${a.playedIdx + 1}.</span>` +
      `<span class="az-rank-notation">${notation}</span>` +
      `<span class="az-rank-score">${rm.score > 0 ? '+' : ''}${rm.score}</span>`;
    rankedEl.appendChild(row);
  }
}

function getMoveNotation(rankedMove) {
  const pn = rankedMove.piece.type === 'P' ? '' : rankedMove.piece.type;
  const cap = rankedMove.captured ? 'x' : '';
  return pn + GameModule.coordToNotation(...rankedMove.from) + cap + GameModule.coordToNotation(...rankedMove.to);
}

// ── Stepper buttons ────────────────────────────────────────────

document.getElementById('az-start').addEventListener('click', () => goToPosition(0));
document.getElementById('az-prev').addEventListener('click', () => goToPosition(currentIdx - 1));
document.getElementById('az-next').addEventListener('click', () => goToPosition(currentIdx + 1));
document.getElementById('az-end').addEventListener('click', () => goToPosition(positions.length - 1));

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  const analyzerView = document.getElementById('analyzer-view');
  if (!analyzerView || analyzerView.classList.contains('hidden')) return;
  if (!report) return;

  if (e.key === 'ArrowLeft') goToPosition(currentIdx - 1);
  else if (e.key === 'ArrowRight') goToPosition(currentIdx + 1);
  else if (e.key === 'Home') goToPosition(0);
  else if (e.key === 'End') goToPosition(positions.length - 1);
});

export function initAnalyzer() {
  console.log('✅ Analyzer initialized');
}
