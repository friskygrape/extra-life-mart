import Phaser from 'phaser';
import { getProduct } from '../data/products';
import { SHELF_ROWS, SHELF_SLOTS, type ShelfSlot } from '../data/shelves';
import { CUSTOMER_LOOKS, WINDOW } from '../art/textures';
import { isMuted, sfx, toggleMuted } from '../audio';
import { canAddToTable, isOrderComplete, requestLines } from '../logic/basket';
import { buildRequest, chooseCash, nextSpawnDelay } from '../logic/customers';
import { endDay } from '../logic/day';
import { anyShelfStocked, returnItem, takeFromShelf } from '../logic/inventory';
import { nextRowPrice } from '../logic/licences';
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
const PORTRAIT_X = 70;
const PORTRAIT_OFFSCREEN = 80;
const BUBBLE_X = 103;
const BUBBLE_Y = 32;
const BUBBLE_W = 91;
/** A short beat after the last item lands, so you can see the order complete. */
const PAYMENT_DELAY_MS = 350;
const EMPTY_HANDED_MS = 1900;

/** Someone in line. What they want is decided when they reach the window. */
interface Waiting {
  look: number;
  paidByCash: boolean;
}

interface Customer extends Waiting {
  wants: string[];
  wished: string[];
  /** Keeps their cash the same if you back out of payment and return with the same total. */
  tender?: { total: number; amount: number };
}

interface TableItem {
  productId: string;
  image: Phaser.GameObjects.Image;
}

export class ShackScene extends Phaser.Scene {
  private shutter!: Phaser.GameObjects.Image;
  private closedSign!: Phaser.GameObjects.BitmapText;
  private portrait!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Rectangle;
  private bubbleTail!: Phaser.GameObjects.Triangle;
  private bubbleLines: { destroy(): void }[] = [];
  private spoken = '';
  private spokenColour: number = COLOURS.ink;
  private slotArt = new Map<string, Phaser.GameObjects.GameObject[]>();
  private rowArt: Phaser.GameObjects.GameObject[] = [];
  private waitingArt: Phaser.GameObjects.Image[] = [];
  private table: TableItem[] = [];
  private queue: Waiting[] = [];
  private current: Customer | null = null;
  private busy = false;
  private readyToPay = false;
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
    this.add.image(WINDOW.x, WINDOW.y, 'beach').setOrigin(0).setDepth(0);
    this.waitingArt = [0, 1, 2, 3].map((i) =>
      this.add.image(172 - i * 13, 104 + (i % 2) * 3, 'waiting').setOrigin(0).setDepth(1).setVisible(false),
    );
    this.portrait = this.add.image(-PORTRAIT_OFFSCREEN, WINDOW.y + WINDOW.h, 'cust_0').setOrigin(0.5, 1).setDepth(2);
    this.shutter = this.add.image(WINDOW.x, WINDOW.y, 'shutter').setOrigin(0).setDepth(3);
    this.closedSign = label(this, WINDOW.x + WINDOW.w / 2, WINDOW.y + 60, 'CLOSED', COLOURS.white, 'center').setDepth(3.5);
    this.add.image(0, 0, 'shop').setOrigin(0).setDepth(4);
    this.bubble = this.add.rectangle(BUBBLE_X, BUBBLE_Y, BUBBLE_W, 40, COLOURS.paper).setOrigin(0).setStrokeStyle(1, COLOURS.ink).setDepth(5).setVisible(false);
    this.bubbleTail = this.add.triangle(0, 0, 0, 0, 0, 8, -7, 8, COLOURS.paper).setOrigin(0).setDepth(5).setVisible(false);

    this.add.rectangle(0, 0, WIDTH, 15, COLOURS.bg).setOrigin(0).setDepth(6);
    this.dayText = label(this, 4, 4, '').setDepth(7);
    this.clockText = label(this, WIDTH / 2, 4, '', COLOURS.dim, 'center').setDepth(7);
    this.moneyText = label(this, WIDTH - 4, 4, '', COLOURS.gold, 'right').setDepth(7);

    label(this, 191, 166, 'ORDER', COLOURS.green, 'center').setDepth(7);
    label(this, 191, 175, 'STOCKS', COLOURS.green, 'center').setDepth(7);
    this.add.rectangle(168, 160, 46, 36, 0xffffff, 0).setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
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
    this.readyToPay = false;
    this.clearTable();
    this.portrait.setX(-PORTRAIT_OFFSCREEN);
    this.shutter.setY(WINDOW.y);
    this.closedSign.setVisible(true);
    this.refreshShelves();
  }

  // ---- Shelves and table --------------------------------------------------

  private refreshShelves() {
    for (const slot of SHELF_SLOTS) {
      this.slotArt.get(slot.id)?.forEach((o) => o.destroy());
      this.slotArt.delete(slot.id);
      const shelf = session.state.shelves.find((s) => s.id === slot.id);
      if (!shelf) continue;
      const art: Phaser.GameObjects.GameObject[] = [];
      const x = slot.col * SLOT_W;
      const y = SHELF_TOP + slot.row * SLOT_H;
      if (shelf.productId && shelf.qty > 0) {
        const shown = Math.min(shelf.qty, 6);
        for (let i = 0; i < shown; i++) {
          const ix = x + 3 + (i % 3) * 16;
          const iy = y + 21 - Math.floor(i / 3) * 16;
          art.push(this.add.image(ix, iy, `item_${shelf.productId}`).setOrigin(0).setDepth(5 + (i < 3 ? 0.2 : 0.1)));
        }
        art.push(label(this, x + 3, y + 40, getProduct(shelf.productId).short, COLOURS.ink).setDepth(6));
        art.push(label(this, x + SLOT_W - 3, y + 40, String(shelf.qty), COLOURS.ink, 'right').setDepth(6));
      } else {
        art.push(label(this, x + SLOT_W / 2, y + 40, 'EMPTY', 0x8a7f6a, 'center').setDepth(6));
        art.push(label(this, x + SLOT_W / 2, y + 16, '+', COLOURS.white, 'center').setDepth(6).setAlpha(0.7));
      }
      this.slotArt.set(slot.id, art);
    }
    this.refreshLockedRows();
    this.renderBubble();
  }

  private refreshLockedRows() {
    this.rowArt.forEach((o) => o.destroy());
    this.rowArt = [];
    const { rowsOwned } = session.state;
    for (let row = rowsOwned; row < SHELF_ROWS; row++) {
      const y = SHELF_TOP + row * SLOT_H;
      this.rowArt.push(this.add.image(0, y, 'boards').setOrigin(0).setDepth(5));
      const price = row === rowsOwned ? nextRowPrice(session.state) : null;
      const text = price ? `MORE SHELVES ${formatCents(price)}` : 'LOCKED';
      this.rowArt.push(label(this, WIDTH / 2, y + 20, text, COLOURS.white, 'center').setDepth(6));
    }
  }

  private stockTotal(): number {
    return Object.values(session.state.stockroom).reduce((sum, n) => sum + n, 0);
  }

  private tapSlot(slot: ShelfSlot) {
    if (session.modal) return;
    if (slot.row >= session.state.rowsOwned) return this.openModal('Order', { tab: 'shelves' });
    const shelf = session.state.shelves.find((s) => s.id === slot.id)!;
    if (shelf.qty > 0 && this.current && !this.busy) return this.fetch(slot, shelf.productId!);
    this.openModal('Stock', { shelfId: slot.id });
  }

  private fetch(slot: ShelfSlot, productId: string) {
    const customer = this.current!;
    if (customer.wants.length === 0) return;
    if (this.readyToPay || !canAddToTable(customer.wants, session.table, productId)) {
      sfx.error();
      this.say(`NO ${getProduct(productId).short}, THANKS`, COMPLAINT);
      return;
    }
    if (this.table.length >= TABLE_CAPACITY) return;
    if (!takeFromShelf(session.state, slot.id, productId)) return;
    sfx.pickUp();
    this.spoken = '';
    const image = this.add.image(slot.col * SLOT_W + SLOT_W / 2, SHELF_TOP + slot.row * SLOT_H + 20, `item_${productId}`).setDepth(9);
    const item: TableItem = { productId, image };
    this.table.push(item);
    image.setInteractive({ useHandCursor: true }).on('pointerup', () => this.takeBack(item));
    this.layoutTable();
    this.refreshShelves();

    if (isOrderComplete(customer.wants, session.table)) {
      this.time.delayedCall(PAYMENT_DELAY_MS, () => {
        // They may have taken something back during the pause.
        if (this.current === customer && !session.modal && isOrderComplete(customer.wants, session.table)) this.startPayment();
      });
    }
  }

  private takeBack(item: TableItem) {
    if (session.modal) return;
    sfx.putBack();
    this.table = this.table.filter((other) => other !== item);
    item.image.destroy();
    returnItem(session.state, item.productId);
    this.spoken = '';
    this.readyToPay = false;
    this.layoutTable();
    this.refreshShelves();
  }

  private layoutTable() {
    this.table.forEach((item, i) => {
      this.tweens.killTweensOf(item.image);
      this.tweens.add({ targets: item.image, x: 44 + i * 21, y: 180, duration: 140, ease: 'Quad.easeOut' });
    });
    session.table = this.table.map((t) => t.productId);
  }

  private clearTable() {
    this.table.forEach((t) => t.image.destroy());
    this.table = [];
    session.table = [];
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

    // One icon per box of stock would be too few to see, so show them unit by unit, up to a limit.
    const items = Object.entries(session.state.pendingOrders).flatMap(([id, qty]) => Array.from({ length: qty }, () => id));
    const step = Math.max(1, Math.floor(items.length / MAX_FLYING_ITEMS));
    const shown = items.filter((_, i) => i % step === 0).slice(0, MAX_FLYING_ITEMS);
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

  // ---- Customers ----------------------------------------------------------

  private callNext() {
    const next = this.queue.shift();
    if (!next) return;
    const request = buildRequest(session.state);
    const customer: Customer = { ...next, ...request };
    this.current = customer;
    this.busy = true;
    this.spoken = '';
    this.readyToPay = false;
    session.wants = customer.wants;
    session.payingCash = customer.paidByCash;
    session.state.stats.missedSales += customer.wished.length;
    sfx.customer();
    this.portrait.setTexture(`cust_${next.look}`).setX(-PORTRAIT_OFFSCREEN);
    this.tweens.add({
      targets: this.portrait,
      x: PORTRAIT_X,
      duration: 450,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.busy = false;
        this.renderBubble();
        // With nothing at all on the shelves, they say so and move on.
        if (customer.wants.length === 0) {
          this.time.delayedCall(EMPTY_HANDED_MS, () => {
            if (this.current === customer) this.dismiss();
          });
        }
      },
    });
  }

  private dismiss() {
    this.current = null;
    session.wants = null;
    this.busy = true;
    this.spoken = '';
    this.readyToPay = false;
    this.renderBubble();
    this.tweens.add({
      targets: this.portrait,
      x: WIDTH + PORTRAIT_OFFSCREEN,
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
    const customer = this.current;
    const visible = customer !== null && !this.busy;
    this.bubble.setVisible(visible);
    this.bubbleTail.setVisible(visible);
    if (!visible) return;
    const put = (y: number, text: string, colour: number) => {
      const t = label(this, BUBBLE_X + 3, y, text, colour).setDepth(6);
      this.bubbleLines.push(t);
      return t;
    };
    let y = BUBBLE_Y + 4;
    requestLines(customer.wants, session.table).forEach((line) => {
      put(y, `${line.qty} ${getProduct(line.productId).name}`, line.done ? 0x2f7d55 : COLOURS.ink);
      y += 10;
    });
    if (customer.wants.length > 0) {
      y += 1;
      put(y, customer.paidByCash ? 'PAYING CASH' : 'PAYING CARD', customer.paidByCash ? 0x8a5a14 : 0x2a62a8);
      y += 10;
    }
    if (this.spoken) {
      y += 1;
      y += put(y, this.spoken, this.spokenColour).setMaxWidth(BUBBLE_W - 6).height + 2;
    }
    if (customer.wished.length > 0) {
      y += 1;
      const wish = put(y, `I WISH YOU HAD ${getProduct(customer.wished[0]).name}`, 0x6d6352);
      y += wish.setMaxWidth(BUBBLE_W - 6).height + 2;
    }
    const bottom = y + 2;
    this.bubble.setSize(BUBBLE_W, bottom - BUBBLE_Y);
    this.bubbleTail.setPosition(BUBBLE_X + 1, bottom - 1);
  }

  private pressAction() {
    if (session.modal) return;
    if (session.phase === 'morning') return this.openShop();
    if (this.readyToPay) this.startPayment();
  }

  private startPayment() {
    const customer = this.current;
    if (!customer || session.modal) return;
    const items = session.table.slice();
    const total = items.reduce((sum, id) => sum + getProduct(id).retail, 0);
    if (customer.tender?.total !== total) customer.tender = { total, amount: customerTender(total) };
    this.openModal('Register', {
      items,
      total,
      paidByCash: customer.paidByCash,
      tendered: customer.paidByCash ? customer.tender.amount : 0,
      onDone: () => {
        this.clearTable();
        this.dismiss();
        this.floatMoney(total);
      },
      onBack: () => {
        this.readyToPay = true;
        this.say('');
      },
    });
  }

  private floatMoney(total: number) {
    const t = label(this, 84, 180, `+${formatCents(total)}`, 0x1f7a5a, 'center').setDepth(9);
    this.tweens.add({ targets: t, y: 165, alpha: 0, duration: 1100, delay: 300, onComplete: () => t.destroy() });
  }

  private openShop() {
    if (!anyShelfStocked(session.state)) {
      sfx.error();
      session.toast('STOCK YOUR SHELVES BEFORE OPENING', 3000);
      return;
    }
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
          this.queue.push({ look: Math.floor(Math.random() * CUSTOMER_LOOKS), paidByCash: chooseCash() });
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

    const showAction = phase === 'morning' || (this.readyToPay && this.current !== null);
    this.action.setVisible(showAction);
    this.action.setLabel(phase === 'morning' ? 'OPEN' : 'TAKE PAYMENT');
    this.hint.setText(this.hintText());
  }

  private hintText(): string {
    if (performance.now() < session.messageUntil) return session.message;
    const { state, phase, waiting } = session;
    if (this.box && !this.boxOpening) return 'TAP THE BOX TO UNPACK IT';
    if (phase === 'morning') {
      return anyShelfStocked(state) ? 'ORDER MORE OR OPEN UP' : 'TAP AN EMPTY SHELF TO STOCK IT';
    }
    if (this.current) {
      if (this.current.wants.length === 0) return 'YOUR SHELVES ARE EMPTY!';
      return this.readyToPay ? 'TAP A TABLE ITEM TO CHANGE IT' : 'TAP SHELVES TO FETCH ITEMS';
    }
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

