import Phaser from 'phaser';
import { ITEM_SCALE } from '../art/textures';
import { sfx } from '../audio';
import { BOX_SIZE, PRODUCTS, type Product } from '../data/products';
import { SHELF_ROW_PRICES } from '../data/shelves';
import { WEATHER } from '../data/weather';
import { buyLicence, buyShelfRow, nextRowPrice } from '../logic/licences';
import { formatCents } from '../logic/money';
import { cartCost, placeOrder, rushCost, type Cart } from '../logic/orders';
import { session } from '../session';
import { BUTTONS, COLOURS, ScrollList, WIDTH, backdrop, button, closeButton, label, mainButton, secondaryButton } from '../ui';

import type { CelebrationData } from './CelebrationScene';

export type OrderTab = 'snacks' | 'shelves';

const ROW_H = 38;
const LIST_Y = 54;
const LIST_H = 198;
const FOOTER_Y = LIST_Y + LIST_H + 2;

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
    this.track(label(this, WIDTH - BUTTONS.closeW - 8, 14, `TOMORROW: ${WEATHER[state.forecast].short}`, COLOURS.gold, 'right'));

    const tab = (x: number, w: number, id: OrderTab, text: string) =>
      this.track(button(this, x, 27, w, BUTTONS.tabH, text, () => {
        this.tab = id;
        if (this.list) this.list.destroy();
        this.list = null;
        this.scroll = 0;
        this.render();
      }, this.tab === id ? COLOURS.panelLight : COLOURS.panel));
    tab(4, 103, 'snacks', 'SNACKS');
    tab(109, 103, 'shelves', 'SHELVES');

    if (this.tab === 'snacks') this.renderSnacks();
    else this.renderShelves();
    this.renderFooter();
  }

  /** Every snack in the game on one list, so you can always see what's ahead. */
  private renderSnacks() {
    const list = new ScrollList(this, LIST_Y, LIST_H, PRODUCTS.length * ROW_H, this.scroll);
    this.list = list;
    PRODUCTS.forEach((product, i) => {
      if (session.state.unlocked.includes(product.id)) this.productRow(product, i * ROW_H, list);
      else this.lockedRow(product, i * ROW_H, list);
    });
  }

  /** A snack you can't order until you've paid for its licence. */
  private lockedRow(product: Product, y: number, list: ScrollList) {
    const { state } = session;
    const price = product.licence!;
    list.add(this.add.image(12, y + 17, `item_${product.id}`).setScale(ITEM_SCALE));
    list.add(label(this, 24, y + 6, product.name));
    list.add(label(this, 24, y + 18, 'LICENCE', COLOURS.dim));
    list.addButton(button(this, WIDTH - BUTTONS.rowW - 6, y + 2, BUTTONS.rowW, BUTTONS.rowH, formatCents(price), list.guard(() => {
      if (!buyLicence(state, product.id)) return;
      if (session.phase === 'morning') session.save();
      this.render();
      this.celebrate({ kind: 'licence', productId: product.id });
    }, null), COLOURS.button, null)).setEnabled(price <= state.balance);
  }

  private productRow(product: Product, y: number, list: ScrollList) {
    const boxes = (this.cart[product.id] ?? 0) / BOX_SIZE;
    const have = session.state.stockroom[product.id] ?? 0;
    const coming = (session.state.pendingOrders[product.id] ?? 0) + (session.state.arrivals[product.id] ?? 0);
    list.add(this.add.image(12, y + 17, `item_${product.id}`).setScale(ITEM_SCALE));
    list.add(label(this, 24, y + 2, product.name));
    list.add(label(this, 24, y + 12, `${BOX_SIZE} FOR ${formatCents(product.wholesale * BOX_SIZE)}`, COLOURS.gold));
    list.add(label(this, 24, y + 22, coming > 0 ? `HAVE ${have} COMING ${coming}` : `SELL ${formatCents(product.retail)} HAVE ${have}`, COLOURS.dim));
    list.addButton(button(this, 132, y + 2, BUTTONS.stepper, BUTTONS.stepper, '-', list.guard(() => this.change(product.id, -BOX_SIZE)), COLOURS.button, null)).setEnabled(boxes > 0);
    list.add(label(this, 170, y + 14, String(boxes), boxes ? COLOURS.gold : COLOURS.dim, 'center'));
    list.addButton(button(this, 178, y + 2, BUTTONS.stepper, BUTTONS.stepper, '+', list.guard(() => this.change(product.id, BOX_SIZE)), COLOURS.button, null));
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
        if (session.phase === 'morning') session.save();
        session.events.emit('shelves-changed');
        this.render();
        this.celebrate({ kind: 'shelves', row: rowNumber });
      }, COLOURS.button, null)).setEnabled(isNext && price <= state.balance);
    });
  }

  private renderFooter() {
    const cost = cartCost(this.cart);
    const canAfford = cost <= session.state.balance;
    const rush = rushCost(this.cart);
    this.track(this.add.rectangle(6, FOOTER_Y, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    this.track(label(this, 6, FOOTER_Y + 4, 'TOTAL', COLOURS.dim));
    this.track(label(this, WIDTH - 6, FOOTER_Y + 4, formatCents(cost), canAfford ? COLOURS.white : COLOURS.red, 'right'));
    const place = this.track(mainButton(this, FOOTER_Y + 15, 'ORDER FOR TOMORROW', () => this.submit(false)));
    place.setEnabled(cost > 0 && canAfford);
    const rushNow = this.track(secondaryButton(this, FOOTER_Y + 50, cost > 0 ? `RUSH TODAY ${formatCents(rush)}` : 'RUSH TODAY', () => this.submit(true)));
    rushNow.setEnabled(cost > 0 && rush <= session.state.balance);
    const note = !canAfford ? 'NOT ENOUGH MONEY' : this.notice || `EACH + IS A BOX OF ${BOX_SIZE}`;
    this.track(label(this, WIDTH / 2, FOOTER_Y + 86, note, !canAfford ? COLOURS.red : this.notice ? COLOURS.green : COLOURS.dim, 'center'));
  }

  /** Stops everything while the player enjoys their new unlock. */
  private celebrate(data: CelebrationData) {
    this.scene.launch('Celebration', data);
    this.scene.pause();
    this.scene.pause('Shack');
  }

  private change(id: string, delta: number) {
    this.notice = '';
    this.cart[id] = Math.max(0, (this.cart[id] ?? 0) + delta);
    this.render();
  }

  private submit(rush: boolean) {
    if (!placeOrder(session.state, this.cart, rush)) return;
    sfx.order();
    this.cart = {};
    this.notice = rush ? 'RUSH BOX ON THE WAY' : 'ARRIVES TOMORROW MORNING';
    if (session.phase === 'morning') session.save();
    session.events.emit('order-placed', rush);
    this.render();
  }

  private close() {
    this.list?.destroy();
    this.list = null;
    session.modal = false;
    this.scene.stop();
  }
}
