import Phaser from 'phaser';
import { textWidth } from '../art/fontMetrics';
import { TERMINAL_DIGITS, drawerMoneySizes } from '../art/textures';
import { sfx } from '../audio';
import { getProduct } from '../data/products';
import { L, PAYMENT_PANEL_H, bubbleW, bubbleX, receiptHeight } from '../layout';
import { checkCard, checkChange, completeSale } from '../logic/checkout';
import { DENOMINATIONS, formatCents } from '../logic/money';
import { settleService } from '../logic/reputation';
import { session } from '../session';
import { BUTTONS, COLOURS, bigLabel, button, drawPaper, label, tinyLabel } from '../ui';

interface RegisterData {
  items: string[];
  total: number;
  paidByCash: boolean;
  tendered: number;
  receiptTop: number;
  /** Called with the tip they left. */
  onDone: (tip: number) => void;
  onBack: () => void;
}

const SUCCESS_INK = 0x0b6b3a;
const OVER_INK = 0x9a5b00;
const MAX_RECEIPT_LINES = 4;
const RECEIPT_MIN_W = 116;
const HIGHLIGHT_H = 18;
const HIGHLIGHT_GOLD = 0xffc65c;
const PRINT_LINE_MS = 70;
/** The beats of the reveal: the money lands, the receipt fills in, then the controls come up. */
const BEFORE_TENDER_MS = 250;
const NEXT_LINE_MS = 300;
const BEFORE_CONTROLS_MS = 250;
const SLIDE_MS = 240;
const PANEL_MESSAGE_MS = 1300;
const LIFT = 3;
const FLY_MS = 130;
const denominationLabel = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}C`);
const deskLabel = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}`);

interface DeskPiece {
  cents: number;
  parts: { destroy(): void }[];
  sprite: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.BitmapText;
  hit: Phaser.GameObjects.Rectangle;
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
  /** Controls ignore taps until the receipt has finished and they've come up. */
  private ready = false;
  private controls!: Phaser.GameObjects.Container;
  private panelName = '';
  private panelLabel!: Phaser.GameObjects.BitmapText;
  private panelValue!: Phaser.GameObjects.BitmapText;
  private panelTimer: Phaser.Time.TimerEvent | null = null;
  private displayText: Phaser.GameObjects.BitmapText | null = null;
  private terminal: Phaser.GameObjects.Container | null = null;

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

  /** One thing at a time: the items print, the money lands, the number to work from appears, then the controls. */
  private reveal(items: string[], cash: boolean) {
    // Wide enough for the highlighted amount, leaning over the customer's shoulder on narrow screens.
    const w = Math.max(bubbleW(), RECEIPT_MIN_W);
    const x = Math.min(bubbleX(), L.W - 3 - w);
    const y = this.info.receiptTop;
    const lines = items.slice(0, MAX_RECEIPT_LINES);
    // The till feeds out its paper in step with the receipt on screen.
    const totalSteps = lines.length + (cash ? 3 : 1);
    let stepsDone = 0;
    const feed = () => session.events.emit('receipt-feed', ++stepsDone / totalSteps);
    const paper = this.add.graphics();
    drawPaper(paper, x, y, w, 5, false);

    const at = (ms: number, step: () => void) => {
      this.time.delayedCall(ms, () => {
        if (!this.finished) step();
      });
    };
    const row = (rowY: number, name: string, value: string) => {
      label(this, x + 3, rowY, name, COLOURS.ink);
      label(this, x + w - 3, rowY, value, COLOURS.ink, 'right');
    };

    lines.forEach((id, i) => {
      at(i * PRINT_LINE_MS, () => {
        const p = getProduct(id);
        const price = formatCents(p.retail);
        const fits = textWidth(p.name) + textWidth(price) + 4 <= w - 6;
        sfx.keypad();
        feed();
        drawPaper(paper, x, y, w, 5 + (i + 1) * 9, false);
        label(this, x + 3, y + 3 + i * 9, fits ? p.name : p.short, COLOURS.ink);
        label(this, x + w - 3, y + 3 + i * 9, price, COLOURS.ink, 'right');
      });
    });

    const ruleY = y + 3 + lines.length * 9;
    const finalHeight = receiptHeight(lines.length, cash);
    let time = lines.length * PRINT_LINE_MS;

    if (cash) {
      at(time, () => {
        feed();
        drawPaper(paper, x, y, w, ruleY - y + 13, false);
        this.add.rectangle(x + 3, ruleY, w - 6, 1, COLOURS.ink).setOrigin(0);
        row(ruleY + 3, 'CASH TOTAL', formatCents(this.total));
      });
      time += BEFORE_TENDER_MS;
      at(time, () => session.events.emit('show-tender'));
      time += NEXT_LINE_MS;
      at(time, () => {
        sfx.keypad();
        feed();
        drawPaper(paper, x, y, w, ruleY - y + 22, false);
        row(ruleY + 12, 'AMOUNT PAID', formatCents(this.tendered));
      });
      time += NEXT_LINE_MS;
      at(time, () => {
        sfx.coin();
        feed();
        drawPaper(paper, x, y, w, finalHeight, true);
        this.add.rectangle(x + 3, ruleY + 21, w - 6, 1, COLOURS.ink).setOrigin(0);
        this.highlightRow(x, ruleY + 23, w, ['CHANGE', 'DUE'], formatCents(this.tendered - this.total));
      });
    } else {
      at(time, () => {
        sfx.coin();
        feed();
        drawPaper(paper, x, y, w, finalHeight, true);
        this.add.rectangle(x + 3, ruleY, w - 6, 1, COLOURS.ink).setOrigin(0);
        this.highlightRow(x, ruleY + 2, w, ['TOTAL'], formatCents(this.total));
      });
      time += BEFORE_TENDER_MS;
      at(time, () => {
        session.events.emit('show-tender');
        this.buildTerminal();
      });
      time += NEXT_LINE_MS;
    }

    time += BEFORE_CONTROLS_MS;
    at(time, () => {
      this.tweens.add({
        targets: this.controls,
        y: 0,
        duration: SLIDE_MS,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.ready = true;
          session.servicePaused = false;
        },
      });
    });
  }

  /** The number to focus on: a gold bar across the receipt with the amount at double size. */
  private highlightRow(x: number, y: number, w: number, names: string[], value: string) {
    const barW = w - 4;
    const bar = this.add.container(x + 2 + barW / 2, y + HIGHLIGHT_H / 2);
    const left = -barW / 2;
    bar.add(this.add.rectangle(left, -HIGHLIGHT_H / 2, barW, HIGHLIGHT_H, HIGHLIGHT_GOLD).setOrigin(0));
    names.forEach((name, i) => {
      const nameY = names.length === 1 ? -4 : -8 + i * 8;
      bar.add(label(this, left + 2, nameY, name, COLOURS.ink));
    });
    bar.add(bigLabel(this, barW / 2 - 2, -7, value, COLOURS.ink, 'right'));
    bar.setScale(1.25);
    this.tweens.add({ targets: bar, scale: 1, duration: 200, ease: 'Back.easeOut' });
  }

  /** The figure you're building right now: large, at the top of the payment area. */
  private buildPanel(name: string) {
    this.panelName = name;
    this.controls.add(this.add.rectangle(4, this.top + 3, L.W - 8, 25, COLOURS.panelLight).setOrigin(0));
    this.panelLabel = label(this, 8, this.top + 12, name, COLOURS.gold);
    this.panelValue = bigLabel(this, L.W - 8, this.top + 7, '$0.00', COLOURS.white, 'right');
    this.controls.add([this.panelLabel, this.panelValue]);
  }

  /** A mistake takes over the panel's label for a moment. */
  private reject(text: string) {
    sfx.error();
    this.panelLabel.setText(text).setTint(COLOURS.red);
    this.panelTimer?.remove();
    this.panelTimer = this.time.delayedCall(PANEL_MESSAGE_MS, () => this.resetPanelLabel());
    this.cameras.main.shake(140, 0.008);
  }

  private resetPanelLabel() {
    this.panelLabel.setText(this.panelName).setTint(COLOURS.gold);
    this.panelTimer?.remove();
    this.panelTimer = null;
  }

  // ---- Cash ---------------------------------------------------------------

  private buildCash() {
    this.buildPanel('CHANGE');
    const d = drawerMoneySizes();
    this.controls.add(this.add.image(d.x, d.y, 'drawer_tray').setOrigin(0));
    DENOMINATIONS.forEach((cents, i) => {
      if (i < 4) this.drawerBill(cents, i, d);
      else this.drawerCoin(cents, i - 4, d);
    });

    const actionsY = this.floor - BUTTONS.actionH;
    const actionW = Math.floor((L.W - 12) * 0.25);
    const addButton = (b: { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.BitmapText }) => this.controls.add([b.rect, b.text]);
    addButton(button(this, 4, actionsY, actionW, BUTTONS.actionH, 'UNDO', () => this.undo()));
    addButton(button(this, 6 + actionW, actionsY, actionW, BUTTONS.actionH, 'CLEAR', () => this.clearDesk()));
    const giveX = 8 + actionW * 2;
    addButton(button(this, giveX, actionsY, L.W - giveX - 4, BUTTONS.actionH, 'GIVE', () => this.giveChange(), COLOURS.accent, null));
  }

  /** A stack of bills standing on end in its slot, with its value printed upright. */
  private drawerBill(cents: number, col: number, d: ReturnType<typeof drawerMoneySizes>) {
    const cx = d.slotX(col) + Math.floor(d.slotW / 2);
    const bottom = d.billTop + d.billH;
    const spriteY = bottom - d.billSpriteH;
    const sprite = this.add.image(cx, spriteY, `drawer_${cents}`).setOrigin(0.5, 0);
    // Centred on the pale panel of the front bill
    const textY = spriteY + 5 + Math.floor((d.billSpriteH - 5) / 2) - 4;
    const amount = label(this, cx - 1, textY, denominationLabel(cents), COLOURS.ink, 'center');
    this.addSlot(cents, d.slotX(col), d.billTop, d.slotW, d.billH, sprite, amount);
  }

  /** A little pile of coins in its cup. */
  private drawerCoin(cents: number, col: number, d: ReturnType<typeof drawerMoneySizes>) {
    const cx = d.slotX(col) + Math.floor(d.slotW / 2);
    const sprite = this.add.image(cx, 0, `drawer_${cents}`).setOrigin(0.5, 0);
    const spriteY = d.coinTop + Math.floor((d.coinH - sprite.height) / 2);
    sprite.setY(spriteY);
    // Centred on the front coin, which sits a little lower than the two behind it
    const amount = label(this, cx, spriteY + Math.floor(sprite.height / 2), denominationLabel(cents), COLOURS.ink, 'center');
    this.addSlot(cents, d.slotX(col), d.coinTop, d.slotW, d.coinH, sprite, amount);
  }

  /** The whole slot is the tap target. Pressing lifts the money a little, ready to be taken. */
  private addSlot(cents: number, x: number, y: number, w: number, h: number, sprite: Phaser.GameObjects.Image, amount: Phaser.GameObjects.BitmapText) {
    const restY = sprite.y;
    const textY = amount.y;
    const press = (down: boolean) => {
      const lift = down ? LIFT : 0;
      sprite.setY(restY - lift);
      amount.setY(textY - lift);
    };
    const hit = this.add.rectangle(x, y, w, h, 0xffffff, 0).setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => press(true))
      .on('pointerout', () => press(false))
      .on('pointerup', () => {
        press(false);
        this.addToDesk(cents, x + w / 2, y + h / 2);
      });
    this.controls.add([sprite, amount, hit]);
  }

  private addToDesk(cents: number, fromX: number, fromY: number) {
    if (this.finished || !this.ready) return;
    (cents >= 100 ? sfx.bill : sfx.coin)();
    const sprite = this.add.image(0, 0, `desk_${cents}`);
    const text = label(this, 0, 0, deskLabel(cents), COLOURS.ink, 'center');
    const hit = this.add.rectangle(0, 0, Math.max(sprite.width, 20), 18, 0xffffff, 0).setInteractive({ useHandCursor: true });
    const piece: DeskPiece = { cents, sprite, text, hit, parts: [sprite, text, hit] };
    hit.on('pointerup', () => this.removePiece(piece));
    this.desk.push(piece);
    this.refreshDesk();
    // It flies up from the drawer and lands with a small bounce.
    const flying = this.add.image(fromX, fromY, `desk_${cents}`).setDepth(200);
    this.tweens.add({ targets: flying, x: sprite.x, y: sprite.y, duration: FLY_MS, ease: 'Quad.easeOut', onComplete: () => flying.destroy() });
    sprite.setScale(1.3);
    this.tweens.add({ targets: sprite, scale: 1, duration: 110, delay: FLY_MS, ease: 'Quad.easeOut' });
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
    this.panelValue.setText(formatCents(given));
    this.panelValue.setTint(given === due ? COLOURS.green : given > due ? COLOURS.red : COLOURS.white);

    const deskLeft = 84;
    const rowOne = { y: L.counterTop + 12, right: L.W - 56 };
    const rowTwo = { y: L.counterTop + 29, right: L.W - 56 };
    const width = (piece: DeskPiece) => piece.sprite.width;
    const fitRow = (pieces: DeskPiece[], row: { y: number; right: number }, baseDepth: number) => {
      if (pieces.length === 0) return;
      const room = row.right - deskLeft;
      const natural = pieces.reduce((sum, p) => sum + width(p) + 1, -1);
      const squeeze = natural > room ? (natural - room) / Math.max(pieces.length - 1, 1) : 0;
      let x = deskLeft;
      pieces.forEach((piece, i) => {
        const cx = Math.round(x + width(piece) / 2);
        piece.sprite.setPosition(cx, row.y).setDepth(baseDepth + i * 3);
        piece.text.setPosition(cx, row.y - 3).setDepth(baseDepth + i * 3 + 1);
        piece.hit.setPosition(cx, row.y).setDepth(baseDepth + i * 3 + 2);
        x += width(piece) + 1 - squeeze;
      });
    };
    const firstRow: DeskPiece[] = [];
    const secondRow: DeskPiece[] = [];
    let used = 0;
    const room = rowOne.right - deskLeft;
    this.desk.forEach((piece) => {
      if (secondRow.length === 0 && used + width(piece) <= room) {
        firstRow.push(piece);
        used += width(piece) + 1;
      } else {
        secondRow.push(piece);
      }
    });
    fitRow(firstRow, rowOne, 10);
    fitRow(secondRow, rowTwo, 100);
  }

  private giveChange() {
    if (this.finished || !this.ready) return;
    const result = checkChange(this.total, this.tendered, this.given());
    if (result.status === 'short') return this.reject('NOT ENOUGH CHANGE');
    const extra = result.status === 'over' ? result.extra : 0;
    const tip = this.settle(extra);
    sfx.sale();
    if (extra > 0) this.finish(`OOPS! THAT'S ${formatCents(extra)} TOO MUCH`, OVER_INK, tip);
    else this.finish(tip > 0 ? `A ${formatCents(tip)} TIP!` : 'PERFECT. THANKS!', SUCCESS_INK, tip);
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
    const key = (col: number, row: number, keyW: number, keyH: number, text: string, fill: number, sound: (() => void) | null) => {
      const b = button(this, x(col), y(row), keyW, keyH, text, () => this.pressKey(text), fill, sound);
      this.controls.add([b.rect, b.text]);
    };
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((text, i) => key(i % 3, Math.floor(i / 3), w, h, text, COLOURS.button, sfx.keypad));
    key(0, 3, w, h, 'CLR', 0x7d3a30, sfx.keypad);
    key(1, 3, w, h, '0', COLOURS.button, sfx.keypad);
    key(2, 3, w, h, 'DEL', 0x8c6d28, sfx.keypad);
    key(3, 0, okW, h * 4 + gap * 3, 'OK', COLOURS.accent, null);

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
      sfx.approved();
      this.finish(tip > 0 ? `A ${formatCents(tip)} TIP!` : 'APPROVED. THANKS!', SUCCESS_INK, tip);
      return;
    }
    if (key === 'CLR') this.entered = 0;
    else if (key === 'DEL') this.entered = Math.floor(this.entered / 10);
    else this.entered = Math.min(this.entered * 10 + Number(key), 9999999);
    const shown = formatCents(this.entered);
    this.resetPanelLabel();
    this.panelValue.setText(shown).setTint(this.entered === this.total ? COLOURS.green : COLOURS.white);
    this.displayText?.setText(shown);
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

  private finish(text: string, color: number, tip: number) {
    this.finished = true;
    // The customer says it, so it appears beside them rather than down by the buttons.
    session.events.emit('say', text, color);
    this.time.delayedCall(this.terminal ? 800 : 1000, () => {
      this.removeTerminal(() => {
        session.sale = null;
        session.modal = false;
        this.info.onDone(tip);
        this.scene.stop();
      });
    });
  }
}
