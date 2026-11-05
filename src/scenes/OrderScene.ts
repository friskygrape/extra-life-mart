import Phaser from 'phaser';
import { sfx } from '../audio';
import { BOX_SIZE, type Product } from '../data/products';
import { SHELF_ROW_PRICES } from '../data/shelves';
import { buyLicence, buyShelfRow, lockedProducts, nextRowPrice, unlockedProducts } from '../logic/licences';
import { formatCents } from '../logic/money';
import { cartCost, placeOrder, type Cart } from '../logic/orders';
import { session } from '../session';
import { BUTTONS, COLOURS, WIDTH, backdrop, button, closeButton, label, mainButton, pager } from '../ui';

export type OrderTab = 'snacks' | 'licences' | 'shelves';

const ROW_H = 38;
const LIST_Y = 54;
const PER_PAGE = 6;

export class OrderScene extends Phaser.Scene {
  private tab: OrderTab = 'snacks';
  private page = 0;
  private cart: Cart = {};
  private content: { destroy(): void }[] = [];
  private notice = '';

  constructor() {
    super('Order');
  }

  create(data?: { tab?: OrderTab }) {
    this.tab = data?.tab ?? 'snacks';
    this.page = 0;
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

    this.track(label(this, 6, 4, 'ORDER STOCKS', COLOURS.gold));
    this.track(closeButton(this, () => this.close()));
    this.track(label(this, 6, 14, formatCents(state.balance), COLOURS.dim));

    const tab = (x: number, w: number, id: OrderTab, text: string) =>
      this.track(button(this, x, 27, w, BUTTONS.tabH, text, () => {
        this.tab = id;
        this.page = 0;
        this.render();
      }, this.tab === id ? COLOURS.panelLight : COLOURS.panel));
    tab(4, 62, 'snacks', 'SNACKS');
    tab(68, 72, 'licences', 'LICENCES');
    tab(142, 70, 'shelves', 'SHELVES');

    if (this.tab === 'snacks') this.renderList(unlockedProducts(state), (p, y) => this.productRow(p, y));
    else if (this.tab === 'licences') this.renderLicences();
    else this.renderShelves();
    this.renderFooter();
  }

  private renderList(products: Product[], row: (p: Product, y: number) => void) {
    const pages = Math.max(1, Math.ceil(products.length / PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    if (pages > 1) pager(this, this.page, pages, (delta) => this.turn(delta)).forEach((o) => this.track(o));
    products.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((p, i) => row(p, LIST_Y + i * ROW_H));
  }

  private turn(delta: number) {
    this.page += delta;
    this.render();
  }

  private productRow(product: Product, y: number) {
    const boxes = (this.cart[product.id] ?? 0) / BOX_SIZE;
    const have = session.state.stockroom[product.id] ?? 0;
    this.track(this.add.image(12, y + 17, `item_${product.id}`));
    this.track(label(this, 24, y + 2, product.name));
    this.track(label(this, 24, y + 12, `${BOX_SIZE} FOR ${formatCents(product.wholesale * BOX_SIZE)}`, COLOURS.gold));
    this.track(label(this, 24, y + 22, `SELL ${formatCents(product.retail)} HAVE ${have}`, COLOURS.dim));
    this.track(button(this, 134, y + 2, BUTTONS.stepper, BUTTONS.stepper, '-', () => this.change(product.id, -BOX_SIZE))).setEnabled(boxes > 0);
    this.track(label(this, 172, y + 14, String(boxes), boxes ? COLOURS.gold : COLOURS.dim, 'center'));
    this.track(button(this, 180, y + 2, BUTTONS.stepper, BUTTONS.stepper, '+', () => this.change(product.id, BOX_SIZE)));
  }

  private renderLicences() {
    const locked = lockedProducts(session.state);
    if (locked.length === 0) {
      this.track(label(this, WIDTH / 2, 120, 'EVERYTHING UNLOCKED!', COLOURS.green, 'center'));
      return;
    }
    this.renderList(locked, (product, y) => {
      const price = product.licence!;
      this.track(this.add.image(12, y + 17, `item_${product.id}`));
      this.track(label(this, 24, y + 6, product.name));
      this.track(label(this, 24, y + 18, `+${formatCents(product.retail - product.wholesale)} A SALE`, COLOURS.green));
      this.track(button(this, WIDTH - BUTTONS.rowW - 4, y + 2, BUTTONS.rowW, BUTTONS.rowH, formatCents(price), () => {
        if (!buyLicence(session.state, product.id)) return;
        sfx.unlock();
        this.notice = `${product.short} UNLOCKED!`;
        if (session.phase === 'morning') session.save();
        this.render();
      }, COLOURS.button, null)).setEnabled(price <= session.state.balance);
    });
  }

  private renderShelves() {
    const { state } = session;
    SHELF_ROW_PRICES.forEach((price, i) => {
      const y = LIST_Y + i * ROW_H;
      const rowNumber = i + 2;
      const owned = state.rowsOwned >= rowNumber;
      this.track(label(this, 8, y + 6, `SHELF ROW ${rowNumber}`));
      this.track(label(this, 8, y + 18, '4 MORE SHELVES', COLOURS.green));
      if (owned) {
        this.track(label(this, WIDTH - 4 - BUTTONS.rowW / 2, y + 14, 'OWNED', COLOURS.dim, 'center'));
        return;
      }
      const isNext = nextRowPrice(state) === price;
      this.track(button(this, WIDTH - BUTTONS.rowW - 4, y + 2, BUTTONS.rowW, BUTTONS.rowH, formatCents(price), () => {
        if (!buyShelfRow(state)) return;
        sfx.unlock();
        this.notice = 'NEW SHELVES ADDED!';
        if (session.phase === 'morning') session.save();
        session.events.emit('shelves-changed');
        this.render();
      }, COLOURS.button, null)).setEnabled(isNext && price <= state.balance);
    });
  }

  private renderFooter() {
    const cost = cartCost(this.cart);
    const canAfford = cost <= session.state.balance;
    this.track(this.add.rectangle(6, 288, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    this.track(label(this, 6, 294, 'TOTAL', COLOURS.dim));
    this.track(label(this, WIDTH - 6, 294, formatCents(cost), canAfford ? COLOURS.white : COLOURS.red, 'right'));
    const place = this.track(mainButton(this, 306, 'PLACE ORDER', () => this.submit()));
    place.setEnabled(cost > 0 && canAfford);
    const note = !canAfford ? 'NOT ENOUGH MONEY' : this.notice || `EACH + IS A BOX OF ${BOX_SIZE}`;
    this.track(label(this, WIDTH / 2, 344, note, !canAfford ? COLOURS.red : this.notice ? COLOURS.green : COLOURS.dim, 'center'));
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
    this.notice = 'ORDER PLACED. BOX ON THE WAY';
    if (session.phase === 'morning') session.save();
    session.events.emit('order-placed');
    this.render();
  }

  private close() {
    session.modal = false;
    this.scene.stop();
  }
}
