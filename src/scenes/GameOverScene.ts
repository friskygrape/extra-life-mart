import Phaser from 'phaser';
import { sfx } from '../audio';
import { weekOf } from '../logic/calendar';
import { formatCents } from '../logic/money';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, drawPaper, label, mainButton } from '../ui';

const PAPER_X = 14;
const PAPER_W = WIDTH - PAPER_X * 2;
const INK_MUTED = 0x6d6352;
const INK_BAD = 0xb3261e;

/** Rent went unpaid two weeks running. The game stays here, even after a refresh, until you start over. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create() {
    sfx.dayEnd();
    backdrop(this);
    const { state } = session;
    const centre = WIDTH / 2;
    const top = 44;
    drawPaper(this.add.graphics(), PAPER_X, top, PAPER_W, 208, true);

    label(this, centre, top + 14, 'STORE CLOSED', INK_BAD, 'center').setScale(2);
    const said = label(this, centre, top + 40, 'THE RENT WENT UNPAID TWO WEEKS IN A ROW, AND THE LANDLORD TOOK BACK THE KEYS.', INK_MUTED, 'center');
    said.setMaxWidth(PAPER_W - 16);

    const left = PAPER_X + 8;
    const right = PAPER_X + PAPER_W - 8;
    let y = top + 96;
    const row = (name: string, value: string) => {
      label(this, left, y, name, COLOURS.ink);
      label(this, right, y, value, COLOURS.ink, 'right');
      y += 13;
    };
    const daysOpen = state.day - 1;
    row('DAYS OPEN', String(daysOpen));
    row('WEEKS', String(weekOf(daysOpen)));
    row('CUSTOMERS SERVED', String(state.totalServed));
    row('BEST DAY', formatCents(state.bestProfit ?? 0));
    row('SNACKS LICENSED', String(state.unlocked.length));

    label(this, centre, top + 178, 'THE BEACH WILL MISS YOU.', INK_MUTED, 'center');
    label(this, centre, top + 190, 'EVERYONE GETS AN EXTRA LIFE.', COLOURS.ink, 'center');

    mainButton(this, top + 222, 'START OVER', () => {
      session.reset();
      window.location.reload();
    }, sfx.click);
  }
}
