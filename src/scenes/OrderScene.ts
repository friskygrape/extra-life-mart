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

    this.track(label(this, 6, 4, 'SUPPLIER', COLOURS.gold));
    this.track(button(this, WIDTH - 50, 3, 46, 20, 'CLOSE', () => this.close()));
    this.track(label(this, 6, 14, formatCents(state.balance), COLOURS.dim));

    const tab = (x: number, kind: ProductKind, text: string) =>
      this.track(button(this, x, 27, 102, 24, text, () => {
        this.tab = kind;
        this.render();
      }, this.tab === kind ? COLOURS.panelLight : COLOURS.panel));
    tab(4, 'food', 'FOOD');
    tab(110, 'game', 'GAMES');

    PRODUCTS.filter((p) => p.kind === this.tab).forEach((product, i) => {
      const y = 56 + i * 38;
      const qty = this.cart[product.id] ?? 0;
      const have = state.stockroom[product.id] ?? 0;
      const coming = state.pendingOrders[product.id] ?? 0;
      this.track(this.add.image(12, y + 16, `item_${product.id}`));
      this.track(label(this, 24, y + 6, product.name));
      this.track(label(this, 24, y + 17, formatCents(product.wholesale), COLOURS.gold));
      this.track(label(this, 70, y + 17, `HAVE ${have}${coming ? `+${coming}` : ''}`, COLOURS.dim));
      const minus = this.track(button(this, 130, y + 2, 28, 32, '-', () => this.change(product.id, -1)));
      minus.setEnabled(qty > 0);
      this.track(label(this, 167, y + 14, String(qty), qty ? COLOURS.gold : COLOURS.dim, 'center'));
      this.track(button(this, 176, y + 2, 36, 32, '+', () => this.change(product.id, 1)));
    });

    const cost = cartCost(this.cart);
    const canAfford = cost <= state.balance;
    this.track(this.add.rectangle(6, 290, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    this.track(label(this, 6, 300, 'TOTAL', COLOURS.dim));
    this.track(label(this, 6, 311, formatCents(cost), canAfford ? COLOURS.white : COLOURS.red));
    const place = this.track(button(this, 96, 296, 116, 32, 'PLACE ORDER', () => this.submit(), COLOURS.accent));
    place.setEnabled(cost > 0 && canAfford);
    const note = !canAfford ? 'NOT ENOUGH MONEY' : this.notice || 'ORDERS ARRIVE NEXT MORNING';
    this.track(label(this, WIDTH / 2, 342, note, !canAfford ? COLOURS.red : this.notice ? COLOURS.green : COLOURS.dim, 'center'));
  }

  private change(id: string, delta: number) {
    this.notice = '';
    this.cart[id] = Math.max(0, (this.cart[id] ?? 0) + delta);
    this.render();
  }

  private submit() {
    if (!placeOrder(session.state, this.cart)) return;
    this.cart = {};
    this.notice = 'ORDER PLACED';
    if (session.phase === 'morning') session.save();
    this.render();
  }

  private close() {
    session.modal = false;
    this.scene.stop();
  }
}
