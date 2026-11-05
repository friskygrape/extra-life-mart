import Phaser from 'phaser';
import { createPixelFont } from '../art/font';
import { createTextures } from '../art/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    createPixelFont(this);
    createTextures(this);
    this.scene.start('Shop');
  }
}
