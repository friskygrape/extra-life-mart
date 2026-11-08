import Phaser from 'phaser';
import { ITEM_SCALE } from '../art/textures';
import { sfx } from '../audio';
import { BOX_SIZE, type Product } from '../data/products';
import { TAG_ORDER, TAGS, type TagId } from '../data/tags';
import { SHELF_ROW_PRICES } from '../data/shelves';
import { WEATHER } from '../data/weather';
import { totalInStore } from '../logic/inventory';
import { buyLicence, buyShelfRow, lockedProducts, nextRowPrice, unlockedProducts } from '../logic/licences';
import { formatCents } from '../logic/money';
import { RUSH_FEE, cartCost, placeOrder, rushCost, type Cart } from '../logic/orders';
import { RETRO, bevel, retroButton, retroWindow } from '../retroUi';
import { session } from '../session';
import { ScrollList, WIDTH, backdrop, label, tinyLabel, titleLabel } from '../ui';

import type { CelebrationData } from './CelebrationScene';

export type ComputerPage = 'menu' | 'inventory' | 'order' | 'licences' | 'upgrades';

const TITLES: Record<Exclude<ComputerPage, 'menu'>, string> = {
  inventory: 'INVENTORY',
  order: 'ORDER STOCK',
  licences: 'LICENCES',
  upgrades: 'UPGRADES',
};
const MENU: { page: ComputerPage; text: string; icon: string }[] = [
  { page: 'inventory', text: 'INVENTORY', icon: 'pc_inventory' },
  { page: 'order', text: 'ORDER STOCK', icon: 'pc_order' },
  { page: 'licences', text: 'LICENCES', icon: 'pc_licences' },
  { page: 'upgrades', text: 'UPGRADES', icon: 'pc_upgrades' },
];
const COMING_SOON = [
  { name: 'FREEZER', icon: 'icon_freezer' },
  { name: 'ICE CREAM MACHINE', icon: 'icon_icecream' },
];

/** The main page's window is only as tall as its tiles, on the desktop. */
export const MENU_WINDOW = { y: 56, h: 272 };
export const MENU_TILE = { x: 8, y: MENU_WINDOW.y + 21, w: 98, h: 120, gap: 4 };
const FULL_WINDOW = { y: 2, h: 380 };
export const BACK_BUTTON = { x: 6, y: 20, w: 46, h: 17 };
const CONTENT_Y = 40;
const FIELD_X = 6;
const FIELD_W = WIDTH - 12;
const SCROLL_W = 7;
const ROW_H = 38;
const ORDER_LIST_H = 214;
const ORDER_FOOTER_Y = CONTENT_Y + ORDER_LIST_H + 3;
const HEADER_H = 12;
const INVENTORY_ROW_H = 28;
/** The band naming each kind of snack in a list. */
const HEADING_H = 11;
const INVENTORY_FOOTER_Y = 350;

/** Everything on the shop's computer: a main page, and a page for each thing it does. */
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
    backdrop(this).setFillStyle(RETRO.desktop);
    this.input.keyboard?.on('keydown-ESC', () => (this.page === 'menu' ? this.close() : this.go('menu')));
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

  private render() {
    if (this.list) this.scroll = this.list.scroll;
    this.list?.destroy();
    this.list = null;
    this.content.forEach((o) => o.destroy());
    this.content = [];

    const funds = `YOUR FUNDS ${formatCents(session.state.balance)}`;
    if (this.page === 'menu') {
      this.track(retroWindow(this, MENU_WINDOW.y, MENU_WINDOW.h, funds, () => this.close()));
      this.renderMenu();
      return;
    }
    this.track(retroWindow(this, FULL_WINDOW.y, FULL_WINDOW.h, TITLES[this.page], () => this.close()));
    this.track(retroButton(this, BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h, 'BACK', () => this.go('menu')));
    this.track(label(this, WIDTH - 7, BACK_BUTTON.y + 4, funds, RETRO.ink, 'right'));

    if (this.page === 'inventory') this.renderInventory();
    else if (this.page === 'order') this.renderOrder();
    else if (this.page === 'licences') this.renderLicences();
    else this.renderUpgrades();
  }

  private renderMenu() {
    const { x, y, w, h, gap } = MENU_TILE;
    MENU.forEach(({ page, text, icon }, i) => {
      const tileX = x + (i % 2) * (w + gap);
      const tileY = y + Math.floor(i / 2) * (h + gap);
      const tile = this.track(retroButton(this, tileX, tileY, w, h, '', () => this.go(page)));
      tile.text.setVisible(false);
      this.track(this.add.image(tileX + w / 2, tileY + 48, icon).setScale(2));
      this.track(titleLabel(this, tileX + w / 2, tileY + 95, text, RETRO.ink, 'center'));
    });
  }

  /** A white, sunken list with a blocky scroll bar. */
  /** Where each heading and product goes in a list grouped by kind. */
  private groupRows(groups: { tag: TagId; products: Product[] }[], rowH: number) {
    const headings: { tag: TagId; y: number }[] = [];
    const items: { product: Product; y: number }[] = [];
    let y = 0;
    for (const group of groups) {
      headings.push({ tag: group.tag, y });
      y += HEADING_H;
      for (const product of group.products) {
        items.push({ product, y });
        y += rowH;
      }
    }
    return { headings, items, height: y };
  }

  private addHeadings(list: ScrollList, headings: { tag: TagId; y: number }[]) {
    for (const { tag, y } of headings) {
      list.add(this.add.rectangle(FIELD_X + 2, y, FIELD_W - 12, HEADING_H - 1, RETRO.face).setOrigin(0));
      list.add(this.add.rectangle(FIELD_X + 5, y + 3, 5, 5, TAGS[tag].colour).setOrigin(0));
      list.add(tinyLabel(this, FIELD_X + 13, y + 2, TAGS[tag].heading, RETRO.ink));
    }
  }

  private field(y: number, h: number, contentH: number): ScrollList {
    this.track(bevel(this, FIELD_X, y, FIELD_W, h, false, RETRO.field));
    const list = new ScrollList(this, y + 2, h - 4, contentH, this.scroll, {
      x: FIELD_X + FIELD_W - SCROLL_W - 1,
      w: SCROLL_W,
      thumb: RETRO.shade,
      track: RETRO.face,
    });
    this.list = list;
    return list;
  }

  // ---- Inventory ----------------------------------------------------------

  private renderInventory() {
    const { state } = session;
    const groups = groupByTag(unlockedProducts(state).sort((a, b) => totalInStore(state, b.id) - totalInStore(state, a.id)));
    this.track(bevel(this, FIELD_X, CONTENT_Y, FIELD_W, HEADER_H, true));
    this.track(tinyLabel(this, FIELD_X + 4, CONTENT_Y + 3, 'SNACK', RETRO.ink));
    this.track(tinyLabel(this, WIDTH - 18, CONTENT_Y + 3, 'IN STOCK', RETRO.ink, 'right'));
    const top = CONTENT_Y + HEADER_H;
    const rows = this.groupRows(groups, INVENTORY_ROW_H);
    const list = this.field(top, INVENTORY_FOOTER_Y - top - 3, rows.height);
    this.addHeadings(list, rows.headings);
    rows.items.forEach(({ product, y }) => {
      const count = totalInStore(state, product.id);
      const coming = (state.pendingOrders[product.id] ?? 0) + (state.arrivals[product.id] ?? 0);
      list.add(this.add.image(20, y + 13, `item_${product.id}`).setScale(ITEM_SCALE));
      list.add(titleLabel(this, 36, y + (coming > 0 ? 3 : 8), product.name, count > 0 ? RETRO.ink : RETRO.dim));
      if (coming > 0) list.add(tinyLabel(this, 36, y + 15, `COMING ${coming}`, RETRO.link));
      list.add(label(this, WIDTH - 20, y + 8, String(count), count > 0 ? RETRO.ink : RETRO.dim, 'right'));
      list.add(this.add.rectangle(FIELD_X + 2, y + INVENTORY_ROW_H - 1, FIELD_W - 12, 1, RETRO.face).setOrigin(0));
    });
    this.track(retroButton(this, FIELD_X, INVENTORY_FOOTER_Y, FIELD_W, 26, 'ORDER MORE STOCK', () => this.go('order')));
  }

  // ---- Order stock --------------------------------------------------------

  private renderOrder() {
    const rows = this.groupRows(groupByTag(unlockedProducts(session.state)), ROW_H);
    const list = this.field(CONTENT_Y, ORDER_LIST_H, rows.height);
    this.addHeadings(list, rows.headings);
    rows.items.forEach(({ product, y }) => this.productRow(product, y, list));
    this.renderOrderFooter();
  }

  private productRow(product: Product, y: number, list: ScrollList) {
    const boxes = (this.cart[product.id] ?? 0) / BOX_SIZE;
    const have = session.state.stockroom[product.id] ?? 0;
    const coming = (session.state.pendingOrders[product.id] ?? 0) + (session.state.arrivals[product.id] ?? 0);
    list.add(this.add.image(20, y + 17, `item_${product.id}`).setScale(ITEM_SCALE));
    list.add(titleLabel(this, 34, y + 2, product.name, RETRO.ink));
    list.add(tinyLabel(this, 34, y + 13, `${BOX_SIZE} FOR ${formatCents(product.wholesale * BOX_SIZE)}`, RETRO.good));
    list.add(tinyLabel(this, 34, y + 23, coming > 0 ? `HAVE ${have} COMING ${coming}` : `SELL ${formatCents(product.retail)} HAVE ${have}`, RETRO.dim));
    list.addButton(retroButton(this, 132, y + 5, 24, 24, '-', list.guard(() => this.change(product.id, -BOX_SIZE)), null)).setEnabled(boxes > 0);
    list.add(label(this, 164, y + 13, String(boxes), boxes ? RETRO.ink : RETRO.dim, 'center'));
    list.addButton(retroButton(this, 172, y + 5, 24, 24, '+', list.guard(() => this.change(product.id, BOX_SIZE)), null));
  }

  private renderOrderFooter() {
    const cost = cartCost(this.cart);
    const canAfford = cost <= session.state.balance;
    const rush = rushCost(this.cart);
    const y = ORDER_FOOTER_Y;
    this.track(label(this, FIELD_X, y + 1, `TOMORROW: ${WEATHER[session.state.forecast].short}`, RETRO.ink));
    this.track(label(this, WIDTH - FIELD_X, y + 1, formatCents(cost), canAfford ? RETRO.ink : RETRO.bad, 'right'));
    const place = this.track(retroButton(this, FIELD_X, y + 13, FIELD_W, 30, 'ORDER FOR TOMORROW: FREE', () => this.submit(false), null));
    place.setEnabled(cost > 0 && canAfford);
    const rushNow = this.track(retroButton(this, FIELD_X, y + 46, FIELD_W, 30, `RUSH TODAY: +${formatCents(RUSH_FEE)}`, () => this.submit(true)));
    rushNow.setEnabled(cost > 0 && rush <= session.state.balance);
    const note = !canAfford ? 'NOT ENOUGH MONEY' : this.notice || `EACH + IS A BOX OF ${BOX_SIZE}`;
    this.track(label(this, WIDTH / 2, y + 84, note, !canAfford ? RETRO.bad : this.notice ? RETRO.good : RETRO.dim, 'center'));
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
      this.track(bevel(this, FIELD_X, CONTENT_Y, FIELD_W, 336, false, RETRO.field));
      this.track(label(this, WIDTH / 2, 150, 'YOU OWN EVERY LICENCE!', RETRO.good, 'center'));
      return;
    }
    const list = this.field(CONTENT_Y, 336, products.length * ROW_H);
    products.forEach((product, i) => this.licenceRow(product, i * ROW_H, list));
  }

  private licenceRow(product: Product, y: number, list: ScrollList) {
    const { state } = session;
    const price = product.licence!;
    list.add(this.add.image(20, y + 17, `item_${product.id}`).setScale(ITEM_SCALE));
    list.add(titleLabel(this, 34, y + 6, product.name, RETRO.ink));
    list.add(tinyLabel(this, 34, y + 18, `SELLS FOR ${formatCents(product.retail)}`, RETRO.dim));
    list.addButton(retroButton(this, 136, y + 5, 60, 26, formatCents(price), list.guard(() => {
      if (!buyLicence(state, product.id)) return;
      if (session.phase === 'morning') session.save();
      this.render();
      this.celebrate({ kind: 'licence', productId: product.id });
    }, null), null)).setEnabled(price <= state.balance);
  }

  // ---- Upgrades -----------------------------------------------------------

  private renderUpgrades() {
    const { state } = session;
    this.track(bevel(this, FIELD_X, CONTENT_Y, FIELD_W, 336, false, RETRO.field));
    SHELF_ROW_PRICES.forEach((price, i) => {
      const y = CONTENT_Y + 3 + i * ROW_H;
      const rowNumber = i + 2;
      this.track(titleLabel(this, FIELD_X + 5, y + 6, `REPAIR SHELF ROW ${rowNumber}`, RETRO.ink));
      this.track(tinyLabel(this, FIELD_X + 5, y + 18, 'ROOM FOR 4 MORE SNACKS', RETRO.good));
      if (state.rowsOwned >= rowNumber) {
        this.track(label(this, WIDTH - 39, y + 12, 'DONE', RETRO.dim, 'center'));
        return;
      }
      const isNext = nextRowPrice(state) === price;
      this.track(retroButton(this, WIDTH - 70, y + 3, 60, 28, formatCents(price), () => {
        if (!buyShelfRow(state)) return;
        if (session.phase === 'morning') session.save();
        session.events.emit('shelves-changed');
        this.render();
        this.celebrate({ kind: 'shelves', row: rowNumber });
      }, null)).setEnabled(isNext && price <= state.balance);
    });
    const soonY = CONTENT_Y + 3 + SHELF_ROW_PRICES.length * ROW_H + 6;
    this.track(this.add.rectangle(FIELD_X + 4, soonY - 4, FIELD_W - 8, 1, RETRO.shade).setOrigin(0));
    COMING_SOON.forEach(({ name, icon }, i) => {
      const y = soonY + i * ROW_H;
      this.track(this.add.image(FIELD_X + 14, y + 16, icon).setAlpha(0.7));
      this.track(titleLabel(this, FIELD_X + 28, y + 6, name, RETRO.dim));
      this.track(tinyLabel(this, FIELD_X + 28, y + 18, 'COMING SOON', RETRO.link));
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

/** Products under their kinds, in the usual order of kinds, keeping the order they came in within each. */
function groupByTag(products: Product[]): { tag: TagId; products: Product[] }[] {
  return TAG_ORDER.map((tag) => ({ tag, products: products.filter((p) => p.tag === tag) })).filter((g) => g.products.length > 0);
}
