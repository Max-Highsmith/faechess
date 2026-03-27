/**
 * Chess Clock Module
 * Self-contained clock for PvP, PvAI, and Online modes.
 */

let whiteTimeMs = 0;
let blackTimeMs = 0;
let activeColor = null;
let intervalId = null;
let onTimeout = null;
let lastTick = 0;
let enabled = false;

let whiteClockEl = null;
let blackClockEl = null;
let whiteContainerEl = null;
let blackContainerEl = null;
let clockRootEl = null;

export function init() {
  clockRootEl = document.getElementById('chess-clock');
  whiteClockEl = document.getElementById('clock-white-time');
  blackClockEl = document.getElementById('clock-black-time');
  whiteContainerEl = document.getElementById('clock-white');
  blackContainerEl = document.getElementById('clock-black');
}

export function setTimeControl(minutes) {
  const ms = minutes * 60 * 1000;
  whiteTimeMs = ms;
  blackTimeMs = ms;
  enabled = minutes > 0;
  activeColor = null;
  if (clockRootEl) {
    clockRootEl.style.display = enabled ? '' : 'none';
  }
  updateDisplay();
}

export function start(color) {
  if (!enabled) return;
  activeColor = color;
  lastTick = Date.now();
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(tick, 100);
  updateDisplay();
}

export function switchTurn(newColor) {
  if (!enabled) return;
  activeColor = newColor;
  lastTick = Date.now();
  if (!intervalId) {
    intervalId = setInterval(tick, 100);
  }
  updateDisplay();
}

export function pause() {
  activeColor = null;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  updateDisplay();
}

export function getTimeRemaining(color) {
  return color === 'w' ? whiteTimeMs : blackTimeMs;
}

export function setTimeRemaining(color, ms) {
  if (color === 'w') whiteTimeMs = ms;
  else blackTimeMs = ms;
  updateDisplay();
}

export function setOnTimeout(cb) {
  onTimeout = cb;
}

export function isEnabled() {
  return enabled;
}

export function reset() {
  pause();
  enabled = false;
  whiteTimeMs = 0;
  blackTimeMs = 0;
  if (clockRootEl) clockRootEl.style.display = 'none';
  updateDisplay();
}

export function destroy() {
  pause();
  enabled = false;
  activeColor = null;
  whiteTimeMs = 0;
  blackTimeMs = 0;
  if (clockRootEl) clockRootEl.style.display = 'none';
}

function tick() {
  if (!activeColor) return;
  const now = Date.now();
  const elapsed = now - lastTick;
  lastTick = now;

  if (activeColor === 'w') {
    whiteTimeMs = Math.max(0, whiteTimeMs - elapsed);
    if (whiteTimeMs <= 0) {
      whiteTimeMs = 0;
      pause();
      updateDisplay();
      if (onTimeout) onTimeout('w');
      return;
    }
  } else {
    blackTimeMs = Math.max(0, blackTimeMs - elapsed);
    if (blackTimeMs <= 0) {
      blackTimeMs = 0;
      pause();
      updateDisplay();
      if (onTimeout) onTimeout('b');
      return;
    }
  }
  updateDisplay();
}

function updateDisplay() {
  if (!whiteClockEl || !blackClockEl) return;
  whiteClockEl.textContent = formatTime(whiteTimeMs);
  blackClockEl.textContent = formatTime(blackTimeMs);

  // Active highlighting
  whiteContainerEl.classList.toggle('active', activeColor === 'w');
  blackContainerEl.classList.toggle('active', activeColor === 'b');

  // Low time warning (< 30s)
  whiteContainerEl.classList.toggle('low-time', enabled && whiteTimeMs > 0 && whiteTimeMs < 30000);
  blackContainerEl.classList.toggle('low-time', enabled && blackTimeMs > 0 && blackTimeMs < 30000);

  // Timeout
  whiteContainerEl.classList.toggle('timeout', enabled && whiteTimeMs <= 0);
  blackContainerEl.classList.toggle('timeout', enabled && blackTimeMs <= 0);
}

function formatTime(ms) {
  if (!ms && ms !== 0) return '--:--';
  const totalSeconds = Math.ceil(ms / 1000);
  if (ms < 10000) {
    // Show tenths when < 10 seconds
    const secs = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `0:${String(secs).padStart(2, '0')}.${tenths}`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
