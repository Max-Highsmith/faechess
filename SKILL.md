---
name: raumschach
description: Play Raumschach 3D chess (5x5x5) via HTTP API
version: 1.0.0
author: user
tags: [games, chess, 3d-chess]
---

# Raumschach 3D Chess

Play a game of Raumschach, a 3D chess variant on a 5x5x5 board.

## Setup

Start the game server:
```bash
cd /path/to/3dchess && node server.js
```

The API runs on `http://localhost:3000`.

## Coordinates

Positions use notation like `a1A`:
- **Letter** (a-e): file (column, x-axis)
- **Number** (1-5): rank (row, y-axis)
- **Capital letter** (A-E): level (height, z-axis)

Level A is the bottom (White's home), Level E is the top (Black's home).

## Pieces

| Code | Name    | Movement                                  |
|------|---------|-------------------------------------------|
| K    | King    | One step in any of 26 directions          |
| Q    | Queen   | Slides along any axis, diagonal, or triagonal |
| R    | Rook    | Slides along one axis (6 directions)      |
| B    | Bishop  | Slides diagonally in 2 axes (12 directions) |
| U    | Unicorn | Slides diagonally in all 3 axes (8 directions) |
| N    | Knight  | Jumps in L-shape (2+1 across any axes)    |
| P    | Pawn    | Moves forward in y or z; captures diagonally |

## How to Play

### 1. Check the board

```bash
curl http://localhost:3000/state
```

Response includes:
- `board`: all pieces with positions, types, and colors
- `turn`: "white" or "black"
- `legalMoves`: object mapping each piece position to its legal target squares
- `check`: whether current player is in check
- `gameOver` and `result`: game end status

### 2. Choose and make a move

Pick a piece from `legalMoves` and choose one of its targets:

```bash
curl -X POST http://localhost:3000/move \
  -H "Content-Type: application/json" \
  -d '{"from":"a2A","to":"a3A"}'
```

The response includes the updated game state.

### 3. Continue until checkmate or stalemate

Keep alternating: check state, make a move.

### Other commands

```bash
# Reset the game
curl http://localhost:3000/reset

# Undo last move
curl http://localhost:3000/undo

# Health check
curl http://localhost:3000/health
```

## Strategy Tips

- Control the center (c3C area) for maximum influence
- Unicorns are unique to 3D chess and very powerful on open boards
- Pawns advance in both y and z, giving two promotion paths
- Watch for attacks from different levels — the 3D space makes forks common
- The Queen combines Rook + Bishop + Unicorn movement and dominates open positions

## Example Game Session

```bash
# 1. See initial position
curl -s localhost:3000/state | jq '.turn, .legalMoves | keys'

# 2. White opens with pawn to a3A
curl -s -X POST localhost:3000/move -H "Content-Type: application/json" -d '{"from":"a2A","to":"a3A"}'

# 3. Black responds
curl -s -X POST localhost:3000/move -H "Content-Type: application/json" -d '{"from":"a4E","to":"a3E"}'

# 4. Check state after moves
curl -s localhost:3000/state | jq '{turn, check, moveCount}'
```
