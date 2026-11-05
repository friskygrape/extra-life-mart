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
const LIST_Y = 72;
const ROW_H = 32;

export class StockScene extends Phaser.Scene {
  private shelfId = '';
  private page = 0;
  private selected: string | null = null;
  private qty = 0;
  private content: { destroy(): void }[] = [];

  constructor() {
    super('Stock');
  }

  create(data: StockData) {
    this.shelfId = data.shelfId;
    this.page = 0;
    this.selected = null;
    this.qty = 0;
    this.content = [];
    backdrop(this);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.render();
  }

  private track<T extends { destroy(): void }>(obj: T): T {
    this.content.push(obj);
    return obj;
  }

  private shelf() {
    return session.state.shelves.find((s) => s.id === this.shelfId)!;
  }

  private have(id: string): number {
    return session.state.stockroom[id] ?? 0;
  }

  /** The most of a snack that can go on this shelf right now. */
  private maxFor(id: string): number {
    const shelf = this.shelf();
    if (shelf.productId && shelf.productId !== id) return 0;
    return Math.min(this.have(id), SHELF_CAPACITY - shelf.qty);
  }

  private select(id: string) {
    this.selected = id;
    this.qty = this.maxFor(id);
    sfx.click();
    this.render();
  }

  private render() {
    this.content.forEach((o) => o.destroy());
    this.content = [];
    const shelf = this.shelf();

    // A shelf already holding something can only take more of the same, so start there.
    if (!this.selected && shelf.productId && this.maxFor(shelf.productId) > 0) {
      this.selected = shelf.productId;
      this.qty = this.maxFor(shelf.productId);
    }

    this.track(label(this, 6, 8, 'SHELF', COLOURS.gold));
    this.track(button(this, WIDTH - 50, 3, 46, 20, 'CLOSE', () => this.close()));

    const current = shelf.productId ? getProduct(shelf.productId).name : 'EMPTY';
    this.track(label(this, 6, 30, current, shelf.productId ? COLOURS.white : COLOURS.dim));
    this.track(label(this, 6, 40, `HOLDS ${shelf.qty}/${SHELF_CAPACITY}`, COLOURS.dim));
    if (shelf.productId) {
      this.track(button(this, WIDTH - 62, 28, 58, 22, 'REMOVE', () => {
        emptyShelf(session.state, this.shelfId);
        this.selected = null;
        this.changed();
        this.render();
      }));
    }

    this.track(this.add.rectangle(6, 54, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    this.track(label(this, 6, 60, 'CHOOSE A SNACK', COLOURS.dim));

    // What you actually have comes first, so there's less to page through.
    const products = unlockedProducts(session.state).sort((a, b) => Number(this.have(b.id) > 0) - Number(this.have(a.id) > 0));
    const pages = Math.ceil(products.length / PER_PAGE);
    this.page = Math.min(this.page, pages - 1);
    if (pages > 1) {
      this.track(button(this, 112, 56, 24, 14, '<', () => this.turn(-1))).setEnabled(this.page > 0);
      this.track(label(this, 150, 59, `${this.page + 1}/${pages}`, COLOURS.dim, 'center'));
      this.track(button(this, 164, 56, 24, 14, '>', () => this.turn(1))).setEnabled(this.page < pages - 1);
    }

    products.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((product, i) => {
      const y = LIST_Y + i * ROW_H;
      const usable = this.maxFor(product.id) > 0;
      const isSelected = this.selected === product.id;
      const alpha = usable ? 1 : 0.4;
      const row = this.track(this.add.rectangle(4, y, WIDTH - 8, ROW_H - 2, isSelected ? COLOURS.accent : COLOURS.panel).setOrigin(0));
      row.setAlpha(usable ? 1 : 0.5);
      if (isSelected) row.setStrokeStyle(1, COLOURS.white);
      if (usable) row.setInteractive({ useHandCursor: true }).on('pointerup', () => this.select(product.id));
      this.track(this.add.image(16, y + 15, `item_${product.id}`).setAlpha(alpha));
      this.track(label(this, 28, y + 5, product.name).setAlpha(alpha));
      this.track(label(this, 28, y + 16, `HAVE ${this.have(product.id)}`, isSelected ? COLOURS.white : COLOURS.dim).setAlpha(alpha));
      if (isSelected) this.track(label(this, WIDTH - 12, y + 11, '✓', COLOURS.white, 'right'));
    });

    const footerY = LIST_Y + PER_PAGE * ROW_H + 2;
    const max = this.selected ? this.maxFor(this.selected) : 0;
    this.track(label(this, 6, footerY + 8, 'HOW MANY', this.selected ? COLOURS.white : COLOURS.dim));
    this.track(button(this, 112, footerY, 30, 24, '-', () => this.changeQty(-1))).setEnabled(this.qty > 1);
    this.track(label(this, 158, footerY + 8, String(this.qty), this.selected ? COLOURS.gold : COLOURS.dim, 'center'));
    this.track(button(this, 174, footerY, 36, 24, '+', () => this.changeQty(1))).setEnabled(this.qty > 0 && this.qty < max);

    this.track(button(this, 6, footerY + 28, WIDTH - 12, 32, 'PLACE ON SHELF', () => this.place(), COLOURS.accent, null))
      .setEnabled(this.selected !== null && this.qty > 0);
    this.track(button(this, 44, footerY + 64, WIDTH - 88, 20, 'ORDER MORE STOCK', () => {
      this.scene.stop();
      this.scene.launch('Order');
    }, COLOURS.panel));
  }

  private turn(delta: number) {
    this.page += delta;
    this.render();
  }

  private changeQty(delta: number) {
    this.qty += delta;
    this.render();
  }

  private place() {
    if (!this.selected || this.qty <= 0) return;
    if (stockShelf(session.state, this.shelfId, this.selected, this.qty) !== 'ok') return;
    sfx.pop();
    this.changed();
    this.close();
  }

  private changed() {
    if (session.phase === 'morning') session.save();
    session.events.emit('shelves-changed');
  }

  private close() {
    session.modal = false;
    this.scene.stop();
  }
}
