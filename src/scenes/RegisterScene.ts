import Phaser from 'phaser';
import { sfx } from '../audio';
import { getProduct } from '../data/products';
import { checkCard, checkChange, completeSale } from '../logic/checkout';
import { DENOMINATIONS, formatCents } from '../logic/money';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, button, label } from '../ui';

interface RegisterData {
  items: string[];
  total: number;
  paidByCash: boolean;
  tendered: number;
  onDone: () => void;
  onBack: () => void;
}

/** The panel starts below the counter, so the desk and customer stay in view. */
const TOP = 198;
const CELL_W = 52;
const CELL_H = 32;
const MONEY_Y = 264;
const ACTIONS_Y = 334;
/** Where change is laid out on the desk: two rows in front of the customer. */
const DESK_LEFT = 44;
const DESK_ROW_1 = { y: 170, right: 114 };
const DESK_ROW_2 = { y: 187, right: 164 };
const denominationLabel = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}C`);
const deskLabel = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}`);

interface DeskPiece {
  cents: number;
  parts: { destroy(): void; setPosition(x: number, y: number): unknown; setDepth(d: number): unknown }[];
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

  constructor() {
    super('Register');
  }

  create(data: RegisterData) {
    this.info = data;
    this.total = data.total;
    this.tendered = data.tendered;
    this.desk = [];
    this.entered = 0;
    this.finished = false;
    session.sale = { items: data.items, total: data.total, paidByCash: data.paidByCash, tendered: data.tendered };
    session.events.emit('say', data.paidByCash ? `HERE'S ${formatCents(data.tendered)}` : 'CARD, PLEASE');

    backdrop(this, TOP);
    this.drawReceipt(data.items, data.paidByCash);
    if (data.paidByCash) this.buildCash();
    else this.buildCard();
    this.input.keyboard?.on('keydown-ESC', () => this.back());
  }

  private drawReceipt(items: string[], cash: boolean) {
    this.add.rectangle(4, TOP + 3, 120, 52, COLOURS.paper).setOrigin(0);
    items.slice(0, 4).forEach((id, i) => {
      const p = getProduct(id);
      label(this, 6, TOP + 4 + i * 9, p.short, COLOURS.ink);
      label(this, 122, TOP + 4 + i * 9, formatCents(p.retail), COLOURS.ink, 'right');
    });
    this.add.rectangle(6, TOP + 41, 116, 1, COLOURS.ink).setOrigin(0);
    label(this, 6, TOP + 44, cash ? 'CASH TOTAL' : 'TOTAL', COLOURS.ink);
    label(this, 122, TOP + 44, formatCents(this.total), COLOURS.ink, 'right');
  }

  // ---- Cash ---------------------------------------------------------------

  private buildCash() {
    const row = (y: number, name: string, value: string, colour: number) => {
      label(this, 128, y, name, COLOURS.dim);
      return label(this, 212, y, value, colour, 'right');
    };
    row(TOP + 5, 'PAID', formatCents(this.tendered), COLOURS.white);
    this.add.rectangle(127, TOP + 16, 87, 13, COLOURS.panelLight).setOrigin(0);
    label(this, 129, TOP + 19, 'CHANGE', COLOURS.gold);
    label(this, 212, TOP + 19, formatCents(this.tendered - this.total), COLOURS.gold, 'right');
    this.givenText = row(TOP + 35, 'GIVEN', '$0.00', COLOURS.white);
    this.messageText = label(this, WIDTH / 2, TOP + 57, 'TAP MONEY TO GIVE IT', COLOURS.dim, 'center');

    DENOMINATIONS.forEach((cents, i) => this.moneyPiece(cents, i));
    button(this, 4, ACTIONS_Y, 42, 44, 'BACK', () => this.back());
    button(this, 48, ACTIONS_Y, 40, 44, 'UNDO', () => this.undo());
    button(this, 90, ACTIONS_Y, 40, 44, 'CLEAR', () => this.clearDesk());
    button(this, 132, ACTIONS_Y, 80, 44, 'GIVE', () => this.giveChange(), COLOURS.accent, null);
  }

  /** A bill or coin you can tap, with its value printed on it. */
  private moneyPiece(cents: number, index: number) {
    const cx = 4 + (index % 4) * CELL_W + CELL_W / 2;
    const cy = MONEY_Y + Math.floor(index / 4) * (CELL_H + 2) + CELL_H / 2;
    const sprite = this.add.image(cx, cy, `money_${cents}`);
    const amount = label(this, cx, cy - 3, denominationLabel(cents), COLOURS.ink, 'center');
    const press = (down: boolean) => {
      sprite.setY(down ? cy + 1 : cy);
      amount.setY((down ? cy + 1 : cy) - 3);
    };
    this.add.rectangle(cx - CELL_W / 2, cy - CELL_H / 2, CELL_W, CELL_H, 0xffffff, 0).setOrigin(0)
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
    // Drop it onto the desk
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

  /** Lays pieces out in two rows, fanning them closer together when there are many. */
  private refreshDesk() {
    this.messageText.setText('');
    const due = this.tendered - this.total;
    const given = this.given();
    this.givenText.setText(formatCents(given));
    this.givenText.setTint(given === due ? COLOURS.green : given > due ? COLOURS.red : COLOURS.white);

    const width = (piece: DeskPiece) => piece.sprite.width;
    const fitRow = (pieces: DeskPiece[], row: { y: number; right: number }, baseDepth: number) => {
      if (pieces.length === 0) return;
      const room = row.right - DESK_LEFT;
      const natural = pieces.reduce((sum, p) => sum + width(p) + 1, -1);
      const squeeze = natural > room ? (natural - room) / Math.max(pieces.length - 1, 1) : 0;
      let x = DESK_LEFT;
      pieces.forEach((piece, i) => {
        const cx = Math.round(x + width(piece) / 2);
        piece.sprite.setPosition(cx, row.y).setDepth(baseDepth + i * 3);
        piece.text.setPosition(cx, row.y - 3).setDepth(baseDepth + i * 3 + 1);
        piece.hit.setPosition(cx, row.y).setDepth(baseDepth + i * 3 + 2);
        x += width(piece) + 1 - squeeze;
      });
    };
    // Fill the shorter front row first, then the longer row below it
    const firstRow: DeskPiece[] = [];
    const secondRow: DeskPiece[] = [];
    let used = 0;
    const room = DESK_ROW_1.right - DESK_LEFT;
    this.desk.forEach((piece) => {
      if (secondRow.length === 0 && used + width(piece) <= room) {
        firstRow.push(piece);
        used += width(piece) + 1;
      } else {
        secondRow.push(piece);
      }
    });
    fitRow(firstRow, DESK_ROW_1, 10);
    fitRow(secondRow, DESK_ROW_2, 100);
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
    this.add.rectangle(128, TOP + 3, 84, 52, 0x101a17).setOrigin(0).setStrokeStyle(1, COLOURS.border);
    label(this, 132, TOP + 7, 'AMOUNT', 0x5fa877);
    this.displayText = label(this, 208, TOP + 21, '$0.00', COLOURS.green, 'right');
    this.messageText = label(this, 170, TOP + 41, '', COLOURS.red, 'center');

    const w = 50;
    const h = 28;
    const x = (col: number) => 6 + col * (w + 2);
    const y = (row: number) => TOP + 58 + row * (h + 2);
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((key, i) => {
      button(this, x(i % 3), y(Math.floor(i / 3)), w, h, key, () => this.pressKey(key), COLOURS.button, sfx.keypad);
    });
    button(this, x(0), y(3), w, h, 'CLR', () => this.pressKey('CLR'), 0x7d3a30, sfx.keypad);
    button(this, x(1), y(3), w * 2 + 2, h, '0', () => this.pressKey('0'), COLOURS.button, sfx.keypad);
    button(this, x(3), y(0), 48, h * 2 + 2, 'BACK', () => this.back());
    button(this, x(3), y(2), 48, h * 2 + 2, 'OK', () => this.pressKey('OK'), COLOURS.accent, null);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        sfx.keypad();
        this.pressKey(e.key);
      } else if (e.key === 'Backspace') this.pressKey('CLR');
      else if (e.key === 'Enter') this.pressKey('OK');
    });
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
    session.sale = null;
    session.modal = false;
    this.info.onBack();
    this.scene.stop();
  }

  private finish(text: string, color: number) {
    this.finished = true;
    this.messageText.setTint(color).setText(text);
    this.time.delayedCall(900, () => {
      session.sale = null;
      session.modal = false;
      this.info.onDone();
      this.scene.stop();
    });
  }
}
