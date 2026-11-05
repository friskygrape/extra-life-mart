import Phaser from 'phaser';
import { FONT_KEY } from './art/font';
import { sfx } from './audio';

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

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color = COLOURS.white,
  align: Align = 'left',
): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(x, y, FONT_KEY, text.toUpperCase());
  t.setTint(color);
  t.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0);
  return t;
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

/** Full-screen backing that also stops taps reaching the shop underneath. */
export function backdrop(scene: Phaser.Scene, top = 0): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, top, WIDTH, HEIGHT - top, COLOURS.bg).setOrigin(0).setInteractive();
}
