import Phaser from 'phaser';
import { createGameFont, loadGameFont } from '../art/font';
import { CUSTOMER_LOOKS, createTextures } from '../art/textures';
import { L } from '../layout';

const BILL_CENTS = [100, 500, 1000, 2000];
const MONEY_ART = [...BILL_CENTS.flatMap((c) => [`bill_${c}`, `bill_${c}_up`]), ...[5, 10, 25, 50].map((c) => `coin_${c}`)];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const scene of ['beach', 'beach_dusk', 'beach_night']) this.load.image(scene, `${scene}.png`);
    for (const art of ['register', 'register_paper', 'sign', 'sign_star_on', 'sign_star_off', 'choco_group', 'item_soda', 'item_chips', 'item_choco', 'item_noodle']) {
      this.load.image(art, `shop/${art}.png`);
    }
    for (const art of MONEY_ART) this.load.image(art, `money/${art}.png`);
    for (let i = 0; i < CUSTOMER_LOOKS; i++) this.load.image(`cust_${i}`, `customers/c${i}.png`);
  }

  create() {
    void loadGameFont().then(() => {
      createGameFont(this);
      // Money shows at a third of its size, which only stays blocky when that's a whole number of screen pixels.
      if (L.renderScale % 3 !== 0) for (const art of MONEY_ART) this.textures.get(art).setFilter(Phaser.Textures.FilterMode.LINEAR);
      createTextures(this);
      this.scene.start('Shack');
    });
  }
}
