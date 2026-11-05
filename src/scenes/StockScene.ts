import Phaser from 'phaser';
import { PRODUCTS, SHELF_CAPACITY, getProduct } from '../data/products';
import { emptyShelf, stockShelf } from '../logic/inventory';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, button, label } from '../ui';

interface StockData {
  shelfId: string;
}

export class StockScene extends Phaser.Scene {
  private shelfId = '';
  private content: { destroy(): void }[] = [];

  constructor() {
    super('Stock');
  }

  create(data: StockData) {
    this.shelfId = data.shelfId;
    this.content = [];
    backdrop(this);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.render();
  }

  private track<T extends { destroy(): void }>(obj: T): T {
    this.content.push(obj);
    return obj;
  }

  private render() {
    this.content.forEach((o) => o.destroy());
    this.content = [];
    const shelf = session.state.shelves.find((s) => s.id === this.shelfId)!;
    const capacity = SHELF_CAPACITY[shelf.kind];

    this.track(label(this, 6, 8, shelf.kind === 'food' ? 'FOOD SHELF' : 'GAME RACK', COLOURS.gold));
    this.track(button(this, WIDTH - 50, 3, 46, 20, 'CLOSE', () => this.close()));

    const current = shelf.productId ? getProduct(shelf.productId).name : 'EMPTY';
    this.track(label(this, 6, 30, current, shelf.productId ? COLOURS.white : COLOURS.dim));
    this.track(label(this, 6, 40, `HOLDS ${shelf.qty}/${capacity}`, COLOURS.dim));
    if (shelf.productId) {
      this.track(button(this, WIDTH - 62, 28, 58, 22, 'REMOVE', () => {
        emptyShelf(session.state, this.shelfId);
        this.changed();
      }));
    }

    this.track(this.add.rectangle(6, 54, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    this.track(label(this, 6, 60, 'FROM THE BACK ROOM', COLOURS.dim));

    const room = capacity - shelf.qty;
    PRODUCTS.filter((p) => p.kind === shelf.kind).forEach((product, i) => {
      const y = 72 + i * 38;
      const have = session.state.stockroom[product.id] ?? 0;
      const usable = have > 0 && room > 0 && (!shelf.productId || shelf.productId === product.id);
      const alpha = have > 0 ? 1 : 0.4;
      this.track(this.add.image(14, y + 16, `item_${product.id}`).setAlpha(alpha));
      this.track(label(this, 27, y + 6, product.name).setAlpha(alpha));
      this.track(label(this, 27, y + 17, `HAVE ${have}`, COLOURS.dim).setAlpha(alpha));
      const one = this.track(button(this, WIDTH - 70, y + 2, 32, 32, '+1', () => this.add1(product.id, 1)));
      const all = this.track(button(this, WIDTH - 36, y + 2, 32, 32, 'ALL', () => this.add1(product.id, capacity)));
      one.setEnabled(usable);
      all.setEnabled(usable);
    });

    this.track(button(this, 6, 310, WIDTH - 12, 34, 'BUY MORE STOCK', () => {
      this.scene.stop();
      this.scene.launch('Order');
    }, COLOURS.accent));
    this.track(label(this, WIDTH / 2, 352, 'ORDERS ARRIVE NEXT MORNING', COLOURS.dim, 'center'));
  }

  private add1(productId: string, qty: number) {
    if (stockShelf(session.state, this.shelfId, productId, qty) === 'ok') this.changed();
  }

  private changed() {
    if (session.phase === 'morning') session.save();
    session.events.emit('shelves-changed');
    this.render();
  }

  private close() {
    session.modal = false;
    this.scene.stop();
  }
}
