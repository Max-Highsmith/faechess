/**
 * Tutorial – Piece movement lessons for Raumschach 3D Chess
 */

const LESSONS = [
  {
    type: 'P',
    name: 'Pawn',
    icon: '♙',
    description: 'Moves forward one square along the Y or Z axis (no diagonal). Captures diagonally forward in any plane. White pawns move in +Y and +Z directions.',
    startPos: [2, 1, 1]
  },
  {
    type: 'R',
    name: 'Rook',
    icon: '♖',
    description: 'Slides any number of squares along a single axis — left/right, forward/back, or up/down. 6 possible directions in 3D.',
    startPos: [2, 2, 2]
  },
  {
    type: 'N',
    name: 'Knight',
    icon: '♘',
    description: 'Jumps in an L-shape: 2 squares along one axis and 1 along another (0 along the third). Can leap over other pieces. The 3D board gives it many more targets than in standard chess.',
    startPos: [2, 2, 2]
  },
  {
    type: 'B',
    name: 'Bishop',
    icon: '♗',
    description: 'Slides diagonally through exactly 2 axes at once. Moves along XY, XZ, or YZ diagonal planes. 12 possible directions in 3D.',
    startPos: [2, 2, 2]
  },
  {
    type: 'U',
    name: 'Unicorn',
    icon: '⛊',
    description: 'Unique to 3D chess! Slides along triagonals — diagonals that pass through all 3 axes simultaneously. 8 possible directions. Think of it as a 3D bishop.',
    startPos: [2, 2, 2]
  },
  {
    type: 'Q',
    name: 'Queen',
    icon: '♕',
    description: 'The most powerful piece. Combines the movement of Rook + Bishop + Unicorn. Can slide in any of 26 directions — along axes, diagonals, and triagonals.',
    startPos: [2, 2, 2]
  },
  {
    type: 'K',
    name: 'King',
    icon: '♔',
    description: 'Moves exactly 1 square in any direction — including diagonals and triagonals. That\'s up to 26 possible squares from the center of the board.',
    startPos: [2, 2, 2]
  }
];

export function getAll() {
  return LESSONS;
}

export function getByType(type) {
  return LESSONS.find(l => l.type === type) || null;
}
