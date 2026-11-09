import Phaser from 'phaser';
import { BLENDER, COFFEE_COLOUR, SMOOTHIE_COLOURS, drawBlender, drawBlenderGlass } from '../art/appliances';
import { COFFEE_ART, decanterKey, decanterState } from '../art/coffeeArt';
import { ITEM_SCALE } from '../art/textures';
import { sfx } from '../audio';
import { BLEND_SECONDS, smoothieFor } from '../data/appliances';
import { getProduct } from '../data/products';
import { canLoadFruit, emptyBlender, smoothieReady, startBlend, startBrew } from '../logic/appliances';
import { canAddToTable, isOrderComplete } from '../logic/basket';
import { L } from '../layout';
import { session } from '../session';
import { BUTTONS, COLOURS, bigLabel, button, label, type Button } from '../ui';

const TABLE_CAPACITY = 4;
const PANEL_PAD = 6;
const HINT_H = 16;
const ACTION_H = 26;
const GAP = 4;
const POUR_MS = 650;
/** The column beside the coffee machine for its filters and beans. */
const SUPPLY_W = 52;

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

/**
 * The user's coffee machine, worked by tapping it: a filter into the basket, beans on top, the red switch to brew,
 * then the pot to pour. Five seconds of dripping fill the pot, and it pours a cup at a time until it's empty.
 */
export class CoffeeScene extends DrinkStation {
  protected readonly machineSize = COFFEE_ART.machine;
  /** The filter and beans going in are just for show until the switch is flipped. */
  private filterIn = false;
  private beansIn = false;
  private drips: Phaser.GameObjects.Rectangle[] = [];
  private machineImage: Phaser.GameObjects.Image | null = null;
  private decanter!: Phaser.GameObjects.Image;
  private basketFill!: Phaser.GameObjects.Graphics;
  private powerOff!: Phaser.GameObjects.Rectangle;
  private powerGlow!: Phaser.GameObjects.Arc;
  private beansCount!: Phaser.GameObjects.BitmapText;
  private cupSpot = { x: 0, y: 0 };

  constructor() {
    super('Coffee');
  }

  /** As large as fits, while keeping every art pixel a whole number of screen pixels. */
  protected chooseScale(roomH: number) {
    const r = L.renderScale;
    const fits = Math.min(roomH / COFFEE_ART.machine.h, (L.W - PANEL_PAD * 2 - SUPPLY_W - 10) / COFFEE_ART.machine.w);
    return Math.max(1, Math.floor(fits * r)) / r;
  }

  protected build() {
    this.filterIn = false;
    this.beansIn = false;
    this.drips = [];
    const st = session.state;
    const s = this.scale_;
    const snap = (v: number) => Math.round(v * L.renderScale) / L.renderScale;
    // Centred in the room below the hint, on the screen's own pixels
    const roomH = L.H - L.safeBottom - 3 - this.top - HINT_H - 12;
    this.machineX = snap(this.machineX);
    this.machineY = snap(this.machineY + Math.max(0, (roomH - COFFEE_ART.machine.h * s) / 2));
    this.countdown.setY(this.machineY - 2);
    this.machineImage = this.add.image(this.machineX, this.machineY, COFFEE_ART.machine.key).setOrigin(0).setScale(s).setDepth(1);

    // What's in the basket: a paper filter, then the beans
    this.basketFill = this.add.graphics().setDepth(1.5);

    // The red switch: dim while off, glowing while it brews
    const pw = COFFEE_ART.power;
    const power = this.at(pw.x, pw.y);
    this.powerOff = this.add.rectangle(power.x, power.y, pw.w * s, pw.h * s, 0x000000, 0.55).setOrigin(0).setDepth(1.6);
    this.powerGlow = this.add.circle(power.x + (pw.w * s) / 2, power.y + (pw.h * s) / 2, pw.h * s * 0.9, 0xff3030, 0.25).setDepth(1.4).setVisible(false);
    this.tweens.add({ targets: this.powerGlow, alpha: 0.05, duration: 500, yoyo: true, repeat: -1 });

    // The decanter, turning about its spout so it can tip to pour
    const d = COFFEE_ART.decanter;
    const sp = COFFEE_ART.spout;
    const home = this.at(d.x + sp.x, d.y + sp.y);
    this.decanter = this.add.image(home.x, home.y, decanterKey('empty')).setOrigin(sp.x / d.w, sp.y / d.h).setScale(s).setDepth(2);

    // The supplies beside the machine
    const supplyX = Math.round(this.machineX + COFFEE_ART.machine.w * s + 8);
    const supplyW = Math.min(SUPPLY_W, L.W - PANEL_PAD - supplyX);
    const filtersTop = this.top + BUTTONS.compactH + 10;
    this.drawFilterStack(supplyX + supplyW / 2, filtersTop + 14);
    label(this, supplyX + supplyW / 2, filtersTop + 22, 'FILTERS', COLOURS.dim, 'center');
    const beansY = filtersTop + 50;
    this.add.image(supplyX + supplyW / 2, beansY + 14, 'item_beans').setScale(ITEM_SCALE * 1.4);
    this.beansCount = label(this, supplyX + supplyW / 2, beansY + 32, '', COLOURS.dim, 'center');
    this.cupSpot = { x: supplyX + supplyW / 2, y: L.H - L.safeBottom - 8 };

    // Tap the things themselves
    const tap = (x: number, y: number, w: number, h: number, onTap: () => void) =>
      this.add.rectangle(x, y, w, h, 0xffffff, 0).setOrigin(0).setDepth(10).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (!this.pouring) onTap();
      });
    const ready = () => st.coffeePot === 0 && st.brewLeft === 0;
    const basket = this.at(COFFEE_ART.basket.x + COFFEE_ART.basket.w / 2, COFFEE_ART.basket.y + 2);
    tap(supplyX, filtersTop - 4, supplyW, 36, () => {
      if (!ready() || this.filterIn) return sfx.error();
      this.dropIn('item_filter', supplyX + supplyW / 2, filtersTop + 10, basket.x, basket.y, () => {
        sfx.click();
        this.filterIn = true;
      });
    });
    tap(supplyX, beansY - 4, supplyW, 44, () => {
      if (!ready() || !this.filterIn || this.beansIn || (st.stockroom.beans ?? 0) <= 0) return sfx.error();
      this.dropIn('item_beans', supplyX + supplyW / 2, beansY + 14, basket.x, basket.y, () => {
        sfx.pickUp();
        this.beansIn = true;
      });
    });
    // The switch is small, so its tap area reaches well beyond it.
    const powerCentre = { x: power.x + (pw.w * s) / 2, y: power.y + (pw.h * s) / 2 };
    tap(powerCentre.x - 14, powerCentre.y - 16, 28, 32, () => {
      if (!this.filterIn || !this.beansIn || !startBrew(st)) return sfx.error();
      sfx.click();
      this.filterIn = false;
      this.beansIn = false;
    });
    const pot = this.at(d.x, d.y);
    tap(pot.x, pot.y, d.w * s, d.h * s, () => {
      if (st.coffeePot <= 0 || st.brewLeft > 0 || !wanted('coffee')) return sfx.error();
      this.pourFromPot();
    });
  }

  /** A few paper filters, stacked. */
  private drawFilterStack(cx: number, bottom: number) {
    const g = this.add.graphics();
    for (let i = 0; i < 3; i++) {
      const y = bottom - i * 3;
      g.fillStyle(0x6b6358).fillTriangle(cx - 11, y - 9, cx + 11, y - 9, cx, y + 1);
      g.fillStyle(i === 2 ? 0xfbf6ec : 0xe9e1d2).fillTriangle(cx - 10, y - 9, cx + 10, y - 9, cx, y);
    }
    g.fillStyle(0xd8cfbe).fillRect(cx - 10, bottom - 15, 20, 1);
  }

  protected secondsLeft() {
    return session.state.brewLeft;
  }

  protected drawMachine(on: boolean) {
    if (!this.machineImage) return;
    this.powerOff.setVisible(!on);
    this.powerGlow.setVisible(on);
  }

  protected drawContents() {
    const st = session.state;
    const s = this.scale_;
    const brewing = st.brewLeft > 0;
    this.decanter.setTexture(decanterKey(decanterState(st.coffeePot, st.brewLeft)));
    this.beansCount.setText(`BEANS x${st.stockroom.beans ?? 0}`);
    const g = this.basketFill.clear();
    const b = COFFEE_ART.basket;
    // A paper filter sits in the basket from when it goes in until the pot's empty, with the grounds on it.
    if (this.filterIn || brewing || st.coffeePot > 0) {
      const p = this.at(b.x + 4, b.y);
      g.fillStyle(0xf3eee4).fillRect(p.x, p.y, (b.w - 8) * s, 3 * s);
      g.fillStyle(0xd9d0c0).fillRect(p.x, p.y + 2 * s, (b.w - 8) * s, s);
    }
    if (this.beansIn || brewing || st.coffeePot > 0) {
      const p = this.at(b.x + 14, b.y - 2);
      g.fillStyle(0x4a2a14).fillRect(p.x, p.y, (b.w - 28) * s, 3 * s);
      g.fillStyle(0x6b4022).fillRect(p.x + 4 * s, p.y, (b.w - 36) * s, s);
    }
    if (brewing && this.drips.length === 0) this.startDrips();
    if (!brewing && this.drips.length > 0) this.stopDrips();
  }

  private startDrips() {
    const { x, from, to } = COFFEE_ART.drip;
    const top = this.at(x, from);
    const bottom = this.at(x, to);
    for (let i = 0; i < 3; i++) {
      const drip = this.add.rectangle(top.x, top.y, Math.max(1, this.scale_ * 1.5), Math.max(2, this.scale_ * 2.5), COFFEE_COLOUR).setDepth(1.8);
      this.tweens.add({ targets: drip, y: bottom.y, duration: 380, delay: i * 130, repeat: -1, ease: 'Quad.easeIn' });
      this.drips.push(drip);
    }
  }

  private stopDrips() {
    this.drips.forEach((d) => d.destroy());
    this.drips = [];
  }

  /** The pot swings over to a cup, tips and pours, then goes back while the cup heads up to the counter. */
  private pourFromPot() {
    this.pouring = true;
    sfx.click();
    const home = { x: this.decanter.x, y: this.decanter.y };
    const cupH = 46 * ITEM_SCALE * 1.4;
    const cup = this.add.image(this.cupSpot.x, this.cupSpot.y, 'item_coffee').setOrigin(0.5, 1).setScale(ITEM_SCALE * 1.4, 0.05).setDepth(3).setAlpha(0);
    const spoutAt = { x: this.cupSpot.x - 2, y: this.cupSpot.y - cupH - 10 };
    this.tweens.add({
      targets: this.decanter,
      x: spoutAt.x,
      y: spoutAt.y,
      angle: -35,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => {
        cup.setAlpha(1);
        const stream = this.add.rectangle(spoutAt.x, spoutAt.y, Math.max(2, this.scale_ * 2), cupH + 6, COFFEE_COLOUR).setOrigin(0.5, 0).setDepth(2.5);
        this.tweens.add({ targets: cup, scaleY: ITEM_SCALE * 1.4, duration: POUR_MS, ease: 'Quad.easeOut' });
        this.time.delayedCall(POUR_MS, () => {
          stream.destroy();
          this.tweens.add({ targets: this.decanter, x: home.x, y: home.y, angle: 0, duration: 260, ease: 'Quad.easeInOut' });
          this.tweens.add({
            targets: cup,
            y: this.top - 10,
            alpha: 0,
            duration: 320,
            ease: 'Quad.easeIn',
            onComplete: () => {
              cup.destroy();
              this.pouring = false;
              session.events.emit('pour-drink', 'coffee');
              if (session.wants && isOrderComplete(session.wants, session.table)) this.close();
            },
          });
        });
      },
    });
  }

  protected hintText() {
    const st = session.state;
    if (st.brewLeft > 0) return 'BREWING...';
    if (st.coffeePot > 0) return wanted('coffee') ? 'TAP THE POT TO POUR' : `${st.coffeePot} ${st.coffeePot === 1 ? 'CUP' : 'CUPS'} READY`;
    if (!this.filterIn) return 'TAP A FILTER';
    if (!this.beansIn) return (st.stockroom.beans ?? 0) > 0 ? 'TAP THE BEANS' : 'NO BEANS: ORDER ON THE PC';
    return 'FLIP THE RED SWITCH';
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

