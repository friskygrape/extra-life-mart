import Phaser from 'phaser';
import { ITEM_SCALE } from '../art/textures';
import { sfx } from '../audio';
import { boxSize, type Product } from '../data/products';
import { TAG_ORDER, TAGS, type TagId } from '../data/tags';
import { SHELF_ROW_PRICES } from '../data/shelves';
import { APPLIANCES } from '../data/appliances';
import { buyAppliance, owns } from '../logic/appliances';
import { WEATHER } from '../data/weather';
import { totalInStore } from '../logic/inventory';
import { buyLicence, buyShelfRow, lockedProducts, nextRowPrice, orderableProducts } from '../logic/licences';
import { formatCents } from '../logic/money';
import { RUSH_FEE, cartCost, placeOrder, rushCost, type Cart } from '../logic/orders';
import { RETRO, TITLE_H, bevel, retroButton, retroWindow } from '../retroUi';
import { L } from '../layout';
import { session } from '../session';
import { ScrollList, backdrop, label, tinyLabel, titleLabel } from '../ui';

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

// The computer fills the whole screen, so its layout follows the screen's size.
/** Windows sit 20 screen pixels in from every edge of the screen, whatever its size. */
const SCREEN_PADDING = 20;
const margin = () => Math.max(2, Math.round(SCREEN_PADDING / L.zoom));
const windowH = () => L.H - margin() * 2;
const windowW = () => L.W - margin() * 2;
/** Just under the title bar. */
const belowTitle = () => margin() + 3 + TITLE_H;
const backButton = () => ({ x: fieldX(), y: belowTitle() + 3, w: 46, h: 17 });
const contentY = () => backButton().y + backButton().h + 4;
/** The left edge of the lists and buttons, inside the window's frame. */
const fieldX = () => margin() + 4;
/** How far the lists have moved from where their rows were first laid out, at the screen's left edge. */
const rowX = (x: number) => x + fieldX() - 6;
const fieldW = () => L.W - fieldX() * 2;
/** The right edge of the lists and buttons. */
const fieldRight = () => fieldX() + fieldW();
/** The bottom of the space inside a full window. */
const contentBottom = () => margin() + windowH() - 6;
/** The order page's footer: forecast and cost, two order buttons and a note. */
const ORDER_FOOTER_H = 96;
const orderFooterY = () => contentBottom() - ORDER_FOOTER_H;
const INVENTORY_BUTTON_H = 26;
const inventoryFooterY = () => contentBottom() - INVENTORY_BUTTON_H;
const MENU_GAP = 4;
const SCROLL_W = 7;
const ROW_H = 38;
const HEADER_H = 12;
const INVENTORY_ROW_H = 28;
/** The band naming each kind of snack in a list. */
const HEADING_H = 11;

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
    backdrop(this, true).setFillStyle(RETRO.desktop);
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
      this.track(retroWindow(this, margin(), windowH(), funds, () => this.close(), windowW(), margin()));
      this.renderMenu();
      return;
    }
    this.track(retroWindow(this, margin(), windowH(), TITLES[this.page], () => this.close(), windowW(), margin()));
    const back = backButton();
    this.track(retroButton(this, back.x, back.y, back.w, back.h, 'BACK', () => this.go('menu')));
    this.track(label(this, fieldRight() - 1, back.y + 4, funds, RETRO.ink, 'right'));

    if (this.page === 'inventory') this.renderInventory();
    else if (this.page === 'order') this.renderOrder();
    else if (this.page === 'licences') this.renderLicences();
    else this.renderUpgrades();
  }

  private renderMenu() {
    // Four tiles share everything inside the window.
    const x = fieldX() + 2;
    const y = belowTitle() + 4;
    const w = Math.floor((fieldW() - 4 - MENU_GAP) / 2);
    const h = Math.floor((contentBottom() - y - MENU_GAP) / 2);
    // Icons at whole sizes keep their pixels even; three times when the tiles have room.
    const iconScale = 32 * 3 <= Math.min(w - 12, h - 40) ? 3 : 2;
    MENU.forEach(({ page, text, icon }, i) => {
      const tileX = x + (i % 2) * (w + MENU_GAP);
      const tileY = y + Math.floor(i / 2) * (h + MENU_GAP);
      const tile = this.track(retroButton(this, tileX, tileY, w, h, '', () => this.go(page)));
      tile.text.setVisible(false);
      // The icon and its name, centred together in the tile
      const iconH = 32 * iconScale;
      const blockTop = tileY + Math.floor((h - iconH - 18) / 2);
      this.track(this.add.image(tileX + w / 2, blockTop + iconH / 2, icon).setScale(iconScale));
      this.track(titleLabel(this, tileX + w / 2, blockTop + iconH + 9, text, RETRO.ink, 'center'));
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
      list.add(this.add.rectangle(fieldX() + 2, y, fieldW() - 12, HEADING_H - 1, RETRO.face).setOrigin(0));
      list.add(this.add.rectangle(fieldX() + 5, y + 3, 5, 5, TAGS[tag].colour).setOrigin(0));
      list.add(tinyLabel(this, fieldX() + 13, y + 2, TAGS[tag].heading, RETRO.ink));
    }
  }

  private field(y: number, h: number, contentH: number): ScrollList {
    this.track(bevel(this, fieldX(), y, fieldW(), h, false, RETRO.field));
    const list = new ScrollList(this, y + 2, h - 4, contentH, this.scroll, {
      x: fieldRight() - SCROLL_W - 1,
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
    const groups = groupByTag(orderableProducts(state).sort((a, b) => totalInStore(state, b.id) - totalInStore(state, a.id)));
    this.track(bevel(this, fieldX(), contentY(), fieldW(), HEADER_H, true));
    this.track(tinyLabel(this, fieldX() + 4, contentY() + 3, 'SNACK', RETRO.ink));
    this.track(tinyLabel(this, fieldRight() - 12, contentY() + 3, 'IN STOCK', RETRO.ink, 'right'));
    const top = contentY() + HEADER_H;
    const rows = this.groupRows(groups, INVENTORY_ROW_H);
    const list = this.field(top, inventoryFooterY() - top - 3, rows.height);
    this.addHeadings(list, rows.headings);
    rows.items.forEach(({ product, y }) => {
      const count = totalInStore(state, product.id);
      const coming = (state.pendingOrders[product.id] ?? 0) + (state.arrivals[product.id] ?? 0);
      list.add(this.add.image(rowX(20), y + 13, `item_${product.id}`).setScale(ITEM_SCALE));
      list.add(titleLabel(this, rowX(36), y + (coming > 0 ? 3 : 8), product.name, count > 0 ? RETRO.ink : RETRO.dim));
      if (coming > 0) list.add(tinyLabel(this, rowX(36), y + 15, `COMING ${coming}`, RETRO.link));
      list.add(label(this, fieldRight() - 14, y + 8, String(count), count > 0 ? RETRO.ink : RETRO.dim, 'right'));
      list.add(this.add.rectangle(fieldX() + 2, y + INVENTORY_ROW_H - 1, fieldW() - 12, 1, RETRO.face).setOrigin(0));
    });
    this.track(retroButton(this, fieldX(), inventoryFooterY(), fieldW(), INVENTORY_BUTTON_H, 'ORDER MORE STOCK', () => this.go('order')));
  }

  // ---- Order stock --------------------------------------------------------

  private renderOrder() {
    const rows = this.groupRows(groupByTag(orderableProducts(session.state)), ROW_H);
    const list = this.field(contentY(), orderFooterY() - contentY() - 3, rows.height);
    this.addHeadings(list, rows.headings);
    rows.items.forEach(({ product, y }) => this.productRow(product, y, list));
    this.renderOrderFooter();
  }

  private productRow(product: Product, y: number, list: ScrollList) {
    const box = boxSize(product.id);
    const boxes = (this.cart[product.id] ?? 0) / box;
    const have = session.state.stockroom[product.id] ?? 0;
    const coming = (session.state.pendingOrders[product.id] ?? 0) + (session.state.arrivals[product.id] ?? 0);
    list.add(this.add.image(rowX(20), y + 17, `item_${product.id}`).setScale(ITEM_SCALE));
    list.add(titleLabel(this, rowX(34), y + 2, product.name, RETRO.ink));
    list.add(tinyLabel(this, rowX(34), y + 13, `${box} FOR ${formatCents(product.wholesale * box)}`, RETRO.good));
    list.add(tinyLabel(this, rowX(34), y + 23, coming > 0 ? `HAVE ${have} COMING ${coming}` : product.kind === 'ingredient' ? `HAVE ${have}` : `SELL ${formatCents(product.retail)} HAVE ${have}`, RETRO.dim));
    const right = fieldRight();
    list.addButton(retroButton(this, right - 74, y + 5, 24, 24, '-', list.guard(() => this.change(product.id, -box)), null)).setEnabled(boxes > 0);
    list.add(label(this, right - 42, y + 13, String(boxes), boxes ? RETRO.ink : RETRO.dim, 'center'));
    list.addButton(retroButton(this, right - 34, y + 5, 24, 24, '+', list.guard(() => this.change(product.id, box)), null));
  }

  private renderOrderFooter() {
    const cost = cartCost(this.cart);
    const canAfford = cost <= session.state.balance;
    const rush = rushCost(this.cart);
    const y = orderFooterY();
    this.track(label(this, fieldX(), y + 1, `TOMORROW: ${WEATHER[session.state.forecast].short}`, RETRO.ink));
    this.track(label(this, fieldRight(), y + 1, formatCents(cost), canAfford ? RETRO.ink : RETRO.bad, 'right'));
    const place = this.track(retroButton(this, fieldX(), y + 13, fieldW(), 30, 'ORDER FOR TOMORROW: FREE', () => this.submit(false), null));
    place.setEnabled(cost > 0 && canAfford);
    const rushNow = this.track(retroButton(this, fieldX(), y + 46, fieldW(), 30, `RUSH TODAY: +${formatCents(RUSH_FEE)}`, () => this.submit(true)));
    rushNow.setEnabled(cost > 0 && rush <= session.state.balance);
    const note = !canAfford ? 'NOT ENOUGH MONEY' : this.notice || 'EACH + IS ONE BOX';
    this.track(label(this, L.W / 2, y + 84, note, !canAfford ? RETRO.bad : this.notice ? RETRO.good : RETRO.dim, 'center'));
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
      this.track(bevel(this, fieldX(), contentY(), fieldW(), contentBottom() - contentY(), false, RETRO.field));
      this.track(label(this, L.W / 2, 150, 'YOU OWN EVERY LICENCE!', RETRO.good, 'center'));
      return;
    }
    const list = this.field(contentY(), contentBottom() - contentY(), products.length * ROW_H);
    products.forEach((product, i) => this.licenceRow(product, i * ROW_H, list));
  }

  private licenceRow(product: Product, y: number, list: ScrollList) {
    const { state } = session;
    const price = product.licence!;
    list.add(this.add.image(rowX(20), y + 17, `item_${product.id}`).setScale(ITEM_SCALE));
    list.add(titleLabel(this, rowX(34), y + 6, product.name, RETRO.ink));
    list.add(tinyLabel(this, rowX(34), y + 18, `SELLS FOR ${formatCents(product.retail)}`, RETRO.dim));
    list.addButton(retroButton(this, fieldRight() - 74, y + 5, 60, 26, formatCents(price), list.guard(() => {
      if (!buyLicence(state, product.id)) return;
      if (session.phase === 'morning') session.save();
      this.render();
      this.celebrate({ kind: 'licence', productId: product.id });
    }, null), null)).setEnabled(price <= state.balance);
  }

  // ---- Upgrades -----------------------------------------------------------

  private renderUpgrades() {
    const { state } = session;
    this.track(bevel(this, fieldX(), contentY(), fieldW(), contentBottom() - contentY(), false, RETRO.field));
    SHELF_ROW_PRICES.forEach((price, i) => {
      const y = contentY() + 3 + i * ROW_H;
      const rowNumber = i + 2;
      this.track(titleLabel(this, fieldX() + 5, y + 6, `REPAIR SHELF ROW ${rowNumber}`, RETRO.ink));
      this.track(tinyLabel(this, fieldX() + 5, y + 18, 'ROOM FOR 4 MORE SNACKS', RETRO.good));
      if (state.rowsOwned >= rowNumber) {
        this.track(label(this, fieldRight() - 33, y + 12, 'DONE', RETRO.dim, 'center'));
        return;
      }
      const isNext = nextRowPrice(state) === price;
      this.track(retroButton(this, fieldRight() - 64, y + 3, 60, 28, formatCents(price), () => {
        if (!buyShelfRow(state)) return;
        if (session.phase === 'morning') session.save();
        session.events.emit('shelves-changed');
        this.render();
        this.celebrate({ kind: 'shelves', row: rowNumber });
      }, null)).setEnabled(isNext && price <= state.balance);
    });
    // The appliances for the bottom row
    const applianceY = contentY() + 3 + SHELF_ROW_PRICES.length * ROW_H + 6;
    this.track(this.add.rectangle(fieldX() + 4, applianceY - 4, fieldW() - 8, 1, RETRO.shade).setOrigin(0));
    APPLIANCES.forEach((appliance, i) => {
      const y = applianceY + i * ROW_H;
      this.track(titleLabel(this, fieldX() + 5, y + 6, appliance.name, RETRO.ink));
      this.track(tinyLabel(this, fieldX() + 5, y + 18, appliance.blurb, RETRO.good));
      if (owns(state, appliance.id)) {
        this.track(label(this, fieldRight() - 33, y + 12, 'OWNED', RETRO.dim, 'center'));
        return;
      }
      this.track(retroButton(this, fieldRight() - 64, y + 3, 60, 28, formatCents(appliance.price), () => {
        if (!buyAppliance(state, appliance.id)) return;
        if (session.phase === 'morning') session.save();
        this.render();
        this.celebrate({ kind: 'appliance', applianceId: appliance.id });
      }, null)).setEnabled(appliance.price <= state.balance);
    });
    const soonY = applianceY + APPLIANCES.length * ROW_H + 6;
    this.track(this.add.rectangle(fieldX() + 4, soonY - 4, fieldW() - 8, 1, RETRO.shade).setOrigin(0));
    COMING_SOON.forEach(({ name, icon }, i) => {
      const y = soonY + i * ROW_H;
      this.track(this.add.image(fieldX() + 14, y + 16, icon).setAlpha(0.7));
      this.track(titleLabel(this, fieldX() + 28, y + 6, name, RETRO.dim));
      this.track(tinyLabel(this, fieldX() + 28, y + 18, 'COMING SOON', RETRO.link));
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
