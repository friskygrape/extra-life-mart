import Phaser from 'phaser';
import { sfx } from '../audio';
import { BOX_SIZE, PRODUCTS, type Product } from '../data/products';
import { SHELF_ROW_PRICES } from '../data/shelves';
import { buyLicence, buyShelfRow, nextRowPrice, unlockedProducts } from '../logic/licences';
import { formatCents } from '../logic/money';
import { cartCost, placeOrder, type Cart } from '../logic/orders';
import { session } from '../session';
import { BUTTONS, COLOURS, ScrollList, WIDTH, backdrop, button, closeButton, label, mainButton } from '../ui';

export type OrderTab = 'snacks' | 'licences' | 'shelves';

const ROW_H = 38;
const LIST_Y = 54;
const LIST_H = 232;

export class OrderScene extends Phaser.Scene {
  private tab: OrderTab = 'snacks';
  private scroll = 0;
  private list: ScrollList | null = null;
  private cart: Cart = {};
  private content: { destroy(): void }[] = [];
  private notice = '';

  constructor() {
    super('Order');
  }

  create(data?: { tab?: OrderTab }) {
    this.tab = data?.tab ?? 'snacks';
    this.scroll = 0;
    this.list = null;
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
    if (this.list) this.scroll = this.list.scroll;
    this.list?.destroy();
    this.list = null;
    this.content.forEach((o) => o.destroy());
    this.content = [];
    const { state } = session;

    this.track(label(this, 6, 4, 'ORDER STOCKS', COLOURS.gold));
    this.track(closeButton(this, () => this.close()));
    this.track(label(this, 6, 14, formatCents(state.balance), COLOURS.dim));

    const tab = (x: number, w: number, id: OrderTab, text: string) =>
      this.track(button(this, x, 27, w, BUTTONS.tabH, text, () => {
        this.tab = id;
        if (this.list) this.list.destroy();
        this.list = null;
        this.scroll = 0;
        this.render();
      }, this.tab === id ? COLOURS.panelLight : COLOURS.panel));
    tab(4, 62, 'snacks', 'SNACKS');
    tab(68, 72, 'licences', 'LICENCES');
    tab(142, 70, 'shelves', 'SHELVES');

    if (this.tab === 'snacks') this.renderList(unlockedProducts(state), (p, y, list) => this.productRow(p, y, list));
    else if (this.tab === 'licences') this.renderLicences();
    else this.renderShelves();
    this.renderFooter();
  }

  private renderList(products: Product[], row: (p: Product, y: number, list: ScrollList) => void) {
    const list = new ScrollList(this, LIST_Y, LIST_H, products.length * ROW_H, this.scroll);
    this.list = list;
    products.forEach((p, i) => row(p, i * ROW_H, list));
  }

  private productRow(product: Product, y: number, list: ScrollList) {
    const boxes = (this.cart[product.id] ?? 0) / BOX_SIZE;
    const have = session.state.stockroom[product.id] ?? 0;
    list.add(this.add.image(12, y + 17, `item_${product.id}`));
    list.add(label(this, 24, y + 2, product.name));
    list.add(label(this, 24, y + 12, `${BOX_SIZE} FOR ${formatCents(product.wholesale * BOX_SIZE)}`, COLOURS.gold));
    list.add(label(this, 24, y + 22, `SELL ${formatCents(product.retail)} HAVE ${have}`, COLOURS.dim));
    list.addButton(button(this, 132, y + 2, BUTTONS.stepper, BUTTONS.stepper, '-', list.guard(() => this.change(product.id, -BOX_SIZE)), COLOURS.button, null)).setEnabled(boxes > 0);
    list.add(label(this, 170, y + 14, String(boxes), boxes ? COLOURS.gold : COLOURS.dim, 'center'));
    list.addButton(button(this, 178, y + 2, BUTTONS.stepper, BUTTONS.stepper, '+', list.guard(() => this.change(product.id, BOX_SIZE)), COLOURS.button, null));
  }

  /** Every licence in the game stays on the list, so you can always see what's ahead. */
  private renderLicences() {
    const { state } = session;
    this.renderList(PRODUCTS.filter((p) => p.licence), (product, y, list) => {
      const price = product.licence!;
      const owned = state.unlocked.includes(product.id);
      list.add(this.add.image(12, y + 17, `item_${product.id}`));
      list.add(label(this, 24, y + 6, product.name));
      list.add(label(this, 24, y + 18, `+${formatCents(product.retail - product.wholesale)} A SALE`, COLOURS.green));
      if (owned) {
        list.add(label(this, WIDTH - 6 - BUTTONS.rowW / 2, y + 14, 'OWNED', COLOURS.dim, 'center'));
        return;
      }
      list.addButton(button(this, WIDTH - BUTTONS.rowW - 6, y + 2, BUTTONS.rowW, BUTTONS.rowH, formatCents(price), list.guard(() => {
        if (!buyLicence(state, product.id)) return;
        sfx.unlock();
        this.notice = `${product.short} UNLOCKED!`;
        if (session.phase === 'morning') session.save();
        this.render();
      }, null), COLOURS.button, null)).setEnabled(price <= state.balance);
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
    this.list?.destroy();
    this.list = null;
    session.modal = false;
    this.scene.stop();
  }
}
