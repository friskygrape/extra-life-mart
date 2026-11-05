import Phaser from 'phaser';
import { sfx } from '../audio';
import type { Product } from '../data/products';
import { buyLicence, lockedProducts, unlockedProducts } from '../logic/licences';
import { formatCents } from '../logic/money';
import { cartCost, placeOrder, type Cart } from '../logic/orders';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, button, label } from '../ui';

type Tab = 'food' | 'game' | 'licences';

const ROW_H = 38;
const LIST_Y = 54;

export class OrderScene extends Phaser.Scene {
  private tab: Tab = 'food';
  private cart: Cart = {};
  private content: { destroy(): void }[] = [];
  private notice = '';
  private confirming: string | null = null;

  constructor() {
    super('Order');
  }

  create() {
    this.cart = {};
    this.content = [];
    this.notice = '';
    this.confirming = null;
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

    const tab = (x: number, w: number, id: Tab, text: string) =>
      this.track(button(this, x, 27, w, 24, text, () => {
        this.tab = id;
        this.confirming = null;
        this.render();
      }, this.tab === id ? COLOURS.panelLight : COLOURS.panel));
    tab(4, 60, 'food', 'FOOD');
    tab(66, 60, 'game', 'GAMES');
    tab(128, 84, 'licences', 'LICENCES');

    if (this.tab === 'licences') this.renderLicences();
    else unlockedProducts(state).filter((p) => p.kind === this.tab).forEach((p, i) => this.productRow(p, i));
    this.renderFooter();
  }

  private productRow(product: Product, index: number) {
    const { state } = session;
    const y = LIST_Y + index * ROW_H;
    const qty = this.cart[product.id] ?? 0;
    const have = state.stockroom[product.id] ?? 0;
    const coming = state.pendingOrders[product.id] ?? 0;
    this.track(this.add.image(12, y + 17, `item_${product.id}`));
    this.track(label(this, 24, y + 2, product.name));
    this.track(label(this, 24, y + 12, `${formatCents(product.wholesale)}>${formatCents(product.retail)}`, COLOURS.gold));
    this.track(label(this, 24, y + 22, `HAVE ${have}${coming ? `+${coming}` : ''}`, COLOURS.dim));
    const minus = this.track(button(this, 130, y + 2, 28, 32, '-', () => this.change(product.id, -1)));
    minus.setEnabled(qty > 0);
    this.track(label(this, 167, y + 14, String(qty), qty ? COLOURS.gold : COLOURS.dim, 'center'));
    this.track(button(this, 176, y + 2, 36, 32, '+', () => this.change(product.id, 1)));
  }

  private renderLicences() {
    const locked = lockedProducts(session.state);
    if (locked.length === 0) {
      this.track(label(this, WIDTH / 2, 120, 'EVERYTHING UNLOCKED!', COLOURS.green, 'center'));
      return;
    }
    locked.forEach((product, i) => {
      const y = LIST_Y + i * ROW_H;
      const price = product.licence!;
      const canAfford = price <= session.state.balance;
      this.track(this.add.image(12, y + 17, `item_${product.id}`));
      this.track(label(this, 24, y + 4, product.name));
      this.track(label(this, 24, y + 16, `+${formatCents(product.retail - product.wholesale)} A SALE`, COLOURS.green));
      const confirming = this.confirming === product.id;
      const buy = this.track(button(this, 142, y + 2, 70, 32, confirming ? 'SURE?' : formatCents(price), () => {
        if (!confirming) {
          this.confirming = product.id;
          this.render();
          return;
        }
        this.confirming = null;
        if (buyLicence(session.state, product.id)) {
          sfx.unlock();
          this.notice = `${product.short} UNLOCKED!`;
          if (session.phase === 'morning') session.save();
          session.events.emit('shelves-changed');
        }
        this.render();
      }, confirming ? COLOURS.accent : COLOURS.button));
      buy.setEnabled(canAfford);
    });
  }

  private renderFooter() {
    const cost = cartCost(this.cart);
    const canAfford = cost <= session.state.balance;
    this.track(this.add.rectangle(6, 290, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    this.track(label(this, 6, 300, 'TOTAL', COLOURS.dim));
    this.track(label(this, 6, 311, formatCents(cost), canAfford ? COLOURS.white : COLOURS.red));
    const place = this.track(button(this, 96, 296, 116, 32, 'PLACE ORDER', () => this.submit(), COLOURS.accent, null));
    place.setEnabled(cost > 0 && canAfford);
    const note = !canAfford ? 'NOT ENOUGH MONEY' : this.notice || 'A BOX ARRIVES SHORTLY AFTER';
    this.track(label(this, WIDTH / 2, 342, note, !canAfford ? COLOURS.red : this.notice ? COLOURS.green : COLOURS.dim, 'center'));
  }

  private change(id: string, delta: number) {
    this.notice = '';
    this.cart[id] = Math.max(0, (this.cart[id] ?? 0) + delta);
    this.render();
  }

  private submit() {
    if (!placeOrder(session.state, this.cart)) return;
    sfx.order();
    this.cart = {};
    this.notice = 'ORDER PLACED';
    if (session.phase === 'morning') session.save();
    session.events.emit('order-placed');
    this.render();
  }

  private close() {
    session.modal = false;
    this.scene.stop();
  }
}
