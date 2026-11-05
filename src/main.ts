import Phaser from 'phaser';
import { audioStatus, unlockAudio } from './audio';
import { BootScene } from './scenes/BootScene';
import { OrderScene } from './scenes/OrderScene';
import { RegisterScene } from './scenes/RegisterScene';
import { ShackScene } from './scenes/ShackScene';
import { StockScene } from './scenes/StockScene';
import { SummaryScene } from './scenes/SummaryScene';
import { session } from './session';
import { HEIGHT, WIDTH } from './ui';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#1a1626',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE },
  scene: [BootScene, ShackScene, OrderScene, StockScene, RegisterScene, SummaryScene],
});

/** Scale to fill the screen, snapped to half device pixels to keep the art pixels crisp and even. */
function fitToScreen() {
  const parent = document.getElementById('game')!;
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(parent.clientWidth / WIDTH, parent.clientHeight / HEIGHT);
  game.scale.setZoom(Math.max(1, Math.floor(fit * dpr * 2) / 2) / dpr);
}

unlockAudio();
game.events.once(Phaser.Core.Events.READY, fitToScreen);
window.addEventListener('resize', fitToScreen);

if (import.meta.env.DEV) {
  Object.assign(window, { __game: game, __session: session, __audio: audioStatus });
}
