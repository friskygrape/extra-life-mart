import Phaser from 'phaser';
import { WIDTH } from '../ui';

type Ctx = CanvasRenderingContext2D;

export const WINDOW = { x: 20, y: 20, w: 176, h: 138 };
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
    for (let y = 22; y < 154; y += 3) {
      rect(c, '#d9b98a', 7, y, 3, 2);
      rect(c, '#a98a5f', 8, y + 2, 2, 1);
    }
    disc(c, '#fbf1d8', 207, 70, 7);
    disc(c, '#8ad1c2', 207, 70, 3);
    [[201, 68], [211, 68], [205, 64], [205, 74]].forEach(([rx, ry]) => rect(c, '#e8604f', rx, ry, 4, 3));

    // White window frame
    const { x, y, w, h } = WINDOW;
    rect(c, '#b7c8c2', x - 5, y - 5, w + 10, h + 8);
    rect(c, '#fbf6e8', x - 4, y - 4, w + 8, h + 6);
    rect(c, '#d9d3bf', x - 1, y - 1, w + 2, h + 2);
    c.clearRect(x, y, w, h);

    // Striped awning hanging across the top of the window
    for (let ax = 0; ax < w; ax += 16) {
      const colour = (ax / 16) % 2 === 0 ? '#ef6f5e' : '#fff6e3';
      rect(c, colour, x + ax, y, 16, 9);
      disc(c, colour, x + ax + 8, y + 9, 3);
      rect(c, (ax / 16) % 2 === 0 ? '#c9503f' : '#e2d6bc', x + ax, y, 16, 1);
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

  // The boardwalk through the window
  canvasTexture(scene, 'beach', WINDOW.w, WINDOW.h, (c) => {
    const rng = seeded(21);
    const { w, h } = WINDOW;
    const skyBands = ['#6cc3ee', '#84cff1', '#9bd9f3', '#b3e3f5', '#c9ecf7', '#def4f9'];
    for (let y = 0; y < 62; y++) rect(c, skyBands[Math.min(5, Math.floor(y / 10))], 0, y, w, 1);
    // Clouds
    [[18, 22], [66, 14], [118, 28]].forEach(([cx, cy]) => {
      disc(c, '#ffffff', cx, cy, 5);
      disc(c, '#ffffff', cx + 7, cy - 2, 6);
      disc(c, '#ffffff', cx + 15, cy, 5);
      rect(c, '#ffffff', cx - 4, cy + 1, 24, 4);
      rect(c, '#e7f4fa', cx - 4, cy + 4, 24, 1);
    });
    // Sea
    rect(c, '#2fb4cf', 0, 58, w, 16);
    rect(c, '#55cbdc', 0, 58, w, 2);
    for (let i = 0; i < 34; i++) rect(c, rng() < 0.5 ? '#a8ecef' : '#1f99b8', Math.floor(rng() * w), 60 + Math.floor(rng() * 13), 2 + Math.floor(rng() * 7), 1);
    rect(c, '#e9fbf7', 0, 73, w, 2);
    // Sand
    rect(c, '#f4d99a', 0, 75, w, h - 75);
    for (let i = 0; i < 120; i++) rect(c, rng() < 0.5 ? '#e8c780' : '#fbe9bd', Math.floor(rng() * w), 76 + Math.floor(rng() * (h - 76)), 1 + Math.floor(rng() * 2), 1);

    // Row of pastel shops along the boardwalk
    const shops: [number, number, number, string, string][] = [
      [88, 44, 24, '#f2a0a8', '#fff6e3'],
      [110, 38, 24, '#9fd0f2', '#ef6f5e'],
      [132, 46, 26, '#f7d774', '#3f9e8a'],
      [156, 36, 22, '#a8e0b0', '#ef6f5e'],
    ];
    shops.forEach(([sx, top, sw, wall, awning]) => {
      rect(c, '#2c2a33', sx - 1, top - 1, sw + 2, 96 - top + 1);
      rect(c, wall, sx, top, sw, 96 - top);
      rect(c, '#fbf6e8', sx, top, sw, 2);
      for (let wy = top + 6; wy < 74; wy += 12) {
        for (let wx = sx + 3; wx < sx + sw - 5; wx += 8) {
          rect(c, '#fbf6e8', wx - 1, wy - 1, 6, 8);
          rect(c, '#5a9fc0', wx, wy, 4, 6);
        }
      }
      for (let ax = 0; ax < sw; ax += 4) rect(c, ax % 8 === 0 ? awning : '#ffffff', sx + ax, 76, 4, 6);
      rect(c, '#6a5040', sx + sw / 2 - 3, 84, 6, 12);
    });
    // Boardwalk planks in the foreground
    rect(c, '#a97d4f', 72, 96, w - 72, h - 96);
    for (let py = 96; py < h; py += 5) rect(c, '#8a6240', 72, py, w - 72, 1);
    for (let i = 0; i < 40; i++) rect(c, '#c1955f', 72 + Math.floor(rng() * (w - 72)), 97 + Math.floor(rng() * (h - 97)), 3 + Math.floor(rng() * 8), 1);
    rect(c, '#7d5838', 72, 92, w - 72, 2);
    for (let px = 74; px < w; px += 13) rect(c, '#7d5838', px, 86, 2, 10);
    rect(c, '#9c7446', 72, 86, w - 72, 2);

    // Palm trees
    const palm = (px: number, base: number, height: number) => {
      for (let i = 0; i < height; i++) {
        const lean = Math.floor((i * i) / (height * 3));
        rect(c, i % 4 === 0 ? '#8a6240' : '#a97d4f', px + lean, base - i, 3, 1);
      }
      const tx = px + Math.floor(height / 3);
      const ty = base - height;
      [[-1, -0.35], [-1, 0.35], [1, -0.35], [1, 0.35], [-0.6, 0.8], [0.6, 0.8]].forEach(([dx, dy]) => {
        for (let i = 0; i < 14; i++) {
          const fx = Math.round(tx + dx * i);
          const fy = Math.round(ty + dy * i + (i * i) / 28);
          rect(c, i % 3 === 0 ? '#3f9e55' : '#5cbf5e', fx, fy, 2, 2);
        }
      });
      disc(c, '#7a5a38', tx + 1, ty + 1, 1);
    };
    palm(8, 92, 58);
    palm(150, 92, 66);
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
    rect(c, '#7a5a38', 56, 52, 64, 22);
    rect(c, '#a97d4f', 57, 53, 62, 20);
    rect(c, '#7a5a38', 60, 44, 1, 8);
    rect(c, '#7a5a38', 115, 44, 1, 8);
  });

  canvasTexture(scene, 'waiting', 14, 26, (c) => {
    disc(c, '#3a5266', 7, 5, 4);
    rect(c, '#3a5266', 3, 10, 8, 10);
    rect(c, '#3a5266', 3, 20, 3, 6);
    rect(c, '#3a5266', 8, 20, 3, 6);
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
  25: { r: 18, base: '#b9bfc9', dark: '#6f7686', light: '#e8ecf2' },
  10: { r: 14, base: '#c3c8d0', dark: '#7a8090', light: '#eef0f4' },
  5: { r: 16, base: '#98a0a8', dark: '#5c6470', light: '#c9ced4' },
  1: { r: 13, base: '#c67f4f', dark: '#804a28', light: '#eeb78e' },
};

function drawMoney(scene: Phaser.Scene) {
  for (const [cents, b] of Object.entries(BILLS)) {
    canvasTexture(scene, `money_${cents}`, 50, 34, (c) => {
      rect(c, b.dark, 0, 0, 50, 34);
      rect(c, b.base, 1, 1, 48, 32);
      rect(c, b.dark, 3, 3, 44, 1);
      rect(c, b.dark, 3, 30, 44, 1);
      rect(c, b.dark, 3, 3, 1, 28);
      rect(c, b.dark, 46, 3, 1, 28);
      // Engraved corners
      [[5, 5], [41, 5], [5, 25], [41, 25]].forEach(([x, y]) => {
        rect(c, b.light, x, y, 4, 4);
        rect(c, b.dark, x + 1, y + 1, 2, 2);
      });
      // Fine lines behind the centre panel
      for (let y = 6; y < 29; y += 3) rect(c, b.light, 10, y, 30, 1);
      // Centre panel, which the amount sits on
      rect(c, '#efe8cf', 12, 9, 26, 16);
      rect(c, '#efe8cf', 10, 11, 30, 12);
      rect(c, b.dark, 12, 9, 26, 1);
      rect(c, b.dark, 12, 24, 26, 1);
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
  }
}

/** The colour a denomination shows as in the change tray. */
export function moneyColour(cents: number): number {
  const hex = cents >= 100 ? BILLS[cents].base : COINS[cents].base;
  return parseInt(hex.slice(1), 16);
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
  drawProducts(scene);
}
