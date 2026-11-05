import Phaser from 'phaser';
import { sfx } from '../audio';
import type { NextDayEvents } from '../logic/day';
import { lockedProducts } from '../logic/licences';
import { formatCents } from '../logic/money';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, button, label } from '../ui';

export class SummaryScene extends Phaser.Scene {
  private confirmingReset = false;

  constructor() {
    super('Summary');
  }

  create({ summary, starterBox }: NextDayEvents) {
    this.confirmingReset = false;
    sfx.dayEnd();
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
    if (summary.upgradeSpend > 0) {
      label(this, 10, 150, 'UPGRADES', COLOURS.dim);
      label(this, WIDTH - 10, 150, formatCents(-summary.upgradeSpend), COLOURS.white, 'right');
    }
    label(this, 10, 164, 'BALANCE');
    label(this, WIDTH - 10, 164, formatCents(summary.balance), COLOURS.gold, 'right');
    const next = lockedProducts(session.state)[0];
    if (next) label(this, WIDTH / 2, 182, `NEXT LICENCE: ${next.short} ${formatCents(next.licence!)}`, COLOURS.dim, 'center');
    if (summary.newBest) label(this, WIDTH / 2, 30, 'NEW BEST DAY!', COLOURS.green, 'center');

    button(this, 48, 214, 120, 40, 'NEXT DAY', () => {
      if (starterBox) session.toast('SUPPLIER SENT A FREE BOX', 4000);
      this.toNextDay();
    }, COLOURS.accent);

    const reset = button(this, 48, 300, 120, 28, 'START OVER', () => {
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
