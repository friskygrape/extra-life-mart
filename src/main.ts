import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';
import { OrderScene } from './scenes/OrderScene';
import { RegisterScene } from './scenes/RegisterScene';
import { ShopScene } from './scenes/ShopScene';
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
  scene: [BootScene, ShopScene, HudScene, OrderScene, StockScene, RegisterScene, SummaryScene],
});

/** Scale to fill the screen, snapped to whole device pixels so every art pixel is the same size. */
function fitToScreen() {
  const parent = document.getElementById('game')!;
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(parent.clientWidth / WIDTH, parent.clientHeight / HEIGHT);
  game.scale.setZoom(Math.max(1, Math.floor(fit * dpr)) / dpr);
}

game.events.once(Phaser.Core.Events.READY, fitToScreen);
window.addEventListener('resize', fitToScreen);

if (import.meta.env.DEV) {
  Object.assign(window, { __game: game, __session: session });
}
