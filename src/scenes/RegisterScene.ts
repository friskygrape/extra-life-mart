import Phaser from 'phaser';
import { sfx } from '../audio';
import { getProduct } from '../data/products';
import { L } from '../layout';
import { checkCard, checkChange, completeSale } from '../logic/checkout';
import { DENOMINATIONS, formatCents } from '../logic/money';
import { session } from '../session';
import { COLOURS, button, label } from '../ui';

interface RegisterData {
  items: string[];
  total: number;
  paidByCash: boolean;
  tendered: number;
  onDone: () => void;
  onBack: () => void;
}

const RECEIPT_H = 55;
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
    this.drawReceipt(data.items, data.paidByCash);
    if (data.paidByCash) this.buildCash();
    else this.buildCard();
    this.input.keyboard?.on('keydown-ESC', () => this.back());
  }

  private drawReceipt(items: string[], cash: boolean) {
    const top = this.top;
    this.add.rectangle(4, top + 3, 120, 52, COLOURS.paper).setOrigin(0);
    items.slice(0, 4).forEach((id, i) => {
      const p = getProduct(id);
      label(this, 6, top + 4 + i * 9, p.short, COLOURS.ink);
      label(this, 122, top + 4 + i * 9, formatCents(p.retail), COLOURS.ink, 'right');
    });
    this.add.rectangle(6, top + 41, 116, 1, COLOURS.ink).setOrigin(0);
    label(this, 6, top + 44, cash ? 'CASH TOTAL' : 'TOTAL', COLOURS.ink);
    label(this, 122, top + 44, formatCents(this.total), COLOURS.ink, 'right');
  }

  // ---- Cash ---------------------------------------------------------------

  private buildCash() {
    const top = this.top;
    const right = L.W - 4;
    const row = (y: number, name: string, value: string, colour: number) => {
      label(this, 128, y, name, COLOURS.dim);
      return label(this, right, y, value, colour, 'right');
    };
    row(top + 5, 'PAID', formatCents(this.tendered), COLOURS.white);
    this.add.rectangle(127, top + 16, right - 125, 13, COLOURS.panelLight).setOrigin(0);
    label(this, 129, top + 19, 'CHANGE', COLOURS.gold);
    label(this, right, top + 19, formatCents(this.tendered - this.total), COLOURS.gold, 'right');
    this.givenText = row(top + 35, 'GIVEN', '$0.00', COLOURS.white);
    this.messageText = label(this, Math.floor(L.W / 2), top + 57, 'TAP MONEY TO GIVE IT', COLOURS.dim, 'center');

    const moneyY = top + 66;
    const actionsH = 44;
    const cellH = Math.min(46, Math.floor((this.floor - moneyY - actionsH - 2) / 2) - 2);
    const cellW = Math.floor((L.W - 8) / 4);
    DENOMINATIONS.forEach((cents, i) => {
      const cx = 4 + (i % 4) * cellW + Math.floor(cellW / 2);
      const cy = moneyY + Math.floor(i / 4) * (cellH + 2) + Math.floor(cellH / 2);
      this.moneyPiece(cents, cx, cy, cellW, cellH);
    });

    const actionsY = this.floor - actionsH;
    const small = Math.floor((L.W - 8) * 0.19);
    button(this, 4, actionsY, small + 2, actionsH, 'BACK', () => this.back());
    button(this, 8 + small, actionsY, small, actionsH, 'UNDO', () => this.undo());
    button(this, 10 + small * 2, actionsY, small, actionsH, 'CLEAR', () => this.clearDesk());
    const giveX = 12 + small * 3;
    button(this, giveX, actionsY, L.W - giveX - 4, actionsH, 'GIVE', () => this.giveChange(), COLOURS.accent, null);
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
    this.messageText.setText('');
    const due = this.tendered - this.total;
    const given = this.given();
    this.givenText.setText(formatCents(given));
    this.givenText.setTint(given === due ? COLOURS.green : given > due ? COLOURS.red : COLOURS.white);

    const deskLeft = 46;
    const rowOne = { y: L.counterTop + 12, right: L.W - 94 };
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
    if (extra > 0) this.finish(`OOPS! ${formatCents(extra)} TOO MUCH`, COLOURS.gold);
    else this.finish('EXACT CHANGE. THANKS!', COLOURS.green);
  }

  // ---- Card ---------------------------------------------------------------

  private buildCard() {
    const top = this.top;
    this.buildTerminal();

    const right = L.W - 4;
    label(this, 128, top + 5, 'CHARGE', COLOURS.dim);
    label(this, right, top + 5, formatCents(this.total), COLOURS.gold, 'right');
    label(this, 128, top + 21, 'KEY IT INTO', COLOURS.dim);
    label(this, 128, top + 31, 'THE TERMINAL', COLOURS.dim);
    this.messageText = label(this, Math.floor((128 + right) / 2), top + 44, '', COLOURS.red, 'center');

    const gridY = top + RECEIPT_H + 3;
    const sideW = 48;
    const gap = 2;
    const w = Math.floor((L.W - 12 - sideW - gap * 3) / 3);
    const h = Math.min(40, Math.floor((this.floor - gridY - gap * 3) / 4));
    const x = (col: number) => 6 + col * (w + gap);
    const y = (row: number) => gridY + row * (h + gap);
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((key, i) => {
      button(this, x(i % 3), y(Math.floor(i / 3)), w, h, key, () => this.pressKey(key), COLOURS.button, sfx.keypad);
    });
    button(this, x(0), y(3), w, h, 'CLR', () => this.pressKey('CLR'), 0x7d3a30, sfx.keypad);
    button(this, x(1), y(3), w * 2 + gap, h, '0', () => this.pressKey('0'), COLOURS.button, sfx.keypad);
    button(this, x(3), y(0), sideW, h * 2 + gap, 'BACK', () => this.back());
    button(this, x(3), y(2), sideW, h * 2 + gap, 'OK', () => this.pressKey('OK'), COLOURS.accent, null);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        sfx.keypad();
        this.pressKey(e.key);
      } else if (e.key === 'Backspace') this.pressKey('CLR');
      else if (e.key === 'Enter') this.pressKey('OK');
    });
  }

  /** The terminal rises up from behind the counter, and sinks back when you're done. */
  private buildTerminal() {
    const x = Math.round(L.W * 0.42);
    const restY = L.counterBottom - 34;
    const body = this.add.image(0, 0, 'terminal');
    this.displayText = label(this, 18, -18, '$0.00', COLOURS.green, 'right');
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
      this.finish('APPROVED!', COLOURS.green);
      return;
    }
    this.messageText.setText('');
    this.entered = key === 'CLR' ? 0 : Math.min(this.entered * 10 + Number(key), 9999999);
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
    this.messageText.setTint(color).setText(text);
    this.time.delayedCall(this.terminal ? 650 : 900, () => {
      this.removeTerminal(() => {
        session.sale = null;
        session.modal = false;
        this.info.onDone();
        this.scene.stop();
      });
    });
  }
}
