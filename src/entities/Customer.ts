import Phaser from 'phaser';
import { ENTRANCE } from '../data/map';
import { CUSTOMER_LOOKS } from '../art/textures';
import { buildWishlist } from '../logic/customers';
import { Walker } from './Walker';

export type CustomerStage = 'shopping' | 'queueing' | 'leaving';

export class Customer {
  readonly walker: Walker;
  readonly wishlist = buildWishlist();
  readonly items: string[] = [];
  stage: CustomerStage = 'shopping';

  constructor(scene: Phaser.Scene) {
    const look = Math.floor(Math.random() * CUSTOMER_LOOKS);
    this.walker = new Walker(scene, `char_c${look}`, ENTRANCE, 34 + Math.random() * 10);
  }
}
