/**
 * Bootstrap file - loads all modules and initializes the app
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as GameModule from './game.js';
import * as AIModule from './ai.js';
import * as PuzzlesModule from './puzzles.js';
import { initAuth, getCurrentUser, getAuthToken } from './auth.js';
import { initNavigation } from './navigation.js';

// Make THREE and OrbitControls available globally for render.js
window.THREE = THREE;
window.OrbitControls = OrbitControls;

// Make game modules available globally (for compatibility with existing code)
window.Raumschach = GameModule;
window.ChessAI = AIModule;
window.Puzzles = PuzzlesModule;

// Initialize authentication
initAuth();

// Initialize navigation
initNavigation();

// Load render.js and main.js dynamically
Promise.all([
  /* @vite-ignore */ import('./render.js'),
  /* @vite-ignore */ import('./flat-render.js')
]).then(() => {
  // Now load main.js and analyzer.js which depend on the render files
  Promise.all([
    /* @vite-ignore */ import('./main.js'),
    /* @vite-ignore */ import('./analyzer.js')
  ]).then(([mainModule, analyzerModule]) => {
    console.log('✅ All modules loaded successfully!');

    // Make loadUserProgress available globally for auth.js
    if (mainModule && mainModule.loadUserProgress) {
      window.loadUserProgress = mainModule.loadUserProgress;
    }
  });
}).catch(error => {
  console.error('❌ Error loading modules:', error);
});

// Export for other modules
export { getCurrentUser, getAuthToken };
