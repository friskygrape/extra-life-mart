import Phaser from 'phaser';
import { sfx } from '../audio';
import { SHELF_CAPACITY, getProduct } from '../data/products';
import { emptyShelf, stockShelf } from '../logic/inventory';
import { unlockedProducts } from '../logic/licences';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, button, label } from '../ui';

interface StockData {
  shelfId: string;
}

const PER_PAGE = 6;

export class StockScene extends Phaser.Scene {
  private shelfId = '';
  private page = 0;
  private content: { destroy(): void }[] = [];

  constructor() {
    super('Stock');
  }

  create(data: StockData) {
    this.shelfId = data.shelfId;
    this.page = 0;
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
    const { state } = session;
    const shelf = state.shelves.find((s) => s.id === this.shelfId)!;

    this.track(label(this, 6, 8, 'SHELF', COLOURS.gold));
    this.track(button(this, WIDTH - 50, 3, 46, 20, 'CLOSE', () => this.close()));

    const current = shelf.productId ? getProduct(shelf.productId).name : 'EMPTY';
    this.track(label(this, 6, 30, current, shelf.productId ? COLOURS.white : COLOURS.dim));
    this.track(label(this, 6, 40, `HOLDS ${shelf.qty}/${SHELF_CAPACITY}`, COLOURS.dim));
    if (shelf.productId) {
      this.track(button(this, WIDTH - 62, 28, 58, 22, 'REMOVE', () => {
        emptyShelf(state, this.shelfId);
        this.changed();
      }));
    }

    this.track(this.add.rectangle(6, 54, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    this.track(label(this, 6, 60, 'FROM YOUR STOCK', COLOURS.dim));

    // What you actually have comes first, so there's less to page through.
    const have = (id: string) => state.stockroom[id] ?? 0;
    const products = unlockedProducts(state).sort((a, b) => Number(have(b.id) > 0) - Number(have(a.id) > 0));
    const pages = Math.ceil(products.length / PER_PAGE);
    this.page = Math.min(this.page, pages - 1);
    if (pages > 1) {
      this.track(button(this, 112, 56, 24, 14, '<', () => this.turn(-1))).setEnabled(this.page > 0);
      this.track(label(this, 150, 59, `${this.page + 1}/${pages}`, COLOURS.dim, 'center'));
      this.track(button(this, 164, 56, 24, 14, '>', () => this.turn(1))).setEnabled(this.page < pages - 1);
    }

    const room = SHELF_CAPACITY - shelf.qty;
    products.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((product, i) => {
      const y = 72 + i * 38;
      const count = have(product.id);
      const usable = count > 0 && room > 0 && (!shelf.productId || shelf.productId === product.id);
      const alpha = count > 0 ? 1 : 0.4;
      this.track(this.add.image(14, y + 16, `item_${product.id}`).setAlpha(alpha));
      this.track(label(this, 27, y + 6, product.name).setAlpha(alpha));
      this.track(label(this, 27, y + 17, `HAVE ${count}`, COLOURS.dim).setAlpha(alpha));
      this.track(button(this, WIDTH - 70, y + 2, 32, 32, '+1', () => this.stock(product.id, 1))).setEnabled(usable);
      this.track(button(this, WIDTH - 36, y + 2, 32, 32, 'ALL', () => this.stock(product.id, SHELF_CAPACITY))).setEnabled(usable);
    });

    this.track(button(this, 6, 310, WIDTH - 12, 34, 'ORDER STOCKS', () => {
      this.scene.stop();
      this.scene.launch('Order');
    }, COLOURS.accent));
    if (shelf.qty > 0) this.track(label(this, WIDTH / 2, 352, 'REMOVE TO SWAP SNACKS', COLOURS.dim, 'center'));
  }

  private turn(delta: number) {
    this.page += delta;
    this.render();
  }

  private stock(productId: string, qty: number) {
    if (stockShelf(session.state, this.shelfId, productId, qty) === 'ok') {
      sfx.pop();
      this.changed();
    }
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
