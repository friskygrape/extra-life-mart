import Phaser from 'phaser';
import { WIDTH } from '../ui';

type Ctx = CanvasRenderingContext2D;

/** Exactly the size of a panel on the character sheet, so its art is shown pixel for pixel. */
export const WINDOW = { x: 37, y: 45, w: 141, h: 113 };
export const CUSTOMER_LOOKS = 6;
const COLOUR_STRIP = '#1b3346';

const rect = (c: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
}

/** Small repeatable random generator, so the grime looks the same on every load. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(c: Ctx, rng: () => number, x: number, y: number, w: number, h: number, colors: string[], amount: number) {
  for (let i = 0; i < w * h * amount; i++) {
    rect(c, colors[Math.floor(rng() * colors.length)], x + Math.floor(rng() * w), y + Math.floor(rng() * h));
  }
}

/** Darkens every empty pixel touching the drawing, giving sprites a hand-inked edge. */
function outline(c: Ctx, w: number, h: number, color: string) {
  const data = c.getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) rect(c, color, x, y);
    }
  }
}

function disc(c: Ctx, color: string, cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt((r + 0.5) ** 2 - y * y));
    rect(c, color, cx - half, cy + y, half * 2 + 1, 1);
  }
}

// ---- The shop -------------------------------------------------------------

/** The wooden plate along the bottom of each shelf, which shows the label. */
function drawShelfCubby(c: Ctx, rng: () => number, x: number, y: number) {
  rect(c, '#b98a58', x, y, 54, 49);
  rect(c, '#dcb483', x, y, 54, 1);
  rect(c, '#8a6240', x + 1, y + 1, 52, 37);
  rect(c, '#6f4d31', x + 1, y + 1, 52, 4);
  for (let py = y + 9; py < y + 38; py += 8) rect(c, '#7d5838', x + 1, py, 52, 1);
  speckle(c, rng, x + 1, y + 5, 52, 33, ['#7d5838', '#97703f'], 0.04);
  rect(c, '#e3bf8e', x, y + 38, 54, 2);
  rect(c, '#fbf1d8', x + 1, y + 40, 52, 8);
}

function drawShop(scene: Phaser.Scene) {
  canvasTexture(scene, 'shop', WIDTH, 384, (c) => {
    const rng = seeded(7);
    // Painted seafoam boards
    rect(c, '#8ad1c2', 0, 0, WIDTH, 160);
    for (let y = 0; y < 160; y += 7) {
      rect(c, '#6fbcae', 0, y + 6, WIDTH, 1);
      rect(c, '#a3e0d3', 0, y, WIDTH, 1);
    }
    speckle(c, rng, 0, 0, WIDTH, 160, ['#7cc6b8', '#9bdccf'], 0.05);

    // Rope down the left side; a life ring on the right
    for (let y = 18; y < 154; y += 3) {
      rect(c, '#d9b98a', 15, y, 3, 2);
      rect(c, '#a98a5f', 16, y + 2, 2, 1);
    }
    disc(c, '#fbf1d8', 197, 128, 8);
    disc(c, '#8ad1c2', 197, 128, 4);
    [[189, 126], [201, 126], [195, 120], [195, 132]].forEach(([rx, ry]) => rect(c, '#e8604f', rx, ry, 4, 4));

    // The shop's name board above the window
    rect(c, '#5d4630', 34, 18, 147, 21);
    rect(c, '#a97d4f', 35, 19, 145, 19);
    rect(c, '#c1955f', 35, 19, 145, 1);
    for (let i = 0; i < 40; i++) rect(c, '#8a6240', 36 + Math.floor(rng() * 140), 21 + Math.floor(rng() * 16), 3 + Math.floor(rng() * 8), 1);

    // White window frame
    const { x, y, w, h } = WINDOW;
    rect(c, '#b7c8c2', x - 5, y - 5, w + 10, h + 8);
    rect(c, '#fbf6e8', x - 4, y - 4, w + 8, h + 6);
    rect(c, '#d9d3bf', x - 1, y - 1, w + 2, h + 2);
    c.clearRect(x, y, w, h);

    // Striped awning hanging across the top of the window
    for (let ax = 0; ax < w; ax += 16) {
      const colour = (ax / 16) % 2 === 0 ? '#ef6f5e' : '#fff6e3';
      rect(c, colour, x + ax, y, Math.min(16, w - ax), 6);
      if (ax + 16 <= w) disc(c, colour, x + ax + 8, y + 6, 2);
      rect(c, (ax / 16) % 2 === 0 ? '#c9503f' : '#e2d6bc', x + ax, y, Math.min(16, w - ax), 1);
    }

    // Driftwood counter
    rect(c, '#e8c896', 0, 158, WIDTH, 4);
    rect(c, '#f6dfb6', 0, 158, WIDTH, 1);
    rect(c, '#d4ad78', 0, 162, WIDTH, 34);
    for (let i = 0; i < 90; i++) {
      rect(c, rng() < 0.5 ? '#c49c68' : '#e0bd8b', Math.floor(rng() * WIDTH), 162 + Math.floor(rng() * 34), 1 + Math.floor(rng() * 8), 1);
    }
    rect(c, '#9c7446', 0, 196, WIDTH, 2);
    rect(c, '#7a5a38', 0, 198, WIDTH, 4);

    // Cash register
    rect(c, '#2c2a33', 2, 165, 28, 30);
    rect(c, '#2f8f8c', 3, 166, 26, 28);
    rect(c, '#4bb5b0', 3, 166, 26, 2);
    rect(c, '#123c3d', 6, 169, 20, 7);
    rect(c, '#9df0b0', 8, 171, 11, 2);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) rect(c, '#fbf1d8', 6 + col * 5, 179 + row * 3, 3, 2);
    rect(c, '#1f6a68', 3, 190, 26, 4);

    // Beige desktop computer: monitor and keyboard
    rect(c, '#2c2a33', 169, 161, 44, 26);
    rect(c, '#e6dcc2', 170, 162, 42, 24);
    rect(c, '#f6efdb', 170, 162, 42, 1);
    rect(c, '#2c2a33', 172, 164, 38, 20);
    rect(c, '#123c30', 173, 165, 36, 18);
    rect(c, '#bdb296', 185, 186, 12, 2);
    rect(c, '#2c2a33', 171, 188, 40, 7);
    rect(c, '#e6dcc2', 172, 189, 38, 5);
    for (let ky = 0; ky < 2; ky++) for (let kx = 0; kx < 9; kx++) rect(c, '#9a927c', 173 + kx * 4, 190 + ky * 2, 3, 1);

    // Shelving
    rect(c, '#7a5a38', 0, 202, WIDTH, 150);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) drawShelfCubby(c, rng, col * 54, 203 + row * 49);

    // Controls strip
    rect(c, COLOUR_STRIP, 0, 352, WIDTH, 32);
    rect(c, '#356482', 0, 352, WIDTH, 1);
  });

  // Painted shutter, closed until you open up
  canvasTexture(scene, 'shutter', WINDOW.w, WINDOW.h, (c) => {
    const rng = seeded(33);
    const { w, h } = WINDOW;
    rect(c, '#e9dcc0', 0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      rect(c, (y / 6) % 8 < 4 ? '#7fc4cf' : '#f4ead2', 0, y, w, 5);
      rect(c, '#b7a988', 0, y + 5, w, 1);
    }
    speckle(c, rng, 0, 0, w, h, ['#c9b994', '#ffffff'], 0.02);
    // Sign the word CLOSED sits on
    rect(c, '#7a5a38', 38, 46, 64, 22);
    rect(c, '#a97d4f', 39, 47, 62, 20);
    rect(c, '#7a5a38', 42, 38, 1, 8);
    rect(c, '#7a5a38', 97, 38, 1, 8);
  });

  canvasTexture(scene, 'waiting', 12, 22, (c) => {
    disc(c, '#6d5a52', 6, 4, 3);
    rect(c, '#58719a', 3, 8, 6, 8);
    rect(c, '#4b4453', 3, 16, 2, 6);
    rect(c, '#4b4453', 7, 16, 2, 6);
    outline(c, 12, 22, '#2c2a33');
  });

  // Boards across shelf rows you haven't bought yet
  canvasTexture(scene, 'boards', WIDTH, 49, (c) => {
    const rng = seeded(55);
    rect(c, '#5d4630', 0, 0, WIDTH, 49);
    for (let y = 2; y < 46; y += 9) {
      rect(c, '#9c7446', 0, y, WIDTH, 7);
      rect(c, '#b98a58', 0, y, WIDTH, 1);
      for (let i = 0; i < 40; i++) rect(c, '#8a6240', Math.floor(rng() * WIDTH), y + 2 + Math.floor(rng() * 4), 3 + Math.floor(rng() * 9), 1);
    }
  });
}

// ---- Products -------------------------------------------------------------

const SNACK_ART: Record<string, (c: Ctx) => void> = {
  chips: (c) => {
    rect(c, '#b02f2a', 3, 2, 10, 12);
    rect(c, '#d9423c', 3, 2, 7, 12);
    rect(c, '#f0b04a', 2, 1, 12, 2);
    rect(c, '#f0b04a', 2, 13, 12, 2);
    rect(c, '#f7d774', 5, 5, 6, 6);
    rect(c, '#d9a23e', 7, 7, 3, 3);
    rect(c, '#f09a90', 4, 3, 1, 9);
  },
  soda: (c) => {
    rect(c, '#2a62a8', 4, 2, 8, 12);
    rect(c, '#3c86cf', 4, 2, 5, 12);
    rect(c, '#c6ced4', 5, 1, 6, 1);
    rect(c, '#8c969e', 4, 2, 8, 1);
    rect(c, '#8c969e', 5, 14, 6, 1);
    rect(c, '#ece3cc', 4, 6, 8, 2);
    rect(c, '#ece3cc', 6, 8, 6, 2);
    rect(c, '#a8d4ef', 5, 3, 1, 10);
  },
  choco: (c) => {
    rect(c, '#8a2f59', 1, 4, 10, 8);
    rect(c, '#a73c70', 1, 4, 10, 3);
    rect(c, '#f0d27a', 3, 6, 6, 4);
    rect(c, '#54301c', 11, 4, 4, 8);
    rect(c, '#744528', 11, 4, 2, 2);
    rect(c, '#744528', 13, 6, 2, 2);
    rect(c, '#744528', 11, 8, 2, 2);
    rect(c, '#744528', 13, 10, 2, 2);
  },
  noodle: (c) => {
    rect(c, '#e8e0cb', 3, 4, 10, 4);
    rect(c, '#e8e0cb', 4, 8, 8, 6);
    rect(c, '#b8ad96', 10, 4, 3, 4);
    rect(c, '#b8ad96', 10, 8, 2, 6);
    rect(c, '#d9423c', 3, 6, 10, 3);
    rect(c, '#f0b04a', 2, 2, 12, 2);
    rect(c, '#c98a2e', 10, 2, 4, 2);
    rect(c, '#54201e', 6, 11, 4, 1);
  },
  jerky: (c) => {
    for (let i = 0; i < 11; i++) {
      rect(c, '#5a2d1a', 2 + i, 12 - i, 3, 3);
      rect(c, '#94512a', 3 + i, 12 - i, 1, 2);
    }
    rect(c, '#d9c28a', 2, 11, 4, 4);
    rect(c, '#b89f68', 4, 13, 2, 2);
  },
  icepop: (c) => {
    rect(c, '#e85d75', 4, 1, 8, 4);
    rect(c, '#fbf1d8', 4, 5, 8, 3);
    rect(c, '#4aa8e0', 4, 8, 8, 3);
    rect(c, '#f6a0ae', 5, 1, 2, 4);
    rect(c, '#2f86bd', 10, 8, 2, 3);
    rect(c, '#d9b98a', 7, 11, 2, 4);
  },
  popcorn: (c) => {
    rect(c, '#fbf1d8', 4, 7, 8, 8);
    [4, 8].forEach((x) => rect(c, '#d9423c', x, 7, 2, 8));
    rect(c, '#fff3c4', 3, 3, 10, 4);
    rect(c, '#fff3c4', 5, 1, 6, 2);
    [[4, 4], [8, 2], [11, 5], [6, 5]].forEach(([x, y]) => rect(c, '#f0b04a', x, y, 1, 1));
  },
  coconut: (c) => {
    rect(c, '#6b4a2e', 3, 5, 10, 9);
    rect(c, '#8a6240', 3, 5, 5, 4);
    rect(c, '#fbf6e8', 4, 3, 8, 3);
    rect(c, '#bfe6e0', 5, 3, 6, 2);
    rect(c, '#ef6f5e', 10, 0, 1, 5);
    rect(c, '#ef6f5e', 11, 0, 2, 1);
  },
  pie: (c) => {
    rect(c, '#7a5228', 2, 11, 12, 3);
    rect(c, '#55381b', 3, 13, 10, 1);
    rect(c, '#d9a55c', 2, 7, 12, 5);
    rect(c, '#d9a55c', 4, 5, 8, 2);
    rect(c, '#f0c988', 4, 5, 5, 2);
    rect(c, '#f0c988', 3, 7, 5, 2);
    rect(c, '#8a5a2c', 6, 7, 1, 2);
    rect(c, '#8a5a2c', 9, 6, 1, 2);
    rect(c, '#8a5a2c', 11, 8, 1, 2);
  },
  taco: (c) => {
    rect(c, '#5cbf5e', 3, 5, 10, 2);
    rect(c, '#ef6f5e', 5, 4, 2, 2);
    rect(c, '#fbf1d8', 9, 4, 3, 2);
    rect(c, '#f0c04a', 2, 7, 12, 5);
    rect(c, '#f0c04a', 4, 12, 8, 2);
    rect(c, '#c9922e', 2, 11, 12, 1);
    rect(c, '#f7dc8a', 3, 7, 5, 1);
  },
  lemon: (c) => {
    rect(c, '#e6f3f2', 4, 3, 8, 12);
    rect(c, '#f7e25a', 5, 6, 6, 8);
    rect(c, '#fff4a0', 5, 6, 2, 8);
    rect(c, '#9fd0d8', 4, 14, 8, 1);
    disc(c, '#f0c02e', 12, 4, 2);
    rect(c, '#ef6f5e', 7, 0, 1, 6);
  },
  shave: (c) => {
    disc(c, '#f28bb0', 8, 6, 4);
    rect(c, '#7fd0ee', 8, 2, 4, 8);
    rect(c, '#fff3c4', 6, 3, 2, 3);
    rect(c, '#fbf1d8', 4, 9, 8, 2);
    rect(c, '#e8604f', 5, 11, 6, 3);
    rect(c, '#c9503f', 9, 11, 2, 3);
  },
};

function drawProducts(scene: Phaser.Scene) {
  for (const [id, draw] of Object.entries(SNACK_ART)) {
    canvasTexture(scene, `item_${id}`, 16, 16, (c) => {
      draw(c);
      outline(c, 16, 16, '#2c2a33');
    });
  }
}

// ---- Money, boxes and small props -----------------------------------------

const BILLS: Record<number, { base: string; dark: string; light: string }> = {
  2000: { base: '#5f9a63', dark: '#2f6b3f', light: '#a9d39f' },
  1000: { base: '#4f9490', dark: '#27615f', light: '#a0d6cd' },
  500: { base: '#5d7fb3', dark: '#35507e', light: '#b0c6e4' },
  100: { base: '#8f9c62', dark: '#5c6a35', light: '#cdd6a3' },
};

const COINS: Record<number, { r: number; base: string; dark: string; light: string }> = {
  50: { r: 15, base: '#e0b64a', dark: '#946d1f', light: '#f7dd8c' },
  25: { r: 14, base: '#b9bfc9', dark: '#6f7686', light: '#e8ecf2' },
  10: { r: 12, base: '#c3c8d0', dark: '#7a8090', light: '#eef0f4' },
  5: { r: 13, base: '#98a0a8', dark: '#5c6470', light: '#c9ced4' },
};

function drawMoney(scene: Phaser.Scene) {
  for (const [cents, b] of Object.entries(BILLS)) {
    canvasTexture(scene, `money_${cents}`, 50, 30, (c) => {
      rect(c, b.dark, 0, 0, 50, 30);
      rect(c, b.base, 1, 1, 48, 28);
      rect(c, b.dark, 3, 3, 44, 1);
      rect(c, b.dark, 3, 26, 44, 1);
      rect(c, b.dark, 3, 3, 1, 24);
      rect(c, b.dark, 46, 3, 1, 24);
      [[5, 5], [41, 5], [5, 21], [41, 21]].forEach(([x, y]) => {
        rect(c, b.light, x, y, 4, 4);
        rect(c, b.dark, x + 1, y + 1, 2, 2);
      });
      for (let y = 6; y < 25; y += 3) rect(c, b.light, 10, y, 30, 1);
      rect(c, '#efe8cf', 12, 8, 26, 14);
      rect(c, '#efe8cf', 10, 10, 30, 10);
      rect(c, b.dark, 12, 8, 26, 1);
      rect(c, b.dark, 12, 21, 26, 1);
    });
    // The same bill redrawn at desk size, with its border, corners and centre panel
    canvasTexture(scene, `desk_${cents}`, 32, 19, (c) => {
      rect(c, '#2c2a33', 0, 0, 32, 19);
      rect(c, b.dark, 1, 1, 30, 17);
      rect(c, b.base, 2, 2, 28, 15);
      [[3, 3], [26, 3], [3, 13], [26, 13]].forEach(([x, y]) => {
        rect(c, b.light, x, y, 3, 3);
        rect(c, b.dark, x + 1, y + 1, 1, 1);
      });
      rect(c, b.light, 6, 4, 20, 1);
      rect(c, b.light, 6, 14, 20, 1);
      rect(c, '#efe8cf', 6, 6, 20, 7);
      rect(c, b.dark, 6, 5, 20, 1);
      rect(c, b.dark, 6, 13, 20, 1);
    });
  }
  for (const [cents, m] of Object.entries(COINS)) {
    const size = m.r * 2 + 1;
    canvasTexture(scene, `money_${cents}`, size, size, (c) => {
      disc(c, m.dark, m.r, m.r, m.r);
      disc(c, m.base, m.r, m.r, m.r - 1);
      disc(c, m.light, m.r - 1, m.r - 1, m.r - 3);
      disc(c, m.base, m.r, m.r, m.r - 3);
    });
    const r = Math.max(7, Math.round(m.r * 0.6));
    canvasTexture(scene, `desk_${cents}`, r * 2 + 3, r * 2 + 3, (c) => {
      const mid = r + 1;
      disc(c, m.dark, mid, mid, r);
      disc(c, m.base, mid, mid, r - 1);
      disc(c, m.light, mid - 1, mid - 1, r - 2);
      disc(c, m.base, mid, mid, r - 2);
      outline(c, r * 2 + 3, r * 2 + 3, '#2c2a33');
    });
  }
}

/** Skin and sleeve colours taken from each character on the sheet. */
const HANDS: { skin: string; shade: string; sleeve: string; cuff: string }[] = [
  { skin: '#f0c896', shade: '#c9915f', sleeve: '#efdcc6', cuff: '#c9b49c' },
  { skin: '#e3b184', shade: '#a9744c', sleeve: '#e9daa8', cuff: '#a9b4c0' },
  { skin: '#f4cfa6', shade: '#cf9a6c', sleeve: '#54728f', cuff: '#37506a' },
  { skin: '#f0c896', shade: '#c9915f', sleeve: '#8a7250', cuff: '#6d5a3f' },
  { skin: '#f0c49a', shade: '#c9915f', sleeve: '#cbbd9f', cuff: '#a3967b' },
  { skin: '#dcae85', shade: '#a3724f', sleeve: '#b9c490', cuff: '#8f9a6a' },
];

function drawHands(scene: Phaser.Scene) {
  HANDS.forEach((h, i) => {
    canvasTexture(scene, `hand_${i}`, 20, 26, (c) => {
      // Forearm coming over the counter from the customer
      rect(c, h.sleeve, 3, 0, 11, 13);
      rect(c, h.cuff, 3, 11, 11, 3);
      rect(c, h.cuff, 11, 0, 3, 11);
      // Back of the hand
      rect(c, h.skin, 4, 14, 10, 6);
      rect(c, h.shade, 11, 14, 3, 6);
      // Thumb and fingers wrapped around what they're holding
      rect(c, h.skin, 13, 16, 5, 3);
      rect(c, h.shade, 13, 18, 5, 1);
      for (let f = 0; f < 4; f++) {
        rect(c, h.skin, 4 + f * 3, 20, 2, 4);
        rect(c, h.shade, 5 + f * 3, 21, 1, 3);
      }
      outline(c, 20, 26, '#2c2a33');
    });
  });
  canvasTexture(scene, 'held_card', 26, 17, (c) => {
    rect(c, '#2c2a33', 0, 0, 26, 17);
    rect(c, '#2f6fb0', 1, 1, 24, 15);
    rect(c, '#4b92d4', 1, 1, 24, 2);
    rect(c, '#1f3a5c', 1, 4, 24, 3);
    rect(c, '#f0c84f', 4, 9, 5, 4);
    rect(c, '#a98a2e', 6, 9, 1, 4);
    rect(c, '#dbe9f6', 12, 10, 10, 1);
    rect(c, '#dbe9f6', 12, 13, 7, 1);
  });
}

function drawProps(scene: Phaser.Scene) {
  canvasTexture(scene, 'box_closed', 28, 24, (c) => {
    rect(c, '#14100e', 0, 2, 28, 22);
    rect(c, '#b98d55', 1, 3, 26, 20);
    rect(c, '#d4aa70', 1, 3, 26, 8);
    rect(c, '#8f6a3b', 1, 10, 26, 1);
    rect(c, '#e8dcb8', 11, 3, 6, 20);
    rect(c, '#c9bb92', 15, 3, 2, 20);
    rect(c, '#8f6a3b', 20, 15, 5, 5);
    rect(c, '#efe8cf', 21, 16, 3, 1);
    rect(c, '#efe8cf', 21, 18, 3, 1);
  });
  canvasTexture(scene, 'box_open', 28, 24, (c) => {
    rect(c, '#14100e', 2, 8, 24, 16);
    rect(c, '#b98d55', 3, 9, 22, 14);
    rect(c, '#3b2618', 4, 9, 20, 4);
    rect(c, '#8f6a3b', 3, 13, 22, 1);
    // Flaps folded out to the sides
    rect(c, '#14100e', 0, 3, 8, 7);
    rect(c, '#d4aa70', 1, 4, 6, 5);
    rect(c, '#14100e', 20, 3, 8, 7);
    rect(c, '#d4aa70', 21, 4, 6, 5);
    rect(c, '#e8dcb8', 11, 14, 6, 9);
  });
  canvasTexture(scene, 'crate', 20, 18, (c) => {
    rect(c, '#14100e', 0, 0, 20, 18);
    rect(c, '#8f6a3b', 1, 1, 18, 16);
    rect(c, '#b98d55', 1, 1, 18, 2);
    rect(c, '#6d4f2b', 1, 5, 18, 1);
    rect(c, '#6d4f2b', 1, 11, 18, 1);
    rect(c, '#6d4f2b', 3, 1, 1, 16);
    rect(c, '#6d4f2b', 16, 1, 1, 16);
  });
  canvasTexture(scene, 'sound_on', 11, 9, (c) => {
    rect(c, '#ece3cc', 0, 3, 2, 3);
    rect(c, '#ece3cc', 2, 2, 1, 5);
    rect(c, '#ece3cc', 3, 1, 1, 7);
    rect(c, '#ece3cc', 4, 0, 1, 9);
    rect(c, '#8fe0a0', 6, 3, 1, 3);
    rect(c, '#8fe0a0', 8, 2, 1, 5);
    rect(c, '#8fe0a0', 10, 1, 1, 7);
  });
  canvasTexture(scene, 'sound_off', 11, 9, (c) => {
    rect(c, '#93a3a0', 0, 3, 2, 3);
    rect(c, '#93a3a0', 2, 2, 1, 5);
    rect(c, '#93a3a0', 3, 1, 1, 7);
    rect(c, '#93a3a0', 4, 0, 1, 9);
    for (let i = 0; i < 5; i++) {
      rect(c, '#f0705f', 6 + i, 2 + i, 1, 1);
      rect(c, '#f0705f', 10 - i, 2 + i, 1, 1);
    }
  });
}

export function createTextures(scene: Phaser.Scene): void {
  drawShop(scene);
  drawMoney(scene);
  drawProps(scene);
  drawHands(scene);
  drawProducts(scene);
}
