import Phaser from 'phaser';
import { moneyColour } from '../art/textures';
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

const TOP = 160;
const CELL_W = 52;
const CELL_H = 40;
const MONEY_Y = 246;
const denominationLabel = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}C`);

export class RegisterScene extends Phaser.Scene {
  private data_!: RegisterData;
  private total = 0;
  private tendered = 0;
  private tray: number[] = [];
  private entered = 0;
  private finished = false;
  private givenText!: Phaser.GameObjects.BitmapText;
  private trayGfx!: Phaser.GameObjects.Graphics;
  private messageText!: Phaser.GameObjects.BitmapText;
  private displayText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Register');
  }

  create(data: RegisterData) {
    this.data_ = data;
    this.total = data.total;
    this.tendered = data.tendered;
    this.tray = [];
    this.entered = 0;
    this.finished = false;
    session.sale = { items: data.items, total: data.total, paidByCash: data.paidByCash, tendered: data.tendered };
    session.events.emit('say', data.paidByCash ? `HERE'S ${formatCents(data.tendered)}` : 'CARD, PLEASE');

    backdrop(this, TOP);
    this.drawReceipt(data.items);
    if (data.paidByCash) this.buildCash();
    else this.buildCard();
    this.input.keyboard?.on('keydown-ESC', () => this.back());
  }

  private drawReceipt(items: string[]) {
    this.add.rectangle(4, TOP + 3, 120, 52, COLOURS.paper).setOrigin(0);
    items.slice(0, 4).forEach((id, i) => {
      const p = getProduct(id);
      label(this, 6, TOP + 4 + i * 9, p.short, COLOURS.ink);
      label(this, 122, TOP + 4 + i * 9, formatCents(p.retail), COLOURS.ink, 'right');
    });
    this.add.rectangle(6, TOP + 41, 116, 1, COLOURS.ink).setOrigin(0);
    label(this, 6, TOP + 44, 'TOTAL', COLOURS.ink);
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

    this.add.rectangle(4, TOP + 58, WIDTH - 8, 16, COLOURS.panel).setOrigin(0).setStrokeStyle(1, COLOURS.border);
    this.trayGfx = this.add.graphics();
    this.messageText = label(this, WIDTH / 2, TOP + 77, '', COLOURS.red, 'center');

    DENOMINATIONS.forEach((cents, i) => this.moneyPiece(cents, i));
    button(this, 4, 332, 42, 46, 'BACK', () => this.back());
    button(this, 48, 332, 40, 46, 'UNDO', () => this.undo());
    button(this, 90, 332, 40, 46, 'CLEAR', () => this.clearTray());
    button(this, 132, 332, 80, 46, 'GIVE', () => this.giveChange(), COLOURS.accent, null);
  }

  /** A bill or coin you can tap, with its value printed on it. */
  private moneyPiece(cents: number, index: number) {
    const cx = 4 + (index % 4) * CELL_W + CELL_W / 2;
    const cy = MONEY_Y + Math.floor(index / 4) * (CELL_H + 2) + CELL_H / 2;
    const isBill = cents >= 100;
    const sprite = this.add.image(cx, cy, `money_${cents}`);
    const amount = label(this, cx, cy - 3, denominationLabel(cents), isBill ? COLOURS.ink : 0x2b2420, 'center');
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
        this.addToTray(cents);
      });
  }

  private addToTray(cents: number) {
    if (this.finished) return;
    (cents >= 100 ? sfx.bill : sfx.coin)();
    this.tray.push(cents);
    this.refreshTray();
  }

  private undo() {
    if (this.finished) return;
    this.tray.pop();
    this.refreshTray();
  }

  private clearTray() {
    if (this.finished) return;
    this.tray = [];
    this.refreshTray();
  }

  private given(): number {
    return this.tray.reduce((sum, c) => sum + c, 0);
  }

  private refreshTray() {
    this.messageText.setText('');
    const due = this.tendered - this.total;
    const given = this.given();
    this.givenText.setText(formatCents(given));
    this.givenText.setTint(given === due ? COLOURS.green : given > due ? COLOURS.red : COLOURS.white);
    this.trayGfx.clear();
    let x = 7;
    for (const cents of this.tray) {
      if (x > WIDTH - 18) break;
      this.trayGfx.fillStyle(moneyColour(cents));
      if (cents >= 100) {
        this.trayGfx.fillRect(x, TOP + 62, 10, 8);
        x += 12;
      } else {
        this.trayGfx.fillRect(x, TOP + 63, 5, 6);
        x += 7;
      }
    }
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
    label(this, 132, TOP + 9, 'AMOUNT', 0x5fa877);
    this.displayText = label(this, 208, TOP + 33, '$0.00', COLOURS.green, 'right');
    this.messageText = label(this, WIDTH / 2, TOP + 62, '', COLOURS.red, 'center');

    const w = 50;
    const h = 34;
    const x = (col: number) => 6 + col * (w + 2);
    const y = (row: number) => 232 + row * (h + 2);
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
      this.finish('APPROVED. THANKS!', COLOURS.green);
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
    this.cameras.main.shake(140, 0.012);
  }

  /** Leaves payment without charging, with the items still on the table. */
  private back() {
    if (this.finished) return;
    session.sale = null;
    session.modal = false;
    this.data_.onBack();
    this.scene.stop();
  }

  private finish(text: string, color: number) {
    this.finished = true;
    this.messageText.setTint(color).setText(text);
    this.time.delayedCall(900, () => {
      session.sale = null;
      session.modal = false;
      this.data_.onDone();
      this.scene.stop();
    });
  }
}
