import Phaser from 'phaser';
import { getProduct } from '../data/products';
import { checkCard, checkChange, completeSale } from '../logic/checkout';
import { chooseCash } from '../logic/customers';
import { DENOMINATIONS, customerTender, formatCents } from '../logic/money';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, button, label } from '../ui';

interface RegisterData {
  items: string[];
  onDone: (total: number) => void;
}

const TOP = 160;
const denominationLabel = (cents: number) => (cents >= 100 ? `$${cents / 100}` : `${cents}C`);

export class RegisterScene extends Phaser.Scene {
  private onDone!: (total: number) => void;
  private total = 0;
  private tendered = 0;
  private tray: number[] = [];
  private entered = 0;
  private finished = false;
  private trayText!: Phaser.GameObjects.BitmapText;
  private trayGfx!: Phaser.GameObjects.Graphics;
  private messageText!: Phaser.GameObjects.BitmapText;
  private displayText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Register');
  }

  create(data: RegisterData) {
    this.onDone = data.onDone;
    this.total = data.items.reduce((sum, id) => sum + getProduct(id).retail, 0);
    this.tray = [];
    this.entered = 0;
    this.finished = false;
    const paidByCash = chooseCash();
    this.tendered = paidByCash ? customerTender(this.total) : 0;
    session.sale = { items: data.items, total: this.total, paidByCash, tendered: this.tendered };
    session.events.emit('say', paidByCash ? `HERE'S ${formatCents(this.tendered)}` : 'CARD, PLEASE');

    backdrop(this, TOP);
    this.drawReceipt(data.items);
    if (paidByCash) this.buildCash();
    else this.buildCard();
  }

  private drawReceipt(items: string[]) {
    this.add.rectangle(4, TOP + 3, 120, 52, COLOURS.paper).setOrigin(0);
    const lines = items.slice(0, 4);
    lines.forEach((id, i) => {
      const p = getProduct(id);
      label(this, 6, TOP + 4 + i * 9, p.short, COLOURS.ink);
      label(this, 122, TOP + 4 + i * 9, formatCents(p.retail), COLOURS.ink, 'right');
    });
    if (items.length > 4) label(this, 66, TOP + 4 + 3 * 9, `+${items.length - 3}`, COLOURS.ink);
    this.add.rectangle(6, TOP + 41, 116, 1, COLOURS.ink).setOrigin(0);
    label(this, 6, TOP + 44, 'TOTAL', COLOURS.ink);
    label(this, 122, TOP + 44, formatCents(this.total), COLOURS.ink, 'right');
  }

  private buildCash() {
    label(this, 130, TOP + 5, 'THEY PAID', COLOURS.dim);
    label(this, 212, TOP + 15, formatCents(this.tendered), COLOURS.gold, 'right');
    label(this, 130, TOP + 28, 'YOU GIVE', COLOURS.dim);
    this.trayText = label(this, 212, TOP + 38, '$0.00', COLOURS.green, 'right');
    this.add.rectangle(4, TOP + 58, WIDTH - 8, 16, COLOURS.panel).setOrigin(0).setStrokeStyle(1, COLOURS.border);
    this.trayGfx = this.add.graphics();
    this.messageText = label(this, WIDTH / 2, TOP + 77, '', COLOURS.red, 'center');

    DENOMINATIONS.forEach((cents, i) => {
      const fill = cents >= 100 ? 0x2c6e4e : 0x8c6d28;
      button(this, 4 + (i % 4) * 52, 248 + Math.floor(i / 4) * 40, 52, 38, denominationLabel(cents), () => this.addToTray(cents), fill);
    });
    button(this, 4, 330, 48, 48, 'UNDO', () => this.undo());
    button(this, 56, 330, 48, 48, 'CLEAR', () => this.clearTray());
    button(this, 108, 330, 104, 48, 'GIVE CHANGE', () => this.giveChange(), COLOURS.accent);
  }

  private addToTray(cents: number) {
    if (this.finished) return;
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

  private refreshTray() {
    this.messageText.setText('');
    this.trayText.setText(formatCents(this.tray.reduce((sum, c) => sum + c, 0)));
    this.trayGfx.clear();
    let x = 7;
    for (const cents of this.tray) {
      if (x > WIDTH - 18) break;
      if (cents >= 100) {
        this.trayGfx.fillStyle(0x6fc48d).fillRect(x, TOP + 62, 10, 8);
        this.trayGfx.fillStyle(0x2c6e4e).fillRect(x + 4, TOP + 64, 2, 4);
        x += 12;
      } else {
        this.trayGfx.fillStyle(0xf0d27a).fillRect(x, TOP + 63, 5, 6);
        x += 7;
      }
    }
  }

  private giveChange() {
    if (this.finished) return;
    const given = this.tray.reduce((sum, c) => sum + c, 0);
    const result = checkChange(this.total, this.tendered, given);
    if (result.status === 'short') return this.reject('NOT ENOUGH CHANGE');
    const extra = result.status === 'over' ? result.extra : 0;
    if (extra > 0) this.finish(`OOPS! ${formatCents(extra)} TOO MUCH`, COLOURS.gold);
    else this.finish('EXACT CHANGE. THANKS!', COLOURS.green);
    completeSale(session.state, this.total, extra);
  }

  private buildCard() {
    this.add.rectangle(130, TOP + 4, 82, 50, 0x101a17).setOrigin(0).setStrokeStyle(1, COLOURS.border);
    label(this, 134, TOP + 10, 'AMOUNT', 0x5fa877);
    this.displayText = label(this, 208, TOP + 32, '$0.00', COLOURS.green, 'right');
    this.messageText = label(this, WIDTH / 2, TOP + 60, '', COLOURS.red, 'center');

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'];
    keys.forEach((key, i) => {
      const fill = key === 'OK' ? COLOURS.accent : key === 'CLR' ? 0x7d3a30 : COLOURS.button;
      button(this, 6 + (i % 3) * 70, 232 + Math.floor(i / 3) * 37, 64, 34, key, () => this.pressKey(key), fill);
    });

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) this.pressKey(e.key);
      else if (e.key === 'Backspace') this.pressKey('CLR');
      else if (e.key === 'Enter') this.pressKey('OK');
    });
  }

  private pressKey(key: string) {
    if (this.finished) return;
    if (key === 'OK') {
      if (checkCard(this.total, this.entered)) {
        this.finish('APPROVED. THANKS!', COLOURS.green);
        completeSale(session.state, this.total, 0);
      } else {
        this.reject('WRONG AMOUNT');
      }
      return;
    }
    this.messageText.setText('');
    this.entered = key === 'CLR' ? 0 : Math.min(this.entered * 10 + Number(key), 9999999);
    this.displayText.setText(formatCents(this.entered));
  }

  private reject(text: string) {
    this.messageText.setTint(COLOURS.red).setText(text);
    this.cameras.main.shake(140, 0.012);
  }

  private finish(text: string, color: number) {
    this.finished = true;
    this.messageText.setTint(color).setText(text);
    this.time.delayedCall(900, () => {
      session.sale = null;
      session.modal = false;
      this.onDone(this.total);
      this.scene.stop();
    });
  }
}
