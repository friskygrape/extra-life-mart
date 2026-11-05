import Phaser from 'phaser';
import { WIDTH } from '../ui';

type Ctx = CanvasRenderingContext2D;

export const WINDOW = { x: 20, y: 20, w: 176, h: 138 };
export const PORTRAIT_W = 84;
export const PORTRAIT_H = 100;
export const CUSTOMER_LOOKS = 10;

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

/** Rust running down from a point, the signature wear on everything in the shack. */
function rustStreak(c: Ctx, rng: () => number, x: number, y: number, len: number) {
  for (let i = 0; i < len; i++) {
    if (rng() < 0.82) rect(c, i < len / 2 ? '#8a4a2c' : '#6b4332', x + (rng() < 0.2 ? 1 : 0), y + i);
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
    const half = Math.floor(Math.sqrt(r * r - y * y));
    rect(c, color, cx - half, cy + y, half * 2 + 1, 1);
  }
}

// ---- The shack ------------------------------------------------------------

function drawShack(scene: Phaser.Scene) {
  canvasTexture(scene, 'shack', WIDTH, 384, (c) => {
    const rng = seeded(7);
    // Corrugated walls
    rect(c, '#34494a', 0, 0, WIDTH, 160);
    for (let x = 0; x < WIDTH; x += 4) rect(c, '#2c3f40', x, 0, 1, 160);
    for (let x = 2; x < WIDTH; x += 4) rect(c, '#3d5455', x, 0, 1, 160);
    speckle(c, rng, 0, 0, WIDTH, 160, ['#2a3a3b', '#44595a', '#5a4a3c'], 0.05);
    for (let i = 0; i < 14; i++) rustStreak(c, rng, Math.floor(rng() * WIDTH), 18 + Math.floor(rng() * 70), 8 + Math.floor(rng() * 40));

    // Cables along the left side, a pipe along the right
    rect(c, '#1b2225', 5, 18, 2, 142);
    rect(c, '#7a3d2c', 10, 40, 2, 120);
    rect(c, '#222c2e', 200, 18, 6, 142);
    rect(c, '#46585a', 201, 18, 2, 142);
    rect(c, '#14191b', 199, 70, 8, 3);
    rect(c, '#14191b', 199, 118, 8, 3);

    // Heavy window frame
    const { x, y, w, h } = WINDOW;
    rect(c, '#191e20', x - 5, y - 5, w + 10, h + 8);
    rect(c, '#4b3a3a', x - 4, y - 4, w + 8, h + 6);
    rect(c, '#5f4a48', x - 4, y - 4, w + 8, 1);
    rect(c, '#2e2526', x - 1, y - 1, w + 2, h + 2);
    speckle(c, rng, x - 4, y - 4, w + 8, 3, ['#8a4a2c', '#39302f'], 0.25);
    speckle(c, rng, x - 4, y, 3, h, ['#8a4a2c', '#39302f'], 0.25);
    speckle(c, rng, x + w + 1, y, 3, h, ['#8a4a2c', '#39302f'], 0.25);
    [x - 3, x + w + 1].forEach((bx) => [y + 6, y + 60, y + 120].forEach((by) => rect(c, '#a39a8a', bx, by, 2, 2)));
    c.clearRect(x, y, w, h);

    // Table
    rect(c, '#6e6f62', 0, 158, WIDTH, 4);
    rect(c, '#8d8d7c', 0, 158, WIDTH, 1);
    rect(c, '#55574d', 0, 162, WIDTH, 34);
    for (let i = 0; i < 90; i++) rect(c, rng() < 0.5 ? '#4a4c43' : '#62645a', Math.floor(rng() * WIDTH), 162 + Math.floor(rng() * 34), 1 + Math.floor(rng() * 7), 1);
    rect(c, '#22282a', 0, 196, WIDTH, 2);
    rect(c, '#14181a', 0, 198, WIDTH, 4);

    // Old cash register on the left of the table
    rect(c, '#14181a', 2, 165, 28, 30);
    rect(c, '#7d2f2b', 3, 166, 26, 28);
    rect(c, '#9c423a', 3, 166, 26, 2);
    rect(c, '#1c2b28', 6, 169, 20, 7);
    rect(c, '#8fe0a0', 8, 171, 11, 2);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) rect(c, '#d8cfb6', 6 + col * 5, 179 + row * 3, 3, 2);
    rect(c, '#54201e', 3, 190, 26, 4);

    // Crusty terminal on the right of the table, for buying stock
    rect(c, '#14181a', 168, 163, 45, 32);
    rect(c, '#b9ae94', 169, 164, 43, 30);
    rect(c, '#d4c9ad', 169, 164, 43, 1);
    rect(c, '#14181a', 172, 167, 37, 16);
    rect(c, '#1c3a30', 173, 168, 35, 14);
    rect(c, '#2a5444', 173, 168, 35, 2);
    rect(c, '#8c8069', 172, 186, 16, 4);
    rect(c, '#f0705f', 203, 187, 3, 2);
    speckle(c, rng, 169, 183, 43, 11, ['#8a7d60', '#8a4a2c'], 0.1);

    // Shelving under the table
    rect(c, '#14181a', 0, 202, WIDTH, 150);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const sx = col * 54;
        const sy = 203 + row * 49;
        const food = col < 2;
        rect(c, food ? '#4d3220' : '#2d2c44', sx, sy, 54, 49);
        rect(c, food ? '#6e4a2e' : '#47456a', sx, sy, 54, 1);
        rect(c, food ? '#3b2618' : '#222137', sx + 1, sy + 1, 52, 37);
        rect(c, food ? '#2d1d12' : '#1a1a2c', sx + 1, sy + 1, 52, 4);
        rect(c, food ? '#7d5634' : '#5a5887', sx, sy + 38, 54, 2);
        rect(c, food ? '#c9b98f' : '#b8b5d4', sx + 1, sy + 40, 52, 8);
        speckle(c, rng, sx, sy, 54, 39, food ? ['#5e3e27', '#2d1d12'] : ['#38375a', '#1a1a2c'], 0.03);
        speckle(c, rng, sx, sy + 38, 54, 2, ['#8a4a2c'], 0.25);
      }
    }
    // A strip light over the game racks and a rough divider between the two sections
    rect(c, '#14181a', 107, 202, 2, 150);
    rect(c, '#e05a8a', 109, 203, 107, 1);

    // Floor strip behind the controls
    rect(c, '#1c2224', 0, 352, WIDTH, 32);
    rect(c, '#3a3331', 0, 352, WIDTH, 1);
    speckle(c, rng, 0, 353, WIDTH, 31, ['#232a2c', '#171c1e'], 0.08);
  });

  canvasTexture(scene, 'street', WINDOW.w, WINDOW.h, (c) => {
    const rng = seeded(21);
    const { w, h } = WINDOW;
    for (let y = 0; y < h; y++) rect(c, y < 60 ? '#141c2c' : y < 90 ? '#1a2333' : '#20283a', 0, y, w, 1);
    // Far buildings with lit windows
    [[0, 44, 42], [38, 22, 36], [72, 52, 30], [100, 30, 40], [138, 40, 38]].forEach(([bx, by, bw]) => {
      rect(c, '#0e1420', bx, by, bw, 100 - by);
      for (let wy = by + 4; wy < 94; wy += 8) {
        for (let wx = bx + 4; wx < bx + bw - 4; wx += 7) {
          if (rng() < 0.32) rect(c, rng() < 0.7 ? '#e0a94f' : '#6fb7c9', wx, wy, 3, 4);
        }
      }
    });
    // Neon sign across the street
    rect(c, '#090d15', 104, 38, 58, 22);
    rect(c, '#e05a8a', 106, 40, 54, 1);
    rect(c, '#e05a8a', 106, 57, 54, 1);
    rect(c, '#e05a8a', 106, 40, 1, 18);
    rect(c, '#e05a8a', 159, 40, 1, 18);
    [[110, 44, 8], [120, 44, 4], [126, 44, 11], [139, 44, 5], [146, 44, 10]].forEach(([nx, ny, nw]) => {
      rect(c, '#6fe0d6', nx, ny, nw, 2);
      rect(c, '#6fe0d6', nx, ny + 7, nw, 2);
      rect(c, '#6fe0d6', nx, ny, 2, 9);
    });
    // Wet pavement
    rect(c, '#232636', 0, 100, w, h - 100);
    rect(c, '#31344a', 0, 100, w, 2);
    for (let i = 0; i < 26; i++) rect(c, rng() < 0.5 ? '#3b3f58' : '#5a3854', Math.floor(rng() * w), 104 + Math.floor(rng() * (h - 104)), 3 + Math.floor(rng() * 16), 1);
    // Rain
    for (let i = 0; i < 70; i++) rect(c, '#46577a', Math.floor(rng() * w), Math.floor(rng() * h), 1, 3);
  });

  canvasTexture(scene, 'shutter', WINDOW.w, WINDOW.h, (c) => {
    const rng = seeded(33);
    const { w, h } = WINDOW;
    rect(c, '#5c5249', 0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      rect(c, '#6e6358', 0, y, w, 2);
      rect(c, '#3f3730', 0, y + 5, w, 1);
    }
    for (let i = 0; i < 26; i++) rustStreak(c, rng, Math.floor(rng() * w), Math.floor(rng() * (h - 30)), 8 + Math.floor(rng() * 26));
    speckle(c, rng, 0, 0, w, h, ['#8a4a2c', '#3f3730', '#7a6e60'], 0.03);
    rect(c, '#2a2522', 74, h - 9, 28, 9);
    rect(c, '#b08a3a', 83, h - 12, 10, 8);
    rect(c, '#2a2522', 87, h - 9, 2, 3);
  });

  canvasTexture(scene, 'waiting', 14, 22, (c) => {
    disc(c, '#090d15', 7, 6, 5);
    rect(c, '#090d15', 1, 12, 12, 10);
  });
}

// ---- Customers ------------------------------------------------------------

interface Look {
  skin: string;
  shade: string;
  hair: string;
  top: string;
  topShade: string;
  hairstyle: 'short' | 'long' | 'bald' | 'beanie' | 'cap' | 'curly' | 'bun';
  clothes: 'hoodie' | 'jacket' | 'tee';
  glasses?: boolean;
  beard?: boolean;
  earring?: boolean;
}

const LOOKS: Look[] = [
  { skin: '#c98d62', shade: '#a26c48', hair: '#26201f', top: '#7d2f2b', topShade: '#572020', hairstyle: 'beanie', clothes: 'hoodie' },
  { skin: '#8a5a3c', shade: '#6a4229', hair: '#17120f', top: '#b8922f', topShade: '#8a6c20', hairstyle: 'curly', clothes: 'jacket', earring: true },
  { skin: '#eec7a2', shade: '#c99e78', hair: '#b85f26', top: '#39665a', topShade: '#274a41', hairstyle: 'long', clothes: 'tee' },
  { skin: '#c49068', shade: '#9c6e4c', hair: '#cdcbd0', top: '#54477f', topShade: '#3b3160', hairstyle: 'short', clothes: 'jacket', glasses: true, beard: true },
  { skin: '#5e3a28', shade: '#452a1c', hair: '#141011', top: '#2f6e88', topShade: '#225066', hairstyle: 'bald', clothes: 'hoodie', beard: true },
  { skin: '#f0cfae', shade: '#cba585', hair: '#e0bb50', top: '#a83f62', topShade: '#7d2d48', hairstyle: 'bun', clothes: 'tee', glasses: true },
  { skin: '#d3a074', shade: '#ab7c54', hair: '#2b2235', top: '#3f4a4d', topShade: '#2c3537', hairstyle: 'cap', clothes: 'hoodie' },
  { skin: '#a8724c', shade: '#855637', hair: '#3a1f18', top: '#d0c5a5', topShade: '#a39a7f', hairstyle: 'long', clothes: 'jacket' },
  { skin: '#e6b48c', shade: '#c08f69', hair: '#4a2c1c', top: '#6b7f3a', topShade: '#4e5e29', hairstyle: 'short', clothes: 'tee', beard: true },
  { skin: '#744a30', shade: '#573420', hair: '#7d3b73', top: '#27364f', topShade: '#1b263a', hairstyle: 'curly', clothes: 'hoodie', glasses: true },
];

function drawPortrait(c: Ctx, l: Look) {
  const cx = 42;
  // Hair that sits behind the head
  if (l.hairstyle === 'long') rect(c, l.hair, 21, 20, 42, 56);
  if (l.hairstyle === 'curly') {
    disc(c, l.hair, cx, 28, 26);
    disc(c, l.hair, 20, 40, 9);
    disc(c, l.hair, 64, 40, 9);
  }
  if (l.hairstyle === 'bun') disc(c, l.hair, cx, 9, 8);

  // Shoulders
  for (let y = 74; y < PORTRAIT_H; y++) {
    const half = Math.min(40, 16 + (y - 74) * 2);
    rect(c, l.top, cx - half, y, half * 2, 1);
    rect(c, l.topShade, cx + half - 8, y, 8, 1);
  }
  // Neck
  rect(c, l.shade, 34, 58, 16, 20);
  rect(c, l.skin, 34, 62, 10, 13);

  // Clothing details
  if (l.clothes === 'hoodie') {
    rect(c, l.topShade, 24, 70, 36, 8);
    rect(c, l.top, 28, 70, 28, 3);
    rect(c, '#e0d8c2', 37, 78, 1, 11);
    rect(c, '#e0d8c2', 47, 78, 1, 9);
  } else if (l.clothes === 'jacket') {
    rect(c, l.topShade, 41, 78, 2, 22);
    for (let i = 0; i < 11; i++) {
      rect(c, l.topShade, 30 - i, 74 + i, 6, 1);
      rect(c, l.topShade, 48 + i, 74 + i, 6, 1);
    }
    rect(c, '#d9d2bd', 36, 74, 12, 6);
  } else {
    rect(c, l.skin, 35, 74, 14, 3);
    rect(c, l.topShade, 33, 77, 18, 1);
  }

  // Head
  rect(c, l.skin, 24, 22, 36, 38);
  rect(c, l.skin, 26, 18, 32, 46);
  rect(c, l.skin, 29, 64, 26, 3);
  rect(c, l.shade, 54, 22, 6, 38);
  rect(c, l.shade, 52, 58, 6, 6);
  rect(c, l.shade, 29, 65, 26, 2);
  // Ears
  rect(c, l.skin, 21, 36, 3, 9);
  rect(c, l.shade, 60, 36, 3, 9);
  if (l.earring) rect(c, '#f0b04a', 21, 46, 2, 3);

  // Face
  rect(c, '#ece3cc', 30, 38, 6, 4);
  rect(c, '#ece3cc', 47, 38, 6, 4);
  rect(c, '#1b1512', 32, 38, 3, 4);
  rect(c, '#1b1512', 49, 38, 3, 4);
  rect(c, l.shade, 30, 42, 6, 1);
  rect(c, l.shade, 47, 42, 6, 1);
  const brow = l.hairstyle === 'bald' ? '#241a15' : l.hair;
  rect(c, brow, 29, 34, 8, 2);
  rect(c, brow, 46, 34, 8, 2);
  rect(c, l.shade, 42, 38, 2, 11);
  rect(c, l.shade, 39, 49, 6, 2);
  rect(c, '#6b3a30', 36, 55, 13, 2);
  rect(c, l.shade, 38, 57, 9, 1);

  if (l.beard) {
    rect(c, l.hair, 26, 50, 32, 14);
    rect(c, l.hair, 30, 64, 24, 3);
    rect(c, l.skin, 36, 53, 13, 6);
    rect(c, '#6b3a30', 37, 55, 11, 2);
  }
  if (l.glasses) {
    ['#1b1512'].forEach((g) => {
      [[27, 36], [44, 36]].forEach(([gx, gy]) => {
        rect(c, g, gx, gy, 12, 1);
        rect(c, g, gx, gy + 8, 12, 1);
        rect(c, g, gx, gy, 1, 9);
        rect(c, g, gx + 11, gy, 1, 9);
      });
      rect(c, g, 39, 39, 5, 1);
    });
  }

  // Hair on top
  switch (l.hairstyle) {
    case 'short':
      rect(c, l.hair, 24, 14, 36, 12);
      rect(c, l.hair, 24, 26, 3, 8);
      rect(c, l.hair, 57, 26, 3, 8);
      break;
    case 'long':
      rect(c, l.hair, 24, 14, 36, 11);
      rect(c, l.hair, 22, 22, 6, 28);
      rect(c, l.hair, 56, 22, 6, 28);
      break;
    case 'bun':
      rect(c, l.hair, 24, 14, 36, 11);
      rect(c, l.hair, 24, 25, 4, 8);
      rect(c, l.hair, 56, 25, 4, 8);
      break;
    case 'curly':
      for (let i = 0; i < 7; i++) disc(c, l.hair, 26 + i * 5, 19 + (i % 2) * 3, 4);
      break;
    case 'beanie':
      rect(c, l.top, 23, 8, 38, 18);
      rect(c, l.topShade, 23, 22, 38, 6);
      for (let x = 25; x < 60; x += 4) rect(c, l.top, x, 22, 1, 6);
      rect(c, l.topShade, 53, 8, 8, 14);
      break;
    case 'cap':
      rect(c, l.top, 24, 10, 36, 14);
      rect(c, l.topShade, 53, 10, 7, 14);
      rect(c, l.topShade, 20, 24, 44, 4);
      rect(c, l.hair, 24, 28, 3, 6);
      rect(c, l.hair, 57, 28, 3, 6);
      rect(c, '#f0b04a', 38, 14, 8, 6);
      break;
    case 'bald':
      rect(c, '#ffffff22', 30, 21, 10, 3);
      break;
  }
  outline(c, PORTRAIT_W, PORTRAIT_H, '#0e0b0a');
}

// ---- Products -------------------------------------------------------------

const FOOD_ART: Record<string, (c: Ctx) => void> = {
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
};

const GAME_ART: Record<string, { body: string; draw: (c: Ctx) => void }> = {
  golf: { body: '#2f8a55', draw: (c) => {
    rect(c, '#ece3cc', 7, 4, 1, 6);
    rect(c, '#f0705f', 8, 4, 3, 2);
    rect(c, '#1c5a36', 5, 9, 6, 1);
  } },
  mops: { body: '#2f5cb0', draw: (c) => {
    rect(c, '#ece3cc', 10, 3, 1, 5);
    rect(c, '#f0b04a', 7, 8, 5, 2);
    rect(c, '#ece3cc', 5, 4, 1, 1);
  } },
  chef: { body: '#34343f', draw: (c) => {
    rect(c, '#ece3cc', 6, 3, 4, 3);
    rect(c, '#d9c28a', 6, 6, 4, 2);
    rect(c, '#f0705f', 5, 8, 6, 1);
  } },
  disco: { body: '#8f3fb0', draw: (c) => {
    rect(c, '#f0d27a', 6, 4, 4, 4);
    rect(c, '#ece3cc', 6, 4, 2, 2);
    rect(c, '#6fe0d6', 5, 8, 6, 1);
  } },
  toad: { body: '#c9702a', draw: (c) => {
    rect(c, '#8fe0a0', 5, 5, 6, 4);
    rect(c, '#14181a', 6, 5, 1, 1);
    rect(c, '#14181a', 9, 5, 1, 1);
  } },
  cave: { body: '#6b4e3a', draw: (c) => {
    rect(c, '#14181a', 6, 5, 4, 5);
    rect(c, '#14181a', 7, 4, 2, 1);
    rect(c, '#f0b04a', 7, 7, 1, 1);
  } },
};

function drawProducts(scene: Phaser.Scene) {
  for (const [id, draw] of Object.entries(FOOD_ART)) {
    canvasTexture(scene, `item_${id}`, 16, 16, (c) => {
      draw(c);
      outline(c, 16, 16, '#14100e');
    });
  }
  for (const [id, art] of Object.entries(GAME_ART)) {
    canvasTexture(scene, `item_${id}`, 16, 16, (c) => {
      rect(c, '#73778a', 3, 1, 10, 14);
      rect(c, '#9da1b5', 3, 1, 10, 1);
      rect(c, '#4f5263', 11, 2, 2, 13);
      rect(c, art.body, 4, 3, 8, 8);
      art.draw(c);
      rect(c, '#4f5263', 5, 12, 6, 1);
      rect(c, '#4f5263', 5, 14, 6, 1);
      outline(c, 16, 16, '#14100e');
    });
  }
}

export function createTextures(scene: Phaser.Scene): void {
  drawShack(scene);
  drawProducts(scene);
  LOOKS.forEach((look, i) => canvasTexture(scene, `cust_${i}`, PORTRAIT_W, PORTRAIT_H, (c) => drawPortrait(c, look)));
}
