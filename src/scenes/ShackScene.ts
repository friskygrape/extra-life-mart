import Phaser from 'phaser';
import { getProduct } from '../data/products';
import { SHELF_SLOTS, type ShelfSlot } from '../data/shelves';
import { CUSTOMER_LOOKS, PORTRAIT_H, PORTRAIT_W, WINDOW } from '../art/textures';
import { isMuted, sfx, toggleMuted } from '../audio';
import { checkHandOver, requestLines } from '../logic/basket';
import { buildWishlist, chooseCash, nextSpawnDelay } from '../logic/customers';
import { endDay } from '../logic/day';
import { findShelfWith, returnItem, takeFromShelf } from '../logic/inventory';
import { customerTender, formatCents } from '../logic/money';
import { deliverOrders } from '../logic/orders';
import { session } from '../session';
import { Button, COLOURS, WIDTH, button, label } from '../ui';

const SLOT_W = 54;
const SLOT_H = 49;
const SHELF_TOP = 203;
const TABLE_CAPACITY = 5;
const BOX_X = 153;
const BOX_Y = 178;
const CRATE_X = 14;
const CRATE_Y = 368;
const DELIVERY_SECONDS = 3;
const MAX_FLYING_ITEMS = 14;
const MAX_WAITING = 4;
const COMPLAINT = 0xb0352b;
const PORTRAIT_X = 24;
const BUBBLE_X = 103;
const BUBBLE_Y = 26;
const BUBBLE_W = 91;

interface Customer {
  wants: string[];
  look: number;
  paidByCash: boolean;
  /** Keeps their cash the same if you back out of payment and return with the same total. */
  tender?: { total: number; amount: number };
}

interface TableItem {
  productId: string;
  image: Phaser.GameObjects.Image;
}

export class ShackScene extends Phaser.Scene {
  private shutter!: Phaser.GameObjects.Image;
  private portrait!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Rectangle;
  private bubbleLines: { destroy(): void }[] = [];
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
  private stockCount!: Phaser.GameObjects.BitmapText;
  private crate!: Phaser.GameObjects.Image;
  private soundIcon!: Phaser.GameObjects.Image;
  private box: Phaser.GameObjects.Image | null = null;
  private boxOpening = false;
  private deliveryIn = 0;

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

    this.crate = this.add.image(CRATE_X, CRATE_Y, 'crate').setDepth(7).setInteractive({ useHandCursor: true })
      .on('pointerup', () => session.toast(`${this.stockTotal()} ITEMS IN YOUR STOCK`));
    this.stockCount = label(this, CRATE_X, CRATE_Y - 3, '', COLOURS.white, 'center').setDepth(8);
    this.hint = label(this, 28, 354, '').setDepth(7);
    this.hint.setMaxWidth(102);
    this.soundIcon = this.add.image(62, 7, isMuted() ? 'sound_off' : 'sound_on').setDepth(7);
    this.add.rectangle(50, 0, 24, 16, 0xffffff, 0).setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.soundIcon.setTexture(toggleMuted() ? 'sound_off' : 'sound_on');
        sfx.click();
      });
    this.action = button(this, 134, 356, 78, 25, 'OPEN', () => this.pressAction(), COLOURS.accent, null);
    this.action.rect.setDepth(7);
    this.action.text.setDepth(8);

    session.events.on('shelves-changed', this.refreshShelves, this);
    session.events.on('begin-day', this.beginDay, this);
    session.events.on('say', this.say, this);
    session.events.on('order-placed', () => {
      this.deliveryIn = DELIVERY_SECONDS;
    });
    this.beginDay();
  }

  private beginDay() {
    session.phase = 'morning';
    session.clock = 0;
    session.modal = false;
    this.deliveryIn = 1;
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
    this.renderBubble();
  }

  private stockTotal(): number {
    return Object.values(session.state.stockroom).reduce((sum, n) => sum + n, 0);
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
    sfx.pickUp();
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
    sfx.putBack();
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
      this.tweens.add({ targets: item.image, x: 44 + i * 21, y: 180, duration: 140, ease: 'Quad.easeOut' });
    });
    session.table = this.table.map((t) => t.productId);
  }

  // ---- Deliveries ---------------------------------------------------------

  private hasPendingOrder(): boolean {
    return Object.values(session.state.pendingOrders).some((qty) => qty > 0);
  }

  private tickDelivery(dt: number) {
    if (this.box && !this.boxOpening && !this.hasPendingOrder()) {
      this.box.destroy();
      this.box = null;
    }
    if (this.box || !this.hasPendingOrder()) return;
    this.deliveryIn -= dt;
    // Boxes never land mid-sale: they wait until the current customer has been dealt with.
    if (this.deliveryIn <= 0 && !this.current && !session.modal) this.dropBox();
  }

  private dropBox() {
    const box = this.add.image(BOX_X, BOX_Y - 44, 'box_closed').setDepth(9);
    this.box = box;
    box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.openBox());
    this.tweens.add({
      targets: box,
      y: BOX_Y,
      duration: 480,
      ease: 'Bounce.easeOut',
      onUpdate: (tween) => {
        if (tween.progress > 0.35 && !box.getData('landed')) {
          box.setData('landed', true);
          sfx.thud();
        }
      },
    });
    session.toast('DELIVERY! TAP THE BOX');
  }

  private openBox() {
    const box = this.box;
    if (!box || session.modal || this.boxOpening) return;
    this.boxOpening = true;
    this.tweens.killTweensOf(box);
    box.setPosition(BOX_X, BOX_Y).setTexture('box_open').disableInteractive();
    sfx.rip();

    const items = Object.entries(session.state.pendingOrders).flatMap(([id, qty]) => Array.from({ length: qty }, () => id));
    const shown = items.slice(0, MAX_FLYING_ITEMS);
    shown.forEach((id, i) => {
      this.time.delayedCall(180 + i * 90, () => {
        sfx.pop();
        const icon = this.add.image(BOX_X, BOX_Y - 4, `item_${id}`).setDepth(10).setScale(0.5);
        this.tweens.add({
          targets: icon,
          y: BOX_Y - 30,
          x: BOX_X - 6 + (i % 3) * 6,
          scale: 1,
          duration: 180,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: icon,
              x: CRATE_X,
              y: CRATE_Y,
              scale: 0.5,
              duration: 360,
              ease: 'Quad.easeIn',
              onComplete: () => {
                icon.destroy();
                this.tweens.add({ targets: this.crate, scale: 1.2, duration: 50, yoyo: true });
              },
            });
          },
        });
      });
    });

    this.time.delayedCall(180 + shown.length * 90 + 560, () => {
      const delivered = deliverOrders(session.state);
      if (session.phase === 'morning') session.save();
      sfx.stored();
      session.toast(`${delivered} ITEMS ADDED TO STOCK`);
      this.boxOpening = false;
      this.box = null;
      this.tweens.add({ targets: box, alpha: 0, duration: 220, onComplete: () => box.destroy() });
    });
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
    sfx.customer();
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
    requestLines(this.current!.wants, session.table, (id) => findShelfWith(session.state, id) !== null).forEach((line) => {
      const colour = line.done ? 0x2f7d55 : line.soldOut ? 0x9c917b : COLOURS.ink;
      const text = put(y, `${line.qty} ${getProduct(line.productId).name}`, colour);
      if (line.soldOut) {
        // Crossed out, so it's clear the sale will carry on without it.
        const strike = this.add.rectangle(text.x, y + 3, text.width, 1, 0x9c917b).setOrigin(0).setDepth(6);
        this.bubbleLines.push(strike);
      }
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
    if (result.status === 'nothing') {
      session.state.stats.missedSales += result.missed;
      session.toast('THEY LEFT EMPTY-HANDED');
      return this.dismiss();
    }
    const customer = this.current;
    const items = session.table.slice();
    const total = items.reduce((sum, id) => sum + getProduct(id).retail, 0);
    if (customer.tender?.total !== total) customer.tender = { total, amount: customerTender(total) };
    this.openModal('Register', {
      items,
      total,
      paidByCash: customer.paidByCash,
      tendered: customer.paidByCash ? customer.tender.amount : 0,
      onDone: () => {
        session.state.stats.missedSales += result.missed;
        this.clearTable();
        this.dismiss();
        this.floatMoney(total);
      },
      onBack: () => this.say(''),
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
    sfx.shutter();
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
          this.queue.push({
            wants: buildWishlist(session.state.unlocked),
            look: Math.floor(Math.random() * CUSTOMER_LOOKS),
            paidByCash: chooseCash(),
          });
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
    this.tickDelivery(dt);
    session.waiting = this.queue.length;
    this.waitingArt.forEach((img, i) => img.setVisible(i < this.queue.length));
    this.updateHud();
  }

  private updateHud() {
    const { state, phase } = session;
    this.dayText.setText(`DAY ${state.day}`);
    this.clockText.setText(session.clockLabel());
    this.moneyText.setText(formatCents(state.balance));
    this.stockCount.setText(String(this.stockTotal()));

    const showAction = phase === 'morning' || (this.current !== null && !this.busy);
    this.action.setVisible(showAction && phase !== 'summary');
    if (phase === 'morning') this.action.setLabel('OPEN');
    else this.action.setLabel(this.table.length || this.anythingAvailable() ? 'HAND OVER' : 'SAY SORRY');
    this.hint.setText(this.hintText());
  }

  private anythingAvailable(): boolean {
    return (this.current?.wants ?? []).some((id) => findShelfWith(session.state, id) !== null);
  }

  private hintText(): string {
    if (performance.now() < session.messageUntil) return session.message;
    const { state, phase, waiting } = session;
    if (this.box && !this.boxOpening) return 'TAP THE BOX TO UNPACK IT';
    if (phase === 'morning') {
      return state.shelves.some((s) => s.qty > 0) ? 'BUY STOCK OR LICENCES, THEN OPEN' : 'TAP AN EMPTY SHELF TO STOCK IT';
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

