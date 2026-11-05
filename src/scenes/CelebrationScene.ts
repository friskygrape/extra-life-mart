import Phaser from 'phaser';
import { sfx } from '../audio';
import { getProduct } from '../data/products';
import { formatCents } from '../logic/money';
import { COLOURS, WIDTH, HEIGHT, backdrop, drawPaper, label, mainButton } from '../ui';

export type CelebrationData = { kind: 'licence'; productId: string } | { kind: 'shelves'; row: number };

const PAPER_W = 168;
const PAPER_H = 150;
const PAPER_Y = 76;
const CONFETTI = 44;
const CONFETTI_COLOURS = [0xef6f5e, 0xffc65c, 0x9df0b0, 0x62b6e8, 0xfbf1d8];
const RAYS = 12;
const INK_GOOD = 0x0b6b3a;
const INK_MUTED = 0x6d6352;

/** The proud moment after buying a licence or shelves. Everything else waits until you've taken it in. */
export class CelebrationScene extends Phaser.Scene {
  constructor() {
    super('Celebration');
  }

  create(data: CelebrationData) {
    sfx.fanfare();
    backdrop(this);
    const cx = WIDTH / 2;
    const cy = PAPER_Y + PAPER_H / 2;

    const rays = this.add.graphics({ x: cx, y: cy });
    rays.fillStyle(COLOURS.gold, 0.18);
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2;
      const spread = Math.PI / RAYS / 1.6;
      rays.fillTriangle(0, 0, Math.cos(a - spread) * 300, Math.sin(a - spread) * 300, Math.cos(a + spread) * 300, Math.sin(a + spread) * 300);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });

    const card = this.add.container(cx, cy);
    const paper = this.add.graphics();
    drawPaper(paper, -PAPER_W / 2, -PAPER_H / 2, PAPER_W, PAPER_H, false);
    card.add(paper);
    const heading = (y: number, text: string, colour: number) => card.add(label(this, 0, y - PAPER_H / 2, text, colour, 'center'));

    if (data.kind === 'licence') {
      const product = getProduct(data.productId);
      heading(10, 'LICENCE GRANTED', INK_MUTED);
      card.add(this.add.image(0, -8, `item_${product.id}`).setScale(4));
      heading(114, product.name, COLOURS.ink);
      heading(128, `+${formatCents(product.retail - product.wholesale)} A SALE`, INK_GOOD);
    } else {
      heading(10, 'NEW SHELVES!', INK_MUTED);
      card.add(this.add.image(0, -8, 'new_shelf').setScale(2));
      heading(114, `SHELF ROW ${data.row}`, COLOURS.ink);
      heading(128, 'ROOM FOR 4 MORE SNACKS', INK_GOOD);
    }

    // Pops in with a bounce
    card.setScale(0.2);
    this.tweens.add({ targets: card, scale: 1, duration: 420, ease: 'Back.easeOut' });

    this.throwConfetti();
    label(this, cx, PAPER_Y - 22, 'UNLOCKED!', COLOURS.gold, 'center').setScale(2).setDepth(5);

    const done = mainButton(this, PAPER_Y + PAPER_H + 24, 'NICE!', () => this.close(), sfx.click);
    done.rect.setDepth(5);
    done.text.setDepth(6);
  }

  private throwConfetti() {
    for (let i = 0; i < CONFETTI; i++) {
      const colour = CONFETTI_COLOURS[i % CONFETTI_COLOURS.length];
      const bit = this.add.image(Math.random() * WIDTH, -10 - Math.random() * 120, 'pixel_white').setTint(colour).setDepth(4);
      this.tweens.add({
        targets: bit,
        y: HEIGHT + 20,
        x: bit.x + (Math.random() - 0.5) * 50,
        duration: 1500 + Math.random() * 1600,
        delay: Math.random() * 500,
        repeat: 1,
        ease: 'Sine.easeIn',
        onComplete: () => bit.destroy(),
      });
    }
  }

  private close() {
    this.scene.resume('Order');
    this.scene.resume('Shack');
    this.scene.stop();
  }
}
