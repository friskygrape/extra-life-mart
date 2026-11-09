import Phaser from 'phaser';
import { BLENDER, COFFEE_COLOUR, SMOOTHIE_COLOURS, drawBlender, drawBlenderGlass } from '../art/appliances';
import { COFFEE_ART, ICE_ART, STATION, decanterKey, decanterState, scaledTexture, type DecanterState } from '../art/coffeeArt';
import { ITEM_SCALE } from '../art/textures';
import { sfx } from '../audio';
import { BLEND_SECONDS, smoothieFor } from '../data/appliances';
import { getProduct } from '../data/products';
import { canLoadFruit, emptyBlender, pourDrink, returnDrink, smoothieReady, startBlend, startBrew } from '../logic/appliances';
import { canAddToTable, isOrderComplete } from '../logic/basket';
import { L } from '../layout';
import { session } from '../session';
import { BUTTONS, COLOURS, bigLabel, button, label, tinyLabel, type Button } from '../ui';

const TABLE_CAPACITY = 4;
const PANEL_PAD = 6;
const HINT_H = 16;
const ACTION_H = 26;
const GAP = 4;
const POUR_MS = 650;

/** Whether the customer at the window still needs one of this drink. */
function wanted(drinkId: string): boolean {
  return session.wants !== null && session.table.length < TABLE_CAPACITY && canAddToTable(session.wants, session.table, drinkId);
}

/**
 * A close-up of an appliance, over the shelves like the payment screen, so the customer is still in view.
 * The shop keeps running above it: the clock, the customer's patience and the machine itself.
 */
abstract class DrinkStation extends Phaser.Scene {
  protected top = 0;
  protected hint!: Phaser.GameObjects.BitmapText;
  protected countdown!: Phaser.GameObjects.BitmapText;
  protected machine!: Phaser.GameObjects.Graphics;
  /** What's inside the machine, redrawn every frame. */
  protected contents!: Phaser.GameObjects.Graphics;
  protected machineX = 0;
  protected machineY = 0;
  protected scale_ = 1;
  protected columnX = 0;
  protected columnW = 0;
  protected pouring = false;
  private buttons: { button: Button; enabled: () => boolean; label?: () => string }[] = [];

  protected abstract readonly machineSize: { w: number; h: number };
  protected abstract build(): void;
  protected abstract drawMachine(on: boolean): void;
  protected abstract drawContents(): void;
  protected abstract hintText(): string;
  protected abstract secondsLeft(): number;

  create() {
    this.top = L.counterBottom;
    this.buttons = [];
    this.pouring = false;
    const floor = L.H - L.safeBottom - 3;
    const panelH = floor - this.top;
    // Tapping above the panel closes it, like the payment screen.
    this.add.rectangle(0, 0, L.W, this.top, 0xffffff, 0).setOrigin(0).setInteractive().on('pointerup', () => this.close());
    this.add.rectangle(0, this.top, L.W, L.H - this.top, COLOURS.bg).setOrigin(0).setInteractive();

    this.hint = label(this, PANEL_PAD, this.top + 5, '', COLOURS.gold);
    const close = button(this, L.W - BUTTONS.closeW - PANEL_PAD, this.top + 3, BUTTONS.closeW, BUTTONS.compactH, 'CLOSE', () => this.close());
    close.rect.setDepth(2);
    close.text.setDepth(3);

    // The machine fills the left side, as tall as the panel allows.
    const roomH = panelH - HINT_H - 12;
    this.scale_ = this.chooseScale(roomH);
    this.machineX = PANEL_PAD + 4;
    this.machineY = this.top + HINT_H + 8;
    this.machine = this.add.graphics();
    this.contents = this.add.graphics();
    this.columnX = Math.round(this.machineX + this.machineSize.w * this.scale_ + 10);
    this.columnW = L.W - this.columnX - PANEL_PAD;
    this.countdown = bigLabel(this, this.machineX + (this.machineSize.w * this.scale_) / 2, this.machineY - 2, '', COLOURS.white, 'center').setDepth(5);
    this.drawMachine(false);
    this.build();
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.refresh();
  }

  update() {
    const left = this.secondsLeft();
    this.countdown.setText(left > 0 ? String(Math.ceil(left)) : '');
    this.drawMachine(left > 0);
    this.contents.clear();
    this.drawContents();
    this.refresh();
  }

  /** A button down the right-hand column, re-checked every frame. */
  protected action(y: number, h: number, text: string, onTap: () => void, enabled: () => boolean, fill = COLOURS.button, labelFn?: () => string, x = this.columnX, w = this.columnW) {
    const b = button(this, x, y, w, h, text, () => {
      if (!this.pouring && enabled()) onTap();
    }, fill);
    this.buttons.push({ button: b, enabled, label: labelFn });
    return b;
  }

  protected refresh() {
    for (const { button: b, enabled, label: labelFn } of this.buttons) {
      b.setEnabled(!this.pouring && enabled());
      if (labelFn) b.setLabel(labelFn());
    }
    this.hint.setText(this.hintText());
    this.onRefresh();
  }

  /** Anything else that follows the machine's state. */
  protected onRefresh() {}

  /** How big to draw the machine, in game pixels per unit. */
  protected chooseScale(roomH: number) {
    return roomH / this.machineSize.h;
  }

  /** Something dropping from a button into the machine. */
  protected dropIn(key: string, fromX: number, fromY: number, toX: number, toY: number, onDone: () => void) {
    const item = this.add.image(fromX, fromY, key).setScale(ITEM_SCALE).setDepth(6);
    this.pouring = true;
    this.tweens.add({
      targets: item,
      x: toX,
      y: toY,
      scale: ITEM_SCALE * 0.7,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete: () => {
        item.destroy();
        this.pouring = false;
        onDone();
      },
    });
  }

  /** Pours a drink into a cup under the machine, then sends the cup up to the counter. */
  protected pour(drinkId: string, streamX: number, streamTop: number, colour: number) {
    this.pouring = true;
    sfx.click();
    const cupX = streamX;
    const cupY = this.machineY + this.machineSize.h * this.scale_ + 2;
    const stream = this.add.rectangle(streamX, streamTop, 2, cupY - streamTop - 8, colour).setOrigin(0.5, 0).setDepth(4);
    const cup = this.add.image(cupX, cupY, `item_${drinkId}`).setOrigin(0.5, 1).setScale(ITEM_SCALE * 1.4, 0.05).setDepth(5);
    this.tweens.add({ targets: cup, scaleY: ITEM_SCALE * 1.4, duration: POUR_MS, ease: 'Quad.easeOut' });
    this.time.delayedCall(POUR_MS, () => {
      stream.destroy();
      this.tweens.add({
        targets: cup,
        y: this.top - 10,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => {
          cup.destroy();
          this.pouring = false;
          session.events.emit('pour-drink', drinkId);
          // The order's done, so get out of the way for payment.
          if (session.wants && isOrderComplete(session.wants, session.table)) this.close();
        },
      });
    });
  }

  protected close() {
    session.modal = false;
    this.scene.stop();
  }

  /** A point on the machine, in its own units, on screen. */
  protected at(x: number, y: number) {
    return { x: this.machineX + x * this.scale_, y: this.machineY + y * this.scale_ };
  }
}

type CupKind = 'hot' | 'iced';
const CUP_DRINK: Record<CupKind, string> = { hot: 'coffee', iced: 'iced_coffee' };

/**
 * The coffee station from the user's mock-up, worked by tapping its things: the filters and beans go into the
 * machine, the red switch brews a pot into the decanter, then it sits on its warmer. Tapping a white cup (hot) or
 * an orange cup (iced) sets one out and fills it; iced coffee then takes a scoop from the ice bin; tapping the
 * full cup hands it over.
 */
export class CoffeeScene extends Phaser.Scene {
  private top = 0;
  private k = 1;
  private ox = 0;
  private oy = 0;
  private hint!: Phaser.GameObjects.BitmapText;
  private countdown!: Phaser.GameObjects.BitmapText;
  private beansCount!: Phaser.GameObjects.BitmapText;
  private decanter!: Phaser.GameObjects.Image;
  private decanterW = 0;
  private decanterH = 0;
  private basketFill!: Phaser.GameObjects.Graphics;
  private powerOff!: Phaser.GameObjects.Rectangle;
  private powerGlow!: Phaser.GameObjects.Arc;
  private drips: Phaser.GameObjects.Rectangle[] = [];
  /** The filter and beans going in are just for show until the switch is flipped. */
  private filterIn = false;
  private beansIn = false;
  /** The cup set out to fill and serve. */
  private cup: { kind: CupKind; filled: boolean; iced: boolean; image: Phaser.GameObjects.Image; ice?: Phaser.GameObjects.Image } | null = null;
  private busy = false;
  private wasBrewing = false;

  constructor() {
    super('Coffee');
  }

  /** A point in the mock-up's pixels, on screen. */
  private at(x: number, y: number) {
    return { x: this.ox + x * this.k, y: this.oy + y * this.k };
  }

  create() {
    this.top = L.counterBottom;
    this.drips = [];
    this.filterIn = false;
    this.beansIn = false;
    this.cup = null;
    this.busy = false;
    const floor = L.H - L.safeBottom;
    // The station fills the width, and its machine reaches up over the counter's edge as in the mock-up.
    this.k = Math.min(L.W / STATION.w, (floor - this.top + STATION.overCounter * (L.W / STATION.w)) / STATION.h);
    const w = STATION.w * this.k;
    this.ox = Math.round((L.W - w) / 2);
    this.oy = this.top - STATION.overCounter * this.k;

    // Tapping above it closes it, like the payment screen.
    this.add.rectangle(0, 0, L.W, this.top - 4, 0xffffff, 0).setOrigin(0).setInteractive().on('pointerup', () => this.close());
    // The counter's wood runs on below the station on tall screens.
    this.add.rectangle(0, this.top, L.W, L.H - this.top, 0x5a3a22).setOrigin(0).setInteractive();
    this.add.image(this.ox, this.oy, scaledTexture(this, STATION.key, w, STATION.h * this.k)).setOrigin(0).setScale(1 / L.renderScale);

    this.basketFill = this.add.graphics().setDepth(1.5);
    const pw = STATION.power;
    const power = this.at(pw.x, pw.y);
    this.powerOff = this.add.rectangle(power.x, power.y, pw.w * this.k, pw.h * this.k, 0x000000, 0.55).setOrigin(0).setDepth(1.6);
    this.powerGlow = this.add.circle(power.x + (pw.w * this.k) / 2, power.y + (pw.h * this.k) / 2, pw.h * this.k * 0.9, 0xff3030, 0.25).setDepth(1.4).setVisible(false);
    this.tweens.add({ targets: this.powerGlow, alpha: 0.05, duration: 500, yoyo: true, repeat: -1 });

    // The decanter, from the user's fill states, turning about its spout to pour
    this.decanterH = STATION.decanter.h * this.k;
    this.decanterW = (this.decanterH * COFFEE_ART.decanter.w) / COFFEE_ART.decanter.h;
    const sp = COFFEE_ART.spout;
    this.decanter = this.add.image(0, 0, this.decanterTexture('empty')).setOrigin(sp.x / COFFEE_ART.decanter.w, sp.y / COFFEE_ART.decanter.h).setScale(1 / L.renderScale).setDepth(2);
    const st = session.state;
    this.wasBrewing = st.brewLeft > 0;
    this.placeDecanter(this.wasBrewing ? 'inMachine' : 'onWarmer');

    // The wall above the warmer holds the close button and what to do next.
    const wall = this.at(STATION.wall.x, STATION.wall.y);
    const close = button(this, L.W - BUTTONS.closeW - 4, Math.max(this.top + 3, wall.y), BUTTONS.closeW, BUTTONS.compactH, 'CLOSE', () => this.close());
    close.rect.setDepth(5);
    close.text.setDepth(6);
    this.hint = tinyLabel(this, wall.x, Math.max(this.top + 3, wall.y) + BUTTONS.compactH + 4, '', COLOURS.gold).setDepth(5);
    this.hint.setMaxWidth(L.W - wall.x - 4);
    const machineTop = this.at(STATION.basket.x + STATION.basket.w / 2, STATION.basket.y - 60);
    this.countdown = bigLabel(this, machineTop.x, machineTop.y, '', COLOURS.white, 'center').setDepth(5);
    const jar = this.at(STATION.beans.x + STATION.beans.w / 2, STATION.beans.y - 34);
    this.beansCount = tinyLabel(this, jar.x, jar.y, '', COLOURS.white, 'center').setDepth(5);

    // Tap the things themselves
    const zone = (r: { x: number; y: number; w: number; h: number }, onTap: () => void) => {
      const p = this.at(r.x, r.y);
      this.add.rectangle(p.x, p.y, r.w * this.k, r.h * this.k, 0xffffff, 0).setOrigin(0).setDepth(10).setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          if (!this.busy) onTap();
        });
    };
    zone(STATION.filters, () => this.tapFilters());
    zone(STATION.beans, () => this.tapBeans());
    // The switch is small, so its tap area reaches well beyond it.
    zone({ x: pw.x - 60, y: pw.y - 50, w: pw.w + 120, h: pw.h + 100 }, () => this.tapPower());
    zone(STATION.hotCups, () => this.tapCups('hot'));
    zone(STATION.icedCups, () => this.tapCups('iced'));
    zone(STATION.ice, () => this.tapIce());
    zone({ x: STATION.cup.x - 90, y: STATION.cup.y - STATION.cup.h - 20, w: 180, h: STATION.cup.h + 40 }, () => this.tapCup());

    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private decanterTexture(state: DecanterState) {
    return scaledTexture(this, decanterKey(state), this.decanterW, this.decanterH);
  }

  /** Where the decanter's spout sits when it stands in the machine or on its warmer. */
  private decanterSpot(where: 'inMachine' | 'onWarmer') {
    const base = STATION.decanter[where];
    const p = this.at(base.x, base.y);
    const sp = COFFEE_ART.spout;
    return { x: p.x + (sp.x / COFFEE_ART.decanter.w) * this.decanterW, y: p.y - this.decanterH + (sp.y / COFFEE_ART.decanter.h) * this.decanterH };
  }

  private placeDecanter(where: 'inMachine' | 'onWarmer') {
    const spot = this.decanterSpot(where);
    this.decanter.setPosition(spot.x, spot.y).setAngle(0);
  }

  private moveDecanter(where: 'inMachine' | 'onWarmer') {
    const spot = this.decanterSpot(where);
    this.tweens.add({ targets: this.decanter, x: spot.x, y: spot.y, duration: 320, ease: 'Quad.easeInOut' });
  }

  update() {
    const st = session.state;
    const brewing = st.brewLeft > 0;
    if (brewing !== this.wasBrewing && !this.busy) {
      // Into the machine to brew, then back onto its warmer
      this.moveDecanter(brewing ? 'inMachine' : 'onWarmer');
      this.wasBrewing = brewing;
    }
    this.countdown.setText(brewing ? String(Math.ceil(st.brewLeft)) : '');
    this.powerOff.setVisible(!brewing);
    this.powerGlow.setVisible(brewing);
    this.decanter.setTexture(this.decanterTexture(decanterState(st.coffeePot, st.brewLeft)));
    this.beansCount.setText(`x${st.stockroom.beans ?? 0}`);
    this.drawBasket(brewing);
    if (brewing && this.drips.length === 0) this.startDrips();
    if (!brewing && this.drips.length > 0) this.stopDrips();
    this.hint.setText(this.hintText());
  }

  /** The paper filter in the basket, and the grounds on it, until the pot's been used up. */
  private drawBasket(brewing: boolean) {
    const st = session.state;
    const g = this.basketFill.clear();
    const b = STATION.basket;
    const k = this.k;
    if (this.filterIn || brewing || st.coffeePot > 0) {
      const p = this.at(b.x + 10, b.y);
      g.fillStyle(0xf3eee4).fillRect(p.x, p.y, (b.w - 20) * k, 14 * k);
      g.fillStyle(0xd9d0c0).fillRect(p.x, p.y + 10 * k, (b.w - 20) * k, 4 * k);
    }
    if (this.beansIn || brewing || st.coffeePot > 0) {
      const p = this.at(b.x + 40, b.y - 10);
      g.fillStyle(0x4a2a14).fillRect(p.x, p.y, (b.w - 80) * k, 14 * k);
      g.fillStyle(0x6b4022).fillRect(p.x + 14 * k, p.y, (b.w - 110) * k, 5 * k);
    }
  }

  private startDrips() {
    const { x, from, to } = STATION.drip;
    const top = this.at(x, from);
    const bottom = this.at(x, to);
    for (let i = 0; i < 3; i++) {
      const drip = this.add.rectangle(top.x, top.y, Math.max(1, 6 * this.k), Math.max(2, 10 * this.k), COFFEE_COLOUR).setDepth(1.8);
      this.tweens.add({ targets: drip, y: bottom.y, duration: 380, delay: i * 130, repeat: -1, ease: 'Quad.easeIn' });
      this.drips.push(drip);
    }
  }

  private stopDrips() {
    this.drips.forEach((d) => d.destroy());
    this.drips = [];
  }

  /** Something flying from where it was tapped into place. */
  private fly(key: string, from: { x: number; y: number }, to: { x: number; y: number }, h: number, onDone: () => void) {
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const w = (h * src.width) / src.height;
    const item = this.add.image(from.x, from.y, scaledTexture(this, key, w, h)).setScale(1 / L.renderScale).setDepth(6);
    this.busy = true;
    this.tweens.add({
      targets: item,
      x: to.x,
      y: to.y,
      duration: 360,
      ease: 'Quad.easeIn',
      onComplete: () => {
        item.destroy();
        this.busy = false;
        onDone();
      },
    });
  }

  private ready() {
    const st = session.state;
    return st.coffeePot === 0 && st.brewLeft === 0;
  }

  private centre(r: { x: number; y: number; w: number; h: number }) {
    return this.at(r.x + r.w / 2, r.y + r.h / 2);
  }

  private tapFilters() {
    if (!this.ready() || this.filterIn) return sfx.error();
    const basket = this.at(STATION.basket.x + STATION.basket.w / 2, STATION.basket.y + 6);
    this.fly('item_filter', this.centre(STATION.filters), basket, 20, () => {
      sfx.click();
      this.filterIn = true;
    });
  }

  private tapBeans() {
    const st = session.state;
    if (!this.ready() || !this.filterIn || this.beansIn || (st.stockroom.beans ?? 0) <= 0) return sfx.error();
    const basket = this.at(STATION.basket.x + STATION.basket.w / 2, STATION.basket.y);
    this.fly('item_beans', this.centre(STATION.beans), basket, 20, () => {
      sfx.pickUp();
      this.beansIn = true;
    });
  }

  private tapPower() {
    if (!this.filterIn || !this.beansIn || !startBrew(session.state)) return sfx.error();
    sfx.click();
    this.filterIn = false;
    this.beansIn = false;
  }

  /** A cup comes out of its stack to stand in front of the machine, and the pot fills it. */
  private tapCups(kind: CupKind) {
    const st = session.state;
    const drink = CUP_DRINK[kind];
    if (this.cup || st.brewLeft > 0 || st.coffeePot <= 0 || !wanted(drink)) return sfx.error();
    const h = STATION.cup.h * this.k;
    const spot = this.at(STATION.cup.x, STATION.cup.y);
    const from = this.centre(kind === 'hot' ? STATION.hotCups : STATION.icedCups);
    this.fly(`item_${drink}`, from, { x: spot.x, y: spot.y - h / 2 }, h, () => {
      const src = this.textures.get(`item_${drink}`).getSourceImage() as HTMLImageElement;
      const w = (h * src.width) / src.height;
      const image = this.add.image(spot.x, spot.y, scaledTexture(this, `item_${drink}`, w, h)).setOrigin(0.5, 1).setScale(1 / L.renderScale).setDepth(3);
      this.cup = { kind, filled: false, iced: false, image };
      this.pourInto();
    });
  }

  /** The decanter comes off its warmer, tips over the cup and pours, then goes back. */
  private pourInto() {
    const cup = this.cup!;
    const st = session.state;
    if (!pourDrink(st, CUP_DRINK[cup.kind])) return;
    this.busy = true;
    sfx.click();
    const spot = this.at(STATION.cup.x, STATION.cup.y - STATION.cup.h);
    const spout = { x: spot.x - 4 * this.k, y: spot.y - 40 * this.k };
    // Show the pot as it was before this cup came out of it, while it pours
    this.tweens.add({
      targets: this.decanter,
      x: spout.x,
      y: spout.y,
      angle: -35,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        const stream = this.add.rectangle(spout.x, spout.y, Math.max(2, 8 * this.k), spot.y - spout.y + 16 * this.k, COFFEE_COLOUR).setOrigin(0.5, 0).setDepth(2.5);
        this.time.delayedCall(POUR_MS, () => {
          stream.destroy();
          cup.filled = true;
          const home = this.decanterSpot('onWarmer');
          this.tweens.add({ targets: this.decanter, x: home.x, y: home.y, angle: 0, duration: 300, ease: 'Quad.easeInOut', onComplete: () => (this.busy = false) });
        });
      },
    });
  }

  /** A scoop from the ice bin for an iced coffee. */
  private tapIce() {
    const cup = this.cup;
    if (!cup || cup.kind !== 'iced' || !cup.filled || cup.iced) return sfx.error();
    const top = this.at(STATION.cup.x, STATION.cup.y - STATION.cup.h);
    const h = 40 * this.k;
    this.fly(ICE_ART.key, this.centre(STATION.ice), top, h, () => {
      sfx.pickUp();
      cup.iced = true;
      const w = (h * ICE_ART.w) / ICE_ART.h;
      cup.ice = this.add.image(top.x, top.y + h * 0.35, scaledTexture(this, ICE_ART.key, w * 0.8, h * 0.8)).setOrigin(0.5, 1).setScale(1 / L.renderScale).setDepth(3.5);
    });
  }

  /** A full cup goes up to the counter for the customer. */
  private tapCup() {
    const cup = this.cup;
    if (!cup || !cup.filled) return sfx.error();
    if (cup.kind === 'iced' && !cup.iced) return sfx.error();
    const drink = CUP_DRINK[cup.kind];
    this.busy = true;
    sfx.pickUp();
    this.tweens.add({
      targets: [cup.image, cup.ice].filter(Boolean),
      y: this.top - 10,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeIn',
      onComplete: () => {
        cup.image.destroy();
        cup.ice?.destroy();
        this.cup = null;
        this.busy = false;
        session.events.emit('serve-drink', drink);
        if (session.wants && isOrderComplete(session.wants, session.table)) this.close();
      },
    });
  }

  private hintText() {
    const st = session.state;
    if (st.brewLeft > 0) return 'BREWING...';
    const cup = this.cup;
    if (cup) {
      if (!cup.filled) return 'POURING...';
      if (cup.kind === 'iced' && !cup.iced) return 'TAP THE ICE';
      return 'TAP THE CUP TO SERVE';
    }
    if (st.coffeePot > 0) {
      if (wanted('iced_coffee')) return 'TAP AN ORANGE CUP FOR ICED';
      if (wanted('coffee')) return 'TAP A WHITE CUP';
      return `${st.coffeePot} ${st.coffeePot === 1 ? 'CUP' : 'CUPS'} READY`;
    }
    if (!this.filterIn) return 'TAP THE FILTERS';
    if (!this.beansIn) return (st.stockroom.beans ?? 0) > 0 ? 'TAP THE BEANS' : 'NO BEANS: ORDER ON THE PC';
    return 'FLIP THE RED SWITCH';
  }

  private close() {
    // A cup that was filled but not served goes back in the pot.
    if (this.cup?.filled) returnDrink(session.state, 'coffee');
    session.modal = false;
    this.scene.stop();
  }
}

const FRUITS = ['mango', 'pineapple', 'watermelon'];

/** One fruit and some ice, five seconds of blending, one smoothie. */
export class BlenderScene extends DrinkStation {
  protected readonly machineSize = BLENDER;
  /** The fruit and ice going in are just for show until BLEND is pressed. */
  private fruitIn: string | null = null;
  private iceIn = false;
  private counts: { fruit: string; text: Phaser.GameObjects.BitmapText }[] = [];

  constructor() {
    super('Blender');
  }

  protected build() {
    this.fruitIn = null;
    this.iceIn = false;
    this.counts = [];
    const st = session.state;
    const jar = BLENDER.jar;
    const jarMouth = this.at(jar.x + jar.w / 2, jar.y + 4);
    const empty = () => st.blenderJar === null && st.blendLeft === 0 && this.fruitIn === null;
    // The three fruits along the top of the column, each with how many are in stock
    let y = this.top + BUTTONS.compactH + 8;
    const fruitW = Math.floor((this.columnW - GAP * 2) / 3);
    const fruitH = 34;
    FRUITS.forEach((fruit, i) => {
      const x = this.columnX + i * (fruitW + GAP);
      this.action(y, fruitH, '', () => {
        this.dropIn(`item_${fruit}`, x + fruitW / 2, y + fruitH / 2, jarMouth.x, jarMouth.y, () => {
          sfx.pickUp();
          this.fruitIn = fruit;
        });
      }, () => empty() && canLoadFruit(st, fruit), COLOURS.button, () => '', x, fruitW);
      this.add.image(x + fruitW / 2, y + 13, `item_${fruit}`).setScale(ITEM_SCALE).setDepth(2);
      this.counts.push({ fruit, text: label(this, x + fruitW / 2, y + fruitH - 10, '', COLOURS.white, 'center').setDepth(2) });
    });
    y += fruitH + GAP;
    this.action(y, ACTION_H, 'ICE', () => {
      sfx.click();
      this.iceIn = true;
    }, () => this.fruitIn !== null && !this.iceIn);
    y += ACTION_H + GAP;
    this.action(y, ACTION_H, 'BLEND', () => {
      if (!this.fruitIn || !startBlend(st, this.fruitIn)) return;
      sfx.click();
      this.fruitIn = null;
      this.iceIn = false;
    }, () => this.fruitIn !== null && this.iceIn, COLOURS.accent);
    y += ACTION_H + GAP;
    const spout = this.at(jar.x + jar.w, jar.y + 4);
    // POUR and THROW OUT share the last row
    const pourW = Math.floor((this.columnW - GAP) * 0.4);
    this.action(y, ACTION_H, 'POUR', () => {
      const drink = st.blenderJar!;
      this.pour(drink, spout.x + 4, spout.y, SMOOTHIE_COLOURS[drink].fill);
    }, () => smoothieReady(st) && wanted(st.blenderJar!), COLOURS.accent, undefined, this.columnX, pourW);
    // A wrong smoothie, or fruit put in by mistake, can be thrown out to free the blender.
    this.action(y, ACTION_H, 'THROW OUT', () => {
      sfx.putBack();
      if (this.fruitIn) {
        this.fruitIn = null;
        this.iceIn = false;
        return;
      }
      emptyBlender(st);
    }, () => smoothieReady(st) || this.fruitIn !== null, COLOURS.button, undefined, this.columnX + pourW + GAP, this.columnW - pourW - GAP);
  }

  protected secondsLeft() {
    return session.state.blendLeft;
  }

  protected onRefresh() {
    for (const { fruit, text } of this.counts) text.setText(`x${session.state.stockroom[fruit] ?? 0}`);
  }

  protected drawMachine(on: boolean) {
    this.machine.clear();
    // A little shake while it blends
    const shake = on ? Math.sin(this.time.now / 30) * this.scale_ * 0.6 : 0;
    drawBlender(this.machine, this.machineX + shake, this.machineY, this.scale_, on);
  }

  protected drawContents() {
    const st = session.state;
    const s = this.scale_;
    const g = this.contents;
    const jar = BLENDER.jar;
    const blending = st.blendLeft > 0;
    const shake = blending ? Math.sin(this.time.now / 30) * s * 0.6 : 0;
    const x = this.machineX + shake;
    if (st.blenderJar) {
      // The smoothie swirls from light to its full colour as it blends
      const colour = SMOOTHIE_COLOURS[st.blenderJar];
      const t = blending ? 1 - st.blendLeft / BLEND_SECONDS : 1;
      const fill = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(colour.light),
        Phaser.Display.Color.ValueToColor(colour.fill),
        100,
        Math.round(t * 100),
      );
      const top = jar.y + jar.h * 0.3;
      g.fillStyle(Phaser.Display.Color.GetColor(fill.r, fill.g, fill.b)).fillRect(x + jar.x * s, this.machineY + top * s, jar.w * s, (jar.y + jar.h - 1 - top) * s);
      if (blending) {
        for (let i = 0; i < 4; i++) {
          const a = this.time.now / 120 + i * 1.6;
          g.fillStyle(colour.light).fillRect(x + (jar.x + jar.w / 2 + Math.cos(a) * 6) * s, this.machineY + (jar.y + jar.h * 0.6 + Math.sin(a) * 6) * s, 2 * s, 2 * s);
        }
      }
    } else if (this.fruitIn) {
      // The fruit and ice sitting in the jar, waiting
      const colour = SMOOTHIE_COLOURS[smoothieFor(this.fruitIn)];
      g.fillStyle(colour.fill).fillRect(x + (jar.x + 3) * s, this.machineY + (jar.y + jar.h - 10) * s, 8 * s, 8 * s);
      if (this.iceIn) {
        g.fillStyle(0xe8f8ff).fillRect(x + (jar.x + 11) * s, this.machineY + (jar.y + jar.h - 8) * s, 4 * s, 4 * s);
        g.fillStyle(0xe8f8ff).fillRect(x + (jar.x + 10) * s, this.machineY + (jar.y + jar.h - 14) * s, 4 * s, 4 * s);
      }
    }
    drawBlenderGlass(g, x, this.machineY, s);
  }

  protected hintText() {
    const st = session.state;
    if (st.blendLeft > 0) return 'BLENDING...';
    if (st.blenderJar) {
      const name = getProduct(st.blenderJar).name.split(' ')[0];
      return wanted(st.blenderJar) ? `POUR THE ${name}` : `${name} READY`;
    }
    if (!this.fruitIn) return FRUITS.some((f) => (st.stockroom[f] ?? 0) > 0) ? 'PICK A FRUIT' : 'NO FRUIT: ORDER ON THE PC';
    if (!this.iceIn) return 'ADD ICE';
    return 'PRESS BLEND';
  }
}

