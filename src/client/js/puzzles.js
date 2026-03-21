/**
 * Raumschach – Puzzle Collection
 *
 * Each puzzle is a mate-in-1 with a unique solution.
 * All positions validated against the game engine.
 */

const puzzles = [
  {
    id: 1,
    title: "Queen's Triagonal Trap",
    description: "White to move. Mate in 1.",
    hint: "The queen can cover all 7 escape squares from one perfect position.",
    difficulty: 1,
    turn: 'w',
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
    description: "White to move. Mate in 1.",
    hint: "The king's own pieces form its prison. Capture the guard.",
    difficulty: 2,
    turn: 'w',
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
    description: "White to move. Mate in 1.",
    hint: "The queen descends through the levels to strike.",
    difficulty: 1,
    turn: 'w',
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
    description: "White to move. Mate in 1.",
    hint: "Send the queen across the board through the z-axis.",
    difficulty: 2,
    turn: 'w',
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
    description: "White to move. Mate in 1.",
    hint: "Trap the king between levels with the queen's multi-dimensional reach.",
    difficulty: 2,
    turn: 'w',
    board: {
      '0,0,4': { type: 'K', color: 'b' },
      '4,4,0': { type: 'K', color: 'w' },
      '1,1,0': { type: 'Q', color: 'w' },
      '1,4,3': { type: 'R', color: 'w' },
    },
    solution: { from: [1,1,0], to: [1,1,3] }
  },
  {
    id: 6,
    title: "Corner Suffocation",
    description: "White to move. Mate in 1.",
    hint: "The queen slides diagonally to seal every exit from the cornered king.",
    difficulty: 2,
    turn: 'w',
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '0,1,0': { type: 'P', color: 'b' },
      '0,1,1': { type: 'P', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '1,0,1': { type: 'P', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '0,0,2': { type: 'Q', color: 'w' },
    },
    solution: { from: [0,0,2], to: [2,2,0] }
  },
  {
    id: 7,
    title: "Triagonal Tomb",
    description: "White to move. Mate in 1.",
    hint: "The queen travels through all three dimensions to reach the killing square.",
    difficulty: 2,
    turn: 'w',
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '0,1,0': { type: 'P', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '1,1,0': { type: 'P', color: 'b' },
      '0,1,1': { type: 'P', color: 'b' },
      '1,0,1': { type: 'P', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '0,0,2': { type: 'Q', color: 'w' },
    },
    solution: { from: [0,0,2], to: [2,2,2] }
  },
  {
    id: 8,
    title: "Queen's Long Reach",
    description: "White to move. Mate in 1.",
    hint: "The queen crosses the entire board to deliver mate from the far side.",
    difficulty: 3,
    turn: 'w',
    board: {
      '4,0,0': { type: 'K', color: 'b' },
      '3,0,0': { type: 'P', color: 'b' },
      '4,1,0': { type: 'P', color: 'b' },
      '4,0,1': { type: 'P', color: 'b' },
      '3,1,0': { type: 'P', color: 'b' },
      '3,0,1': { type: 'P', color: 'b' },
      '0,4,4': { type: 'K', color: 'w' },
      '0,2,2': { type: 'Q', color: 'w' },
    },
    solution: { from: [0,2,2], to: [4,2,2] }
  },
  {
    id: 9,
    title: "Unicorn's Descent",
    description: "White to move. Mate in 1.",
    hint: "The unicorn drops through all three axes at once to deliver the final blow.",
    difficulty: 3,
    turn: 'w',
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '0,1,0': { type: 'P', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '1,1,0': { type: 'P', color: 'b' },
      '0,1,1': { type: 'P', color: 'b' },
      '1,0,1': { type: 'P', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '0,0,4': { type: 'U', color: 'w' },
    },
    solution: { from: [0,0,4], to: [2,2,2] }
  },
  {
    id: 10,
    title: "Knight's 3D Leap",
    description: "White to move. Mate in 1.",
    hint: "The knight vaults through three dimensions to land on the one square that ends it all.",
    difficulty: 4,
    turn: 'w',
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '0,1,0': { type: 'P', color: 'b' },
      '0,1,1': { type: 'P', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '1,0,1': { type: 'P', color: 'b' },
      '1,1,0': { type: 'P', color: 'b' },
      '1,1,1': { type: 'R', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '0,1,3': { type: 'N', color: 'w' },
    },
    solution: { from: [0,1,3], to: [0,2,1] }
  },
  {
    id: 11,
    title: "Rook's Capture Mate",
    description: "White to move. Mate in 1.",
    hint: "The rook captures a defender to deliver mate while the queen covers the escapes.",
    difficulty: 3,
    turn: 'w',
    board: {
      '4,4,4': { type: 'K', color: 'b' },
      '4,4,3': { type: 'P', color: 'b' },
      '4,3,4': { type: 'P', color: 'b' },
      '4,3,3': { type: 'P', color: 'b' },
      '3,4,4': { type: 'P', color: 'b' },
      '3,4,3': { type: 'P', color: 'b' },
      '0,0,0': { type: 'K', color: 'w' },
      '3,3,4': { type: 'R', color: 'w' },
      '3,2,4': { type: 'Q', color: 'w' },
    },
    solution: { from: [3,3,4], to: [3,4,4] }
  },
  {
    id: 12,
    title: "Queen's Sacrifice Descent",
    description: "White to move. Mate in 1.",
    hint: "The queen drops down to capture the pawn, sealing the king's fate with rook support.",
    difficulty: 2,
    turn: 'w',
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,1,0': { type: 'P', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '0,0,2': { type: 'R', color: 'w' },
      '0,1,2': { type: 'Q', color: 'w' },
    },
    solution: { from: [0,1,2], to: [0,0,1] }
  },
  {
    id: 13,
    title: "Triagonal Pincer",
    description: "White to move. Mate in 1.",
    hint: "The queen strikes along a triagonal while the rook controls the critical level.",
    difficulty: 3,
    turn: 'w',
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,1,0': { type: 'P', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '0,1,1': { type: 'R', color: 'w' },
      '1,1,3': { type: 'Q', color: 'w' },
    },
    solution: { from: [1,1,3], to: [1,1,1] }
  },
  {
    id: 14,
    title: "Rank and File",
    description: "White to move. Mate in 1.",
    hint: "The queen swoops down to capture the pawn on the king's rank.",
    difficulty: 2,
    turn: 'w',
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,1,0': { type: 'P', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '0,1,1': { type: 'R', color: 'w' },
      '0,3,0': { type: 'Q', color: 'w' },
    },
    solution: { from: [0,3,0], to: [0,1,0] }
  },
  {
    id: 15,
    title: "Level Drop",
    description: "White to move. Mate in 1.",
    hint: "The queen drops one level to deliver mate with rook support from above.",
    difficulty: 2,
    turn: 'w',
    board: {
      '0,0,0': { type: 'K', color: 'b' },
      '0,1,0': { type: 'P', color: 'b' },
      '1,0,0': { type: 'P', color: 'b' },
      '0,0,1': { type: 'P', color: 'b' },
      '4,4,4': { type: 'K', color: 'w' },
      '0,1,2': { type: 'R', color: 'w' },
      '0,0,2': { type: 'Q', color: 'w' },
    },
    solution: { from: [0,0,2], to: [0,1,1] }
  }
];

export function getAll() { return puzzles; }
export function getById(id) { return puzzles.find(p => p.id === id) || null; }
export function count() { return puzzles.length; }

export default { getAll, getById, count };
