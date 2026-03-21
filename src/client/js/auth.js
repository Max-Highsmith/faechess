import supabase from './supabase-client.js';

let currentUser = null;

/**
 * Initialize authentication system
 */
export async function initAuth() {
  // Check for existing session
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    currentUser = session.user;
    await onAuthStateChange(true);
  } else {
    await onAuthStateChange(false);
  }

  // Listen to auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event);
    currentUser = session?.user || null;
    await onAuthStateChange(!!session);

    // Handle different events
    if (event === 'SIGNED_IN') {
      console.log('User signed in');
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
    }
  });

  // Set up UI event handlers
  setupAuthHandlers();
}

/**
 * Set up event handlers for auth UI
 */
function setupAuthHandlers() {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const subscribeBtn = document.getElementById('subscribe-btn');
  const authForm = document.getElementById('auth-form');
  const authTabs = document.querySelectorAll('.tab');
  const closeAuthBtn = document.getElementById('close-auth');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => openAuthModal('login'));
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', handleSubscribe);
  }

  if (authForm) {
    authForm.addEventListener('submit', handleAuthSubmit);
  }

  if (closeAuthBtn) {
    closeAuthBtn.addEventListener('click', closeAuthModal);
  }

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
  });
}

/**
 * Open authentication modal
 */
export function openAuthModal(mode = 'login') {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    switchAuthTab(mode);
    hideError();
  }
}

/**
 * Close authentication modal
 */
function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.add('hidden');
    hideError();
  }
}

/**
 * Switch between login and signup tabs
 */
function switchAuthTab(mode) {
  const tabs = document.querySelectorAll('.tab');
  const submitBtn = document.getElementById('auth-submit');
  const title = document.getElementById('auth-title');

  tabs.forEach(tab => {
    if (tab.dataset.tab === mode) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  if (mode === 'login') {
    if (submitBtn) submitBtn.textContent = 'Login';
    if (title) title.textContent = 'Welcome Back to Fae Chess';
  } else {
    if (submitBtn) submitBtn.textContent = 'Sign Up';
    if (title) title.textContent = 'Join Fae Chess';
  }

  hideError();
}

/**
 * Handle auth form submission (login or signup)
 */
async function handleAuthSubmit(e) {
  e.preventDefault();

  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const mode = document.querySelector('.tab.active').dataset.tab;

  try {
    let result;

    if (mode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({ email, password });
    }

    if (result.error) {
      showError(result.error.message);
    } else {
      if (mode === 'signup' && result.data.user && !result.data.session) {
        showSuccess('Success! Check your email to confirm your Fae Chess account.');
        setTimeout(() => {
          closeAuthModal();
        }, 4000);
      } else {
        closeAuthModal();
      }
    }
  } catch (error) {
    showError('An unexpected error occurred');
    console.error('Auth error:', error);
  }
}

/**
 * Handle logout
 */
async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

/**
 * Handle subscription button click
 */
async function handleSubscribe() {
  if (!currentUser) {
    openAuthModal('signup');
    return;
  }

  try {
    const token = await getAuthToken();
    const response = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok) {
      alert('Successfully subscribed to weekly puzzles!');
      await checkSubscriptionStatus();
    } else {
      alert('Failed to subscribe: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Subscription error:', error);
    alert('Failed to subscribe. Please try again.');
  }
}

/**
 * Update UI based on auth state
 */
async function onAuthStateChange(isLoggedIn) {
  const loggedInSection = document.getElementById('logged-in');
  const loggedOutSection = document.getElementById('logged-out');
  const userEmailEl = document.getElementById('user-email');

  // Game view auth UI
  if (loggedInSection) {
    loggedInSection.classList.toggle('hidden', !isLoggedIn);
  }

  if (loggedOutSection) {
    loggedOutSection.classList.toggle('hidden', isLoggedIn);
  }

  if (isLoggedIn && currentUser) {
    if (userEmailEl) {
      userEmailEl.textContent = currentUser.email;
    }

    // Check subscription status
    await checkSubscriptionStatus();

    // Load user's puzzle progress
    if (window.loadUserProgress) {
      window.loadUserProgress();
    }
  }

  // Sync landing page auth UI
  const landingLoggedIn = document.getElementById('landing-logged-in');
  const landingLoggedOut = document.getElementById('landing-logged-out');
  const landingUserEmail = document.getElementById('landing-user-email');

  if (landingLoggedIn) landingLoggedIn.classList.toggle('hidden', !isLoggedIn);
  if (landingLoggedOut) landingLoggedOut.classList.toggle('hidden', isLoggedIn);
  if (landingUserEmail && isLoggedIn && currentUser) {
    landingUserEmail.textContent = currentUser.email;
  }
}

/**
 * Check and update subscription status
 */
async function checkSubscriptionStatus() {
  if (!currentUser) return;

  try {
    const token = await getAuthToken();
    const response = await fetch('/api/subscriptions/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    const statusEl = document.getElementById('subscription-status');
    const subscribeBtn = document.getElementById('subscribe-btn');

    if (data.subscribed) {
      if (statusEl) {
        statusEl.textContent = '✓ Subscribed to weekly puzzles';
        statusEl.classList.remove('hidden');
      }
      if (subscribeBtn) {
        subscribeBtn.classList.add('hidden');
      }
    } else {
      if (statusEl) {
        statusEl.classList.add('hidden');
      }
      if (subscribeBtn) {
        subscribeBtn.classList.remove('hidden');
      }
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
  }
}

/**
 * Show error message in auth modal
 */
function showError(message) {
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  if (successEl) successEl.classList.add('hidden');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

/**
 * Show success message in auth modal
 */
function showSuccess(message) {
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  if (errorEl) errorEl.classList.add('hidden');
  if (successEl) {
    successEl.textContent = message;
    successEl.classList.remove('hidden');
  }
}

/**
 * Hide error and success messages
 */
function hideError() {
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  if (errorEl) errorEl.classList.add('hidden');
  if (successEl) successEl.classList.add('hidden');
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Get authentication token
 */
export async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!currentUser;
}
