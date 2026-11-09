import Phaser from 'phaser';
import { audioStatus, unlockAudio } from './audio';
import { startMusic, musicStatus } from './music';
import { BootScene } from './scenes/BootScene';
import { CalendarScene } from './scenes/CalendarScene';
import { CelebrationScene } from './scenes/CelebrationScene';
import { BlenderScene, CoffeeScene } from './scenes/DrinkScenes';
import { ComputerScene } from './scenes/ComputerScene';
import { GameOverScene } from './scenes/GameOverScene';
import { PauseScene } from './scenes/PauseScene';
import { RegisterScene } from './scenes/RegisterScene';
import { ShackScene } from './scenes/ShackScene';
import { StockScene } from './scenes/StockScene';
import { SummaryScene } from './scenes/SummaryScene';
import { session } from './session';
import { computeLayout, setLayout, L, type Layout } from './layout';

function readSafeArea() {
  const style = getComputedStyle(document.documentElement);
  return {
    safeTop: parseFloat(style.getPropertyValue('--safe-top')) || 0,
    safeBottom: parseFloat(style.getPropertyValue('--safe-bottom')) || 0,
  };
}

function measure(): Layout {
  const parent = document.getElementById('game')!;
  return computeLayout({ width: parent.clientWidth, height: parent.clientHeight, dpr: window.devicePixelRatio || 1, ...readSafeArea() });
}

setLayout(measure());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: L.W * L.renderScale,
  height: L.H * L.renderScale,
  backgroundColor: '#1b3346',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE },
  scene: [BootScene, ShackScene, ComputerScene, StockScene, RegisterScene, SummaryScene, CalendarScene, CelebrationScene, GameOverScene, PauseScene, CoffeeScene, BlenderScene],
});

let rebuildPending = false;

/**
 * Same shape as before: just rezoom. A different shape needs a new layout, which waits for
 * the morning so a sale is never interrupted. Until then the current game scales to fit.
 */
function onResize() {
  const next = measure();
  if (next.W === L.W && next.H === L.H) {
    rebuildPending = false;
    game.scale.setZoom(next.zoom / L.renderScale);
    return;
  }
  rebuildPending = true;
  const parent = document.getElementById('game')!;
  game.scale.setZoom(Math.min(parent.clientWidth / L.W, parent.clientHeight / L.H) / L.renderScale);
  if (session.phase === 'morning' && !session.modal) window.location.reload();
}

session.events.on('begin-day', () => {
  if (rebuildPending) window.location.reload();
});

unlockAudio();
window.addEventListener('pointerdown', () => startMusic(), { once: true });
game.events.once(Phaser.Core.Events.READY, () => {
  game.scale.setZoom(L.zoom / L.renderScale);
  // Every scene is laid out in game pixels, and its camera enlarges them onto the canvas.
  for (const scene of game.scene.scenes) {
    scene.sys.events.on(Phaser.Scenes.Events.CREATE, () => scene.cameras.main.setOrigin(0).setZoom(L.renderScale));
  }
});
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(onResize, 250);
});

if (import.meta.env.DEV) {
  Object.assign(window, { __game: game, __session: session, __audio: audioStatus, __music: musicStatus, __layout: L });
}
