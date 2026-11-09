import Phaser from 'phaser';
import { sfx } from './audio';
import { WIDTH, label, titleLabel, type Button } from './ui';

/** The shop computer's look: grey bevelled windows on a teal desktop. */
export const RETRO = {
  desktop: 0x008080,
  face: 0xc0c0c0,
  light: 0xffffff,
  shade: 0x808080,
  dark: 0x101010,
  title: 0x10307a,
  ink: 0x1a1a1a,
  dim: 0x5a5a5a,
  good: 0x0b6b3a,
  bad: 0xb0352b,
  link: 0x10307a,
  field: 0xffffff,
};

/** The blue title bar, tall enough for a close box a thumb can find. */
export const TITLE_H = 18;
const CLOSE_BOX = 16;

/** A raised or sunken edge: light on one side and dark on the other. */
export function drawBevel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, raised: boolean, fill: number = RETRO.face) {
  const topLeft = raised ? RETRO.light : RETRO.shade;
  const bottomRight = raised ? RETRO.dark : RETRO.light;
  const inner = raised ? RETRO.shade : RETRO.dark;
  g.fillStyle(fill).fillRect(x, y, w, h);
  g.fillStyle(topLeft).fillRect(x, y, w, 1).fillRect(x, y, 1, h);
  g.fillStyle(bottomRight).fillRect(x, y + h - 1, w, 1).fillRect(x + w - 1, y, 1, h);
  if (raised) {
    g.fillStyle(inner).fillRect(x + 1, y + h - 2, w - 2, 1).fillRect(x + w - 2, y + 1, 1, h - 2);
  } else {
    g.fillStyle(inner).fillRect(x + 1, y + 1, w - 2, 1).fillRect(x + 1, y + 1, 1, h - 2);
  }
}

export function bevel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, raised: boolean, fill: number = RETRO.face): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawBevel(g, x, y, w, h, raised, fill);
  return g;
}

/** A grey button that presses into the screen. The extra parts move with it, so they go in lists too. */
export function retroButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onTap: () => void,
  tapSound: (() => void) | null = sfx.click,
): Button {
  const face = scene.add.graphics();
  drawBevel(face, x, y, w, h, true);
  const rect = scene.add.rectangle(x, y, w, h, 0xffffff, 0).setOrigin(0).setInteractive({ useHandCursor: true });
  const textY = y + Math.floor((h - 8) / 2);
  const txt = label(scene, x + w / 2, textY, text, RETRO.ink, 'center');
  let enabled = true;
  const paint = (pressed: boolean) => {
    drawBevel(face.clear(), x, y, w, h, !(pressed && enabled));
    txt.setPosition(x + w / 2 + (pressed && enabled ? 1 : 0), textY + (pressed && enabled ? 1 : 0));
  };
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
    parts: [face],
    setEnabled(value) {
      enabled = value;
      txt.setTint(value ? RETRO.ink : RETRO.shade);
    },
    setLabel: (value) => void txt.setText(value.toUpperCase()),
    setVisible(visible) {
      face.setVisible(visible);
      rect.setVisible(visible);
      txt.setVisible(visible);
      if (visible) rect.setInteractive();
      else rect.disableInteractive();
    },
    destroy() {
      face.destroy();
      rect.destroy();
      txt.destroy();
    },
  };
}

/** A window with a blue title bar and an X in a box, which closes it. */
export function retroWindow(scene: Phaser.Scene, y: number, h: number, title: string, onClose: () => void, w: number = WIDTH - 4, x = 2): { destroy(): void } {
  const frame = bevel(scene, x, y, w, h, true);
  const barX = x + 3;
  const barY = y + 3;
  const barW = w - 6;
  const bar = scene.add.rectangle(barX, barY, barW, TITLE_H, RETRO.title).setOrigin(0);
  const heading = titleLabel(scene, barX + 3, barY + Math.floor((TITLE_H - 9) / 2), title, RETRO.light);
  const boxX = barX + barW - CLOSE_BOX - 1;
  const boxY = barY + 1;
  const box = bevel(scene, boxX, boxY, CLOSE_BOX, CLOSE_BOX, true);
  // A bold X, two pixels thick, across the middle of the box
  const cross = scene.add.graphics();
  cross.fillStyle(RETRO.ink);
  const size = 8;
  const crossX = boxX + Math.floor((CLOSE_BOX - size) / 2) - 1;
  const crossY = boxY + Math.floor((CLOSE_BOX - size) / 2) - 1;
  for (let i = 0; i < size; i++) {
    cross.fillRect(crossX + i, crossY + i, 2, 1).fillRect(crossX + size - 1 - i, crossY + i, 2, 1);
  }
  // Larger than the box, so it's easy to hit with a thumb.
  const hit = scene.add.rectangle(boxX + CLOSE_BOX + 4, y, 38, TITLE_H + 12, 0xffffff, 0).setOrigin(1, 0).setInteractive({ useHandCursor: true })
    .on('pointerup', () => {
      sfx.click();
      onClose();
    });
  return {
    destroy() {
      [frame, bar, heading, box, cross, hit].forEach((o) => o.destroy());
    },
  };
}
