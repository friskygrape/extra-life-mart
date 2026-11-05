import Phaser from 'phaser';
import { getProduct } from '../data/products';
import { SHELF_SLOTS, type ShelfSlot } from '../data/shelves';
import { CUSTOMER_LOOKS, PORTRAIT_H, PORTRAIT_W, WINDOW } from '../art/textures';
import { checkHandOver, requestLines } from '../logic/basket';
import { buildWishlist, nextSpawnDelay } from '../logic/customers';
import { endDay } from '../logic/day';
import { findShelfWith, returnItem, takeFromShelf } from '../logic/inventory';
import { formatCents } from '../logic/money';
import { session } from '../session';
import { Button, COLOURS, WIDTH, button, label } from '../ui';

const SLOT_W = 54;
const SLOT_H = 49;
const SHELF_TOP = 203;
const TABLE_CAPACITY = 6;
const MAX_WAITING = 4;
const COMPLAINT = 0xb0352b;
const PORTRAIT_X = 24;
const BUBBLE_X = 103;
const BUBBLE_Y = 26;
const BUBBLE_W = 91;

interface Customer {
  wants: string[];
  look: number;
}

interface TableItem {
  productId: string;
  image: Phaser.GameObjects.Image;
}

export class ShackScene extends Phaser.Scene {
  private shutter!: Phaser.GameObjects.Image;
  private portrait!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Rectangle;
  private bubbleLines: Phaser.GameObjects.BitmapText[] = [];
  private bubbleTail!: Phaser.GameObjects.Triangle;
  private closedSign!: Phaser.GameObjects.BitmapText;
  private spoken = '';
  private spokenColour: number = COLOURS.ink;
  private slotArt = new Map<string, Phaser.GameObjects.GameObject[]>();
  private waitingArt: Phaser.GameObjects.Image[] = [];
  private table: TableItem[] = [];
  private queue: Customer[] = [];
  private current: Customer | null = null;
  private busy = false;
  private spawnIn = 0;
  private dayText!: Phaser.GameObjects.BitmapText;
  private clockText!: Phaser.GameObjects.BitmapText;
  private moneyText!: Phaser.GameObjects.BitmapText;
  private hint!: Phaser.GameObjects.BitmapText;
  private action!: Button;

  constructor() {
    super('Shack');
  }

  create() {
    this.add.image(WINDOW.x, WINDOW.y, 'street').setOrigin(0).setDepth(0);
    this.waitingArt = [0, 1, 2, 3].map((i) =>
      this.add.image(150 - i * 18, 84 + (i % 2) * 2, 'waiting').setOrigin(0).setDepth(1).setVisible(false),
    );
    this.portrait = this.add.image(-PORTRAIT_W, WINDOW.y + WINDOW.h - PORTRAIT_H, 'cust_0').setOrigin(0).setDepth(2);
    this.shutter = this.add.image(WINDOW.x, WINDOW.y, 'shutter').setOrigin(0).setDepth(3);
    this.add.image(0, 0, 'shack').setOrigin(0).setDepth(4);
    this.closedSign = label(this, WINDOW.x + WINDOW.w / 2, 80, 'CLOSED', COLOURS.white, 'center').setDepth(3.5);
    this.bubble = this.add.rectangle(BUBBLE_X, BUBBLE_Y, BUBBLE_W, 40, COLOURS.paper).setOrigin(0).setStrokeStyle(1, COLOURS.ink).setDepth(5).setVisible(false);
    this.bubbleTail = this.add.triangle(0, 0, 0, 0, 0, 8, -7, 8, COLOURS.paper).setOrigin(0).setDepth(5).setVisible(false);

    this.add.rectangle(0, 0, WIDTH, 15, COLOURS.bg).setOrigin(0).setDepth(6);
    this.dayText = label(this, 4, 4, '').setDepth(7);
    this.clockText = label(this, WIDTH / 2, 4, '', COLOURS.dim, 'center').setDepth(7);
    this.moneyText = label(this, WIDTH - 4, 4, '', COLOURS.gold, 'right').setDepth(7);
    label(this, 190, 172, 'BUY', COLOURS.green, 'center').setDepth(7);
    this.add.rectangle(168, 163, 46, 33, 0xffffff, 0).setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.openModal('Order'));

    SHELF_SLOTS.forEach((slot) => {
      this.add.rectangle(slot.col * SLOT_W, SHELF_TOP + slot.row * SLOT_H, SLOT_W, SLOT_H, 0xffffff, 0)
        .setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.tapSlot(slot));
    });

    this.hint = label(this, 5, 358, '').setDepth(7);
    this.hint.setMaxWidth(126);
    this.action = button(this, 134, 356, 78, 25, 'OPEN', () => this.pressAction(), COLOURS.accent);
    this.action.rect.setDepth(7);
    this.action.text.setDepth(8);

    session.events.on('shelves-changed', this.refreshShelves, this);
    session.events.on('begin-day', this.beginDay, this);
    session.events.on('say', this.say, this);
    this.beginDay();
  }

  private beginDay() {
    session.phase = 'morning';
    session.clock = 0;
    session.modal = false;
    this.queue = [];
    this.current = null;
    this.busy = false;
    this.clearTable();
    this.shutter.setY(WINDOW.y);
    this.closedSign.setVisible(true).setY(80);
    this.renderBubble();
    this.refreshShelves();
  }

  private refreshShelves() {
    for (const shelf of session.state.shelves) {
      const slot = SHELF_SLOTS.find((s) => s.id === shelf.id)!;
      this.slotArt.get(shelf.id)?.forEach((o) => o.destroy());
      const art: Phaser.GameObjects.GameObject[] = [];
      const x = slot.col * SLOT_W;
      const y = SHELF_TOP + slot.row * SLOT_H;
      const ink = COLOURS.ink;
      if (shelf.productId && shelf.qty > 0) {
        const shown = Math.min(shelf.qty, 6);
        for (let i = 0; i < shown; i++) {
          const ix = x + 3 + (i % 3) * 16;
          const iy = y + 21 - Math.floor(i / 3) * 16;
          art.push(this.add.image(ix, iy, `item_${shelf.productId}`).setOrigin(0).setDepth(5 + (i < 3 ? 0.2 : 0.1)));
        }
        art.push(label(this, x + 3, y + 40, getProduct(shelf.productId).short, ink).setDepth(6));
        art.push(label(this, x + SLOT_W - 3, y + 40, String(shelf.qty), ink, 'right').setDepth(6));
      } else {
        art.push(label(this, x + SLOT_W / 2, y + 40, 'EMPTY', 0x4f483c, 'center').setDepth(6));
        art.push(label(this, x + SLOT_W / 2, y + 16, '+', COLOURS.dim, 'center').setDepth(6).setAlpha(0.6));
      }
      this.slotArt.set(shelf.id, art);
    }
  }

  // ---- Shelves and table --------------------------------------------------

  private tapSlot(slot: ShelfSlot) {
    if (session.modal) return;
    const shelf = session.state.shelves.find((s) => s.id === slot.id)!;
    const serving = this.current && !this.busy;
    if (shelf.qty > 0 && serving) return this.moveToTable(slot, shelf.productId!);
    this.openModal('Stock', { shelfId: slot.id });
  }

  private moveToTable(slot: ShelfSlot, productId: string) {
    if (this.table.length >= TABLE_CAPACITY) {
      session.toast('THE TABLE IS FULL');
      return;
    }
    if (!takeFromShelf(session.state, slot.id, productId)) return;
    this.spoken = '';
    const from = { x: slot.col * SLOT_W + SLOT_W / 2, y: SHELF_TOP + slot.row * SLOT_H + 20 };
    const image = this.add.image(from.x, from.y, `item_${productId}`).setDepth(9);
    const item: TableItem = { productId, image };
    this.table.push(item);
    image.setInteractive({ useHandCursor: true }).on('pointerup', () => this.takeBack(item));
    this.layoutTable();
    this.refreshShelves();
    this.renderBubble();
  }

  private takeBack(item: TableItem) {
    if (session.modal) return;
    this.table = this.table.filter((other) => other !== item);
    item.image.destroy();
    returnItem(session.state, item.productId);
    this.spoken = '';
    this.layoutTable();
    this.refreshShelves();
    this.renderBubble();
  }

  private layoutTable() {
    this.table.forEach((item, i) => {
      this.tweens.killTweensOf(item.image);
      this.tweens.add({ targets: item.image, x: 44 + i * 23, y: 180, duration: 140, ease: 'Quad.easeOut' });
    });
    session.table = this.table.map((t) => t.productId);
  }

  private clearTable() {
    this.table.forEach((t) => t.image.destroy());
    this.table = [];
    session.table = [];
  }

  // ---- Customers ----------------------------------------------------------

  private callNext() {
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    this.busy = true;
    this.spoken = '';
    session.wants = next.wants;
    this.portrait.setTexture(`cust_${next.look}`).setX(-PORTRAIT_W);
    this.tweens.add({
      targets: this.portrait,
      x: PORTRAIT_X,
      duration: 450,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.busy = false;
        this.renderBubble();
      },
    });
  }

  private dismiss() {
    this.current = null;
    session.wants = null;
    this.busy = true;
    this.spoken = '';
    this.renderBubble();
    this.tweens.add({
      targets: this.portrait,
      x: WIDTH,
      duration: 400,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.busy = false;
      },
    });
  }

  private say(text: string, colour: number = COLOURS.ink) {
    this.spoken = text;
    this.spokenColour = colour;
    this.renderBubble();
  }

  private renderBubble() {
    this.bubbleLines.forEach((t) => t.destroy());
    this.bubbleLines = [];
    const visible = this.current !== null && !this.busy;
    this.bubble.setVisible(visible);
    this.bubbleTail.setVisible(visible);
    if (!visible) return;
    const put = (y: number, text: string, color: number) => {
      const t = label(this, BUBBLE_X + 3, y, text, color).setDepth(6);
      this.bubbleLines.push(t);
      return t;
    };
    let y = BUBBLE_Y + 4;
    requestLines(this.current!.wants, session.table).forEach((line) => {
      put(y, `${line.qty} ${getProduct(line.productId).name}`, line.done ? 0x2f7d55 : COLOURS.ink);
      y += 10;
    });
    if (this.spoken) {
      y += 2;
      y += put(y, this.spoken, this.spokenColour).setMaxWidth(BUBBLE_W - 6).height + 1;
    }
    const bottom = y + 2;
    this.bubble.setSize(BUBBLE_W, bottom - BUBBLE_Y);
    this.bubbleTail.setPosition(BUBBLE_X + 1, bottom - 1);
  }

  private pressAction() {
    if (session.modal) return;
    if (session.phase === 'morning') return this.openShop();
    if (!this.current || this.busy) return;

    const wants = this.current.wants;
    const result = checkHandOver(wants, session.table, (id) => findShelfWith(session.state, id) !== null);
    if (result.status === 'extra') {
      return this.say(`NO ${getProduct(result.productId).short} FOR ME`, COMPLAINT);
    }
    if (result.status === 'still-on-shelf') {
      return this.say(`I SEE ${getProduct(result.productId).short} THERE!`, COMPLAINT);
    }
    session.state.stats.missedSales += result.missed;
    if (result.status === 'nothing') {
      session.toast('THEY LEFT EMPTY-HANDED');
      return this.dismiss();
    }
    this.openModal('Register', {
      items: session.table.slice(),
      onDone: (total: number) => {
        this.clearTable();
        this.dismiss();
        this.floatMoney(total);
      },
    });
  }

  private floatMoney(total: number) {
    const t = label(this, 84, 180, `+${formatCents(total)}`, COLOURS.green, 'center').setDepth(9);
    this.tweens.add({ targets: t, y: 165, alpha: 0, duration: 1100, delay: 300, onComplete: () => t.destroy() });
  }

  private openShop() {
    session.phase = 'open';
    session.clock = 0;
    session.save();
    this.spawnIn = 1;
    session.toast("WE'RE OPEN!");
    this.closedSign.setVisible(false);
    this.tweens.add({ targets: this.shutter, y: WINDOW.y - WINDOW.h, duration: 600, ease: 'Quad.easeIn' });
  }

  private openModal(scene: string, data?: object) {
    if (session.modal || session.phase === 'summary') return;
    session.modal = true;
    this.scene.launch(scene, data);
  }

  // ---- Frame update -------------------------------------------------------

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 100) / 1000;

    if (session.phase === 'open') {
      session.clock += dt;
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        if (this.queue.length < MAX_WAITING) {
          this.queue.push({ wants: buildWishlist(), look: Math.floor(Math.random() * CUSTOMER_LOOKS) });
        }
        this.spawnIn = nextSpawnDelay(session.state.day);
      }
      if (session.clock >= session.dayLength) {
        session.phase = 'closing';
        session.toast('CLOSING TIME!');
      }
    }
    if (session.phase === 'open' || session.phase === 'closing') {
      if (!this.current && !this.busy && !session.modal && this.queue.length > 0) this.callNext();
      if (session.phase === 'closing' && !this.current && !this.busy && !session.modal && this.queue.length === 0) {
        this.closeBooks();
      }
    }
    session.waiting = this.queue.length;
    this.waitingArt.forEach((img, i) => img.setVisible(i < this.queue.length));
    this.updateHud();
  }

  private updateHud() {
    const { state, phase } = session;
    this.dayText.setText(`DAY ${state.day}`);
    this.clockText.setText(session.clockLabel());
    this.moneyText.setText(formatCents(state.balance));

    const showAction = phase === 'morning' || (this.current !== null && !this.busy);
    this.action.setVisible(showAction && phase !== 'summary');
    if (phase === 'morning') this.action.setLabel('OPEN');
    else this.action.setLabel(this.table.length ? 'HAND OVER' : 'SAY SORRY');
    this.hint.setText(this.hintText());
  }

  private hintText(): string {
    if (performance.now() < session.messageUntil) return session.message;
    const { state, phase, waiting } = session;
    if (phase === 'morning') {
      return state.shelves.some((s) => s.qty > 0) ? 'BUY MORE AT THE TERMINAL, THEN OPEN' : 'TAP AN EMPTY SHELF TO STOCK IT';
    }
    if (this.current) return this.table.length ? 'ALL THERE? HAND IT OVER' : 'TAP SHELVES TO FETCH ITEMS';
    if (phase === 'closing') return waiting ? 'LAST CUSTOMERS' : 'CLOSING UP';
    return 'TAP SHELVES TO RESTOCK';
  }

  private closeBooks() {
    session.phase = 'summary';
    const events = endDay(session.state);
    session.save();
    session.modal = true;
    this.scene.launch('Summary', events);
  }
}

