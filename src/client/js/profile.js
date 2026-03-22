/**
 * Profile module – handles game ID, avatar upload, and profile setup
 */
import supabase from './supabase-client.js';
import { getCurrentUser, getAuthToken } from './auth.js';

let cachedProfile = null; // { game_id, avatar_url, email }
let pendingAvatarFile = null;

// --- Public API ---

export async function fetchMyProfile() {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    cachedProfile = await res.json();
    return cachedProfile;
  } catch (err) {
    console.error('Error fetching profile:', err);
    return null;
  }
}

export function getDisplayName() {
  if (cachedProfile?.game_id) return cachedProfile.game_id;
  const user = getCurrentUser();
  return user?.email || 'Anonymous';
}

export function getAvatarUrl() {
  return cachedProfile?.avatar_url || null;
}

export function getCachedProfile() {
  return cachedProfile;
}

export async function showEditProfile() {
  // Pre-fill fields with current data
  const gameIdInput = document.getElementById('game-id-input');
  const previewImg = document.getElementById('avatar-preview-img');
  const placeholder = document.getElementById('avatar-placeholder');

  if (cachedProfile?.game_id && gameIdInput) {
    gameIdInput.value = cachedProfile.game_id;
  }
  if (cachedProfile?.avatar_url && previewImg) {
    previewImg.src = cachedProfile.avatar_url;
    previewImg.classList.remove('hidden');
    if (placeholder) placeholder.classList.add('hidden');
  }

  const { showProfileSetup } = await import('./navigation.js');
  showProfileSetup();
}

/**
 * Initialize profile setup event handlers
 */
export function initProfileSetup() {
  // Avatar file input
  const fileInput = document.getElementById('avatar-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleAvatarSelect);
  }

  // Game ID input – debounced availability check
  const gameIdInput = document.getElementById('game-id-input');
  if (gameIdInput) {
    let debounceTimer;
    gameIdInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => checkGameIdAvailability(gameIdInput.value), 400);
    });
  }

  // Save button
  const saveBtn = document.getElementById('profile-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleProfileSave);
  }

  // Skip button
  const skipBtn = document.getElementById('profile-skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', async () => {
      const { showLandingPage } = await import('./navigation.js');
      showLandingPage();
    });
  }
}

/**
 * Update all avatar and display name elements across views
 */
export function updateProfileUI() {
  const displayName = getDisplayName();
  const avatarUrl = getAvatarUrl();

  // Landing page
  const landingDisplay = document.getElementById('landing-user-display');
  if (landingDisplay) landingDisplay.textContent = displayName;

  const landingAvatar = document.getElementById('landing-avatar');
  if (landingAvatar) {
    if (avatarUrl) {
      landingAvatar.src = avatarUrl;
      landingAvatar.classList.remove('hidden');
    } else {
      landingAvatar.classList.add('hidden');
    }
  }

  // Game view sidebar
  const userEmail = document.getElementById('user-email');
  if (userEmail) userEmail.textContent = displayName;

  // Multiplayer self
  const mpMyName = document.getElementById('mp-my-name');
  if (mpMyName) mpMyName.textContent = displayName;

  const mpMyAvatar = document.getElementById('mp-my-avatar');
  if (mpMyAvatar) {
    if (avatarUrl) {
      mpMyAvatar.src = avatarUrl;
      mpMyAvatar.classList.remove('hidden');
    } else {
      mpMyAvatar.classList.add('hidden');
    }
  }
}

// --- Internal handlers ---

function handleAvatarSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const errorEl = document.getElementById('avatar-upload-error');

  if (file.size > 2 * 1024 * 1024) {
    if (errorEl) {
      errorEl.textContent = 'Image must be under 2MB';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (!file.type.startsWith('image/')) {
    if (errorEl) {
      errorEl.textContent = 'Please select an image file';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (errorEl) errorEl.classList.add('hidden');

  // Show preview
  const reader = new FileReader();
  reader.onload = (ev) => {
    const previewImg = document.getElementById('avatar-preview-img');
    const placeholder = document.getElementById('avatar-placeholder');
    if (previewImg) {
      previewImg.src = ev.target.result;
      previewImg.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
  };
  reader.readAsDataURL(file);

  pendingAvatarFile = file;
}

async function checkGameIdAvailability(value) {
  const statusEl = document.getElementById('game-id-status');
  if (!statusEl) return;

  if (!value || value.length < 3) {
    statusEl.classList.add('hidden');
    return;
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
    statusEl.textContent = 'Only letters, numbers, and underscores allowed';
    statusEl.className = 'invalid';
    return;
  }

  // If it's the user's current game_id, no need to check
  if (cachedProfile?.game_id === value) {
    statusEl.classList.add('hidden');
    return;
  }

  try {
    const token = await getAuthToken();
    const res = await fetch(`/api/profile/check-game-id/${encodeURIComponent(value)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.available) {
      statusEl.textContent = 'Available!';
      statusEl.className = 'available';
    } else {
      statusEl.textContent = 'Already taken';
      statusEl.className = 'taken';
    }
  } catch (err) {
    console.error('Error checking game ID:', err);
  }
}

async function handleProfileSave() {
  const saveBtn = document.getElementById('profile-save-btn');
  const errorEl = document.getElementById('profile-save-error');
  const gameIdInput = document.getElementById('game-id-input');
  const gameId = gameIdInput?.value?.trim();

  if (errorEl) errorEl.classList.add('hidden');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const token = await getAuthToken();
    const updates = {};

    // Upload avatar if pending
    if (pendingAvatarFile) {
      const user = getCurrentUser();
      const ext = pendingAvatarFile.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, pendingAvatarFile, { upsert: true });

      if (uploadError) throw new Error('Failed to upload avatar: ' + uploadError.message);

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Add cache buster to avoid stale images
      updates.avatar_url = urlData.publicUrl + '?t=' + Date.now();
      pendingAvatarFile = null;
    }

    // Set game_id if provided
    if (gameId) {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(gameId)) {
        throw new Error('Game ID must be 3-20 characters (letters, numbers, underscores)');
      }
      updates.game_id = gameId;
    }

    if (Object.keys(updates).length > 0) {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save profile');
      }

      const result = await res.json();
      cachedProfile = { ...cachedProfile, ...result };
    }

    // Update UI across all views
    updateProfileUI();

    // Navigate to landing page
    const { showLandingPage } = await import('./navigation.js');
    showLandingPage();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Profile';
  }
}
