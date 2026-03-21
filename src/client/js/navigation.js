/**
 * Navigation between landing page and game views
 */

/**
 * Show the landing page
 */
export function showLandingPage() {
  const landingPage = document.getElementById('landing-page');
  const gameView = document.getElementById('game-view');
  const analyzerView = document.getElementById('analyzer-view');

  if (landingPage) landingPage.classList.remove('hidden');
  if (gameView) gameView.classList.add('hidden');
  if (analyzerView) analyzerView.classList.add('hidden');
}

/**
 * Show the 3D chess game
 */
export function show3DChessGame() {
  const landingPage = document.getElementById('landing-page');
  const gameView = document.getElementById('game-view');
  const analyzerView = document.getElementById('analyzer-view');

  if (landingPage) landingPage.classList.add('hidden');
  if (analyzerView) analyzerView.classList.add('hidden');
  if (gameView) gameView.classList.remove('hidden');
}

/**
 * Show the game analyzer
 */
export function showAnalyzer() {
  const landingPage = document.getElementById('landing-page');
  const gameView = document.getElementById('game-view');
  const analyzerView = document.getElementById('analyzer-view');

  if (landingPage) landingPage.classList.add('hidden');
  if (gameView) gameView.classList.add('hidden');
  if (analyzerView) analyzerView.classList.remove('hidden');
}

/**
 * Sync user authentication UI between landing and game views
 */
export function syncAuthUI(isLoggedIn, userEmail) {
  // Landing page user section
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
  // Play 3D Chess button
  const play3DChess = document.getElementById('play-3d-chess');
  if (play3DChess) {
    play3DChess.addEventListener('click', () => {
      show3DChessGame();
    });
  }

  // Back to menu button
  const backToMenu = document.getElementById('back-to-menu');
  if (backToMenu) {
    backToMenu.addEventListener('click', () => {
      showLandingPage();
    });
  }

  // Landing page auth buttons
  const landingLoginBtn = document.getElementById('landing-login-btn');
  const landingLogoutBtn = document.getElementById('landing-logout-btn');

  if (landingLoginBtn) {
    landingLoginBtn.addEventListener('click', () => {
      // Import auth functions dynamically to avoid circular dependencies
      import('./auth.js').then(({ openAuthModal }) => {
        if (typeof openAuthModal === 'function') {
          openAuthModal('login');
        } else {
          // Fallback: trigger the main login button
          const mainLoginBtn = document.getElementById('login-btn');
          if (mainLoginBtn) mainLoginBtn.click();
        }
      });
    });
  }

  if (landingLogoutBtn) {
    landingLogoutBtn.addEventListener('click', () => {
      // Trigger the main logout button
      const mainLogoutBtn = document.getElementById('logout-btn');
      if (mainLogoutBtn) mainLogoutBtn.click();
    });
  }

  // Analyzer card
  const openAnalyzer = document.getElementById('open-analyzer');
  if (openAnalyzer) {
    openAnalyzer.addEventListener('click', () => {
      showAnalyzer();
    });
  }

  // Analyzer back button
  const analyzerBack = document.getElementById('analyzer-back');
  if (analyzerBack) {
    analyzerBack.addEventListener('click', () => {
      showLandingPage();
    });
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
