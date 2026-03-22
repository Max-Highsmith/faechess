/**
 * Navigation between landing page, mode select, and game views
 */

const allViews = ['welcome-view', 'landing-page', 'mode-select', 'game-view', 'analyzer-view', 'online-setup'];

function hideAll() {
  for (const id of allViews) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
}

function showView(id) {
  hideAll();
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

export function showLandingPage() { showView('landing-page'); }
export function showModeSelect() { showView('mode-select'); }
export function showAnalyzer() { showView('analyzer-view'); }
export function showOnlineSetup() { showView('online-setup'); }

export function startGame(mode) {
  const gameView = document.getElementById('game-view');
  if (!gameView) return;

  // Remove old mode classes
  gameView.classList.remove('mode-pvp', 'mode-pvai', 'mode-puzzles', 'mode-tutorial', 'mode-online');

  // Apply new mode class
  gameView.classList.add('mode-' + mode);

  showView('game-view');

  // Tell main.js to set up the mode
  if (typeof window.setGameMode === 'function') {
    window.setGameMode(mode);
  }
}

/**
 * Start an online game — transitions from online-setup to game-view
 */
export function startOnlineGame() {
  startGame('online');
}

/**
 * Sync user authentication UI between landing and game views
 */
export function syncAuthUI(isLoggedIn, userEmail) {
  const landingLoggedIn = document.getElementById('landing-logged-in');
  const landingLoggedOut = document.getElementById('landing-logged-out');
  const landingUserEmail = document.getElementById('landing-user-email');

  if (landingLoggedIn) landingLoggedIn.classList.toggle('hidden', !isLoggedIn);
  if (landingLoggedOut) landingLoggedOut.classList.toggle('hidden', isLoggedIn);
  if (landingUserEmail && userEmail) landingUserEmail.textContent = userEmail;
}

/**
 * Initialize navigation event handlers
 */
export function initNavigation() {
  // 3D Chess card → mode select
  const play3DChess = document.getElementById('play-3d-chess');
  if (play3DChess) {
    play3DChess.addEventListener('click', () => showModeSelect());
  }

  // Mode select back → landing
  const modeBack = document.getElementById('mode-back');
  if (modeBack) {
    modeBack.addEventListener('click', () => showLandingPage());
  }

  // Mode cards → start game with mode
  const modes = ['pvp', 'pvai', 'puzzles', 'tutorial'];
  for (const mode of modes) {
    const btn = document.getElementById('mode-' + mode);
    if (btn) {
      btn.addEventListener('click', () => startGame(mode));
    }
  }

  // Online mode card → online setup (requires auth)
  const modeOnline = document.getElementById('mode-online');
  if (modeOnline) {
    modeOnline.addEventListener('click', () => {
      import('./auth.js').then(({ isAuthenticated }) => {
        const authReq = document.getElementById('online-auth-required');
        const panels = document.getElementById('online-panels');
        if (isAuthenticated()) {
          if (authReq) authReq.classList.add('hidden');
          if (panels) panels.style.display = '';
        } else {
          if (authReq) authReq.classList.remove('hidden');
          if (panels) panels.style.display = 'none';
        }
        showOnlineSetup();
      });
    });
  }

  // Online setup back → mode select
  const onlineBack = document.getElementById('online-back');
  if (onlineBack) {
    onlineBack.addEventListener('click', () => showModeSelect());
  }

  // Online auth login button
  const onlineLoginBtn = document.getElementById('online-login-btn');
  if (onlineLoginBtn) {
    onlineLoginBtn.addEventListener('click', () => {
      import('./auth.js').then(({ openAuthModal }) => {
        if (typeof openAuthModal === 'function') openAuthModal('login');
      });
    });
  }

  // Game view back → mode select (not landing)
  const backToMenu = document.getElementById('back-to-menu');
  if (backToMenu) {
    backToMenu.addEventListener('click', () => {
      // Cleanup multiplayer if active
      if (window.Multiplayer) window.Multiplayer.cleanup();
      showModeSelect();
    });
  }

  // Landing page auth buttons
  const landingLoginBtn = document.getElementById('landing-login-btn');
  const landingLogoutBtn = document.getElementById('landing-logout-btn');

  if (landingLoginBtn) {
    landingLoginBtn.addEventListener('click', () => {
      import('./auth.js').then(({ openAuthModal }) => {
        if (typeof openAuthModal === 'function') {
          openAuthModal('login');
        } else {
          const mainLoginBtn = document.getElementById('login-btn');
          if (mainLoginBtn) mainLoginBtn.click();
        }
      });
    });
  }

  if (landingLogoutBtn) {
    landingLogoutBtn.addEventListener('click', () => {
      const mainLogoutBtn = document.getElementById('logout-btn');
      if (mainLogoutBtn) mainLogoutBtn.click();
    });
  }

  // Analyzer card
  const openAnalyzer = document.getElementById('open-analyzer');
  if (openAnalyzer) {
    openAnalyzer.addEventListener('click', () => showAnalyzer());
  }

  // Analyzer back button
  const analyzerBack = document.getElementById('analyzer-back');
  if (analyzerBack) {
    analyzerBack.addEventListener('click', () => showLandingPage());
  }

  // Disabled game cards (5 Board and Torus)
  const play5Board = document.getElementById('play-5-board');
  const playTorus = document.getElementById('play-torus');

  [play5Board, playTorus].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('This game mode is coming soon! Stay tuned.');
      });
    }
  });

  console.log('✅ Navigation initialized');
}
