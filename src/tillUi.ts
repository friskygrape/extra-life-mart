import Phaser from 'phaser';
import { sfx } from './audio';
import { COLOURS, label, type Button } from './ui';

/** The till's own colours, taken from the register art. */
export const TILL = {
  outline: 0x101c20,
  screen: 0x0a1416,
  bezel: 0x2f5660,
  bezelLight: 0x4c7a84,
  lcdDim: 0x4f9a76,
  lcd: 0x7fe0a6,
  lcdMatch: 0xc4ffd9,
  lcdOver: 0xff8d7a,
};

/** A key's face, the light along its top, and the lip beneath that gives it height. */
export interface KeyColours {
  face: number;
  light: number;
  lip: number;
}

export const KEYS: Record<'teal' | 'green' | 'red' | 'orange', KeyColours> = {
  teal: { face: 0x345f68, light: 0x4a7b80, lip: 0x1c3740 },
  green: { face: 0x24835a, light: 0x60c893, lip: 0x154d36 },
  red: { face: 0x8e3b30, light: 0xc0604f, lip: 0x521f19 },
  orange: { face: 0xa8692a, light: 0xf8bd6d, lip: 0x5e3a14 },
};

const LIP = 3;
const SINK = 2;

function drawKey(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: KeyColours, pressed: boolean) {
  // Pressing moves the face down into the lip, so the face keeps its size and the lip gets shorter.
  const top = y + (pressed ? SINK : 0);
  const faceH = h - 2 - LIP;
  g.clear();
  // The outline wraps the face and lip together, with its corners cut.
  g.fillStyle(TILL.outline).fillRect(x + 1, top, w - 2, y + h - top).fillRect(x, top + 1, w, y + h - top - 2);
  g.fillStyle(c.lip).fillRect(x + 1, top + 1, w - 2, y + h - top - 2);
  g.fillStyle(c.face).fillRect(x + 1, top + 1, w - 2, faceH);
  g.fillStyle(c.light).fillRect(x + 2, top + 1, w - 4, 1).fillRect(x + 1, top + 2, 1, faceH - 2);
}

/** A chunky key in the register's metal, sinking into its lip when pressed. */
export function tillKey(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onTap: () => void,
  colours: KeyColours = KEYS.teal,
  tapSound: (() => void) | null = sfx.click,
): Button {
  const g = scene.add.graphics();
  const rect = scene.add.rectangle(x, y, w, h, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
  const textY = y + 1 + Math.floor((h - 2 - LIP - 7) / 2);
  const txt = label(scene, x + w / 2, textY, text, COLOURS.white, 'center');
  let enabled = true;
  const paint = (pressed: boolean) => {
    const down = pressed && enabled;
    drawKey(g, x, y, w, h, colours, down);
    txt.setY(textY + (down ? SINK : 0));
  };
  paint(false);
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
    parts: [g],
    setEnabled(value) {
      enabled = value;
      g.setAlpha(value ? 1 : 0.45);
      txt.setAlpha(value ? 1 : 0.55);
    },
    setLabel: (value) => void txt.setText(value.toUpperCase()),
    setVisible(visible) {
      g.setVisible(visible);
      rect.setVisible(visible);
      txt.setVisible(visible);
      if (visible) rect.setInteractive();
      else rect.disableInteractive();
    },
    destroy() {
      g.destroy();
      rect.destroy();
      txt.destroy();
    },
  };
}

/** The till's screen: a dark LCD in a metal bezel. */
export function drawLcd(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(TILL.outline).fillRect(x + 1, y, w - 2, h).fillRect(x, y + 1, w, h - 2);
  g.fillStyle(TILL.bezel).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(TILL.bezelLight).fillRect(x + 2, y + 1, w - 4, 1);
  g.fillStyle(TILL.outline).fillRect(x + 3, y + 3, w - 6, h - 6);
  g.fillStyle(TILL.screen).fillRect(x + 4, y + 4, w - 8, h - 8);
}
