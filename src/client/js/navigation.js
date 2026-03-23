/**
 * Navigation between landing page, mode select, and game views
 */

const allViews = ['welcome-view', 'profile-setup-view', 'landing-page', 'mode-select', 'game-view', 'analyzer-view', 'online-setup', 'leaderboard-view', 'torus-mode-select', 'torus-game-view'];

function hideAll() {
  for (const id of allViews) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
  // Hide renderers attached to document.body
  if (typeof window.hideTorusRenderer === 'function') window.hideTorusRenderer();
}

function showView(id) {
  hideAll();
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

export function showLandingPage() { showView('landing-page'); }
export function showProfileSetup() { showView('profile-setup-view'); }
export function showModeSelect() { showView('mode-select'); }
export function showAnalyzer() { showView('analyzer-view'); }
export function showOnlineSetup() { showView('online-setup'); }
export function showLeaderboard() { showView('leaderboard-view'); }
export function showTorusModeSelect() {
  if (typeof window.hideTorusRenderer === 'function') window.hideTorusRenderer();
  showView('torus-mode-select');
}

export function startTorusGame(mode) {
  const gameView = document.getElementById('torus-game-view');
  if (!gameView) return;
  gameView.classList.remove('mode-torus-pvp', 'mode-torus-pvai');
  gameView.classList.add('mode-' + mode);
  showView('torus-game-view');
  if (typeof window.setTorusGameMode === 'function') {
    window.setTorusGameMode(mode);
  }
}

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

  // Edit Profile button
  const editProfileBtn = document.getElementById('landing-edit-profile-btn');
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
      import('./profile.js').then(({ showEditProfile }) => showEditProfile());
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

  // Leaderboard card
  const modeLeaderboard = document.getElementById('mode-leaderboard');
  if (modeLeaderboard) {
    modeLeaderboard.addEventListener('click', () => {
      loadLeaderboard();
      showLeaderboard();
    });
  }

  // Leaderboard back button
  const leaderboardBack = document.getElementById('leaderboard-back');
  if (leaderboardBack) {
    leaderboardBack.addEventListener('click', () => showModeSelect());
  }

  // Disabled game cards (5 Board only)
  const play5Board = document.getElementById('play-5-board');
  if (play5Board) {
    play5Board.addEventListener('click', (e) => {
      e.preventDefault();
      alert('This game mode is coming soon! Stay tuned.');
    });
  }

  // Torus Chess card → torus mode select
  const playTorus = document.getElementById('play-torus');
  if (playTorus) {
    playTorus.addEventListener('click', () => showTorusModeSelect());
  }

  // Torus mode select back → landing
  const torusModeBack = document.getElementById('torus-mode-back');
  if (torusModeBack) {
    torusModeBack.addEventListener('click', () => showLandingPage());
  }

  // Torus mode cards → start torus game
  const torusModes = ['torus-pvp', 'torus-pvai'];
  for (const mode of torusModes) {
    const btn = document.getElementById('torus-mode-' + mode.replace('torus-', ''));
    if (btn) {
      btn.addEventListener('click', () => startTorusGame(mode));
    }
  }

  // Torus game view back → torus mode select
  const torusBackToMenu = document.getElementById('torus-back-to-menu');
  if (torusBackToMenu) {
    torusBackToMenu.addEventListener('click', () => {
      if (typeof window.hideTorusRenderer === 'function') window.hideTorusRenderer();
      showTorusModeSelect();
    });
  }

  console.log('✅ Navigation initialized');
}

async function loadLeaderboard() {
  const body = document.getElementById('leaderboard-body');
  const loading = document.getElementById('leaderboard-loading');
  const empty = document.getElementById('leaderboard-empty');
  if (!body) return;

  body.innerHTML = '';
  if (loading) loading.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');

  try {
    const res = await fetch('/api/leaderboard');
    const players = await res.json();

    if (loading) loading.classList.add('hidden');

    if (!players.length) {
      if (empty) empty.classList.remove('hidden');
      return;
    }

    players.forEach((player, i) => {
      const rank = i + 1;
      const tr = document.createElement('tr');
      const rankClass = rank <= 3 ? ` leaderboard-rank-${rank}` : '';
      const avatarHtml = player.avatar_url
        ? `<img class="leaderboard-avatar" src="${player.avatar_url}" alt="" />`
        : '';
      tr.innerHTML = `
        <td class="leaderboard-rank${rankClass}">${rank}</td>
        <td><div class="leaderboard-player">${avatarHtml}<span>${player.game_id || 'Anonymous'}</span></div></td>
        <td class="leaderboard-rating">${player.elo_rating}</td>
        <td class="leaderboard-record">${player.wins}/${player.losses}/${player.draws}</td>
        <td>${player.games_played}</td>
      `;
      body.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading leaderboard:', err);
    if (loading) loading.textContent = 'Failed to load leaderboard';
  }
}
