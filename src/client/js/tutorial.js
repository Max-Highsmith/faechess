/**
 * Tutorial – Piece movement lessons & endgame lessons for Raumschach 3D Chess
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

/**
 * Endgame lessons – interactive practice positions where the user plays White
 * and the black king auto-responds. Goal: deliver checkmate.
 */
const ENDGAME_LESSONS = [
  {
    id: 'kqk',
    name: 'King + Queen vs King',
    icon: '♕',
    description: 'The queen is powerful enough to force checkmate alone (with king support). Use the queen to restrict the enemy king to an edge or corner, then bring your king close to deliver mate. Avoid stalemate!',
    board: {
      '2,2,0': { type: 'K', color: 'w' },
      '2,2,1': { type: 'Q', color: 'w' },
      '2,2,4': { type: 'K', color: 'b' },
    },
    turn: 'w'
  },
  {
    id: 'krrk',
    name: 'King + 2 Rooks vs King',
    icon: '♖',
    description: 'Two rooks can force checkmate using the "ladder" technique: alternate rooks to cut off planes one at a time, pushing the king to the edge. Your king doesn\'t even need to help!',
    board: {
      '2,2,0': { type: 'K', color: 'w' },
      '0,0,0': { type: 'R', color: 'w' },
      '1,0,1': { type: 'R', color: 'w' },
      '2,2,4': { type: 'K', color: 'b' },
    },
    turn: 'w'
  }
];

export function getAll() {
  return LESSONS;
}

export function getByType(type) {
  return LESSONS.find(l => l.type === type) || null;
}

export function getAllEndgames() {
  return ENDGAME_LESSONS;
}

export function getEndgameById(id) {
  return ENDGAME_LESSONS.find(l => l.id === id) || null;
}
