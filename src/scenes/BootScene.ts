import Phaser from 'phaser';
import { BILL_CENTS, billSource, createBills } from '../art/bills';
import { createGameFont, loadGameFont } from '../art/font';
import { COMPUTER_LAYERS, computerSource, createComputer } from '../art/computer';
import { COFFEE_ART, DECANTER_STATES, decanterKey } from '../art/coffeeArt';
import { CUSTOMER_LOOKS, createTextures } from '../art/textures';

const MONEY_ART = [5, 10, 25, 50].map((c) => `coin_${c}`);

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const scene of ['beach', 'beach_dusk', 'beach_night']) this.load.image(scene, `${scene}.png`);
    for (const art of ['register', 'register_paper', 'sign', 'sign_star_on', 'sign_star_off', 'choco_group', 'item_soda', 'item_chips', 'item_choco', 'item_noodle', ...COMPUTER_LAYERS.map(computerSource), COFFEE_ART.machine.key, ...DECANTER_STATES.map(decanterKey)]) {
      this.load.image(art, `shop/${art}.png`);
    }
    for (const art of MONEY_ART) this.load.image(art, `money/${art}.png`);
    for (const cents of BILL_CENTS) this.load.image(billSource(cents), `money/bill_${cents}.png`);
    for (let i = 0; i < CUSTOMER_LOOKS; i++) this.load.image(`cust_${i}`, `customers/c${i}.png`);
  }

  create() {
    void loadGameFont().then(() => {
      createGameFont(this);
      // Coins are shown shrunk to fit, at sizes that don't land on whole screen pixels, so they're smoothed rather than left blocky.
      for (const art of MONEY_ART) this.textures.get(art).setFilter(Phaser.Textures.FilterMode.LINEAR);
      createTextures(this);
      createBills(this);
      createComputer(this);
      this.scene.start('Shack');
    });
  }
}
