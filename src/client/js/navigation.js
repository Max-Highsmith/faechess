/**
 * Navigation between landing page, mode select, and game views
 */

const allViews = ['welcome-view', 'profile-setup-view', 'landing-page', 'mode-select', 'game-view', 'analyzer-view', 'online-setup', 'ranked-setup', 'leaderboard-view', 'torus-mode-select', 'torus-game-view', 'five-board-mode-select', 'five-board-game-view', 'federation-view'];

function hideAll() {
  for (const id of allViews) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
  // Hide renderers attached to document.body
  if (typeof window.hideRaumschachRenderer === 'function') window.hideRaumschachRenderer();
  if (typeof window.hideTorusRenderer === 'function') window.hideTorusRenderer();
  if (typeof window.hideFiveBoardRenderer === 'function') window.hideFiveBoardRenderer();
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
export function showRankedSetup() { showView('ranked-setup'); }
export function showLeaderboard() { showView('leaderboard-view'); }
export function showFederation() { showView('federation-view'); }

export function showTorusModeSelect() {
  if (typeof window.hideTorusRenderer === 'function') window.hideTorusRenderer();
  showView('torus-mode-select');
}

export function startTorusGame(mode) {
  const gameView = document.getElementById('torus-game-view');
  if (!gameView) return;
  gameView.classList.remove('mode-torus-pvp', 'mode-torus-pvai', 'mode-torus-puzzles', 'mode-torus-online');
  gameView.classList.add('mode-' + mode);
  showView('torus-game-view');
  if (typeof window.setTorusGameMode === 'function') {
    window.setTorusGameMode(mode);
  }
}

export function startTorusOnlineGame() {
  startTorusGame('torus-online');
}

export function showFiveBoardModeSelect() {
  if (typeof window.hideFiveBoardRenderer === 'function') window.hideFiveBoardRenderer();
  showView('five-board-mode-select');
}

export function startFiveBoardGame(mode) {
  const gameView = document.getElementById('five-board-game-view');
  if (!gameView) return;
  gameView.classList.remove('mode-fb-pvp', 'mode-fb-pvai', 'mode-fb-online');
  gameView.classList.add('mode-' + mode);
  showView('five-board-game-view');
  if (typeof window.setFiveBoardGameMode === 'function') {
    window.setFiveBoardGameMode(mode);
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
      window._pendingGameType = 'raumschach';
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

  // Ranked mode card → ranked setup (requires auth)
  const modeRanked = document.getElementById('mode-ranked');
  if (modeRanked) {
    modeRanked.addEventListener('click', () => {
      window._pendingRankedGameType = 'raumschach';
      import('./auth.js').then(({ isAuthenticated }) => {
        const authReq = document.getElementById('ranked-auth-required');
        const panels = document.getElementById('ranked-panels');
        if (isAuthenticated()) {
          if (authReq) authReq.classList.add('hidden');
          if (panels) panels.style.display = '';
        } else {
          if (authReq) authReq.classList.remove('hidden');
          if (panels) panels.style.display = 'none';
        }
        showRankedSetup();
      });
    });
  }

  // Online setup back → mode select (or torus mode select)
  const onlineBack = document.getElementById('online-back');
  if (onlineBack) {
    onlineBack.addEventListener('click', () => {
      if (window._pendingGameType === 'torus') {
        window._pendingGameType = null;
        showTorusModeSelect();
      } else if (window._pendingGameType === 'five-board') {
        window._pendingGameType = null;
        showFiveBoardModeSelect();
      } else {
        window._pendingGameType = null;
        showModeSelect();
      }
    });
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

  // Ranked setup back → appropriate mode select
  const rankedBack = document.getElementById('ranked-back');
  if (rankedBack) {
    rankedBack.addEventListener('click', () => {
      if (window.Multiplayer) window.Multiplayer.leaveQueue();
      // Reset panels to config state
      const config = document.getElementById('ranked-config-panel');
      const waiting = document.getElementById('ranked-waiting-panel');
      if (config) config.classList.remove('hidden');
      if (waiting) waiting.classList.add('hidden');

      const gt = window._pendingRankedGameType;
      window._pendingRankedGameType = null;
      if (gt === 'torus') showTorusModeSelect();
      else if (gt === 'five-board') showFiveBoardModeSelect();
      else showModeSelect();
    });
  }

  // Ranked auth login button
  const rankedLoginBtn = document.getElementById('ranked-login-btn');
  if (rankedLoginBtn) {
    rankedLoginBtn.addEventListener('click', () => {
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

  // Five-Board Chess card → five-board mode select
  const play5Board = document.getElementById('play-5-board');
  if (play5Board) {
    play5Board.addEventListener('click', () => showFiveBoardModeSelect());
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
  const torusModes = ['torus-pvp', 'torus-pvai', 'torus-puzzles'];
  for (const mode of torusModes) {
    const btn = document.getElementById('torus-mode-' + mode.replace('torus-', ''));
    if (btn) {
      btn.addEventListener('click', () => startTorusGame(mode));
    }
  }

  // Torus online mode card → online setup (requires auth)
  const torusModeOnline = document.getElementById('torus-mode-online');
  if (torusModeOnline) {
    torusModeOnline.addEventListener('click', () => {
      window._pendingGameType = 'torus';
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

  // Torus ranked mode card → ranked setup (requires auth)
  const torusModeRanked = document.getElementById('torus-mode-ranked');
  if (torusModeRanked) {
    torusModeRanked.addEventListener('click', () => {
      window._pendingRankedGameType = 'torus';
      import('./auth.js').then(({ isAuthenticated }) => {
        const authReq = document.getElementById('ranked-auth-required');
        const panels = document.getElementById('ranked-panels');
        if (isAuthenticated()) {
          if (authReq) authReq.classList.add('hidden');
          if (panels) panels.style.display = '';
        } else {
          if (authReq) authReq.classList.remove('hidden');
          if (panels) panels.style.display = 'none';
        }
        showRankedSetup();
      });
    });
  }

  // Torus game view back → torus mode select
  const torusBackToMenu = document.getElementById('torus-back-to-menu');
  if (torusBackToMenu) {
    torusBackToMenu.addEventListener('click', () => {
      if (window.Multiplayer) window.Multiplayer.cleanup();
      if (typeof window.hideTorusRenderer === 'function') window.hideTorusRenderer();
      showTorusModeSelect();
    });
  }

  // Five-Board mode select back → landing
  const fbModeBack = document.getElementById('fb-mode-back');
  if (fbModeBack) {
    fbModeBack.addEventListener('click', () => showLandingPage());
  }

  // Five-Board mode cards → start five-board game
  const fbModes = ['fb-pvp', 'fb-pvai'];
  for (const mode of fbModes) {
    const btn = document.getElementById(mode.replace('fb-', 'fb-mode-'));
    if (btn) {
      btn.addEventListener('click', () => startFiveBoardGame(mode));
    }
  }

  // Five-Board online mode card → online setup (requires auth)
  const fbModeOnline = document.getElementById('fb-mode-online');
  if (fbModeOnline) {
    fbModeOnline.addEventListener('click', () => {
      import('./auth.js').then(({ isAuthenticated }) => {
        window._pendingGameType = 'five-board';
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

  // Five-Board ranked mode card → ranked setup (requires auth)
  const fbModeRanked = document.getElementById('fb-mode-ranked');
  if (fbModeRanked) {
    fbModeRanked.addEventListener('click', () => {
      window._pendingRankedGameType = 'five-board';
      import('./auth.js').then(({ isAuthenticated }) => {
        const authReq = document.getElementById('ranked-auth-required');
        const panels = document.getElementById('ranked-panels');
        if (isAuthenticated()) {
          if (authReq) authReq.classList.add('hidden');
          if (panels) panels.style.display = '';
        } else {
          if (authReq) authReq.classList.remove('hidden');
          if (panels) panels.style.display = 'none';
        }
        showRankedSetup();
      });
    });
  }

  // Five-Board game view back → five-board mode select
  const fbBackToMenu = document.getElementById('fb-back-to-menu');
  if (fbBackToMenu) {
    fbBackToMenu.addEventListener('click', () => {
      if (typeof window.hideFiveBoardRenderer === 'function') window.hideFiveBoardRenderer();
      showFiveBoardModeSelect();
    });
  }

  // Federation link on landing page
  const openFederation = document.getElementById('open-federation');
  if (openFederation) {
    openFederation.addEventListener('click', () => showFederation());
  }

  // Federation back button
  const federationBack = document.getElementById('federation-back');
  if (federationBack) {
    federationBack.addEventListener('click', () => showLandingPage());
  }

  // Federation tab switching
  const fedTabs = document.querySelectorAll('.fed-tab');
  const fedPanels = document.querySelectorAll('.fed-panel');
  fedTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      fedTabs.forEach(t => t.classList.remove('active'));
      fedPanels.forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      const panel = document.getElementById('fed-' + tab.dataset.fedTab);
      if (panel) panel.classList.remove('hidden');
    });
  });

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
