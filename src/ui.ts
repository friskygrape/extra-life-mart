import Phaser from 'phaser';
import { FONT_KEY } from './art/font';

export const WIDTH = 180;
export const HEIGHT = 320;

export const COLOURS = {
  bg: 0x1a1626,
  panel: 0x2a2440,
  panelLight: 0x3b3556,
  border: 0x5d5585,
  white: 0xf4efe2,
  dim: 0xa59fc2,
  gold: 0xf2b84b,
  green: 0x8df0a1,
  red: 0xff7a70,
  button: 0x46406b,
  buttonPressed: 0x2c2742,
  accent: 0x2f9e6e,
  ink: 0x2a2440,
  paper: 0xf4efe2,
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
    if (enabled) onTap();
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
export function backdrop(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, 0, WIDTH, HEIGHT, COLOURS.bg).setOrigin(0).setInteractive();
}
