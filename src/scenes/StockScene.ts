import Phaser from 'phaser';
import { ITEM_SCALE } from '../art/textures';
import { sfx } from '../audio';
import { SHELF_CAPACITY, getProduct } from '../data/products';
import { emptyShelf, stockShelf } from '../logic/inventory';
import { unlockedProducts } from '../logic/licences';
import { session } from '../session';
import { BUTTONS, COLOURS, ScrollList, WIDTH, backdrop, button, closeButton, label, mainButton, secondaryButton } from '../ui';

interface StockData {
  shelfId: string;
}

const LIST_ROWS = 6;
const LIST_Y = 72;
const ROW_H = 30;

export class StockScene extends Phaser.Scene {
  private shelfId = '';
  private scroll = 0;
  private list: ScrollList | null = null;
  private selected: string | null = null;
  private qty = 0;
  private content: { destroy(): void }[] = [];

  constructor() {
    super('Stock');
  }

  create(data: StockData) {
    this.shelfId = data.shelfId;
    this.scroll = 0;
    this.list = null;
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
    if (this.list) this.scroll = this.list.scroll;
    this.list?.destroy();
    this.list = null;
    this.content.forEach((o) => o.destroy());
    this.content = [];
    const shelf = this.shelf();

    // A shelf already holding something can only take more of the same, so start there.
    if (!this.selected && shelf.productId && this.maxFor(shelf.productId) > 0) {
      this.selected = shelf.productId;
      this.qty = this.maxFor(shelf.productId);
    }

    this.track(label(this, 6, 8, 'SHELF', COLOURS.gold));
    this.track(closeButton(this, () => this.close()));

    const current = shelf.productId ? getProduct(shelf.productId).name : 'EMPTY';
    this.track(label(this, 6, 30, current, shelf.productId ? COLOURS.white : COLOURS.dim));
    this.track(label(this, 6, 40, `HOLDS ${shelf.qty}/${SHELF_CAPACITY}`, COLOURS.dim));
    if (shelf.productId) {
      this.track(button(this, WIDTH - BUTTONS.removeW - 4, 28, BUTTONS.removeW, BUTTONS.compactH, 'REMOVE', () => {
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
    const list = new ScrollList(this, LIST_Y, LIST_ROWS * ROW_H, products.length * ROW_H, this.scroll);
    this.list = list;
    products.forEach((product, i) => {
      const y = i * ROW_H;
      const usable = this.maxFor(product.id) > 0;
      const isSelected = this.selected === product.id;
      const alpha = usable ? 1 : 0.4;
      const row = list.add(this.add.rectangle(4, y, WIDTH - 8, ROW_H - 2, isSelected ? COLOURS.accent : COLOURS.panel).setOrigin(0));
      row.setAlpha(usable ? 1 : 0.5);
      if (isSelected) row.setStrokeStyle(1, COLOURS.white);
      if (usable) row.setInteractive({ useHandCursor: true }).on('pointerup', list.guard(() => this.select(product.id), null));
      list.add(this.add.image(16, y + 14, `item_${product.id}`).setScale(ITEM_SCALE).setAlpha(alpha));
      list.add(label(this, 28, y + 4, product.name).setAlpha(alpha));
      list.add(label(this, 28, y + 15, `HAVE ${this.have(product.id)}`, isSelected ? COLOURS.white : COLOURS.dim).setAlpha(alpha));
      if (isSelected) list.add(label(this, WIDTH - 12, y + 10, '\u2713', COLOURS.white, 'right'));
    });

    const footerY = LIST_Y + LIST_ROWS * ROW_H;
    const max = this.selected ? this.maxFor(this.selected) : 0;
    this.track(label(this, 6, footerY + 12, 'HOW MANY', this.selected ? COLOURS.white : COLOURS.dim));
    this.track(button(this, 134, footerY, BUTTONS.stepper, BUTTONS.stepper, '-', () => this.changeQty(-1))).setEnabled(this.qty > 1);
    this.track(label(this, 172, footerY + 12, String(this.qty), this.selected ? COLOURS.gold : COLOURS.dim, 'center'));
    this.track(button(this, 180, footerY, BUTTONS.stepper, BUTTONS.stepper, '+', () => this.changeQty(1))).setEnabled(this.qty > 0 && this.qty < max);

    this.track(mainButton(this, footerY + 36, 'PLACE ON SHELF', () => this.place())).setEnabled(this.selected !== null && this.qty > 0);
    this.track(secondaryButton(this, footerY + 72, 'ORDER MORE STOCK', () => {
      this.scene.stop();
      this.scene.launch('Computer', { page: 'order' });
    }));
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
    this.list?.destroy();
    this.list = null;
    session.modal = false;
    this.scene.stop();
  }
}
