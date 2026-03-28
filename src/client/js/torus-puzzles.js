/**
 * Torus Chess – Puzzle Collection
 *
 * Each puzzle is a mate-in-1 with a unique solution.
 * Board uses 2D "x,y" keys where x=file(0-7), y=rank(0-7).
 * Many puzzles exploit the wraparound topology.
 */

const torusPuzzles = [
  {
    id: 1,
    title: "Wraparound Queen",
    description: "White to move. Mate in 1.",
    hint: "The queen can wrap around the file edge.",
    difficulty: 1,
    turn: 'w',
    board: {
      '4,3': { type: 'K', color: 'b' },
      '5,3': { type: 'P', color: 'b' },
      '3,3': { type: 'P', color: 'b' },
      '4,4': { type: 'P', color: 'b' },
      '0,0': { type: 'K', color: 'w' },
      '7,3': { type: 'Q', color: 'w' },
      '4,1': { type: 'R', color: 'w' },
    },
    solution: { from: [7,3], to: [4,3] }
  },
  {
    id: 2,
    title: "Rook Through the Edge",
    description: "White to move. Mate in 1.",
    hint: "The rook can attack through the rank boundary.",
    difficulty: 1,
    turn: 'w',
    board: {
      '3,7': { type: 'K', color: 'b' },
      '2,7': { type: 'R', color: 'b' },
      '4,7': { type: 'N', color: 'b' },
      '6,0': { type: 'K', color: 'w' },
      '3,2': { type: 'R', color: 'w' },
      '5,6': { type: 'B', color: 'w' },
    },
    solution: { from: [5,6], to: [4,7] }
  },
  {
    id: 3,
    title: "Knight on the Rim",
    description: "White to move. Mate in 1.",
    hint: "On a torus, the knight on the edge is just as strong.",
    difficulty: 2,
    turn: 'w',
    board: {
      '0,0': { type: 'K', color: 'b' },
      '1,0': { type: 'R', color: 'b' },
      '0,1': { type: 'B', color: 'b' },
      '5,5': { type: 'K', color: 'w' },
      '6,6': { type: 'R', color: 'w' },
      '1,2': { type: 'N', color: 'w' },
    },
    solution: { from: [1,2], to: [0,0] }
  },
  {
    id: 4,
    title: "Bishop Wrap Diagonal",
    description: "White to move. Mate in 1.",
    hint: "The bishop's diagonal wraps around both edges.",
    difficulty: 2,
    turn: 'w',
    board: {
      '7,7': { type: 'K', color: 'b' },
      '6,7': { type: 'P', color: 'b' },
      '7,6': { type: 'P', color: 'b' },
      '3,3': { type: 'K', color: 'w' },
      '5,5': { type: 'B', color: 'w' },
      '7,5': { type: 'R', color: 'w' },
    },
    solution: { from: [5,5], to: [7,7] }
  },
  {
    id: 5,
    title: "Double Rook Squeeze",
    description: "White to move. Mate in 1.",
    hint: "Use both rooks — one cuts off the rank, one delivers.",
    difficulty: 2,
    turn: 'w',
    board: {
      '2,5': { type: 'K', color: 'b' },
      '1,6': { type: 'P', color: 'b' },
      '3,6': { type: 'P', color: 'b' },
      '6,2': { type: 'K', color: 'w' },
      '0,6': { type: 'R', color: 'w' },
      '5,5': { type: 'R', color: 'w' },
    },
    solution: { from: [5,5], to: [2,5] }
  },
  {
    id: 6,
    title: "Queen Teleport",
    description: "White to move. Mate in 1.",
    hint: "Move the queen to where file and rank both wrap.",
    difficulty: 3,
    turn: 'w',
    board: {
      '0,7': { type: 'K', color: 'b' },
      '1,7': { type: 'N', color: 'b' },
      '0,6': { type: 'P', color: 'b' },
      '1,6': { type: 'P', color: 'b' },
      '4,4': { type: 'K', color: 'w' },
      '5,2': { type: 'Q', color: 'w' },
      '0,3': { type: 'R', color: 'w' },
    },
    solution: { from: [5,2], to: [7,0] }
  },
  {
    id: 7,
    title: "Pawn Promotion Mate",
    description: "White to move. Mate in 1.",
    hint: "Promote the pawn to deliver checkmate.",
    difficulty: 2,
    turn: 'w',
    board: {
      '3,7': { type: 'K', color: 'b' },
      '4,7': { type: 'R', color: 'b' },
      '2,7': { type: 'B', color: 'b' },
      '6,2': { type: 'K', color: 'w' },
      '3,6': { type: 'P', color: 'w' },
      '5,7': { type: 'R', color: 'w' },
    },
    solution: { from: [3,6], to: [3,7] }
  },
  {
    id: 8,
    title: "Back Door Entry",
    description: "White to move. Mate in 1.",
    hint: "Attack the king from behind — through the torus wrap.",
    difficulty: 3,
    turn: 'w',
    board: {
      '4,0': { type: 'K', color: 'b' },
      '3,0': { type: 'R', color: 'b' },
      '5,0': { type: 'N', color: 'b' },
      '4,1': { type: 'P', color: 'b' },
      '2,4': { type: 'K', color: 'w' },
      '4,3': { type: 'Q', color: 'w' },
      '6,7': { type: 'R', color: 'w' },
    },
    solution: { from: [6,7], to: [4,7] }
  },
];

export function getTorusPuzzles() {
  return torusPuzzles;
}

export function getTorusPuzzleById(id) {
  return torusPuzzles.find(p => p.id === id);
}
