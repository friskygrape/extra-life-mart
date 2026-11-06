import Phaser from 'phaser';
import { createPixelFont } from '../art/font';
import { CUSTOMER_LOOKS, createTextures } from '../art/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const scene of ['beach', 'beach_dusk', 'beach_night']) this.load.image(scene, `${scene}.png`);
    for (const art of ['register', 'sign', 'sign_star_on', 'sign_star_off', 'choco_group', 'item_soda', 'item_chips', 'item_choco', 'item_noodle']) {
      this.load.image(art, `shop/${art}.png`);
    }
    for (let i = 0; i < CUSTOMER_LOOKS; i++) this.load.image(`cust_${i}`, `customers/c${i}.png`);
  }

  create() {
    createPixelFont(this);
    createTextures(this);
    this.scene.start('Shack');
  }
}
