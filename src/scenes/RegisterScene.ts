import Phaser from 'phaser';
import { AMOUNT_STYLE, RECEIPT_STYLE, textWidth } from '../art/fontMetrics';
import { billImage } from '../art/bills';
import { MONEY_SCALE, TERMINAL_DIGITS } from '../art/textures';
import { sfx } from '../audio';
import { getProduct } from '../data/products';
import { BILL_STACK_STEP, L, PAYMENT_PANEL_H, RECEIPT_LINE_H, TENDER_BILL_H, TENDER_BILL_W, cardSpot, drawerBillSize, drawerLayout, bubbleW, bubbleX, receiptHeight, tenderLayout } from '../layout';
import { checkCard, checkChange, completeSale } from '../logic/checkout';
import { DENOMINATIONS, formatCents, tenderBills } from '../logic/money';
import { settleService } from '../logic/reputation';
import { session } from '../session';
import { BUTTONS, COLOURS, amountLabel, bigLabel, drawPaper, label, receiptLabel, tinyLabel, type Button } from '../ui';
import { KEYS, TILL, drawLcd, tillKey } from '../tillUi';

interface RegisterData {
  items: string[];
  total: number;
  paidByCash: boolean;
  tendered: number;
  receiptTop: number;
  /** Called with the tip they left, and anything you gave back too much. */
  onDone: (tip: number, overpaid: number) => void;
  onBack: () => void;
}

const MAX_RECEIPT_LINES = 4;
const RECEIPT_MIN_W = 116;
const HIGHLIGHT_H = 15;
const HIGHLIGHT_GOLD = 0xffc65c;
const PRINT_LINE_MS = 70;
/** The beats of the reveal: the money lands and the receipt fills in, with the controls up from the start. */
const BEFORE_TENDER_MS = 250;
const NEXT_LINE_MS = 300;
const SLIDE_MS = 160;
const PANEL_MESSAGE_MS = 1300;
const LIFT = 3;
const FLY_MS = 130;
const denominationLabel = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}\u00a2`);
/** The lighter band across each bill, in its own colour, and the line around it. */
const BILL_BANDS: Record<number, { fill: number; edge: number }> = {
  100: { fill: 0xcfdfba, edge: 0x35543c },
  500: { fill: 0xd9e5ea, edge: 0x34506a },
  1000: { fill: 0xdacfdd, edge: 0x4a3556 },
  2000: { fill: 0xd2d5ae, edge: 0x3f4a30 },
};
const BAND_H = 13;
/** Every bill stands in the drawer with two more of it behind. */
const STACK_BEHIND = 2;
/** Change on the counter: coins are about as wide as the upright bills, and each piece overlaps the last a little. */
const DESK_COIN = 13;
const DESK_OVERLAP = 2;
const DESK_LEFT = 84;
/** How long the customer stays to say goodbye. */
const GOODBYE_MS = 1200;
/** Every coin in the drawer shows at the 5 cent coin's size. */
const COIN_SIZE = 77 * MONEY_SCALE;
const COIN_LABEL_TOP = 3;
const COIN_LABEL_H = 9;
const COIN_DROP = 3;
const TAKE_MS = 200;

interface DeskPiece {
  cents: number;
  parts: { destroy(): void }[];
  sprite: Phaser.GameObjects.Image;
  hit: Phaser.GameObjects.Rectangle;
  /** Its size at rest. */
  scale: number;
}

/** Dark digits on the terminal's grey-green screen. */
const TERMINAL_INK = 0x1a2a26;

export class RegisterScene extends Phaser.Scene {
  private info!: RegisterData;
  private total = 0;
  private tendered = 0;
  private desk: DeskPiece[] = [];
  private entered = 0;
  private finished = false;
  /** Controls ignore taps until the receipt has shown the number to work from. */
  private ready = false;
  private controls!: Phaser.GameObjects.Container;
  private panelName = '';
  private panelLabel!: Phaser.GameObjects.BitmapText;
  private panelValue!: Phaser.GameObjects.BitmapText;
  private panelTimer: Phaser.Time.TimerEvent | null = null;
  private displayText: Phaser.GameObjects.BitmapText | null = null;
  private terminal: Phaser.GameObjects.Container | null = null;
  /** Set once the customer's cash has gone into the drawer. */
  private tenderTaken = false;
  /** Gives a slot a small dip, as money lands in it. */
  private slotDips = new Map<number, () => void>();
  /** Everything printed on the receipt, cleared away when the customer says goodbye. */
  private receiptParts: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Register');
  }

  private get top() {
    return L.counterBottom;
  }

  /** Bottom of the area controls can use, clear of rounded corners and gesture bars. */
  private get floor() {
    return L.H - L.safeBottom - 3;
  }

  create(data: RegisterData) {
    this.info = data;
    this.total = data.total;
    this.tendered = data.tendered;
    this.desk = [];
    this.entered = 0;
    this.finished = false;
    this.ready = false;
    this.terminal = null;
    this.displayText = null;
    this.panelTimer = null;
    this.tenderTaken = false;
    this.slotDips = new Map();
    this.receiptParts = [];
    session.sale = { items: data.items, total: data.total, paidByCash: data.paidByCash, tendered: data.tendered };
    session.servicePaused = true;

    this.add.rectangle(0, this.top, L.W, L.H - this.top, COLOURS.bg).setOrigin(0).setInteractive();
    this.controls = this.add.container(0, L.H - this.top);
    if (data.paidByCash) this.buildCash();
    else this.buildCard();
    this.reveal(data.items, data.paidByCash);
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.addCancelArea(data.paidByCash);
  }

  /**
   * Tapping outside the payment area backs out. The menu button stays reachable.
   * For cash the counter counts as part of the payment, so a near miss on your change can't lose it.
   */
  private addCancelArea(cash: boolean) {
    const outsideTop = L.hudH + 8;
    const outsideBottom = cash ? L.counterTop : this.top;
    this.add.rectangle(0, outsideTop, L.W, outsideBottom - outsideTop, 0xffffff, 0).setOrigin(0).setDepth(-2)
      .setInteractive().on('pointerup', () => this.back());
    if (cash) {
      this.add.rectangle(0, L.counterTop, L.W, this.top - L.counterTop, 0xffffff, 0).setOrigin(0).setDepth(-2).setInteractive();
    }
  }

  /** The controls come straight up so the screen is never empty. Then the items print, the money lands, and the number to work from appears. */
  private reveal(items: string[], cash: boolean) {
    // Wide enough for the highlighted amount, leaning over the customer's shoulder on narrow screens.
    // Wide enough for the highlighted row's label and amount side by side.
    const highlight = cash ? ['CHANGE DUE', formatCents(this.tendered - this.total)] : ['TOTAL', formatCents(this.total)];
    const highlightW = textWidth(highlight[0]) + textWidth(highlight[1], AMOUNT_STYLE) + 16;
    const w = Math.min(L.W - 6, Math.max(bubbleW(), RECEIPT_MIN_W, highlightW));
    const x = Math.min(bubbleX(), L.W - 3 - w);
    const y = this.info.receiptTop;
    const lines = items.slice(0, MAX_RECEIPT_LINES);
    this.tweens.add({ targets: this.controls, y: 0, duration: SLIDE_MS, ease: 'Quad.easeOut' });
    // The till feeds out its paper in step with the receipt on screen.
    const totalSteps = lines.length + (cash ? 3 : 1);
    let stepsDone = 0;
    const feed = () => session.events.emit('receipt-feed', ++stepsDone / totalSteps);
    const paper = this.keep(this.add.graphics());
    drawPaper(paper, x, y, w, 5, false);

    const at = (ms: number, step: () => void) => {
      this.time.delayedCall(ms, () => {
        if (!this.finished) step();
      });
    };
    const row = (rowY: number, name: string, value: string) => {
      this.keep(receiptLabel(this, x + 3, rowY, name, COLOURS.ink));
      this.keep(receiptLabel(this, x + w - 3, rowY, value, COLOURS.ink, 'right'));
    };

    lines.forEach((id, i) => {
      at(i * PRINT_LINE_MS, () => {
        const p = getProduct(id);
        const price = formatCents(p.retail);
        const fits = textWidth(p.name, RECEIPT_STYLE) + textWidth(price, RECEIPT_STYLE) + 4 <= w - 6;
        sfx.keypad();
        feed();
        drawPaper(paper, x, y, w, 5 + (i + 1) * RECEIPT_LINE_H, false);
        this.keep(receiptLabel(this, x + 3, y + 3 + i * RECEIPT_LINE_H, fits ? p.name : p.short, COLOURS.ink));
        this.keep(receiptLabel(this, x + w - 3, y + 3 + i * RECEIPT_LINE_H, price, COLOURS.ink, 'right'));
      });
    });

    const ruleY = y + 3 + lines.length * RECEIPT_LINE_H;
    const finalHeight = receiptHeight(lines.length, cash);
    let time = lines.length * PRINT_LINE_MS;

    if (cash) {
      at(time, () => {
        feed();
        drawPaper(paper, x, y, w, ruleY - y + 14, false);
        this.keep(this.add.rectangle(x + 3, ruleY, w - 6, 1, COLOURS.ink).setOrigin(0));
        row(ruleY + 3, 'CASH TOTAL', formatCents(this.total));
      });
      time += BEFORE_TENDER_MS;
      at(time, () => session.events.emit('show-tender'));
      time += NEXT_LINE_MS;
      at(time, () => {
        sfx.keypad();
        feed();
        drawPaper(paper, x, y, w, ruleY - y + 25, false);
        row(ruleY + 14, 'AMOUNT PAID', formatCents(this.tendered));
      });
      time += NEXT_LINE_MS;
      at(time, () => {
        sfx.coin();
        feed();
        drawPaper(paper, x, y, w, finalHeight, true);
        this.keep(this.add.rectangle(x + 3, ruleY + 25, w - 6, 1, COLOURS.ink).setOrigin(0));
        this.highlightRow(x, ruleY + 27, w, 'CHANGE DUE', formatCents(this.tendered - this.total));
      });
    } else {
      at(time, () => {
        sfx.coin();
        feed();
        drawPaper(paper, x, y, w, finalHeight, true);
        this.keep(this.add.rectangle(x + 3, ruleY, w - 6, 1, COLOURS.ink).setOrigin(0));
        this.highlightRow(x, ruleY + 2, w, 'TOTAL', formatCents(this.total));
      });
      time += BEFORE_TENDER_MS;
      at(time, () => {
        session.events.emit('show-tender');
        this.buildTerminal();
      });
      time += NEXT_LINE_MS;
    }

    at(time, () => {
      this.ready = true;
      session.servicePaused = false;
    });
  }

  private keep<T extends Phaser.GameObjects.GameObject>(part: T): T {
    this.receiptParts.push(part);
    return part;
  }

  /** The number to focus on: a gold bar across the receipt with the amount a little larger. */
  private highlightRow(x: number, y: number, w: number, name: string, value: string) {
    const barW = w - 4;
    const bar = this.keep(this.add.container(x + 2 + barW / 2, y + HIGHLIGHT_H / 2));
    const left = -barW / 2;
    bar.add(this.add.rectangle(left, -HIGHLIGHT_H / 2, barW, HIGHLIGHT_H, HIGHLIGHT_GOLD).setOrigin(0));
    bar.add(label(this, left + 2, -3, name, COLOURS.ink));
    bar.add(amountLabel(this, barW / 2 - 2, -6, value, COLOURS.ink, 'right'));
    bar.setScale(1.05);
    this.tweens.add({ targets: bar, scale: 1, duration: 200, ease: 'Back.easeOut' });
  }

  /** The figure you're building right now: large, at the top of the payment area. */
  private buildPanel(name: string) {
    this.panelName = name;
    const screen = this.add.graphics();
    drawLcd(screen, 3, this.top + 2, L.W - 6, 28);
    this.panelLabel = label(this, 10, this.top + 12, name, TILL.lcdDim);
    this.panelValue = bigLabel(this, L.W - 10, this.top + 7, '$0.00', TILL.lcd, 'right');
    this.controls.add([screen, this.panelLabel, this.panelValue]);
  }

  /** The figure on the till's screen, marked with a tick when it's exactly right and red when it's too much. */
  private showFigure(value: number, target: number) {
    const exact = value === target;
    this.panelValue.setText(`${exact ? '\u2713 ' : ''}${formatCents(value)}`);
    this.panelValue.setTint(exact ? TILL.lcdMatch : value > target ? TILL.lcdOver : TILL.lcd);
  }

  /** A mistake takes over the panel's label for a moment. */
  private reject(text: string) {
    sfx.error();
    this.panelLabel.setText(text).setTint(TILL.lcdOver);
    this.panelTimer?.remove();
    this.panelTimer = this.time.delayedCall(PANEL_MESSAGE_MS, () => this.resetPanelLabel());
    this.cameras.main.shake(140, 0.008);
  }

  private resetPanelLabel() {
    this.panelLabel.setText(this.panelName).setTint(TILL.lcdDim);
    this.panelTimer?.remove();
    this.panelTimer = null;
  }

  // ---- Cash ---------------------------------------------------------------

  private buildCash() {
    this.buildPanel('CHANGE');
    const d = drawerLayout();
    this.controls.add(this.add.image(d.x, d.y, 'drawer_tray').setOrigin(0).setScale(0.5));
    DENOMINATIONS.forEach((cents, i) => {
      if (i < 4) this.drawerBill(cents, i, d);
      else this.drawerCoin(cents, i - 4, d);
    });

    const actionsY = this.floor - BUTTONS.actionH;
    const actionW = Math.floor((L.W - 12) * 0.25);
    const addButton = (b: Button) => this.controls.add([...(b.parts ?? []), b.rect, b.text]);
    addButton(tillKey(this, 4, actionsY, actionW, BUTTONS.actionH, 'UNDO', () => this.undo()));
    addButton(tillKey(this, 6 + actionW, actionsY, actionW, BUTTONS.actionH, 'CLEAR', () => this.clearDesk()));
    const giveX = 8 + actionW * 2;
    addButton(tillKey(this, giveX, actionsY, L.W - giveX - 4, BUTTONS.actionH, 'GIVE', () => this.giveChange(), KEYS.green, null));
  }

  /** A stack of three bills standing on end in its slot, most of their length showing above the tray, with a band to carry their value. */
  private drawerBill(cents: number, col: number, d: ReturnType<typeof drawerLayout>) {
    const { w, h } = drawerBillSize();
    const stackW = STACK_BEHIND * BILL_STACK_STEP;
    const left = d.slotX(col) + Math.floor((d.slotW - w - stackW) / 2);
    const top = d.billTop + 2 + stackW;
    const bottom = d.billTop + d.billH;
    // The ones behind peek out above and to the right, a little darker.
    const layers = Array.from({ length: STACK_BEHIND + 1 }, (_, i) => STACK_BEHIND - i).map((back) => {
      const y = top - back * BILL_STACK_STEP;
      const bill = billImage(this, left + back * BILL_STACK_STEP, y, cents);
      bill.setCrop(0, 0, bill.width, Math.min(h, bottom - y) * L.renderScale);
      if (back > 0) bill.setTint(back === 1 ? 0xc4c4c4 : 0x9c9c9c);
      return bill;
    });
    const shownH = Math.min(h, bottom - top);
    const cx = left + Math.floor(w / 2);
    const bandY = top + Math.floor(shownH * 0.55) - Math.floor(BAND_H / 2);
    const bandW = Math.min(d.slotW - 2, w + 4);
    const { fill, edge } = BILL_BANDS[cents];
    const band = this.add.rectangle(cx, bandY, bandW, BAND_H, fill).setOrigin(0.5, 0).setStrokeStyle(1, edge);
    const amount = label(this, cx, bandY + 3, denominationLabel(cents), COLOURS.ink, 'center');
    this.addSlot(cents, d.slotX(col), d.billTop, d.slotW, d.billH, [...layers, band, amount]);
  }

  /** Three coins in their cup, all the same size, centred under their value. */
  private drawerCoin(cents: number, col: number, d: ReturnType<typeof drawerLayout>) {
    const cx = d.slotX(col) + Math.floor(d.slotW / 2);
    const key = `coin_${cents}`;
    const natural = this.textures.get(key).getSourceImage().height;
    const areaTop = d.coinTop + COIN_LABEL_TOP + COIN_LABEL_H;
    const areaH = d.coinTop + d.coinH - 2 - areaTop;
    // Every cup shrinks by the same amount on a short screen, so the coins stay equal.
    const size = Math.min(COIN_SIZE, areaH - COIN_DROP);
    const scale = size / natural;
    const top = Math.round(areaTop + (areaH - size - COIN_DROP) / 2);
    const side = Math.min(size * 0.55, (d.slotW - size) / 2 - 1);
    const left = this.add.image(cx - side, top, key).setOrigin(0.5, 0).setScale(scale);
    const right = this.add.image(cx + side, top, key).setOrigin(0.5, 0).setScale(scale);
    const front = this.add.image(cx, top + COIN_DROP, key).setOrigin(0.5, 0).setScale(scale);
    const amount = label(this, cx, d.coinTop + COIN_LABEL_TOP, denominationLabel(cents), COLOURS.white, 'center');
    this.addSlot(cents, d.slotX(col), d.coinTop, d.slotW, d.coinH, [left, right, front, amount]);
  }

  /** The whole slot is the tap target. Pressing lifts the money a little, ready to be taken. */
  private addSlot(cents: number, x: number, y: number, w: number, h: number, parts: (Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | Phaser.GameObjects.BitmapText)[]) {
    const rest = parts.map((part) => part.y);
    const press = (down: boolean) => parts.forEach((part, i) => part.setY(rest[i] - (down ? LIFT : 0)));
    this.slotDips.set(cents, () => {
      parts.forEach((part, i) => part.setY(rest[i] + 2));
      this.time.delayedCall(90, () => parts.forEach((part, i) => part.setY(rest[i])));
    });
    const hit = this.add.rectangle(x, y, w, h, 0xffffff, 0).setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => press(true))
      .on('pointerout', () => press(false))
      .on('pointerup', () => {
        press(false);
        this.addToDesk(cents, x + w / 2, y + h / 2);
      });
    this.controls.add([...parts, hit]);
  }

  /** The customer's bills leave the counter for their slots in the drawer, clearing it for your change. */
  private takeTender() {
    this.tenderTaken = true;
    session.events.emit('tender-taken');
    const bills = tenderBills(this.tendered);
    const d = drawerLayout();
    tenderLayout(bills.length).forEach(({ x, y }, i) => {
      const cents = bills[i];
      const col = DENOMINATIONS.indexOf(cents as (typeof DENOMINATIONS)[number]);
      const bill = billImage(this, x, y, cents, true).setDepth(150);
      this.tweens.add({
        targets: bill,
        x: d.slotX(col) + Math.floor((d.slotW - TENDER_BILL_W) / 2),
        y: d.billTop + 4,
        alpha: 0.4,
        duration: TAKE_MS,
        delay: i * 25,
        ease: 'Quad.easeIn',
        onComplete: () => {
          bill.destroy();
          this.slotDips.get(cents)?.();
        },
      });
    });
  }

  /** A piece of change as it sits on the counter: a small upright bill, or a coin about as wide. */
  private deskMoney(cents: number, x: number, y: number): { sprite: Phaser.GameObjects.Image; scale: number } {
    if (cents >= 100) {
      const sprite = billImage(this, x, y, cents, true).setOrigin(0.5);
      return { sprite, scale: sprite.scale };
    }
    const key = `coin_${cents}`;
    const scale = DESK_COIN / this.textures.get(key).getSourceImage().height;
    return { sprite: this.add.image(x, y, key).setScale(scale), scale };
  }

  private addToDesk(cents: number, fromX: number, fromY: number) {
    if (this.finished || !this.ready) return;
    if (!this.tenderTaken) this.takeTender();
    (cents >= 100 ? sfx.bill : sfx.coin)();
    const { sprite, scale } = this.deskMoney(cents, 0, 0);
    const hit = this.add.rectangle(0, 0, Math.max(sprite.displayWidth, 10), TENDER_BILL_H, 0xffffff, 0).setInteractive({ useHandCursor: true });
    const piece: DeskPiece = { cents, sprite, hit, scale, parts: [sprite, hit] };
    hit.on('pointerup', () => this.removePiece(piece));
    this.desk.push(piece);
    this.refreshDesk();
    // It flies up from the drawer and lands with a small bounce.
    const flying = this.deskMoney(cents, fromX, fromY).sprite.setDepth(200);
    this.tweens.add({ targets: flying, x: sprite.x, y: sprite.y, duration: FLY_MS, ease: 'Quad.easeOut', onComplete: () => flying.destroy() });
    sprite.setScale(scale * 1.3);
    this.tweens.add({ targets: sprite, scale, duration: 110, delay: FLY_MS, ease: 'Quad.easeOut' });
  }

  private removePiece(piece: DeskPiece) {
    if (this.finished) return;
    sfx.putBack();
    piece.parts.forEach((p) => p.destroy());
    this.desk = this.desk.filter((other) => other !== piece);
    this.refreshDesk();
  }

  private undo() {
    const last = this.desk[this.desk.length - 1];
    if (last) this.removePiece(last);
  }

  private clearDesk() {
    if (this.finished) return;
    this.desk.forEach((piece) => piece.parts.forEach((p) => p.destroy()));
    this.desk = [];
    this.refreshDesk();
  }

  private given(): number {
    return this.desk.reduce((sum, piece) => sum + piece.cents, 0);
  }

  /** Lays pieces out in two rows on the counter, fanning them closer together when there are many. */
  private refreshDesk() {
    this.resetPanelLabel();
    const due = this.tendered - this.total;
    const given = this.given();
    this.showFigure(given, due);

    // One row of upright bills and coins, each overlapping the last a little, squeezed closer when there are many.
    const right = L.W - 58;
    const width = (piece: DeskPiece) => (piece.cents >= 100 ? TENDER_BILL_W : DESK_COIN);
    const natural = this.desk.reduce((sum, p) => sum + width(p) - DESK_OVERLAP, DESK_OVERLAP);
    const squeeze = natural > right - DESK_LEFT ? (natural - (right - DESK_LEFT)) / Math.max(this.desk.length - 1, 1) : 0;
    const top = L.counterTop + 3;
    let x = DESK_LEFT;
    this.desk.forEach((piece, i) => {
      const w = width(piece);
      const cx = x + w / 2;
      // Coins lie at the front of the counter, level with the bottom of the bills.
      const cy = piece.cents >= 100 ? top + TENDER_BILL_H / 2 : top + TENDER_BILL_H - DESK_COIN / 2;
      piece.sprite.setPosition(cx, cy).setDepth(10 + i * 3);
      piece.hit.setPosition(cx, top + TENDER_BILL_H / 2).setSize(Math.max(w - DESK_OVERLAP - squeeze, 4), TENDER_BILL_H).setDepth(11 + i * 3);
      x += w - DESK_OVERLAP - squeeze;
    });
  }

  private giveChange() {
    if (this.finished || !this.ready) return;
    const result = checkChange(this.total, this.tendered, this.given());
    if (result.status === 'short') return this.reject('NOT ENOUGH CHANGE');
    const extra = result.status === 'over' ? result.extra : 0;
    const tip = this.settle(extra);
    sfx.sale();
    if (extra > 0) this.finish(`OOPS! THAT'S ${formatCents(extra)} TOO MUCH. BYE!`, tip, extra);
    else this.finish(tip > 0 ? `THANKS! HERE'S A ${formatCents(tip)} TIP.` : 'PERFECT. THANKS!', tip);
  }

  // ---- Card ---------------------------------------------------------------

  private buildCard() {
    this.buildPanel('AMOUNT');

    // One keypad, laid out like a real terminal, filling all the space down to the bottom.
    const gridY = this.top + PAYMENT_PANEL_H - 1;
    const gap = 2;
    const w = Math.floor((L.W - 8 - gap * 3) / 4);
    const okW = L.W - 8 - gap * 3 - w * 3;
    const h = Math.floor((this.floor - gridY - gap * 3) / 4);
    const x = (col: number) => 4 + col * (w + gap);
    const y = (row: number) => gridY + row * (h + gap);
    const key = (col: number, row: number, keyW: number, keyH: number, text: string, colours: typeof KEYS.teal, sound: (() => void) | null) => {
      const b = tillKey(this, x(col), y(row), keyW, keyH, text, () => this.pressKey(text), colours, sound);
      this.controls.add([...(b.parts ?? []), b.rect, b.text]);
    };
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((text, i) => key(i % 3, Math.floor(i / 3), w, h, text, KEYS.teal, sfx.keypad));
    key(0, 3, w, h, 'CLR', KEYS.red, sfx.keypad);
    key(1, 3, w, h, '0', KEYS.teal, sfx.keypad);
    key(2, 3, w, h, 'DEL', KEYS.orange, sfx.keypad);
    key(3, 0, okW, h * 4 + gap * 3, 'OK', KEYS.green, null);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (!this.ready) return;
      if (/^[0-9]$/.test(e.key)) {
        sfx.keypad();
        this.pressKey(e.key);
      } else if (e.key === 'Backspace') this.pressKey('DEL');
      else if (e.key === 'Enter') this.pressKey('OK');
    });
  }

  /** The terminal rises up from behind the counter, and sinks back when you're done. */
  private buildTerminal() {
    const x = 134;
    const restY = L.counterBottom - 34;
    // Tapping the terminal itself shouldn't count as tapping outside.
    const body = this.add.image(0, 0, 'terminal').setInteractive();
    this.displayText = label(this, 17, -22, '$0.00', TERMINAL_INK, 'right');
    const digits = TERMINAL_DIGITS.map(({ text, x: keyX, y: keyY }) => tinyLabel(this, keyX - body.width / 2, keyY - body.height / 2, text, TERMINAL_INK));
    const terminal = this.add.container(x, restY + 70, [body, this.displayText, ...digits]).setDepth(-1);
    this.terminal = terminal;
    sfx.pop();
    this.tweens.add({ targets: terminal, y: restY, duration: 280, ease: 'Back.easeOut' });
  }

  /** Their card slides along the reader on the terminal's side, stripe first, then goes back to them. */
  private swipeCard(then: () => void) {
    const terminal = this.terminal;
    if (!terminal) return then();
    session.events.emit('card-taken');
    const spot = cardSpot();
    // In front of the terminal, its edge running down the reader on the right side.
    const card = this.add.image(spot.x, spot.y, 'held_card');
    const readerX = terminal.x + 32;
    this.tweens.chain({
      targets: card,
      tweens: [
        { x: readerX, y: terminal.y - 26, angle: 90, duration: 240, ease: 'Quad.easeOut' },
        { y: terminal.y + 16, duration: 360, ease: 'Sine.easeInOut', onStart: () => sfx.swipe() },
        { alpha: 0, x: spot.x, y: spot.y, angle: 0, duration: 260, delay: 150, ease: 'Quad.easeIn', onStart: then, onComplete: () => card.destroy() },
      ],
    });
  }

  private removeTerminal(then: () => void) {
    if (!this.terminal) return then();
    sfx.putBack();
    this.tweens.add({ targets: this.terminal, y: this.terminal.y + 70, duration: 220, ease: 'Quad.easeIn', onComplete: then });
  }

  private pressKey(key: string) {
    if (this.finished || !this.ready) return;
    if (key === 'OK') {
      if (!checkCard(this.total, this.entered)) return this.reject('WRONG AMOUNT');
      const tip = this.settle(0);
      this.finished = true;
      this.swipeCard(() => {
        sfx.approved();
        this.finish(tip > 0 ? `THANKS! I ADDED A ${formatCents(tip)} TIP.` : 'THANKS. SEE YOU!', tip);
      });
      return;
    }
    if (key === 'CLR') this.entered = 0;
    else if (key === 'DEL') this.entered = Math.floor(this.entered / 10);
    else this.entered = Math.min(this.entered * 10 + Number(key), 9999999);
    this.resetPanelLabel();
    this.showFigure(this.entered, this.total);
    this.displayText?.setText(formatCents(this.entered));
  }

  // ---- Shared -------------------------------------------------------------

  /** Leaves payment without charging, with the items still on the table. */
  private back() {
    if (this.finished) return;
    this.finished = true;
    session.servicePaused = false;
    this.removeTerminal(() => {
      session.sale = null;
      session.modal = false;
      this.info.onBack();
      this.scene.stop();
    });
  }

  /** Records the sale, and how the service went. Returns their tip. */
  private settle(overpaid: number): number {
    const { tip } = settleService(session.state, this.total, this.info.items.length, session.serviceSeconds, overpaid);
    completeSale(session.state, this.total, overpaid, tip);
    return tip;
  }

  /** The receipt is done with, and the customer says goodbye in a bubble of their own. */
  private finish(text: string, tip: number, overpaid = 0) {
    this.finished = true;
    this.tweens.add({ targets: this.receiptParts, alpha: 0, duration: 150 });
    session.events.emit('goodbye', text);
    this.time.delayedCall(GOODBYE_MS, () => {
      this.removeTerminal(() => {
        session.sale = null;
        session.modal = false;
        this.info.onDone(tip, overpaid);
        this.scene.stop();
      });
    });
  }
}
