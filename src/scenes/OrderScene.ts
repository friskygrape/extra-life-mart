import Phaser from 'phaser';
import { PRODUCTS, type ProductKind } from '../data/products';
import { formatCents } from '../logic/money';
import { cartCost, placeOrder, type Cart } from '../logic/orders';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, button, label } from '../ui';

export class OrderScene extends Phaser.Scene {
  private tab: ProductKind = 'food';
  private cart: Cart = {};
  private content: { destroy(): void }[] = [];
  private notice = '';

  constructor() {
    super('Order');
  }

  create() {
    this.cart = {};
    this.content = [];
    this.notice = '';
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

    this.track(label(this, 6, 6, 'SUPPLIER', COLOURS.gold));
    this.track(button(this, WIDTH - 50, 3, 46, 20, 'CLOSE', () => this.close()));
    this.track(label(this, 6, 16, formatCents(state.balance), COLOURS.dim));

    const tab = (x: number, kind: ProductKind, text: string) =>
      this.track(button(this, x, 28, 84, 24, text, () => {
        this.tab = kind;
        this.render();
      }, this.tab === kind ? COLOURS.panelLight : COLOURS.panel));
    tab(4, 'food', 'FOOD');
    tab(92, 'game', 'GAMES');

    PRODUCTS.filter((p) => p.kind === this.tab).forEach((product, i) => {
      const y = 56 + i * 32;
      const qty = this.cart[product.id] ?? 0;
      const have = state.stockroom[product.id] ?? 0;
      const coming = state.pendingOrders[product.id] ?? 0;
      this.track(this.add.image(11, y + 13, `item_${product.id}`).setScale(2));
      this.track(label(this, 22, y + 3, product.name));
      this.track(label(this, 22, y + 14, `${formatCents(product.wholesale)} HAVE ${have}${coming ? `+${coming}` : ''}`, COLOURS.dim));
      const minus = this.track(button(this, 112, y + 2, 22, 26, '-', () => this.change(product.id, -1)));
      minus.setEnabled(qty > 0);
      this.track(label(this, 144, y + 11, String(qty), qty ? COLOURS.gold : COLOURS.dim, 'center'));
      this.track(button(this, 154, y + 2, 22, 26, '+', () => this.change(product.id, 1)));
    });

    const cost = cartCost(this.cart);
    const canAfford = cost <= state.balance;
    this.track(this.add.rectangle(6, 252, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    this.track(label(this, 6, 258, 'TOTAL', COLOURS.dim));
    this.track(label(this, 6, 268, formatCents(cost), canAfford ? COLOURS.white : COLOURS.red));
    const place = this.track(button(this, 84, 257, 92, 28, 'ORDER', () => this.submit()));
    place.setEnabled(cost > 0 && canAfford);
    const note = !canAfford ? 'NOT ENOUGH MONEY' : this.notice;
    this.track(label(this, 90, 296, note, canAfford ? COLOURS.green : COLOURS.red, 'center'));
  }

  private change(id: string, delta: number) {
    this.notice = '';
    this.cart[id] = Math.max(0, (this.cart[id] ?? 0) + delta);
    this.render();
  }

  private submit() {
    if (!placeOrder(session.state, this.cart)) return;
    this.cart = {};
    this.notice = 'ARRIVES TOMORROW MORNING';
    if (session.phase === 'morning') session.save();
    this.render();
  }

  private close() {
    session.modal = false;
    this.scene.stop();
  }
}
