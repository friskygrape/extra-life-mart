import Phaser from 'phaser';
import { getProduct, shelfLabelLines } from '../data/products';
import { SHELF_ROWS, SHELF_SLOTS, type ShelfSlot } from '../data/shelves';
import { CUSTOMER_LOOKS, SHELF_LABEL_H, columnX } from '../art/textures';
import { sfx } from '../audio';
import { canAddToTable, isOrderComplete, requestLines } from '../logic/basket';
import { lightingAt } from '../logic/clock';
import { buildRequest, chooseCash, nextSpawnDelay, pickLook, shortenWhenIdle } from '../logic/customers';
import { endDay } from '../logic/day';
import { anyShelfStocked, returnItem, takeFromShelf } from '../logic/inventory';
import { nextRowPrice } from '../logic/licences';
import { customerTender, formatCents, roundToNickel } from '../logic/money';
import { deliverOrders } from '../logic/orders';
import { L, bubbleW, bubbleX, bubbleY, portraitX, receiptHeight } from '../layout';
import { session } from '../session';
import { BUTTONS, Button, COLOURS, button, drawPaper, label } from '../ui';

const TABLE_CAPACITY = 4;
const DELIVERY_SECONDS = 3;
const MAX_FLYING_ITEMS = 14;
const MAX_WAITING = 3;
const SHADOW_COLOUR = 0x24344a;
const SHADOW_SPACING = 32;
const SHADOW_SCALE = 0.94;
/** Each person further back in line is fainter. */
const SHADOW_ALPHAS = [0.8, 0.5, 0.3];
const STEP_FORWARD_MS = 520;
const COMPLAINT = 0xb0352b;
const PORTRAIT_OFFSCREEN = 90;
const DONE_GREEN = 0x1f8f55;
/** Which part of the background sits in the window, in its own pixels. */
const SCENE_FOCUS_LEFT = 238;
const SCENE_FOCUS_BOTTOM = 205;
const SCENE_W = 479;
const SCENE_H = 267;
/** A short beat after the last item lands, so you can see the order complete. */
const PAYMENT_DELAY_MS = 350;
const EMPTY_HANDED_MS = 1900;

const tableItemX = (i: number) => 88 + i * 21;
const tableY = () => L.counterTop + 21;
/** Cash or card lands right beside the register, in front of the customer. */
const propX = () => 62;
const propY = () => L.counterTop + 16;
const boxX = () => L.W - 74;
const slotLeft = (slot: ShelfSlot) => columnX(slot.col);
const slotWidth = (slot: ShelfSlot) => columnX(slot.col + 1) - columnX(slot.col);
const slotTop = (slot: ShelfSlot) => L.shelfTop + slot.row * L.rowH;
const crateX = () => 14;
const crateY = () => L.stripTop + 16;

function mixColour(a: number, b: number, t: number): number {
  const mix = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift;
  return mix(16) | mix(8) | mix(0);
}

/** Someone in line. What they want is decided when they reach the window. */
interface Waiting {
  look: number;
  paidByCash: boolean;
  /** Their dark outline, standing behind whoever is ahead of them. */
  shadow: Phaser.GameObjects.Image;
}

interface Customer extends Omit<Waiting, 'shadow'> {
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
  private duskScene!: Phaser.GameObjects.Image;
  private nightScene!: Phaser.GameObjects.Image;
  private warmLight!: Phaser.GameObjects.Rectangle;
  private shutter!: Phaser.GameObjects.Image;
  private closedSign!: Phaser.GameObjects.BitmapText;
  private portrait!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Graphics;
  private bubbleTail!: Phaser.GameObjects.Image;
  private speech!: Phaser.GameObjects.Graphics;
  private speechTail!: Phaser.GameObjects.Image;
  private heldMoney!: Phaser.GameObjects.Image;
  private heldCard!: Phaser.GameObjects.Image;
  private bubbleLines: { destroy(): void }[] = [];
  private spoken = '';
  private spokenColour: number = COLOURS.ink;
  private slotArt = new Map<string, Phaser.GameObjects.GameObject[]>();
  private rowArt: Phaser.GameObjects.GameObject[] = [];
  /** While paying, the receipt replaces the list: how many lines it has. */
  private receiptLines: number | null = null;
  private receiptTop = 0;
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
  private box: Phaser.GameObjects.Image | null = null;
  private boxOpening = false;
  private deliveryIn = 0;

  constructor() {
    super('Shack');
  }

  create() {
    const { W, windowX, windowY, windowW, windowH } = L;
    const cropLeft = Math.max(0, Math.min(SCENE_W - windowW, SCENE_FOCUS_LEFT - Math.round((windowW - 141) * 0.3)));
    const cropBottom = Math.min(SCENE_H, SCENE_FOCUS_BOTTOM + Math.round((windowH - 113) * 0.5));
    const cropTop = Math.max(0, cropBottom - windowH);
    const sceneX = windowX - cropLeft;
    const sceneY = windowY - cropTop;
    this.add.image(sceneX, sceneY, 'beach').setOrigin(0).setDepth(0);
    this.duskScene = this.add.image(sceneX, sceneY, 'beach_dusk').setOrigin(0).setDepth(0.1).setAlpha(0);
    this.nightScene = this.add.image(sceneX, sceneY, 'beach_night').setOrigin(0).setDepth(0.2).setAlpha(0);
    this.portrait = this.add.image(-PORTRAIT_OFFSCREEN, windowY + windowH, 'cust_0').setOrigin(0.5, 1).setDepth(2);
    this.shutter = this.add.image(windowX, windowY, 'shutter').setOrigin(0).setDepth(3);
    this.closedSign = label(this, windowX + Math.floor(windowW / 2), windowY + Math.floor(windowH / 2) - 4, 'CLOSED', COLOURS.white, 'center').setDepth(3.5);
    this.add.image(0, 0, 'shop').setOrigin(0).setDepth(4);
    this.warmLight = this.add.rectangle(0, 0, W, L.H, 0xffa050, 0).setOrigin(0).setDepth(4.05);

    // The closed sign is a shortcut for opening up.
    this.add.rectangle(windowX, windowY, windowW, windowH, 0xffffff, 0).setOrigin(0).setDepth(3.6).setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (session.phase === 'morning' && !session.modal) this.openShop();
      });

    const standBottom = L.counterBottom - 6;
    this.add.image(2, standBottom, 'till').setOrigin(0, 1).setDepth(4.5);
    const computerX = W - 52;
    const computerY = standBottom + 2 - 60;
    this.add.image(computerX, computerY, 'computer').setOrigin(0).setDepth(4.5);
    label(this, computerX + 24, computerY + 8, 'ORDER', COLOURS.green, 'center').setDepth(4.6);
    label(this, computerX + 24, computerY + 18, 'STOCKS', COLOURS.green, 'center').setDepth(4.6);
    this.add.rectangle(computerX, computerY, 50, 60, 0xffffff, 0).setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.openModal('Order'));

    this.bubble = this.add.graphics().setDepth(5).setVisible(false);
    this.bubbleTail = this.add.image(0, 0, 'bubble_tail').setOrigin(1, 1).setDepth(5.2).setVisible(false);
    this.speech = this.add.graphics().setDepth(5).setVisible(false);
    this.speechTail = this.add.image(0, 0, 'bubble_tail').setOrigin(1, 1).setDepth(5.2).setVisible(false);
    label(this, windowX + Math.floor(windowW / 2), L.signY + 7, 'EXTRA LIFE MART', COLOURS.white, 'center').setDepth(5);
    this.heldMoney = this.add.image(propX(), propY(), 'held_cash').setDepth(5.1).setVisible(false);
    this.heldCard = this.add.image(propX(), propY(), 'held_card').setDepth(5.1).setVisible(false);

    this.add.rectangle(0, 0, W, L.hudH, COLOURS.bg).setOrigin(0).setDepth(6);
    const hudText = L.hudH - 11;
    this.add.image(11, L.hudH - 8, 'menu_icon').setDepth(7);
    this.dayText = label(this, 23, hudText, '').setDepth(7);
    this.add.rectangle(0, 0, 22, L.hudH + 8, 0xffffff, 0).setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        // Full-screen menus cover this button, so only the shop and payment screens can reach it.
        if (this.scene.isActive('Pause') || session.phase === 'summary') return;
        sfx.click();
        this.scene.launch('Pause');
      });
    this.clockText = label(this, Math.floor(W / 2) + 6, hudText, '', COLOURS.dim, 'center').setDepth(7);
    this.moneyText = label(this, W - 4, hudText, '', COLOURS.gold, 'right').setDepth(7);

    SHELF_SLOTS.forEach((slot) => {
      this.add.rectangle(slotLeft(slot), slotTop(slot), slotWidth(slot), L.rowH, 0xffffff, 0)
        .setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.tapSlot(slot));
    });

    this.crate = this.add.image(crateX(), crateY(), 'crate').setDepth(7).setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.openModal('Inventory'));
    this.stockCount = label(this, crateX(), crateY() - 3, '', COLOURS.white, 'center').setDepth(8);
    this.hint = label(this, 28, L.stripTop + 2, '').setDepth(7);
    this.hint.setMaxWidth(W - 116);
    this.action = button(this, W - BUTTONS.stripW - 4, L.stripTop + 3, BUTTONS.stripW, BUTTONS.stripH, 'OPEN', () => this.pressAction(), COLOURS.accent, null);
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
    this.queue.forEach((w) => w.shadow.destroy());
    this.queue = [];
    this.current = null;
    this.busy = false;
    this.readyToPay = false;
    this.receiptLines = null;
    this.hidePayment();
    this.clearTable();
    this.portrait.setX(-PORTRAIT_OFFSCREEN);
    this.shutter.setY(L.windowY);
    this.closedSign.setVisible(true);
    this.refreshShelves();
  }

  // ---- Shelves and table --------------------------------------------------

  private refreshShelves() {
    const iconRows = Math.max(1, Math.floor((L.rowH - SHELF_LABEL_H - 4) / 16));
    for (const slot of SHELF_SLOTS) {
      this.slotArt.get(slot.id)?.forEach((o) => o.destroy());
      this.slotArt.delete(slot.id);
      const shelf = session.state.shelves.find((s) => s.id === slot.id);
      if (!shelf) continue;
      const art: Phaser.GameObjects.GameObject[] = [];
      const x = slotLeft(slot);
      const y = slotTop(slot);
      const w = slotWidth(slot);
      const labelY = y + L.rowH - SHELF_LABEL_H;
      if (shelf.productId && shelf.qty > 0) {
        const shown = Math.min(shelf.qty, 3 * iconRows);
        const left = x + Math.floor((w - 48) / 2);
        for (let i = 0; i < shown; i++) {
          const ix = left + (i % 3) * 16;
          const iy = labelY - 18 - Math.floor(i / 3) * 16;
          art.push(this.add.image(ix, iy, `item_${shelf.productId}`).setOrigin(0).setDepth(5 + 0.2 - i * 0.001));
        }
        const [first, second] = shelfLabelLines(getProduct(shelf.productId).name);
        art.push(label(this, x + 3, labelY + 1, first, COLOURS.ink).setDepth(6));
        if (second) art.push(label(this, x + 3, labelY + 9, second, COLOURS.ink).setDepth(6));
        art.push(label(this, x + w - 3, labelY + 9, String(shelf.qty), COLOURS.ink, 'right').setDepth(6));
      } else {
        art.push(label(this, x + Math.floor(w / 2), y + Math.floor((L.rowH - SHELF_LABEL_H - 7) / 2), '+', COLOURS.white, 'center').setDepth(6).setAlpha(0.7));
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
      const y = L.shelfTop + row * L.rowH;
      this.rowArt.push(this.add.image(0, y, 'boards').setOrigin(0).setDepth(5));
      const price = row === rowsOwned ? nextRowPrice(session.state) : null;
      const text = price ? `MORE SHELVES ${formatCents(price)}` : 'LOCKED';
      this.rowArt.push(label(this, Math.floor(L.W / 2), y + Math.floor(L.rowH / 2) - 4, text, COLOURS.white, 'center').setDepth(6));
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
    const image = this.add.image(slotLeft(slot) + slotWidth(slot) / 2, slotTop(slot) + 20, `item_${productId}`).setDepth(9);
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
      this.tweens.add({ targets: item.image, x: tableItemX(i), y: tableY(), duration: 140, ease: 'Quad.easeOut' });
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
    const box = this.add.image(boxX(), tableY() - 44, 'box_closed').setDepth(4.8);
    this.box = box;
    box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.openBox());
    this.tweens.add({
      targets: box,
      y: tableY(),
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
    box.setPosition(boxX(), tableY()).setTexture('box_open').disableInteractive();
    sfx.rip();

    // One icon per box of stock would be too few to see, so show them unit by unit, up to a limit.
    const items = Object.entries(session.state.pendingOrders).flatMap(([id, qty]) => Array.from({ length: qty }, () => id));
    const step = Math.max(1, Math.floor(items.length / MAX_FLYING_ITEMS));
    const shown = items.filter((_, i) => i % step === 0).slice(0, MAX_FLYING_ITEMS);
    shown.forEach((id, i) => {
      this.time.delayedCall(180 + i * 90, () => {
        sfx.pop();
        const icon = this.add.image(boxX(), tableY() - 4, `item_${id}`).setDepth(10).setScale(0.5);
        this.tweens.add({
          targets: icon,
          y: tableY() - 30,
          x: boxX() - 6 + (i % 3) * 6,
          scale: 1,
          duration: 180,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: icon,
              x: crateX(),
              y: crateY(),
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

  /** The next person in line steps forward, turning from a silhouette into full colour. */
  private callNext() {
    const next = this.queue.shift();
    if (!next) return;
    const request = buildRequest(session.state);
    const customer: Customer = { look: next.look, paidByCash: next.paidByCash, ...request };
    this.current = customer;
    this.busy = true;
    this.spoken = '';
    this.readyToPay = false;
    session.wants = customer.wants;
    session.payingCash = customer.paidByCash;
    session.state.stats.missedSales += customer.wished.length;
    sfx.customer();
    const { shadow } = next;
    this.portrait.setTexture(`cust_${next.look}`).setX(shadow.x).setAlpha(0);
    this.tweens.add({
      targets: shadow,
      x: portraitX(),
      scale: 1,
      alpha: 0,
      duration: STEP_FORWARD_MS,
      ease: 'Quad.easeOut',
      onComplete: () => shadow.destroy(),
    });
    this.tweens.add({
      targets: this.portrait,
      x: portraitX(),
      alpha: 1,
      duration: STEP_FORWARD_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.busy = false;
        this.showPayment(customer);
        this.renderBubble();
        // With nothing at all on the shelves, they move on.
        if (customer.wants.length === 0) {
          this.time.delayedCall(EMPTY_HANDED_MS, () => {
            if (this.current === customer) this.dismiss();
          });
        }
      },
    });
  }

  /** Someone new joins the back of the line, walking in from the right. */
  private joinLine() {
    const taken = [...this.queue.map((w) => w.look), ...(this.current ? [this.current.look] : [])];
    const look = pickLook(taken, CUSTOMER_LOOKS);
    const shadow = this.add.image(L.W + PORTRAIT_OFFSCREEN, L.windowY + L.windowH, `cust_${look}`)
      .setOrigin(0.5, 1).setScale(SHADOW_SCALE).setTintFill(SHADOW_COLOUR);
    this.queue.push({ look, paidByCash: chooseCash(), shadow });
  }

  /** Eases everyone in line towards their place behind the customer. */
  private updateLine(dt: number) {
    this.queue.forEach((waiting, i) => {
      const target = portraitX() + SHADOW_SPACING * (i + 1);
      waiting.shadow.setDepth(1.5 - i * 0.1).setAlpha(SHADOW_ALPHAS[i] ?? 0);
      waiting.shadow.x += (target - waiting.shadow.x) * Math.min(1, dt * 5);
    });
  }

  /** Once they've arrived, their cash or card comes down onto the counter. */
  private showPayment(customer: Customer) {
    if (customer.wants.length === 0) return;
    const held = customer.paidByCash ? this.heldMoney : this.heldCard;
    this.tweens.killTweensOf(held);
    held.setPosition(propX(), propY() - 22).setVisible(true).setAlpha(0);
    (customer.paidByCash ? sfx.bill : sfx.keypad)();
    this.tweens.add({ targets: held, y: propY(), alpha: 1, duration: 260, ease: 'Quad.easeOut' });
  }

  private hidePayment() {
    [this.heldMoney, this.heldCard].forEach((held) => {
      this.tweens.killTweensOf(held);
      if (!held.visible) return;
      this.tweens.add({ targets: held, y: held.y - 22, alpha: 0, duration: 200, onComplete: () => held.setVisible(false) });
    });
  }

  private dismiss() {
    this.hidePayment();
    this.current = null;
    session.wants = null;
    this.busy = true;
    this.spoken = '';
    this.readyToPay = false;
    this.receiptLines = null;
    this.renderBubble();
    // Out to the left, making room for the next person to step up.
    this.tweens.add({
      targets: this.portrait,
      x: -PORTRAIT_OFFSCREEN,
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
    const hasList = visible && customer.wants.length > 0 && this.receiptLines === null;
    this.bubble.setVisible(hasList);
    this.bubbleTail.setVisible(hasList);
    this.speech.setVisible(false);
    this.speechTail.setVisible(false);
    if (!visible) return;

    const put = (y: number, text: string, colour: number) => {
      const t = label(this, bubbleX() + 3, y, text, colour).setDepth(6);
      t.setMaxWidth(bubbleW() - 6);
      this.bubbleLines.push(t);
      return t;
    };
    const place = (box: Phaser.GameObjects.Graphics, tail: Phaser.GameObjects.Image, top: number, bottom: number) => {
      drawPaper(box, bubbleX(), top, bubbleW(), bottom - top, false);
      box.setVisible(true);
      tail.setPosition(bubbleX() + 1, bottom - 2).setVisible(true);
    };

    // The list: finished lines become a solid green row with a check mark
    let y = this.receiptLines === null ? bubbleY() + 3 : this.receiptTop + receiptHeight(this.receiptLines, this.current?.paidByCash ?? false) + 10;
    if (hasList) {
      requestLines(customer.wants, session.table).forEach((line) => {
        const name = getProduct(line.productId).name;
        if (line.done) {
          const row = this.add.rectangle(bubbleX() + 2, y - 1, bubbleW() - 4, 10, DONE_GREEN).setOrigin(0).setDepth(5.5);
          this.bubbleLines.push(row);
          put(y, `\u2713 ${name}`, COLOURS.white);
        } else {
          put(y, `${line.remaining} ${name}`, COLOURS.ink);
        }
        y += 11;
      });
      place(this.bubble, this.bubbleTail, bubbleY(), y + 1);
      y += 7;
    }

    // Anything else they say goes in its own bubble below
    const speechTop = y - 3;
    if (this.spoken) {
      y += put(y, this.spoken, this.spokenColour).height + 2;
      place(this.speech, this.speechTail, speechTop, y + 1);
    }
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
    const charged = customer.paidByCash ? roundToNickel(total) : total;
    if (customer.tender?.total !== charged) customer.tender = { total: charged, amount: customerTender(charged) };
    this.setDeskClear(true);
    this.receiptLines = Math.min(items.length, 4);
    // Moves up if needed, so the receipt and speech bubble stay clear of the things on the counter.
    const speechH = 14;
    this.receiptTop = Math.max(L.windowY + 8, Math.min(bubbleY(), L.counterTop - 20 - speechH - 8 - receiptHeight(this.receiptLines, customer.paidByCash)));
    this.renderBubble();
    this.openModal('Register', {
      items,
      receiptTop: this.receiptTop,
      total: charged,
      paidByCash: customer.paidByCash,
      tendered: customer.paidByCash ? customer.tender.amount : 0,
      onDone: () => {
        this.setDeskClear(false);
        this.clearTable();
        this.dismiss();
        this.floatMoney(charged);
      },
      onBack: () => {
        this.setDeskClear(false);
        this.receiptLines = null;
        this.readyToPay = true;
        this.say('');
      },
    });
  }

  /** Payment uses the desk for counting out change, so what's on it steps aside. */
  private setDeskClear(clear: boolean) {
    this.table.forEach((t) => t.image.setVisible(!clear));
    this.box?.setVisible(!clear);
  }

  private floatMoney(total: number) {
    const t = label(this, 110, tableY(), `+${formatCents(total)}`, 0x1f7a5a, 'center').setDepth(9);
    this.tweens.add({ targets: t, y: tableY() - 15, alpha: 0, duration: 1100, delay: 300, onComplete: () => t.destroy() });
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
    this.tweens.add({ targets: this.shutter, y: L.windowY - L.windowH, duration: 600, ease: 'Quad.easeIn' });
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
      const idle = !this.current && !this.busy && this.queue.length === 0;
      this.spawnIn = shortenWhenIdle(this.spawnIn, idle) - dt;
      if (this.spawnIn <= 0) {
        if (this.queue.length < MAX_WAITING) {
          this.joinLine();
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
    this.applyLighting();
    session.waiting = this.queue.length;
    this.updateLine(dt);
    this.updateHud();
  }

  /** Daylight until 6 PM, then the scene fades through dusk to night by closing. */
  private applyLighting() {
    const { dusk, night } = lightingAt(session.dayFraction());
    this.duskScene.setAlpha(dusk);
    this.nightScene.setAlpha(night);
    // Customers are outside but lit by the shop, so they shift gently and stay readable.
    const tint = mixColour(mixColour(0xffffff, 0xffe2cc, dusk), 0xbcc4e2, night);
    this.portrait.setTint(tint);
    this.warmLight.setFillStyle(0xffa050, 0.1 * Math.max(dusk * 0.5, night));
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

