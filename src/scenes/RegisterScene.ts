import Phaser from 'phaser';
import { sfx } from '../audio';
import { getProduct } from '../data/products';
import { L, bubbleW, bubbleX, receiptHeight } from '../layout';
import { checkCard, checkChange, completeSale } from '../logic/checkout';
import { DENOMINATIONS, formatCents } from '../logic/money';
import { session } from '../session';
import { BUTTONS, COLOURS, button, drawPaper, label } from '../ui';

interface RegisterData {
  items: string[];
  total: number;
  paidByCash: boolean;
  tendered: number;
  receiptTop: number;
  onDone: () => void;
  onBack: () => void;
}

const CASH_PROMPT = 'PROVIDE CHANGE TO THE CUSTOMER';
const CARD_PROMPT = 'TAP OUTSIDE THE KEYPAD TO CANCEL';
const SUCCESS_INK = 0x0b6b3a;
const MAX_RECEIPT_LINES = 4;
const RECEIPT_MIN_W = 116;
const PRINT_LINE_MS = 70;
const denominationLabel = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}C`);
const deskLabel = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}`);

interface DeskPiece {
  cents: number;
  parts: { destroy(): void }[];
  sprite: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.BitmapText;
  hit: Phaser.GameObjects.Rectangle;
}

export class RegisterScene extends Phaser.Scene {
  private info!: RegisterData;
  private total = 0;
  private tendered = 0;
  private desk: DeskPiece[] = [];
  private entered = 0;
  private finished = false;
  private givenText!: Phaser.GameObjects.BitmapText;
  private messageText!: Phaser.GameObjects.BitmapText;
  private displayText!: Phaser.GameObjects.BitmapText;
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
    this.terminal = null;
    session.sale = { items: data.items, total: data.total, paidByCash: data.paidByCash, tendered: data.tendered };
    session.events.emit('say', data.paidByCash ? `HERE'S ${formatCents(data.tendered)}` : 'CARD, PLEASE');

    this.add.rectangle(0, this.top, L.W, L.H - this.top, COLOURS.bg).setOrigin(0).setInteractive();
    this.printReceipt(data.items, data.paidByCash);
    if (data.paidByCash) this.buildCash();
    else this.buildCard();
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

  /** Prints line by line beside the customer, in the same spot the item list was. */
  private printReceipt(items: string[], cash: boolean) {
    // Wide enough for AMOUNT PAID and its price, leaning over the customer's shoulder on narrow screens.
    const w = Math.max(bubbleW(), RECEIPT_MIN_W);
    const x = Math.min(bubbleX(), L.W - 3 - w);
    const y = this.info.receiptTop;
    const lines = items.slice(0, MAX_RECEIPT_LINES);
    const height = receiptHeight(lines.length, cash);
    const paper = this.add.graphics();
    drawPaper(paper, x, y, w, 5, false);
    lines.forEach((id, i) => {
      this.time.delayedCall(i * PRINT_LINE_MS, () => {
        const p = getProduct(id);
        const price = formatCents(p.retail);
        const fits = (p.name.length + price.length + 1) * 6 <= w - 6;
        sfx.keypad();
        drawPaper(paper, x, y, w, 5 + (i + 1) * 9, false);
        label(this, x + 3, y + 3 + i * 9, fits ? p.name : p.short, COLOURS.ink);
        label(this, x + w - 3, y + 3 + i * 9, price, COLOURS.ink, 'right');
      });
    });
    this.time.delayedCall(lines.length * PRINT_LINE_MS, () => {
      drawPaper(paper, x, y, w, height, true);
      const ruleY = y + 3 + lines.length * 9;
      this.add.rectangle(x + 3, ruleY, w - 6, 1, COLOURS.ink).setOrigin(0);
      const row = (rowY: number, name: string, value: string) => {
        label(this, x + 3, rowY, name, COLOURS.ink);
        label(this, x + w - 3, rowY, value, COLOURS.ink, 'right');
      };
      row(ruleY + 3, cash ? 'CASH TOTAL' : 'TOTAL', formatCents(this.total));
      if (cash) {
        row(ruleY + 12, 'AMOUNT PAID', formatCents(this.tendered));
        this.add.rectangle(x + 3, ruleY + 22, w - 6, 1, COLOURS.ink).setOrigin(0);
        row(ruleY + 25, 'CHANGE DUE', formatCents(this.tendered - this.total));
      }
    });
  }

  /** The one number that matters right now, large and at the top of the panel. */
  private headline(y: number, name: string, value: string) {
    this.add.rectangle(4, y, L.W - 8, 25, COLOURS.panelLight).setOrigin(0);
    label(this, 8, y + 9, name, COLOURS.gold);
    label(this, L.W - 8, y + 4, value, COLOURS.gold, 'right').setScale(2);
  }

  // ---- Cash ---------------------------------------------------------------

  private buildCash() {
    const top = this.top;
    this.headline(top + 3, 'CHANGE DUE', formatCents(this.tendered - this.total));
    label(this, 8, top + 32, 'GIVEN', COLOURS.dim);
    this.givenText = label(this, L.W - 8, top + 32, '$0.00', COLOURS.white, 'right');
    this.messageText = label(this, Math.floor(L.W / 2), top + 43, CASH_PROMPT, COLOURS.dim, 'center');
    label(this, Math.floor(L.W / 2), top + 53, 'TAP THE WINDOW TO CANCEL', COLOURS.dim, 'center');

    const moneyY = top + 63;
    const actionsY = this.floor - BUTTONS.actionH;
    const cellH = Math.min(52, Math.floor((actionsY - moneyY - 2) / 2) - 2);
    const cellW = Math.floor((L.W - 8) / 4);
    DENOMINATIONS.forEach((cents, i) => {
      const cx = 4 + (i % 4) * cellW + Math.floor(cellW / 2);
      const cy = moneyY + Math.floor(i / 4) * (cellH + 2) + Math.floor(cellH / 2);
      this.moneyPiece(cents, cx, cy, cellW, cellH);
    });
    const actionW = Math.floor((L.W - 12) * 0.25);
    button(this, 4, actionsY, actionW, BUTTONS.actionH, 'UNDO', () => this.undo());
    button(this, 6 + actionW, actionsY, actionW, BUTTONS.actionH, 'CLEAR', () => this.clearDesk());
    const giveX = 8 + actionW * 2;
    button(this, giveX, actionsY, L.W - giveX - 4, BUTTONS.actionH, 'GIVE', () => this.giveChange(), COLOURS.accent, null);
  }

  /** A bill or coin you can tap, with its value printed on it. */
  private moneyPiece(cents: number, cx: number, cy: number, cellW: number, cellH: number) {
    const sprite = this.add.image(cx, cy, `money_${cents}`);
    const amount = label(this, cx, cy - 3, denominationLabel(cents), COLOURS.ink, 'center');
    const press = (down: boolean) => {
      sprite.setY(down ? cy + 1 : cy);
      amount.setY((down ? cy + 1 : cy) - 3);
    };
    this.add.rectangle(cx - cellW / 2, cy - cellH / 2, cellW, cellH, 0xffffff, 0).setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => press(true))
      .on('pointerout', () => press(false))
      .on('pointerup', () => {
        press(false);
        this.addToDesk(cents);
      });
  }

  private addToDesk(cents: number) {
    if (this.finished) return;
    (cents >= 100 ? sfx.bill : sfx.coin)();
    const sprite = this.add.image(0, 0, `desk_${cents}`);
    const text = label(this, 0, 0, deskLabel(cents), COLOURS.ink, 'center');
    const hit = this.add.rectangle(0, 0, Math.max(sprite.width, 20), 18, 0xffffff, 0).setInteractive({ useHandCursor: true });
    const piece: DeskPiece = { cents, sprite, text, hit, parts: [sprite, text, hit] };
    hit.on('pointerup', () => this.removePiece(piece));
    this.desk.push(piece);
    this.refreshDesk();
    sprite.setScale(1.3);
    this.tweens.add({ targets: sprite, scale: 1, duration: 110, ease: 'Quad.easeOut' });
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
    this.messageText.setTint(COLOURS.dim).setText(CASH_PROMPT);
    const due = this.tendered - this.total;
    const given = this.given();
    this.givenText.setText(formatCents(given));
    this.givenText.setTint(given === due ? COLOURS.green : given > due ? COLOURS.red : COLOURS.white);

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
    if (this.finished) return;
    const result = checkChange(this.total, this.tendered, this.given());
    if (result.status === 'short') return this.reject('NOT ENOUGH CHANGE');
    const extra = result.status === 'over' ? result.extra : 0;
    completeSale(session.state, this.total, extra);
    sfx.sale();
    if (extra > 0) this.finish(`OOPS! THAT'S ${formatCents(extra)} TOO MUCH`, 0x9a5b00);
    else this.finish('PERFECT. THANKS!', SUCCESS_INK);
  }

  // ---- Card ---------------------------------------------------------------

  private buildCard() {
    const top = this.top;
    this.buildTerminal();
    this.headline(top + 3, 'AMOUNT DUE', formatCents(this.total));
    this.messageText = label(this, Math.floor(L.W / 2), top + 31, CARD_PROMPT, COLOURS.dim, 'center');

    // One keypad, laid out like a real terminal, filling all the space down to the bottom.
    const gridY = top + 41;
    const gap = 2;
    const w = Math.floor((L.W - 8 - gap * 3) / 4);
    const okW = L.W - 8 - gap * 3 - w * 3;
    const h = Math.floor((this.floor - gridY - gap * 3) / 4);
    const x = (col: number) => 4 + col * (w + gap);
    const y = (row: number) => gridY + row * (h + gap);
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((key, i) => {
      button(this, x(i % 3), y(Math.floor(i / 3)), w, h, key, () => this.pressKey(key), COLOURS.button, sfx.keypad);
    });
    button(this, x(0), y(3), w, h, 'CLR', () => this.pressKey('CLR'), 0x7d3a30, sfx.keypad);
    button(this, x(1), y(3), w, h, '0', () => this.pressKey('0'), COLOURS.button, sfx.keypad);
    button(this, x(2), y(3), w, h, 'DEL', () => this.pressKey('DEL'), 0x8c6d28, sfx.keypad);
    button(this, x(3), y(0), okW, h * 4 + gap * 3, 'OK', () => this.pressKey('OK'), COLOURS.accent, null);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        sfx.keypad();
        this.pressKey(e.key);
      } else if (e.key === 'Backspace') this.pressKey('DEL');
      else if (e.key === 'Enter') this.pressKey('OK');
    });
  }

  /** The terminal rises up from behind the counter, and sinks back when you're done. */
  private buildTerminal() {
    const x = 106;
    const restY = L.counterBottom - 34;
    // Tapping the terminal itself shouldn't count as tapping outside.
    const body = this.add.image(0, 0, 'terminal').setInteractive();
    this.displayText = label(this, 16, -18, '$0.00', COLOURS.green, 'right');
    const caption = label(this, -18, -24, 'AMOUNT', 0x5fa877);
    caption.setVisible(false);
    const terminal = this.add.container(x, restY + 70, [body, this.displayText, caption]).setDepth(-1);
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
    if (this.finished) return;
    if (key === 'OK') {
      if (!checkCard(this.total, this.entered)) return this.reject('WRONG AMOUNT');
      completeSale(session.state, this.total, 0);
      sfx.approved();
      this.finish('APPROVED. THANKS!', SUCCESS_INK);
      return;
    }
    this.messageText.setTint(COLOURS.dim).setText(CARD_PROMPT);
    if (key === 'CLR') this.entered = 0;
    else if (key === 'DEL') this.entered = Math.floor(this.entered / 10);
    else this.entered = Math.min(this.entered * 10 + Number(key), 9999999);
    this.displayText.setText(formatCents(this.entered));
  }

  // ---- Shared -------------------------------------------------------------

  private reject(text: string) {
    sfx.error();
    this.messageText.setTint(COLOURS.red).setText(text);
    this.cameras.main.shake(140, 0.008);
  }

  /** Leaves payment without charging, with the items still on the table. */
  private back() {
    if (this.finished) return;
    this.finished = true;
    this.removeTerminal(() => {
      session.sale = null;
      session.modal = false;
      this.info.onBack();
      this.scene.stop();
    });
  }

  private finish(text: string, color: number) {
    this.finished = true;
    // The customer says it, so it appears beside them rather than down by the buttons.
    this.messageText.setText('');
    session.events.emit('say', text, color);
    this.time.delayedCall(this.terminal ? 800 : 1000, () => {
      this.removeTerminal(() => {
        session.sale = null;
        session.modal = false;
        this.info.onDone();
        this.scene.stop();
      });
    });
  }
}
