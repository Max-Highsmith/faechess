/**
 * Bootstrap file - loads all modules and initializes the app
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as GameModule from './game.js';
import * as AIModule from './ai.js';
import * as PuzzlesModule from './puzzles.js';
import * as TutorialModule from './tutorial.js';
import * as MultiplayerModule from './multiplayer.js';
import * as TorusGameModule from './torus-game.js';
import * as TorusAIModule from './torus-ai.js';
import { initAuth, getCurrentUser, getAuthToken, isAuthenticated } from './auth.js';
import { initNavigation, startOnlineGame, showOnlineSetup } from './navigation.js';
import { initProfileSetup } from './profile.js';

// Make THREE and OrbitControls available globally for render.js
window.THREE = THREE;
window.OrbitControls = OrbitControls;

// Make game modules available globally (for compatibility with existing code)
window.Raumschach = GameModule;
window.ChessAI = AIModule;
window.Puzzles = PuzzlesModule;
window.Tutorials = TutorialModule;
window.Multiplayer = MultiplayerModule;
window.TorusGameModule = TorusGameModule;
window.TorusAIModule = TorusAIModule;

// Initialize authentication
initAuth();

// Initialize navigation
initNavigation();

// Initialize profile setup handlers
initProfileSetup();

// Initialize music player
initMusicPlayer();

// Set up online game UI handlers
setupOnlineHandlers();

// Load render.js and main.js dynamically
Promise.all([
  /* @vite-ignore */ import('./render.js'),
  /* @vite-ignore */ import('./flat-render.js'),
  /* @vite-ignore */ import('./torus-render.js')
]).then(() => {
  // Now load main.js, analyzer.js, and torus-main.js which depend on the render files
  Promise.all([
    /* @vite-ignore */ import('./main.js'),
    /* @vite-ignore */ import('./analyzer.js'),
    /* @vite-ignore */ import('./torus-main.js')
  ]).then(([mainModule, analyzerModule]) => {
    console.log('✅ All modules loaded successfully!');

    // Make loadUserProgress available globally for auth.js
    if (mainModule && mainModule.loadUserProgress) {
      window.loadUserProgress = mainModule.loadUserProgress;
    }

    // Check URL for game invite on initial load
    checkInviteUrl();
  });
}).catch(error => {
  console.error('❌ Error loading modules:', error);
});

/**
 * Music player toggle & volume
 */
function initMusicPlayer() {
  const audio = document.getElementById('music-audio');
  const btn = document.getElementById('music-toggle');
  const vol = document.getElementById('music-volume');
  if (!audio || !btn || !vol) return;

  audio.volume = parseFloat(vol.value);

  btn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      btn.classList.add('playing');
      btn.title = 'Pause music';
    } else {
      audio.pause();
      btn.classList.remove('playing');
      btn.title = 'Play music';
    }
  });

  vol.addEventListener('input', () => {
    audio.volume = parseFloat(vol.value);
  });
}

/**
 * Set up create/join/copy handlers on the online-setup view
 */
function setupOnlineHandlers() {
  // Color picker
  const colorBtns = document.querySelectorAll('.color-btn');
  let selectedColor = 'white';
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
    });
  });

  // Create game
  const btnCreate = document.getElementById('btn-create-game');
  if (btnCreate) {
    btnCreate.addEventListener('click', async () => {
      try {
        btnCreate.disabled = true;
        btnCreate.textContent = 'Creating...';
        const data = await MultiplayerModule.createGame(selectedColor);

        // Show waiting panel, hide create panel
        document.getElementById('create-game-panel').classList.add('hidden');
        document.getElementById('join-game-panel').classList.add('hidden');
        const waitPanel = document.getElementById('waiting-panel');
        waitPanel.classList.remove('hidden');

        const inviteUrl = `${window.location.origin}/game/${data.invite_code}`;
        document.getElementById('invite-link-input').value = inviteUrl;

        // Listen for opponent joining
        MultiplayerModule.setCallbacks(null, (type, payload) => {
          if (type === 'player_joined') {
            startOnlineGame();
          }
        });
      } catch (err) {
        alert('Failed to create game: ' + err.message);
      } finally {
        btnCreate.disabled = false;
        btnCreate.textContent = 'Create Game';
      }
    });
  }

  // Copy invite link
  const btnCopy = document.getElementById('btn-copy-link');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const input = document.getElementById('invite-link-input');
      navigator.clipboard.writeText(input.value).then(() => {
        btnCopy.textContent = 'Copied!';
        setTimeout(() => { btnCopy.textContent = 'Copy'; }, 2000);
      });
    });
  }

  // Join game
  const btnJoin = document.getElementById('btn-join-game');
  if (btnJoin) {
    btnJoin.addEventListener('click', async () => {
      const input = document.getElementById('invite-code-input');
      let code = input.value.trim();
      if (!code) return;

      // Extract code from full URL if pasted
      const urlMatch = code.match(/\/game\/([A-Za-z0-9_-]+)/);
      if (urlMatch) code = urlMatch[1];

      try {
        btnJoin.disabled = true;
        btnJoin.textContent = 'Joining...';
        await MultiplayerModule.joinGame(code);
        startOnlineGame();
      } catch (err) {
        alert('Failed to join game: ' + err.message);
      } finally {
        btnJoin.disabled = false;
        btnJoin.textContent = 'Join';
      }
    });
  }
}

/**
 * Check if URL is an invite link (/game/:code) and auto-join.
 * Saves the invite code so it survives the auth flow.
 */
function checkInviteUrl() {
  const pathMatch = window.location.pathname.match(/^\/game\/([A-Za-z0-9_-]+)$/);
  if (pathMatch) {
    sessionStorage.setItem('pending-invite', pathMatch[1]);
    window.history.replaceState({}, '', '/');
  }

  attemptPendingJoin();
}

/**
 * Try to join a game from a saved invite code.
 * Called after URL check and again after auth completes.
 */
function attemptPendingJoin() {
  const inviteCode = sessionStorage.getItem('pending-invite');
  if (!inviteCode) return;

  if (!isAuthenticated()) return; // will retry after sign-in

  sessionStorage.removeItem('pending-invite');

  MultiplayerModule.joinGame(inviteCode)
    .then(() => startOnlineGame())
    .catch(err => {
      alert('Failed to join game: ' + err.message);
      showOnlineSetup();
    });
}

// Expose for auth module to call after sign-in
window._attemptPendingJoin = attemptPendingJoin;

// Export for other modules
export { getCurrentUser, getAuthToken };
