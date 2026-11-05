import Phaser from 'phaser';
import { sfx } from '../audio';
import type { NextDayEvents } from '../logic/day';
import { lockedProducts } from '../logic/licences';
import { formatCents } from '../logic/money';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, label, mainButton, secondaryButton } from '../ui';

const PAPER_X = 14;
const PAPER_W = WIDTH - PAPER_X * 2;
const INK_MUTED = 0x6d6352;
const INK_GOOD = 0x1f7a4d;
const INK_BAD = 0xb0352b;

export class SummaryScene extends Phaser.Scene {
  private confirmingReset = false;

  constructor() {
    super('Summary');
  }

  create({ summary, starterBox }: NextDayEvents) {
    this.confirmingReset = false;
    sfx.dayEnd();
    backdrop(this);

    const left = PAPER_X + 8;
    const right = PAPER_X + PAPER_W - 8;
    const centre = WIDTH / 2;
    const top = 8;
    const paperH = 262;

    // The paper, with a torn edge along the bottom
    this.add.rectangle(PAPER_X, top, PAPER_W, paperH, COLOURS.paper).setOrigin(0);
    const edge = this.add.graphics();
    edge.fillStyle(COLOURS.paper);
    for (let x = 0; x + 6 <= PAPER_W; x += 6) edge.fillTriangle(PAPER_X + x, top + paperH, PAPER_X + x + 6, top + paperH, PAPER_X + x + 3, top + paperH + 4);

    label(this, centre, top + 8, 'EXTRA LIFE MART', COLOURS.ink, 'center');
    label(this, centre, top + 20, `DAY ${summary.day} RECEIPT`, INK_MUTED, 'center');
    const rule = (y: number) => {
      for (let x = left; x < right; x += 4) this.add.rectangle(x, y, 2, 1, INK_MUTED).setOrigin(0);
    };
    rule(top + 33);

    const row = (y: number, name: string, value: string, color: number = COLOURS.ink) => {
      label(this, left, y, name, COLOURS.ink);
      label(this, right, y, value, color, 'right');
    };
    row(top + 41, 'SERVED', String(summary.customersServed));
    row(top + 54, 'MISSED SALES', String(summary.missedSales), summary.missedSales ? INK_BAD : COLOURS.ink);
    rule(top + 67);
    row(top + 75, 'SALES', formatCents(summary.revenue), INK_GOOD);
    row(top + 88, 'STOCK BOUGHT', formatCents(-summary.orderSpend));
    row(top + 101, 'OVERPAID', formatCents(-summary.overpaid), summary.overpaid ? INK_BAD : COLOURS.ink);
    rule(top + 114);
    row(top + 122, 'PROFIT', formatCents(summary.profit), summary.profit >= 0 ? INK_GOOD : INK_BAD);
    if (summary.newBest) label(this, centre, top + 135, 'NEW BEST DAY!', INK_GOOD, 'center');
    rule(top + 148);
    const spent = summary.upgradeSpend > 0;
    if (spent) row(top + 156, 'UPGRADES', formatCents(-summary.upgradeSpend));
    row(top + (spent ? 169 : 162), 'BALANCE', formatCents(summary.balance));
    rule(top + 182);
    const next = lockedProducts(session.state)[0];
    if (next) {
      label(this, centre, top + 192, 'NEXT LICENCE', INK_MUTED, 'center');
      label(this, centre, top + 203, `${next.name} ${formatCents(next.licence!)}`, COLOURS.ink, 'center');
    }
    label(this, centre, top + 224, 'THANK YOU!', INK_MUTED, 'center');
    // A little barcode to finish the receipt
    [1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3].reduce((x, w, i) => {
      if (i % 2 === 0) this.add.rectangle(x, top + 238, w, 14, COLOURS.ink).setOrigin(0);
      return x + w + 1;
    }, centre - 19);

    mainButton(this, top + paperH + 10, 'NEXT DAY', () => {
      if (starterBox) session.toast('SUPPLIER SENT A FREE BOX', 4000);
      this.toNextDay();
    }, sfx.click);

    const reset = secondaryButton(this, top + paperH + 46, 'START OVER', () => {
      if (!this.confirmingReset) {
        this.confirmingReset = true;
        reset.setLabel('TAP AGAIN TO CONFIRM');
        return;
      }
      session.reset();
      this.toNextDay();
    });
  }

  private toNextDay() {
    this.scene.stop();
    session.events.emit('shelves-changed');
    session.events.emit('begin-day');
  }
}
