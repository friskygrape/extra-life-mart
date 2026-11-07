import Phaser from 'phaser';
import { BIG_FONT_KEY, BIG_TITLE_FONT_KEY, FONT_KEY, TEXT_SIZE, TINY_FONT_KEY, TITLE_FONT_KEY } from './art/font';
import { sfx } from './audio';
import { ACTION_H, L } from './layout';

export const WIDTH = 216;
export const HEIGHT = 384;

export const COLOURS = {
  bg: 0x1b3346,
  panel: 0x254760,
  panelLight: 0x356482,
  border: 0x5f8ca6,
  white: 0xfbf3df,
  dim: 0xa9c6d6,
  gold: 0xffc65c,
  green: 0x9df0b0,
  red: 0xff8d7a,
  button: 0x3a6a88,
  buttonPressed: 0x254760,
  accent: 0x1f9c8a,
  ink: 0x2c2a33,
  paper: 0xfbf1d8,
};

export type Align = 'left' | 'center' | 'right';

function textIn(font: string, scene: Phaser.Scene, x: number, y: number, text: string, color: number, align: Align) {
  const t = scene.add.bitmapText(x, y, font, text.toUpperCase(), TEXT_SIZE);
  t.setTint(color);
  t.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0);
  return t;
}

export function label(scene: Phaser.Scene, x: number, y: number, text: string, color = COLOURS.white, align: Align = 'left'): Phaser.GameObjects.BitmapText {
  return textIn(FONT_KEY, scene, x, y, text, color, align);
}

/** The same as label, in the small size. */
export function tinyLabel(scene: Phaser.Scene, x: number, y: number, text: string, color = COLOURS.white, align: Align = 'left'): Phaser.GameObjects.BitmapText {
  return textIn(TINY_FONT_KEY, scene, x, y, text, color, align);
}

/** The same as label, at double size. */
export function bigLabel(scene: Phaser.Scene, x: number, y: number, text: string, color = COLOURS.white, align: Align = 'left'): Phaser.GameObjects.BitmapText {
  return textIn(BIG_FONT_KEY, scene, x, y, text, color, align);
}

/** The same as label, in bold: for titles and names. */
export function titleLabel(scene: Phaser.Scene, x: number, y: number, text: string, color = COLOURS.white, align: Align = 'left'): Phaser.GameObjects.BitmapText {
  return textIn(TITLE_FONT_KEY, scene, x, y, text, color, align);
}

/** The same as titleLabel, at double size. */
export function bigTitle(scene: Phaser.Scene, x: number, y: number, text: string, color = COLOURS.white, align: Align = 'left'): Phaser.GameObjects.BitmapText {
  return textIn(BIG_TITLE_FONT_KEY, scene, x, y, text, color, align);
}

export interface Button {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.BitmapText;
  setEnabled(enabled: boolean): void;
  setLabel(value: string): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onTap: () => void,
  fill = COLOURS.button,
  tapSound: (() => void) | null = sfx.click,
): Button {
  const rect = scene.add.rectangle(x, y, w, h, fill).setOrigin(0).setStrokeStyle(1, COLOURS.border);
  rect.setInteractive({ useHandCursor: true });
  const txt = label(scene, x + w / 2, y + Math.floor((h - 7) / 2), text, COLOURS.white, 'center');
  let enabled = true;
  const paint = (pressed: boolean) => rect.setFillStyle(pressed && enabled ? COLOURS.buttonPressed : fill);
  rect.on('pointerdown', () => paint(true));
  rect.on('pointerout', () => paint(false));
  rect.on('pointerup', () => {
    paint(false);
    if (!enabled) return;
    tapSound?.();
    onTap();
  });
  return {
    rect,
    text: txt,
    setEnabled(value) {
      enabled = value;
      rect.setAlpha(value ? 1 : 0.45);
      txt.setAlpha(value ? 1 : 0.55);
    },
    setLabel: (value) => void txt.setText(value.toUpperCase()),
    setVisible(visible) {
      rect.setVisible(visible);
      txt.setVisible(visible);
      if (visible) rect.setInteractive();
      else rect.disableInteractive();
    },
    destroy() {
      rect.destroy();
      txt.destroy();
    },
  };
}

/** Every button of a type is the same size. Main and secondary fill their screen's width. */
export const BUTTONS = {
  largeH: 32,
  rowW: 70,
  rowH: 32,
  stepper: 32,
  compactH: 22,
  closeW: 46,
  removeW: 58,
  tabH: 24,
  actionH: ACTION_H,
};

/** Screens at the minimum layout have this much usable width for full-width buttons. */
export const LARGE_X = 6;
export const LARGE_W = WIDTH - LARGE_X * 2;

export function mainButton(scene: Phaser.Scene, y: number, text: string, onTap: () => void, tapSound: (() => void) | null = null) {
  return button(scene, LARGE_X, y, LARGE_W, BUTTONS.largeH, text, onTap, COLOURS.accent, tapSound);
}

export function secondaryButton(scene: Phaser.Scene, y: number, text: string, onTap: () => void) {
  return button(scene, LARGE_X, y, LARGE_W, BUTTONS.largeH, text, onTap, COLOURS.panel);
}

export function closeButton(scene: Phaser.Scene, onTap: () => void, text = 'CLOSE') {
  return button(scene, WIDTH - BUTTONS.closeW - 4, 3, BUTTONS.closeW, BUTTONS.compactH, text, onTap);
}

/**
 * A list you drag or wheel through. Rows are added at positions relative to its top.
 * Anything scrolled out of view is hidden and can't be tapped.
 */
export class ScrollList {
  readonly container: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly thumb: Phaser.GameObjects.Rectangle | null = null;
  private readonly maxScroll: number;
  private scrollY = 0;
  private dragging = false;
  private moved = false;
  private lastY = 0;
  private totalDrag = 0;
  private readonly onDown = (p: Phaser.Input.Pointer) => {
    this.moved = false;
    this.totalDrag = 0;
    this.dragging = this.inView(p.worldY);
    this.lastY = p.worldY;
  };
  private readonly onMove = (p: Phaser.Input.Pointer) => {
    if (!this.dragging || !p.isDown) return;
    const dy = p.worldY - this.lastY;
    this.lastY = p.worldY;
    this.totalDrag += Math.abs(dy);
    if (this.totalDrag > 4) this.moved = true;
    this.setScroll(this.scrollY - dy);
  };
  private readonly onUp = () => {
    this.dragging = false;
  };
  private readonly onWheel = (_p: unknown, _o: unknown, _dx: number, dy: number) => {
    this.setScroll(this.scrollY + dy * 0.25);
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly top: number,
    private readonly height: number,
    contentHeight: number,
    startAt = 0,
  ) {
    this.container = scene.add.container(0, top);
    this.maxScroll = Math.max(0, contentHeight - height);
    const offsetX = Math.floor((L.W - WIDTH) / 2);
    this.maskShape = scene.make.graphics({});
    this.maskShape.fillStyle(0xffffff).fillRect(-offsetX, top, L.W, height);
    this.container.setMask(this.maskShape.createGeometryMask());
    if (this.maxScroll > 0) {
      const thumbH = Math.max(16, Math.round((height * height) / contentHeight));
      this.thumb = scene.add.rectangle(WIDTH - 2, top, 2, thumbH, COLOURS.dim).setOrigin(0);
    }
    scene.input.on('pointerdown', this.onDown);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.input.on('wheel', this.onWheel);
    this.setScroll(startAt);
  }

  get scroll(): number {
    return this.scrollY;
  }

  private inView(y: number): boolean {
    return y >= this.top && y < this.top + this.height;
  }

  private setScroll(value: number) {
    this.scrollY = Math.round(Math.max(0, Math.min(this.maxScroll, value)));
    this.container.y = this.top - this.scrollY;
    if (this.thumb) {
      const travel = this.height - this.thumb.height;
      this.thumb.y = this.top + (this.maxScroll ? (this.scrollY / this.maxScroll) * travel : 0);
    }
  }

  add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.container.add(obj);
    return obj;
  }

  addButton(b: Button): Button {
    this.container.add([b.rect, b.text]);
    return b;
  }

  /** Wraps a tap so it only counts if it wasn't a drag, and landed on a visible row. */
  guard(onTap: () => void, sound: (() => void) | null = sfx.click): () => void {
    return () => {
      if (this.moved || !this.inView(this.scene.input.activePointer.worldY)) return;
      sound?.();
      onTap();
    };
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('wheel', this.onWheel);
    this.container.clearMask(true);
    this.container.destroy();
    this.maskShape.destroy();
    this.thumb?.destroy();
  }
}

/** Paper with a solid ink outline and, optionally, a torn bottom edge. */
export function drawPaper(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, torn: boolean, ink: number = COLOURS.ink) {
  g.clear();
  g.fillStyle(ink).fillRect(x, y, w, h);
  g.fillStyle(COLOURS.paper).fillRect(x + 1, y + 1, w - 2, h - 2);
  if (!torn) return;
  // Pixel zig-zag, closed off with the outline so no edge is missing
  g.fillStyle(COLOURS.paper).fillRect(x + 1, y + h - 1, w - 2, 1);
  for (let tx = 0; tx < w; tx += 1) {
    const peak = tx % 4 < 2;
    g.fillStyle(peak ? COLOURS.paper : ink).fillRect(x + tx, y + h, 1, 1);
    g.fillStyle(peak ? ink : 0x000000, peak ? 1 : 0).fillRect(x + tx, y + h + 1, 1, 1);
  }
  g.fillStyle(ink).fillRect(x, y + h - 1, 1, 2);
  g.fillStyle(ink).fillRect(x + w - 1, y + h - 1, 1, 2);
}

/** How far text sits in from the edge of a framed bubble. */
export const BUBBLE_PAD = 5;

/** A speech bubble: beige paper in an orange frame, with folded corners and an optional rule under the name. */
export function drawBubble(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ruleY: number | null) {
  const ink = 0x5c3418;
  const frame = 0xee9a62;
  const frameLight = 0xf9bb88;
  const rule = 0xc97440;
  const paper = 0xf7ebcf;
  const fold = 0xdcc8a0;
  const foldShade = 0xbda67c;
  g.clear();
  g.fillStyle(ink).fillRect(x + 1, y, w - 2, h).fillRect(x, y + 1, w, h - 2);
  g.fillStyle(frame).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(frameLight).fillRect(x + 2, y + 1, w - 4, 1);
  g.fillStyle(paper).fillRect(x + 3, y + 3, w - 6, h - 6);
  // The folded top-right corner
  for (let i = 0; i < 6; i++) {
    g.fillStyle(frame).fillRect(x + w - 3 - (6 - i), y + 3 + i, 6 - i, 1);
    g.fillStyle(fold).fillRect(x + w - 9, y + 3 + i, i + 1, 1);
    g.fillStyle(foldShade).fillRect(x + w - 9 + i, y + 3 + i, 1, 1);
  }
  // A smaller curl at the bottom right
  g.fillStyle(fold).fillRect(x + w - 6, y + h - 4, 3, 1).fillRect(x + w - 5, y + h - 5, 2, 1).fillRect(x + w - 4, y + h - 6, 1, 1);
  if (ruleY !== null) g.fillStyle(rule).fillRect(x + BUBBLE_PAD, ruleY, w - BUBBLE_PAD * 2 - 6, 1);
}

/**
 * For screens laid out at the minimum size: centres that content on larger
 * screens, and fills the whole screen behind it, which also stops taps reaching the shop.
 */
export function backdrop(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  const offsetX = Math.floor((L.W - WIDTH) / 2);
  const offsetY = Math.floor((L.H - HEIGHT) / 2);
  scene.cameras.main.setScroll(-offsetX, -offsetY);
  // A little past every edge, so rounding can't leave a sliver of the shop showing.
  const bleed = 4;
  return scene.add.rectangle(-offsetX - bleed, -offsetY - bleed, L.W + bleed * 2, L.H + bleed * 2, COLOURS.bg).setOrigin(0).setInteractive();
}
