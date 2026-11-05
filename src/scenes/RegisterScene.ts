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

    backdrop(this);
    label(this, 6, 4, 'REGISTER', COLOURS.gold);
    label(this, WIDTH - 6, 4, paidByCash ? 'CASH' : 'CARD', paidByCash ? COLOURS.green : COLOURS.white, 'right');
    this.drawReceipt(data.items);
    if (paidByCash) this.buildCash();
    else this.buildCard();
  }

  private drawReceipt(items: string[]) {
    this.add.rectangle(6, 14, WIDTH - 12, 60, COLOURS.paper).setOrigin(0);
    items.forEach((id, i) => {
      const p = getProduct(id);
      label(this, 10, 17 + i * 10, p.name, COLOURS.ink);
      label(this, WIDTH - 10, 17 + i * 10, formatCents(p.retail), COLOURS.ink, 'right');
    });
    this.add.rectangle(10, 60, WIDTH - 20, 1, COLOURS.ink).setOrigin(0);
    label(this, 10, 63, 'TOTAL', COLOURS.ink);
    label(this, WIDTH - 10, 63, formatCents(this.total), COLOURS.ink, 'right');
  }

  private buildCash() {
    label(this, 6, 79, 'CUSTOMER PAID');
    label(this, WIDTH - 6, 79, formatCents(this.tendered), COLOURS.gold, 'right');
    label(this, 6, 90, 'YOUR CHANGE');
    this.trayText = label(this, WIDTH - 6, 90, '$0.00', COLOURS.green, 'right');
    this.add.rectangle(6, 100, WIDTH - 12, 18, COLOURS.panel).setOrigin(0).setStrokeStyle(1, COLOURS.border);
    this.trayGfx = this.add.graphics();
    this.messageText = label(this, WIDTH / 2, 122, '', COLOURS.red, 'center');

    const w = 40;
    const gap = 2;
    const startX = 6;
    DENOMINATIONS.forEach((cents, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const fill = cents >= 100 ? 0x2f7d55 : 0x9c7a2e;
      button(this, startX + col * (w + gap), 134 + row * 54, w, 50, denominationLabel(cents), () => this.addToTray(cents), fill);
    });
    button(this, 6, 244, 40, 60, 'UNDO', () => this.undo());
    button(this, 48, 244, 40, 60, 'CLEAR', () => this.clearTray());
    button(this, 90, 244, 84, 60, 'GIVE CHANGE', () => this.giveChange(), COLOURS.accent).text.setMaxWidth(80);
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
    let x = 9;
    for (const cents of this.tray) {
      if (x > WIDTH - 16) break;
      if (cents >= 100) {
        this.trayGfx.fillStyle(0x6fc48d).fillRect(x, 105, 10, 8);
        this.trayGfx.fillStyle(0x2f7d55).fillRect(x + 4, 107, 2, 4);
        x += 12;
      } else {
        this.trayGfx.fillStyle(0xf2d27a).fillRect(x, 106, 5, 6);
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
    this.add.rectangle(6, 78, WIDTH - 12, 208, COLOURS.panel).setOrigin(0).setStrokeStyle(1, COLOURS.border);
    this.add.rectangle(14, 83, WIDTH - 28, 20, 0x223a35).setOrigin(0);
    this.displayText = label(this, WIDTH - 20, 89, '$0.00', COLOURS.green, 'right');
    label(this, 20, 89, 'AMOUNT', 0x5fa877);

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'];
    keys.forEach((key, i) => {
      const x = 14 + (i % 3) * 52;
      const y = 108 + Math.floor(i / 3) * 44;
      const fill = key === 'OK' ? COLOURS.accent : key === 'CLR' ? 0x8c3b3b : COLOURS.button;
      button(this, x, y, 48, 40, key, () => this.pressKey(key), fill);
    });
    this.messageText = label(this, WIDTH / 2, 294, '', COLOURS.red, 'center');

    const kb = this.input.keyboard;
    kb?.on('keydown', (e: KeyboardEvent) => {
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
