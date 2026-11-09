import Phaser from 'phaser';
import { BLENDER, COFFEE_COLOUR, COFFEE_MACHINE, SMOOTHIE_COLOURS, drawBlender, drawBlenderGlass, drawCoffeeMachine } from '../art/appliances';
import { ITEM_SCALE } from '../art/textures';
import { sfx } from '../audio';
import { BLEND_SECONDS, BREW_SECONDS, POT_CUPS, smoothieFor } from '../data/appliances';
import { getProduct } from '../data/products';
import { canBrew, canLoadFruit, smoothieReady, startBlend, startBrew } from '../logic/appliances';
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
    this.scale_ = roomH / this.machineSize.h;
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

/** Filter, beans, ON: five seconds later there's a pot of five cups to pour from. */
export class CoffeeScene extends DrinkStation {
  protected readonly machineSize = COFFEE_MACHINE;
  /** The filter and beans going in are just for show until ON is pressed. */
  private filterIn = false;
  private beansIn = false;
  private drips: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('Coffee');
  }

  protected build() {
    this.filterIn = false;
    this.beansIn = false;
    this.drips = [];
    const st = session.state;
    const basket = this.at(COFFEE_MACHINE.basket.x + COFFEE_MACHINE.basket.w / 2, COFFEE_MACHINE.basket.y + 2);
    const ready = () => st.coffeePot === 0 && st.brewLeft === 0;
    let y = this.top + BUTTONS.compactH + 8;
    this.action(y, ACTION_H, 'FILTER', () => {
      sfx.click();
      this.filterIn = true;
    }, () => ready() && !this.filterIn);
    y += ACTION_H + GAP;
    this.action(y, ACTION_H, 'BEANS', () => {
      this.dropIn('item_beans', this.columnX + this.columnW / 2, y - ACTION_H / 2, basket.x, basket.y, () => {
        sfx.pickUp();
        this.beansIn = true;
      });
    }, () => ready() && this.filterIn && !this.beansIn && (st.stockroom.beans ?? 0) > 0, COLOURS.button, () => `BEANS x${st.stockroom.beans ?? 0}`);
    y += ACTION_H + GAP;
    this.action(y, ACTION_H, 'ON', () => {
      if (!startBrew(st)) return;
      sfx.click();
      this.filterIn = false;
      this.beansIn = false;
    }, () => this.filterIn && this.beansIn && canBrew(st), COLOURS.accent);
    y += ACTION_H + GAP;
    const spout = this.at(COFFEE_MACHINE.carafe.x + COFFEE_MACHINE.carafe.w + 2, COFFEE_MACHINE.carafe.y);
    this.action(y, ACTION_H, 'POUR', () => this.pour('coffee', spout.x, spout.y, COFFEE_COLOUR), () => st.coffeePot > 0 && wanted('coffee'), COLOURS.accent);
  }

  protected secondsLeft() {
    return session.state.brewLeft;
  }

  protected drawMachine(on: boolean) {
    this.machine.clear();
    drawCoffeeMachine(this.machine, this.machineX, this.machineY, this.scale_, on);
  }

  protected drawContents() {
    const st = session.state;
    const s = this.scale_;
    const g = this.contents;
    const b = COFFEE_MACHINE.basket;
    const brewing = st.brewLeft > 0;
    // A paper filter sits in the basket from when it goes in until the pot's empty.
    if (this.filterIn || brewing || st.coffeePot > 0) {
      const p = this.at(b.x + 2, b.y);
      g.fillStyle(0xfbf8f2).fillRect(p.x, p.y, (b.w - 4) * s, 3 * s);
    }
    if (this.beansIn || brewing) {
      const p = this.at(b.x + 4, b.y + 0.5);
      g.fillStyle(0x5a3418).fillRect(p.x, p.y, (b.w - 8) * s, 1.5 * s);
    }
    // The coffee rises while it brews
    const c = COFFEE_MACHINE.carafe;
    const level = brewing ? 1 - st.brewLeft / BREW_SECONDS : st.coffeePot / POT_CUPS;
    if (level > 0) {
      const h = c.h * level;
      const p = this.at(c.x, c.y + c.h - h);
      g.fillStyle(COFFEE_COLOUR).fillRect(p.x, p.y, c.w * s, h * s);
    }
    // Drips while it brews
    if (brewing && this.drips.length === 0) this.startDrips();
    if (!brewing && this.drips.length > 0) this.stopDrips();
    // Cup marks beside the carafe: how many are left
    for (let i = 0; i < POT_CUPS; i++) {
      const p = this.at(c.x + i * 3, c.y + c.h + 4.2);
      g.fillStyle(i < st.coffeePot ? COFFEE_COLOUR : 0x5a6470).fillRect(p.x, p.y, 2 * s, 1 * s);
    }
  }

  private startDrips() {
    const spout = this.at(COFFEE_MACHINE.spout.x, COFFEE_MACHINE.spout.y);
    const bottom = this.at(0, COFFEE_MACHINE.carafe.y + 2).y;
    for (let i = 0; i < 3; i++) {
      const drip = this.add.rectangle(spout.x, spout.y, Math.max(1, this.scale_ * 0.8), Math.max(2, this.scale_ * 1.5), COFFEE_COLOUR).setDepth(3);
      this.tweens.add({ targets: drip, y: bottom, duration: 420, delay: i * 140, repeat: -1, ease: 'Quad.easeIn' });
      this.drips.push(drip);
    }
  }

  private stopDrips() {
    this.drips.forEach((d) => d.destroy());
    this.drips = [];
  }

  protected hintText() {
    const st = session.state;
    if (st.brewLeft > 0) return 'BREWING...';
    if (st.coffeePot > 0) return wanted('coffee') ? 'POUR A CUP' : `${st.coffeePot} CUPS READY`;
    if (!this.filterIn) return 'ADD A FILTER';
    if (!this.beansIn) return (st.stockroom.beans ?? 0) > 0 ? 'ADD BEANS' : 'NO BEANS: ORDER ON THE PC';
    return 'PRESS ON';
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
    this.action(y, ACTION_H, 'POUR', () => {
      const drink = st.blenderJar!;
      this.pour(drink, spout.x + 4, spout.y, SMOOTHIE_COLOURS[drink].fill);
    }, () => smoothieReady(st) && wanted(st.blenderJar!), COLOURS.accent);
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

