#!/usr/bin/env node
/**
 * Validate Raumschach mate-in-1 puzzles against the game engine.
 * For each puzzle, finds ALL mating moves and checks uniqueness.
 */

const fs = require('fs');
const path = require('path');

// Load game engine
const gameSource = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
eval(gameSource.replace('const Raumschach', 'global.Raumschach'));

const { key, parseKey, legalMoves, applyMove, isInCheck, hasAnyLegalMove, coordToNotation } = Raumschach;

// Puzzle definitions
const PUZZLES = [
  {
    id: 1,
    title: "Queen's Triagonal Trap",
    board: {
      '0,4,4': { type: 'K', color: 'b' },
      '2,0,0': { type: 'K', color: 'w' },
      '1,3,0': { type: 'Q', color: 'w' },
      '1,0,3': { type: 'R', color: 'w' },
    },
    solution: { from: [1,3,0], to: [1,3,3] }
  },
  {
    id: 2,
    title: "Smothered Royalty",
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,1,0': { type: 'R', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '1,1,0': { type: 'P', color: 'b' },
      '1,1,1': { type: 'P', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '1,1,4': { type: 'Q', color: 'w' },
      '2,2,2': { type: 'U', color: 'w' },
    },
    solution: { from: [1,1,4], to: [1,1,1] }
  },
  {
    id: 3,
    title: "Descent of Doom",
    board: {
      '4,4,0': { type: 'K', color: 'b' },
      '0,0,4': { type: 'K', color: 'w' },
      '3,3,4': { type: 'Q', color: 'w' },
      '3,0,1': { type: 'R', color: 'w' },
    },
    solution: { from: [3,3,4], to: [3,3,1] }
  },
  {
    id: 4,
    title: "Cross-Board Strike",
    board: {
      '4,0,4': { type: 'K', color: 'b' },
      '0,4,0': { type: 'K', color: 'w' },
      '3,1,0': { type: 'Q', color: 'w' },
      '3,4,3': { type: 'R', color: 'w' },
    },
    solution: { from: [3,1,0], to: [3,1,3] }
  },
  {
    id: 5,
    title: "Level Lock",
    board: {
      '0,0,4': { type: 'K', color: 'b' },
      '4,4,0': { type: 'K', color: 'w' },
      '1,1,0': { type: 'Q', color: 'w' },
      '1,4,3': { type: 'R', color: 'w' },
    },
    solution: { from: [1,1,0], to: [1,1,3] }
  }
];

function findAllMates(board, color) {
  const mates = [];
  for (const k of Object.keys(board)) {
    const piece = board[k];
    if (piece.color !== color) continue;
    const [x, y, z] = parseKey(k);
    const moves = legalMoves(board, x, y, z);
    for (const [tx, ty, tz] of moves) {
      const { board: nb } = applyMove(board, [x,y,z], [tx,ty,tz]);
      const enemy = color === 'w' ? 'b' : 'w';
      if (isInCheck(nb, enemy) && !hasAnyLegalMove(nb, enemy)) {
        mates.push({
          piece: piece.type,
          from: coordToNotation(x,y,z),
          to: coordToNotation(tx,ty,tz),
          fromCoord: [x,y,z],
          toCoord: [tx,ty,tz]
        });
      }
    }
  }
  return mates;
}

console.log('Validating Raumschach puzzles...\n');

let allValid = true;
for (const puzzle of PUZZLES) {
  console.log(`--- Puzzle ${puzzle.id}: ${puzzle.title} ---`);

  // Check neither side is in check illegally
  if (isInCheck(puzzle.board, 'w')) {
    console.log('  ERROR: White is in check at start!');
    allValid = false;
    continue;
  }
  if (isInCheck(puzzle.board, 'b')) {
    console.log('  ERROR: Black is already in check at start (illegal position)!');
    allValid = false;
    continue;
  }

  const mates = findAllMates(puzzle.board, 'w');

  if (mates.length === 0) {
    console.log('  ERROR: No mating moves found!');
    allValid = false;
  } else if (mates.length === 1) {
    const m = mates[0];
    const expected = puzzle.solution;
    const matchFrom = m.fromCoord[0]===expected.from[0] && m.fromCoord[1]===expected.from[1] && m.fromCoord[2]===expected.from[2];
    const matchTo = m.toCoord[0]===expected.to[0] && m.toCoord[1]===expected.to[1] && m.toCoord[2]===expected.to[2];
    if (matchFrom && matchTo) {
      console.log(`  PASS: Unique mate: ${m.piece} ${m.from} -> ${m.to}`);
    } else {
      console.log(`  WARN: Unique mate found but different from expected!`);
      console.log(`    Found: ${m.piece} ${m.from} -> ${m.to}`);
      console.log(`    Expected: ${coordToNotation(...expected.from)} -> ${coordToNotation(...expected.to)}`);
    }
  } else {
    console.log(`  FAIL: ${mates.length} mating moves found (not unique):`);
    for (const m of mates) {
      console.log(`    ${m.piece} ${m.from} -> ${m.to}`);
    }
    allValid = false;
  }
}

console.log('\n' + (allValid ? 'All puzzles valid!' : 'Some puzzles need fixing.'));
