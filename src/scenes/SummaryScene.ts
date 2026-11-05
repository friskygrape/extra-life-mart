import Phaser from 'phaser';
import { sfx } from '../audio';
import type { NextDayEvents } from '../logic/day';
import { weekdayName } from '../logic/calendar';
import { lockedProducts } from '../logic/licences';
import { rentDue } from '../logic/rent';
import { formatCents } from '../logic/money';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, drawPaper, label, mainButton } from '../ui';

const PAPER_X = 14;
const PAPER_W = WIDTH - PAPER_X * 2;
const INK_MUTED = 0x6d6352;
const INK_GOOD = 0x0b6b3a;
const INK_BAD = 0xb3261e;

export class SummaryScene extends Phaser.Scene {
  constructor() {
    super('Summary');
  }

  create({ summary, starterBox }: NextDayEvents) {
    sfx.dayEnd();
    backdrop(this);

    const left = PAPER_X + 8;
    const right = PAPER_X + PAPER_W - 8;
    const centre = WIDTH / 2;
    const top = 6;
    const paperH = 318;
    const ROW = 12;
    const { rent } = summary;
    const { state } = session;

    // The paper, with a torn edge along the bottom
    drawPaper(this.add.graphics(), PAPER_X, top, PAPER_W, paperH, true, COLOURS.ink);

    label(this, centre, top + 6, 'EXTRA LIFE MART', COLOURS.ink, 'center');
    label(this, centre, top + 16, `${weekdayName(summary.day)} DAY ${summary.day} RECEIPT`, INK_MUTED, 'center');
    let y = top + 27;
    const rule = () => {
      for (let x = left; x < right; x += 4) this.add.rectangle(x, y, 2, 1, INK_MUTED).setOrigin(0);
      y += 6;
    };
    const row = (name: string, value: string, color: number = COLOURS.ink) => {
      label(this, left, y, name, COLOURS.ink);
      label(this, right, y, value, color, 'right');
      y += ROW;
    };
    const note = (text: string, color: number) => {
      const t = label(this, centre, y, text, color, 'center');
      t.setMaxWidth(right - left);
      y += t.height + 3;
    };

    rule();
    row('SERVED', String(summary.customersServed));
    row('MISSED SALES', String(summary.missedSales), summary.missedSales ? INK_BAD : COLOURS.ink);
    rule();
    row('SALES', formatCents(summary.revenue), INK_GOOD);
    row('TIPS', formatCents(summary.tips), summary.tips ? INK_GOOD : COLOURS.ink);
    row('STOCK BOUGHT', formatCents(-summary.orderSpend), summary.orderSpend ? INK_BAD : COLOURS.ink);
    row('OVERPAID', formatCents(-summary.overpaid), summary.overpaid ? INK_BAD : COLOURS.ink);
    rule();
    row('PROFIT', formatCents(summary.profit), summary.profit >= 0 ? INK_GOOD : INK_BAD);
    if (summary.newBest) note('NEW BEST DAY!', INK_GOOD);
    rule();
    if (summary.upgradeSpend > 0) row('UPGRADES', formatCents(-summary.upgradeSpend), INK_BAD);
    if (rent?.status === 'paid') row('RENT', formatCents(-rent.amount), INK_BAD);
    row('BALANCE', formatCents(summary.balance));
    rule();

    if (rent?.status === 'paid') {
      note('RENT PAID!', INK_GOOD);
    } else if (rent?.status === 'missed') {
      note('RENT MISSED! THIS IS A WARNING.', INK_BAD);
      note(`NEXT SUNDAY YOU OWE ${formatCents(rent.owedNext)}. MISS IT AND THE STORE CLOSES.`, INK_BAD);
    } else if (rent?.status === 'closed') {
      note(`YOU OWED ${formatCents(rent.amount)} AND COULD NOT PAY.`, INK_BAD);
    } else {
      note(`SUNDAY'S RENT: ${formatCents(rentDue(state))}`, state.rentBehind > 0 ? INK_BAD : INK_MUTED);
    }
    if (rent?.status !== 'missed' && rent?.status !== 'closed') {
      const next = lockedProducts(state)[0];
      if (next) {
        note('NEXT LICENCE', INK_MUTED);
        note(`${next.name} ${formatCents(next.licence!)}`, COLOURS.ink);
      }
    }
    // A little barcode to finish the receipt
    [1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3].reduce((x, w, i) => {
      if (i % 2 === 0) this.add.rectangle(x, top + paperH - 19, w, 12, COLOURS.ink).setOrigin(0);
      return x + w + 1;
    }, centre - 19);

    const closing = state.closed;
    mainButton(this, top + paperH + 8, closing ? 'CLOSE THE SHOP' : 'NEXT DAY', () => {
      if (closing) {
        this.scene.stop();
        this.scene.launch('GameOver');
        return;
      }
      if (starterBox) session.toast('SUPPLIER SENT A FREE BOX', 4000);
      this.toNextDay();
    }, sfx.click);
  }

  private toNextDay() {
    this.scene.stop();
    session.events.emit('shelves-changed');
    session.events.emit('begin-day');
  }
}
