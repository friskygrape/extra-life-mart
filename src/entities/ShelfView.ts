import Phaser from 'phaser';
import { SHELF_CAPACITY } from '../data/products';
import type { ShelfSpot } from '../data/map';
import type { ShelfState } from '../logic/state';
import { tileCentre } from './Walker';

const SLOTS = [
  { x: -4, y: -5 },
  { x: 4, y: -5 },
  { x: 0, y: 2 },
];

/** A shelf tile with up to three product icons, showing roughly how full it is. */
export class ShelfView {
  private readonly icons: Phaser.GameObjects.Image[];

  constructor(scene: Phaser.Scene, spot: ShelfSpot) {
    const pos = tileCentre(spot);
    scene.add.image(pos.x, pos.y, spot.kind === 'food' ? 'shelf_food' : 'shelf_game').setDepth(pos.y + 8);
    this.icons = SLOTS.map((s) =>
      scene.add.image(pos.x + s.x, pos.y + s.y, 'item_chips').setDepth(pos.y + 8.5).setVisible(false),
    );
  }

  refresh(shelf: ShelfState) {
    const capacity = SHELF_CAPACITY[shelf.kind];
    const shown = shelf.qty === 0 ? 0 : Math.ceil((shelf.qty / capacity) * SLOTS.length);
    this.icons.forEach((icon, i) => {
      const visible = i < shown && shelf.productId !== null;
      icon.setVisible(visible);
      if (visible) icon.setTexture(`item_${shelf.productId}`);
    });
  }
}
