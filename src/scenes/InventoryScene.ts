import Phaser from 'phaser';
import { ITEM_SCALE } from '../art/textures';
import { unlockedProducts } from '../logic/licences';
import { session } from '../session';
import { COLOURS, HEIGHT, ScrollList, WIDTH, backdrop, closeButton, label, secondaryButton } from '../ui';

const LIST_Y = 40;
const ROW_H = 30;
const FOOTER_Y = HEIGHT - 44;

/** Everything you're licensed to sell, and how much of it you have. */
export class InventoryScene extends Phaser.Scene {
  constructor() {
    super('Inventory');
  }

  create() {
    backdrop(this);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    label(this, 6, 8, 'YOUR STOCK', COLOURS.gold);
    closeButton(this, () => this.close());
    label(this, 6, 28, 'SNACK', COLOURS.dim);
    label(this, WIDTH - 12, 28, 'IN STOCK', COLOURS.dim, 'right');

    const { state } = session;
    const have = (id: string) => state.stockroom[id] ?? 0;
    const products = unlockedProducts(state).sort((a, b) => have(b.id) - have(a.id));
    const list = new ScrollList(this, LIST_Y, FOOTER_Y - LIST_Y - 6, products.length * ROW_H);
    products.forEach((product, i) => {
      const y = i * ROW_H;
      const count = have(product.id);
      const onShelves = state.shelves.filter((s) => s.productId === product.id).reduce((sum, s) => sum + s.qty, 0);
      list.add(this.add.rectangle(4, y, WIDTH - 8, ROW_H - 2, COLOURS.panel).setOrigin(0));
      list.add(this.add.image(16, y + 14, `item_${product.id}`).setScale(ITEM_SCALE));
      list.add(label(this, 28, y + 4, product.name, count > 0 ? COLOURS.white : COLOURS.dim));
      list.add(label(this, 28, y + 15, `ON SHELVES ${onShelves}`, COLOURS.dim));
      list.add(label(this, WIDTH - 12, y + 10, String(count), count > 0 ? COLOURS.gold : COLOURS.dim, 'right'));
    });

    secondaryButton(this, FOOTER_Y, 'ORDER MORE STOCK', () => {
      this.scene.stop();
      this.scene.launch('Order');
    });
  }

  private close() {
    session.modal = false;
    this.scene.stop();
  }
}
