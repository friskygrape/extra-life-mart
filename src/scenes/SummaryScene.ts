import Phaser from 'phaser';
import type { NextDayEvents } from '../logic/day';
import { formatCents } from '../logic/money';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, button, label } from '../ui';

export class SummaryScene extends Phaser.Scene {
  private confirmingReset = false;

  constructor() {
    super('Summary');
  }

  create({ summary, delivered, starterBox }: NextDayEvents) {
    this.confirmingReset = false;
    backdrop(this);
    label(this, WIDTH / 2, 18, `DAY ${summary.day} CLOSED`, COLOURS.gold, 'center');

    const rows: [string, string, number][] = [
      ['CUSTOMERS SERVED', String(summary.customersServed), COLOURS.white],
      ['MISSED SALES', String(summary.missedSales), summary.missedSales ? COLOURS.red : COLOURS.white],
      ['SALES', formatCents(summary.revenue), COLOURS.green],
      ['STOCK BOUGHT', formatCents(-summary.orderSpend), COLOURS.white],
      ['CHANGE OVERPAID', formatCents(-summary.overpaid), summary.overpaid ? COLOURS.red : COLOURS.white],
    ];
    rows.forEach(([name, value, color], i) => {
      const y = 44 + i * 16;
      label(this, 10, y, name, COLOURS.dim);
      label(this, WIDTH - 10, y, value, color, 'right');
    });

    this.add.rectangle(10, 128, WIDTH - 20, 1, COLOURS.border).setOrigin(0);
    label(this, 10, 136, 'PROFIT');
    label(this, WIDTH - 10, 136, formatCents(summary.profit), summary.profit >= 0 ? COLOURS.green : COLOURS.red, 'right');
    label(this, 10, 152, 'BALANCE');
    label(this, WIDTH - 10, 152, formatCents(summary.balance), COLOURS.gold, 'right');
    if (summary.newBest) label(this, WIDTH / 2, 172, 'NEW BEST DAY!', COLOURS.gold, 'center');

    button(this, 30, 200, 120, 40, 'NEXT DAY', () => {
      if (starterBox) session.toast('SUPPLIER SENT A FREE BOX', 4000);
      else if (delivered > 0) session.toast(`DELIVERY: ${delivered} ITEMS`, 4000);
      this.toNextDay();
    }, COLOURS.accent);

    const reset = button(this, 30, 264, 120, 26, 'START OVER', () => {
      if (!this.confirmingReset) {
        this.confirmingReset = true;
        reset.setLabel('TAP TO CONFIRM');
        return;
      }
      session.reset();
      this.toNextDay();
    }, COLOURS.panel);
  }

  private toNextDay() {
    this.scene.stop();
    session.events.emit('shelves-changed');
    session.events.emit('begin-day');
  }
}
