import Phaser from 'phaser';
import { ITEM_SCALE } from '../art/textures';
import { sfx } from '../audio';
import { BOX_SIZE, type Product } from '../data/products';
import { SHELF_ROW_PRICES } from '../data/shelves';
import { WEATHER } from '../data/weather';
import { buyLicence, buyShelfRow, lockedProducts, nextRowPrice, unlockedProducts } from '../logic/licences';
import { formatCents } from '../logic/money';
import { cartCost, placeOrder, rushCost, type Cart } from '../logic/orders';
import { session } from '../session';
import { BUTTONS, COLOURS, LARGE_W, LARGE_X, ScrollList, WIDTH, backdrop, button, closeButton, label, mainButton, secondaryButton, tinyLabel, titleLabel } from '../ui';

import type { CelebrationData } from './CelebrationScene';

export type ComputerPage = 'menu' | 'inventory' | 'order' | 'licences' | 'upgrades';

const TITLES: Record<ComputerPage, string> = {
  menu: 'SHOP COMPUTER',
  inventory: 'INVENTORY',
  order: 'ORDER STOCK',
  licences: 'LICENCES',
  upgrades: 'UPGRADES',
};
const MENU: { page: ComputerPage; text: string; note: string }[] = [
  { page: 'inventory', text: 'INVENTORY', note: 'WHAT YOU HAVE IN STOCK' },
  { page: 'order', text: 'ORDER STOCK', note: 'RESTOCK WHAT YOU SELL' },
  { page: 'licences', text: 'LICENCES', note: 'NEW FOODS TO SELL' },
  { page: 'upgrades', text: 'UPGRADES', note: 'IMPROVE YOUR STORE' },
];
const COMING_SOON = [
  { name: 'FREEZER', icon: 'icon_freezer' },
  { name: 'ICE CREAM MACHINE', icon: 'icon_icecream' },
];

const MENU_Y = 44;
const MENU_H = 56;
const MENU_GAP = 8;
const LIST_Y = 30;
const ROW_H = 38;
const ORDER_LIST_H = 222;
const ORDER_FOOTER_Y = LIST_Y + ORDER_LIST_H + 2;
const INVENTORY_ROW_H = 30;
const INVENTORY_FOOTER_Y = 340;

/** Everything on the shop's computer: a menu, and a page for each thing it does. */
export class ComputerScene extends Phaser.Scene {
  private page: ComputerPage = 'menu';
  private scroll = 0;
  private list: ScrollList | null = null;
  private cart: Cart = {};
  private content: { destroy(): void }[] = [];
  private notice = '';

  constructor() {
    super('Computer');
  }

  create(data?: { page?: ComputerPage }) {
    this.page = data?.page ?? 'menu';
    this.scroll = 0;
    this.list = null;
    this.cart = {};
    this.content = [];
    this.notice = '';
    backdrop(this);
    this.input.keyboard?.on('keydown-ESC', () => this.backOrClose());
    this.render();
  }

  private track<T extends { destroy(): void }>(obj: T): T {
    this.content.push(obj);
    return obj;
  }

  private go(page: ComputerPage) {
    this.page = page;
    this.scroll = 0;
    this.notice = '';
    this.list?.destroy();
    this.list = null;
    this.render();
  }

  private backOrClose() {
    if (this.page === 'menu') this.close();
    else this.go('menu');
  }

  private render() {
    if (this.list) this.scroll = this.list.scroll;
    this.list?.destroy();
    this.list = null;
    this.content.forEach((o) => o.destroy());
    this.content = [];

    this.track(titleLabel(this, 6, 4, TITLES[this.page], COLOURS.gold));
    this.track(label(this, 6, 15, formatCents(session.state.balance), COLOURS.dim));
    this.track(closeButton(this, () => this.backOrClose(), this.page === 'menu' ? 'CLOSE' : 'BACK'));

    if (this.page === 'menu') this.renderMenu();
    else if (this.page === 'inventory') this.renderInventory();
    else if (this.page === 'order') this.renderOrder();
    else if (this.page === 'licences') this.renderLicences();
    else this.renderUpgrades();
  }

  private renderMenu() {
    MENU.forEach(({ page, text, note }, i) => {
      const y = MENU_Y + i * (MENU_H + MENU_GAP);
      this.track(button(this, LARGE_X, y, LARGE_W, MENU_H, '', () => this.go(page)));
      this.track(titleLabel(this, WIDTH / 2, y + 17, text, COLOURS.white, 'center'));
      this.track(tinyLabel(this, WIDTH / 2, y + 31, note, COLOURS.dim, 'center'));
    });
  }

  // ---- Inventory ----------------------------------------------------------

  private renderInventory() {
    const { state } = session;
    const have = (id: string) => state.stockroom[id] ?? 0;
    const products = unlockedProducts(state).sort((a, b) => have(b.id) - have(a.id));
    this.track(label(this, 6, LIST_Y, 'SNACK', COLOURS.dim));
    this.track(label(this, WIDTH - 12, LIST_Y, 'IN STOCK', COLOURS.dim, 'right'));
    const list = new ScrollList(this, LIST_Y + 12, INVENTORY_FOOTER_Y - LIST_Y - 18, products.length * INVENTORY_ROW_H, this.scroll);
    this.list = list;
    products.forEach((product, i) => {
      const y = i * INVENTORY_ROW_H;
      const count = have(product.id);
      const onShelves = state.shelves.filter((s) => s.productId === product.id).reduce((sum, s) => sum + s.qty, 0);
      const coming = (state.pendingOrders[product.id] ?? 0) + (state.arrivals[product.id] ?? 0);
      list.add(this.add.rectangle(4, y, WIDTH - 8, INVENTORY_ROW_H - 2, COLOURS.panel).setOrigin(0));
      list.add(this.add.image(16, y + 14, `item_${product.id}`).setScale(ITEM_SCALE));
      list.add(titleLabel(this, 28, y + 3, product.name, count > 0 ? COLOURS.white : COLOURS.dim));
      list.add(tinyLabel(this, 28, y + 16, coming > 0 ? `ON SHELVES ${onShelves}  COMING ${coming}` : `ON SHELVES ${onShelves}`, COLOURS.dim));
      list.add(label(this, WIDTH - 12, y + 10, String(count), count > 0 ? COLOURS.gold : COLOURS.dim, 'right'));
    });
    this.track(secondaryButton(this, INVENTORY_FOOTER_Y, 'ORDER MORE STOCK', () => this.go('order')));
  }

  // ---- Order stock --------------------------------------------------------

  private renderOrder() {
    const products = unlockedProducts(session.state);
    const list = new ScrollList(this, LIST_Y, ORDER_LIST_H, products.length * ROW_H, this.scroll);
    this.list = list;
    products.forEach((product, i) => this.productRow(product, i * ROW_H, list));
    this.renderOrderFooter();
  }

  private productRow(product: Product, y: number, list: ScrollList) {
    const boxes = (this.cart[product.id] ?? 0) / BOX_SIZE;
    const have = session.state.stockroom[product.id] ?? 0;
    const coming = (session.state.pendingOrders[product.id] ?? 0) + (session.state.arrivals[product.id] ?? 0);
    list.add(this.add.image(12, y + 17, `item_${product.id}`).setScale(ITEM_SCALE));
    list.add(titleLabel(this, 24, y + 2, product.name));
    list.add(tinyLabel(this, 24, y + 13, `${BOX_SIZE} FOR ${formatCents(product.wholesale * BOX_SIZE)}`, COLOURS.gold));
    list.add(tinyLabel(this, 24, y + 23, coming > 0 ? `HAVE ${have} COMING ${coming}` : `SELL ${formatCents(product.retail)} HAVE ${have}`, COLOURS.dim));
    list.addButton(button(this, 132, y + 2, BUTTONS.stepper, BUTTONS.stepper, '-', list.guard(() => this.change(product.id, -BOX_SIZE)), COLOURS.button, null)).setEnabled(boxes > 0);
    list.add(label(this, 171, y + 14, String(boxes), boxes ? COLOURS.gold : COLOURS.dim, 'center'));
    list.addButton(button(this, 178, y + 2, BUTTONS.stepper, BUTTONS.stepper, '+', list.guard(() => this.change(product.id, BOX_SIZE)), COLOURS.button, null));
  }

  private renderOrderFooter() {
    const cost = cartCost(this.cart);
    const canAfford = cost <= session.state.balance;
    const rush = rushCost(this.cart);
    this.track(this.add.rectangle(6, ORDER_FOOTER_Y, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    this.track(label(this, 6, ORDER_FOOTER_Y + 3, `TOMORROW: ${WEATHER[session.state.forecast].short}`, COLOURS.gold));
    this.track(label(this, WIDTH - 6, ORDER_FOOTER_Y + 3, formatCents(cost), canAfford ? COLOURS.white : COLOURS.red, 'right'));
    const place = this.track(mainButton(this, ORDER_FOOTER_Y + 14, 'ORDER FOR TOMORROW', () => this.submit(false)));
    place.setEnabled(cost > 0 && canAfford);
    const rushNow = this.track(secondaryButton(this, ORDER_FOOTER_Y + 48, cost > 0 ? `RUSH TODAY ${formatCents(rush)}` : 'RUSH TODAY', () => this.submit(true)));
    rushNow.setEnabled(cost > 0 && rush <= session.state.balance);
    const note = !canAfford ? 'NOT ENOUGH MONEY' : this.notice || `EACH + IS A BOX OF ${BOX_SIZE}`;
    this.track(label(this, WIDTH / 2, ORDER_FOOTER_Y + 84, note, !canAfford ? COLOURS.red : this.notice ? COLOURS.green : COLOURS.dim, 'center'));
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

  // ---- Licences -----------------------------------------------------------

  private renderLicences() {
    const products = lockedProducts(session.state);
    if (products.length === 0) {
      this.track(label(this, WIDTH / 2, 150, 'YOU OWN EVERY LICENCE!', COLOURS.green, 'center'));
      return;
    }
    const list = new ScrollList(this, LIST_Y, 344, products.length * ROW_H, this.scroll);
    this.list = list;
    products.forEach((product, i) => this.licenceRow(product, i * ROW_H, list));
  }

  private licenceRow(product: Product, y: number, list: ScrollList) {
    const { state } = session;
    const price = product.licence!;
    list.add(this.add.image(12, y + 17, `item_${product.id}`).setScale(ITEM_SCALE));
    list.add(titleLabel(this, 24, y + 6, product.name));
    list.add(tinyLabel(this, 24, y + 18, `SELLS FOR ${formatCents(product.retail)}`, COLOURS.dim));
    list.addButton(button(this, WIDTH - BUTTONS.rowW - 6, y + 2, BUTTONS.rowW, BUTTONS.rowH, formatCents(price), list.guard(() => {
      if (!buyLicence(state, product.id)) return;
      if (session.phase === 'morning') session.save();
      this.render();
      this.celebrate({ kind: 'licence', productId: product.id });
    }, null), COLOURS.button, null)).setEnabled(price <= state.balance);
  }

  // ---- Upgrades -----------------------------------------------------------

  private renderUpgrades() {
    const { state } = session;
    SHELF_ROW_PRICES.forEach((price, i) => {
      const y = LIST_Y + i * ROW_H;
      const rowNumber = i + 2;
      this.track(titleLabel(this, 8, y + 6, `REPAIR SHELF ROW ${rowNumber}`));
      this.track(tinyLabel(this, 8, y + 18, 'ROOM FOR 4 MORE SNACKS', COLOURS.green));
      if (state.rowsOwned >= rowNumber) {
        this.track(label(this, WIDTH - 4 - BUTTONS.rowW / 2, y + 12, 'DONE', COLOURS.dim, 'center'));
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
    const soonY = LIST_Y + SHELF_ROW_PRICES.length * ROW_H + 8;
    this.track(this.add.rectangle(6, soonY - 5, WIDTH - 12, 1, COLOURS.border).setOrigin(0));
    COMING_SOON.forEach(({ name, icon }, i) => {
      const y = soonY + i * ROW_H;
      this.track(this.add.image(16, y + 16, icon).setAlpha(0.55));
      this.track(titleLabel(this, 30, y + 6, name, COLOURS.dim));
      this.track(tinyLabel(this, 30, y + 18, 'COMING SOON', COLOURS.gold));
    });
  }

  // ---- Shared -------------------------------------------------------------

  /** Stops everything while the player enjoys their new unlock. */
  private celebrate(data: CelebrationData) {
    this.scene.launch('Celebration', data);
    this.scene.pause();
    this.scene.pause('Shack');
  }

  private close() {
    this.list?.destroy();
    this.list = null;
    session.modal = false;
    this.scene.stop();
  }
}
