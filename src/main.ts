import Phaser from 'phaser';
import { audioStatus, unlockAudio } from './audio';
import { startMusic, musicStatus } from './music';
import { BootScene } from './scenes/BootScene';
import { CalendarScene } from './scenes/CalendarScene';
import { CelebrationScene } from './scenes/CelebrationScene';
import { GameOverScene } from './scenes/GameOverScene';
import { InventoryScene } from './scenes/InventoryScene';
import { OrderScene } from './scenes/OrderScene';
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
  width: L.W,
  height: L.H,
  backgroundColor: '#1b3346',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE },
  scene: [BootScene, ShackScene, OrderScene, StockScene, InventoryScene, RegisterScene, SummaryScene, CalendarScene, CelebrationScene, GameOverScene, PauseScene],
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
    game.scale.setZoom(next.zoom);
    return;
  }
  rebuildPending = true;
  const parent = document.getElementById('game')!;
  game.scale.setZoom(Math.min(parent.clientWidth / L.W, parent.clientHeight / L.H));
  if (session.phase === 'morning' && !session.modal) window.location.reload();
}

session.events.on('begin-day', () => {
  if (rebuildPending) window.location.reload();
});

unlockAudio();
window.addEventListener('pointerdown', () => startMusic(), { once: true });
game.events.once(Phaser.Core.Events.READY, () => game.scale.setZoom(L.zoom));
let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(onResize, 250);
});

if (import.meta.env.DEV) {
  Object.assign(window, { __game: game, __session: session, __audio: audioStatus, __music: musicStatus, __layout: L });
}
