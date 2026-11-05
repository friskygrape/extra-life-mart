import Phaser from 'phaser';
import { eventOnDay, nextEvent } from '../data/events';
import { WEATHER } from '../data/weather';
import { DAYS_PER_WEEK, WEEKDAYS, daysUntilRent, weekOf, weekdayIndex, weekdayName } from '../logic/calendar';
import { formatCents } from '../logic/money';
import { rentDue } from '../logic/rent';
import { MAX_STARS, stars } from '../logic/reputation';
import { session } from '../session';
import { COLOURS, WIDTH, backdrop, closeButton, drawPaper, label } from '../ui';

const CELL_W = 28;
const LOOK_AHEAD_DAYS = 14;
const INK_MUTED = 0x6d6352;
const INK_BAD = 0xb3261e;

/** The week at a glance: today, rent day, what's coming and how the shop is regarded. */
export class CalendarScene extends Phaser.Scene {
  constructor() {
    super('Calendar');
  }

  create() {
    backdrop(this);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    const { state } = session;
    const { day } = state;

    label(this, 6, 4, `WEEK ${weekOf(day)}`, COLOURS.gold);
    label(this, 6, 14, `${weekdayName(day)}, DAY ${day}`, COLOURS.dim);
    closeButton(this, () => this.close());

    const paperX = 6;
    const paperW = WIDTH - 12;
    drawPaper(this.add.graphics(), paperX, 32, paperW, 72, false);
    const left = paperX + Math.floor((paperW - CELL_W * DAYS_PER_WEEK) / 2);
    const monday = day - weekdayIndex(day);
    WEEKDAYS.forEach((name, i) => {
      const x = left + i * CELL_W;
      const date = monday + i;
      const today = date === day;
      if (today) this.add.rectangle(x, 36, CELL_W, 62, 0xffc65c, 0.55).setOrigin(0);
      const past = date < day;
      const ink = past ? 0xb5ab95 : COLOURS.ink;
      label(this, x + CELL_W / 2, 40, name, ink, 'center');
      label(this, x + CELL_W / 2, 52, String(date), ink, 'center');
      if (i === DAYS_PER_WEEK - 1) label(this, x + CELL_W / 2, 66, 'RENT', past ? ink : INK_BAD, 'center');
      else if (eventOnDay(date)) this.add.image(x + CELL_W / 2, 69, 'star_on').setAlpha(past ? 0.4 : 1);
      if (today) label(this, x + CELL_W / 2, 82, WEATHER[state.weather].short, INK_MUTED, 'center');
    });

    let y = 114;
    const heading = (text: string) => {
      label(this, 8, y, text, COLOURS.gold);
      y += 11;
    };
    const line = (text: string, colour: number = COLOURS.white) => {
      const t = label(this, 8, y, text, colour);
      t.setMaxWidth(WIDTH - 16);
      y += t.height + 3;
    };

    heading('RENT');
    const days = daysUntilRent(day);
    line(`${formatCents(rentDue(state))} DUE ${days === 0 ? 'TONIGHT' : days === 1 ? 'TOMORROW' : `IN ${days} DAYS`}`);
    if (state.rentBehind > 0) line(`INCLUDES ${formatCents(state.rentBehind)} YOU MISSED. MISS THIS AND THE STORE CLOSES!`, COLOURS.red);
    y += 6;

    heading('COMING UP');
    const coming = nextEvent(day, LOOK_AHEAD_DAYS);
    if (coming) {
      const away = coming.day - day;
      const when = away === 0 ? 'TODAY' : away === 1 ? 'TOMORROW' : `${weekdayName(coming.day)}, DAY ${coming.day}`;
      line(`${coming.event.name}: ${when}`);
      line(coming.event.hint, COLOURS.dim);
    } else {
      line('NOTHING ON THE BOARDWALK YET', COLOURS.dim);
    }
    line(`TOMORROW'S WEATHER: ${WEATHER[state.forecast].short}`);
    y += 6;

    heading('REPUTATION');
    const earned = stars(state);
    for (let i = 0; i < MAX_STARS; i++) this.add.image(8 + i * 9, y, i < earned ? 'star_on' : 'star_off').setOrigin(0);
    y += 12;
    line('FAST, CAREFUL SERVICE EARNS STARS. STARS BRING CUSTOMERS AND BIGGER TIPS.', COLOURS.dim);
  }

  private close() {
    session.modal = false;
    this.scene.stop();
  }
}
