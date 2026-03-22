/**
 * Multiplayer module – handles online game creation, joining, and real-time sync
 * via Supabase Realtime Broadcast.
 */
import supabase from './supabase-client.js';
import { getCurrentUser, getAuthToken } from './auth.js';

let activeGame = null;   // { id, invite_code, myColor, status }
let channel = null;
let onMoveReceived = null;
let onGameEvent = null;
let playerProfiles = {};  // { [userId]: { id, game_id, avatar_url } }

/**
 * Register callbacks from main.js.
 *   onMove(payload)  – called when opponent makes a move
 *   onEvent(type, payload) – called for join/resign/presence events
 */
export function setCallbacks(onMove, onEvent) {
  onMoveReceived = onMove;
  onGameEvent = onEvent;
}

export function getActiveGame() { return activeGame; }
export function getPlayerProfiles() { return playerProfiles; }

export function isMyTurn(currentTurn) {
  return activeGame && currentTurn === activeGame.myColor;
}

async function authHeaders() {
  const token = await getAuthToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Subscribe to the Supabase Realtime channel for a game.
 */
function subscribeToGame(gameId) {
  if (channel) {
    supabase.removeChannel(channel);
  }

  channel = supabase.channel(`game:${gameId}`, {
    config: { broadcast: { self: false } }
  });

  channel
    .on('broadcast', { event: 'move' }, ({ payload }) => {
      console.log('[MP] Received move broadcast:', payload);
      if (onMoveReceived) onMoveReceived(payload);
    })
    .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
      console.log('[MP] Received player_joined broadcast:', payload);
      if (activeGame) activeGame.status = 'active';
      if (onGameEvent) onGameEvent('player_joined', payload);
    })
    .on('broadcast', { event: 'resign' }, ({ payload }) => {
      console.log('[MP] Received resign broadcast:', payload);
      if (activeGame) activeGame.status = 'completed';
      if (onGameEvent) onGameEvent('resign', payload);
    })
    .subscribe((status) => {
      console.log('[MP] Channel subscription status:', status);
    });
}

/**
 * Create a new online game.
 * @param {string} color – 'white', 'black', or 'random'
 * @returns {{ game_id, invite_code, color }}
 */
export async function createGame(color) {
  const headers = await authHeaders();
  const res = await fetch('/api/games', {
    method: 'POST',
    headers,
    body: JSON.stringify({ color })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create game');
  }

  const data = await res.json();
  activeGame = {
    id: data.game_id,
    invite_code: data.invite_code,
    myColor: data.color,
    status: 'waiting'
  };

  if (data.players) {
    data.players.forEach(p => { playerProfiles[p.id] = p; });
  }

  subscribeToGame(data.game_id);
  return data;
}

/**
 * Join a game via invite code.
 * @param {string} inviteCode
 * @returns {{ game_id, color, status }}
 */
export async function joinGame(inviteCode) {
  const headers = await authHeaders();
  const res = await fetch(`/api/games/join/${encodeURIComponent(inviteCode)}`, {
    headers
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to join game');
  }

  const data = await res.json();
  activeGame = {
    id: data.game_id,
    invite_code: inviteCode,
    myColor: data.color,
    status: data.status
  };

  if (data.players) {
    data.players.forEach(p => { playerProfiles[p.id] = p; });
  }

  subscribeToGame(data.game_id);

  // Broadcast player_joined from client so the creator's channel picks it up
  // Include joiner's profile so the creator can display it
  const user = getCurrentUser();
  const joinerProfile = user ? playerProfiles[user.id] : null;
  if (data.status === 'active' && channel) {
    setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'player_joined',
        payload: { color: data.color, profile: joinerProfile }
      }).then(() => console.log('[MP] Broadcasted player_joined from client'));
    }, 500); // small delay to ensure channel is subscribed
  }

  return data;
}

/**
 * Load an existing game (for reconnection).
 * @param {string} gameId
 * @returns {object} full game state
 */
export async function loadGame(gameId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/games/${gameId}`, { headers });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to load game');
  }

  const data = await res.json();
  activeGame = {
    id: data.id,
    invite_code: data.invite_code,
    myColor: data.my_color,
    status: data.status
  };

  if (data.players) {
    data.players.forEach(p => { playerProfiles[p.id] = p; });
  }

  subscribeToGame(data.id);
  return data;
}

/**
 * Submit a move to the server (optimistic — call after local makeMove).
 * @param {number[]} from – [x,y,z]
 * @param {number[]} to   – [x,y,z]
 */
export async function submitMove(from, to) {
  if (!activeGame) throw new Error('No active game');

  const headers = await authHeaders();
  const res = await fetch(`/api/games/${activeGame.id}/move`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ from, to })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Move rejected');
  }

  const data = await res.json();

  // Broadcast the move from the client so the opponent's channel picks it up
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'move',
      payload: data
    }).then(() => console.log('[MP] Broadcasted move from client'));
  }

  return data;
}

/**
 * Resign the current game.
 */
export async function resignGame() {
  if (!activeGame) return;

  const myColor = activeGame.myColor;
  const headers = await authHeaders();
  const res = await fetch(`/api/games/${activeGame.id}/resign`, {
    method: 'POST',
    headers
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to resign');
  }

  const data = await res.json();

  // Broadcast resignation from client
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'resign',
      payload: { color: myColor, result: data.result }
    }).then(() => console.log('[MP] Broadcasted resign from client'));
  }

  activeGame.status = 'completed';
  return data;
}

/**
 * Unsubscribe from the realtime channel and clear state.
 */
export function cleanup() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  activeGame = null;
  playerProfiles = {};
}
