import Phaser from 'phaser';
import { L, drawerLayout } from '../layout';

type Ctx = CanvasRenderingContext2D;

export { CUSTOMER_LOOKS } from './looks';
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

/** The computer's full width, including the printer and mouse beside the monitor. */
export const COMPUTER_SPRITE_W = 55;
/** Where the monitor's centre sits inside the computer sprite. */
export const MONITOR_CENTRE_X = 23;

/** Height of the two-line label along the bottom of each shelf. */
export const SHELF_LABEL_H = 18;

function drawShelfCubby(c: Ctx, rng: () => number, x: number, y: number, w: number, h: number) {
  const inner = h - SHELF_LABEL_H - 2;
  rect(c, '#b98a58', x, y, w, h);
  rect(c, '#dcb483', x, y, w, 1);
  rect(c, '#8a6240', x + 1, y + 1, w - 2, inner - 1);
  rect(c, '#6f4d31', x + 1, y + 1, w - 2, 4);
  for (let py = y + 9; py < y + inner; py += 8) rect(c, '#7d5838', x + 1, py, w - 2, 1);
  speckle(c, rng, x + 1, y + 5, w - 2, Math.max(1, inner - 5), ['#7d5838', '#97703f'], 0.04);
  rect(c, '#e3bf8e', x, y + inner, w, 2);
  rect(c, '#fbf1d8', x + 1, y + h - SHELF_LABEL_H, w - 2, SHELF_LABEL_H - 1);
}

/** Left edge of a shelf column, so four columns always span the full width. */
export const columnX = (col: number) => Math.round((col * L.W) / 4);

function drawShop(scene: Phaser.Scene) {
  const { W, H, windowX: x, windowY: y, windowW: w, windowH: h } = L;
  canvasTexture(scene, 'shop', W, H, (c) => {
    const rng = seeded(7);
    // Painted seafoam boards
    rect(c, '#8ad1c2', 0, 0, W, L.counterTop + 2);
    for (let by = 0; by < L.counterTop; by += 7) {
      rect(c, '#6fbcae', 0, by + 6, W, 1);
      rect(c, '#a3e0d3', 0, by, W, 1);
    }
    speckle(c, rng, 0, 0, W, L.counterTop, ['#7cc6b8', '#9bdccf'], 0.05);

    // Rope down one side; a life ring on the other
    for (let ry = L.hudH + 3; ry < L.counterTop - 4; ry += 3) {
      rect(c, '#d9b98a', 15, ry, 3, 2);
      rect(c, '#a98a5f', 16, ry + 2, 2, 1);
    }
    const ringX = W - 18;
    const ringY = y + h - 26;
    disc(c, '#fbf1d8', ringX, ringY, 8);
    disc(c, '#8ad1c2', ringX, ringY, 4);
    [[-8, -2], [4, -2], [-2, -8], [-2, 4]].forEach(([rx, ry]) => rect(c, '#e8604f', ringX + rx, ringY + ry, 4, 4));

    // The shop's name board above the window
    rect(c, '#5d4630', x - 3, L.signY, w + 6, 21);
    rect(c, '#a97d4f', x - 2, L.signY + 1, w + 4, 19);
    rect(c, '#c1955f', x - 2, L.signY + 1, w + 4, 1);
    for (let i = 0; i < 40; i++) rect(c, '#8a6240', x + Math.floor(rng() * (w - 8)), L.signY + 3 + Math.floor(rng() * 16), 3 + Math.floor(rng() * 8), 1);

    // White window frame
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
    const top = L.counterTop;
    const bottom = L.counterBottom;
    rect(c, '#e8c896', 0, top, W, 4);
    rect(c, '#f6dfb6', 0, top, W, 1);
    rect(c, '#d4ad78', 0, top + 4, W, bottom - top - 10);
    for (let i = 0; i < 90; i++) {
      rect(c, rng() < 0.5 ? '#c49c68' : '#e0bd8b', Math.floor(rng() * W), top + 4 + Math.floor(rng() * (bottom - top - 10)), 1 + Math.floor(rng() * 8), 1);
    }
    rect(c, '#9c7446', 0, bottom - 6, W, 2);
    rect(c, '#7a5a38', 0, bottom - 4, W, 5);

    // Shelving
    rect(c, '#7a5a38', 0, L.shelfTop, W, L.rowH * 3);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        drawShelfCubby(c, rng, columnX(col), L.shelfTop + row * L.rowH, columnX(col + 1) - columnX(col), L.rowH);
      }
    }

    // Controls strip
    rect(c, COLOUR_STRIP, 0, L.stripTop, W, H - L.stripTop);
    rect(c, '#356482', 0, L.stripTop, W, 1);
  });

  // Painted shutter, closed until you open up
  canvasTexture(scene, 'shutter', w, h, (c) => {
    const rng = seeded(33);
    rect(c, '#e9dcc0', 0, 0, w, h);
    for (let sy = 0; sy < h; sy += 6) {
      rect(c, (sy / 6) % 8 < 4 ? '#7fc4cf' : '#f4ead2', 0, sy, w, 5);
      rect(c, '#b7a988', 0, sy + 5, w, 1);
    }
    speckle(c, rng, 0, 0, w, h, ['#c9b994', '#ffffff'], 0.02);
    const signX = Math.floor(w / 2) - 32;
    const signY = Math.floor(h / 2) - 11;
    rect(c, '#7a5a38', signX, signY, 64, 22);
    rect(c, '#a97d4f', signX + 1, signY + 1, 62, 20);
    rect(c, '#7a5a38', signX + 4, signY - 8, 1, 8);
    rect(c, '#7a5a38', signX + 59, signY - 8, 1, 8);
  });

  // Boards across shelf rows you haven't bought yet
  canvasTexture(scene, 'boards', W, L.rowH, (c) => {
    const rng = seeded(55);
    rect(c, '#5d4630', 0, 0, W, L.rowH);
    for (let by = 2; by < L.rowH - 3; by += 9) {
      rect(c, '#9c7446', 0, by, W, 7);
      rect(c, '#b98a58', 0, by, W, 1);
      for (let i = 0; i < 40; i++) rect(c, '#8a6240', Math.floor(rng() * W), by + 2 + Math.floor(rng() * 4), 3 + Math.floor(rng() * 9), 1);
    }
  });

  drawTill(scene);
  drawComputer(scene);
  drawTerminal(scene);
}

// ---- Counter equipment ------------------------------------------------------

const INK = '#1b1d28';
const COUNTER_SHADOW = 'rgba(74, 42, 16, 0.32)';

/** A filled box with its four corners clipped, which reads as rounded at this size. */
function rounded(c: Ctx, color: string, x: number, y: number, w: number, h: number) {
  rect(c, color, x + 1, y, w - 2, h);
  rect(c, color, x, y + 1, w, h - 2);
}

const TINY_GLYPHS: Record<string, string> = {
  $: '.##|#..|.#.|..#|##.',
  '.': '.|.|.|.|#',
  0: '###|#.#|#.#|#.#|###',
  1: '.#.|##.|.#.|.#.|###',
  2: '##.|..#|.#.|#..|###',
  3: '##.|..#|.#.|..#|##.',
  4: '#.#|#.#|###|..#|..#',
  5: '###|#..|##.|..#|##.',
  6: '.##|#..|###|#.#|###',
  7: '###|..#|.#.|.#.|.#.',
  8: '###|#.#|###|#.#|###',
  9: '###|#.#|###|..#|##.',
};

/** Three-by-five digits for the printing on the machines. Too small to use for game text. */
function tinyText(c: Ctx, color: string, x: number, y: number, text: string) {
  let cx = x;
  for (const ch of text) {
    const rows = TINY_GLYPHS[ch].split('|');
    rows.forEach((row, ry) => [...row].forEach((on, rx) => { if (on === '#') rect(c, color, cx + rx, y + ry, 1, 1); }));
    cx += ch === '.' ? 2 : 4;
  }
}

/** Register: teal body on a steel cash drawer, with a customer display on a pole. */
function drawTill(scene: Phaser.Scene) {
  canvasTexture(scene, 'till', 48, 59, (c) => {
    // Customer display on its pole
    rect(c, '#2f3540', 27, 11, 5, 4);
    rect(c, '#475060', 28, 11, 1, 4);
    rounded(c, '#3e8fa8', 18, 1, 23, 11);
    rect(c, '#73c4d2', 19, 1, 21, 1);
    rect(c, '#2a6a84', 19, 10, 21, 2);
    rect(c, '#14232c', 20, 3, 19, 7);
    tinyText(c, '#8ee05a', 21, 4, '$0.00');

    // Sloping teal body, narrower at the top
    for (let y = 14; y < 41; y++) {
      const inset = Math.max(0, Math.round((30 - y) / 6));
      rect(c, '#4f9d94', 3 + inset, y, 38 - inset * 2, 1);
    }
    rect(c, '#88d1b4', 6, 14, 32, 1);
    rect(c, '#2e7f86', 26, 15, 8, 1);
    rect(c, '#3b8a88', 4, 37, 36, 1);
    rect(c, '#2d7078', 3, 38, 38, 3);
    rect(c, '#62b0a2', 3, 37, 1, 1);

    // Receipt coming out of the printer
    rect(c, '#2a3038', 5, 17, 13, 2);
    rect(c, '#8f97a0', 5, 27, 13, 5);
    rect(c, '#c2c8cc', 5, 27, 13, 1);
    rect(c, '#f4efe0', 7, 18, 9, 12);
    rect(c, '#d4cdb8', 15, 18, 1, 12);
    for (let ry = 20; ry < 29; ry += 2) {
      rect(c, '#807a6e', 8, ry, ry % 4 === 0 ? 4 : 3, 1);
      rect(c, '#807a6e', 13, ry, 1, 1);
    }

    // Main display
    rect(c, '#2a6a74', 18, 16, 21, 8);
    rect(c, '#14232c', 19, 16, 19, 7);
    tinyText(c, '#8ee05a', 20, 17, '$0.00');

    // Keys: peach digits with a yellow and sage row, and red, orange and tall green on the right
    const key = (x: number, y: number, w: number, h: number, colour: string, shine: string, shade: string) => {
      rect(c, shade, x, y, w, h);
      rect(c, colour, x, y, w, h - 1);
      rect(c, shine, x, y, w, 1);
    };
    const digit = ['#f0b064', '#ffd9a0', '#a8703c'];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        let tone = digit;
        if (row === 0 && col === 0) tone = ['#f4c430', '#ffe67c', '#a87c1c'];
        if (col === 2 && row < 2) tone = ['#a8c0a0', '#d0e0c4', '#6c8470'];
        key(19 + col * 5, 25 + row * 3, 4, 3, tone[0], tone[1], tone[2]);
      }
    }
    key(34, 25, 4, 3, '#e04c3c', '#f88070', '#90281c');
    key(34, 28, 4, 3, '#ec9430', '#ffc060', '#a4601c');
    key(34, 31, 4, 6, '#4fb044', '#8ce070', '#2a7428');

    // Two big buttons under the receipt
    key(6, 33, 5, 4, '#f4c430', '#ffe67c', '#a87c1c');
    key(12, 33, 5, 4, '#ec7a30', '#ffac60', '#a4481c');

    // Steel base and cash drawer, with its lock and key
    rect(c, '#3a3d46', 0, 41, 44, 15);
    rect(c, '#5a5e68', 0, 41, 44, 1);
    rect(c, '#9ea3ab', 3, 44, 38, 9);
    rect(c, '#d0d4d8', 3, 44, 38, 1);
    rect(c, '#747982', 3, 52, 38, 1);
    rect(c, '#23262e', 7, 47, 9, 2);
    rect(c, '#23262e', 28, 47, 9, 2);
    rect(c, '#e8ecee', 31, 45, 1, 1);
    rect(c, '#e8ecee', 30, 46, 1, 1);
    disc(c, '#3a3d46', 22, 48, 3);
    disc(c, '#b8bcc2', 22, 48, 2);
    rect(c, '#23262e', 22, 46, 1, 5);
    rect(c, '#23262e', 21, 51, 3, 3);
    rect(c, '#777c84', 22, 52, 1, 3);
    rect(c, '#23262e', 2, 56, 4, 1);
    rect(c, '#23262e', 38, 56, 4, 1);

    outline(c, 48, 59, INK);
    // Soft shadow on the counter, added last so it doesn't get an outline
    rect(c, COUNTER_SHADOW, 45, 44, 3, 13);
    rect(c, COUNTER_SHADOW, 2, 58, 44, 1);
  });
}

/** Grey monitor showing the shop screen, with a keyboard, mouse and receipt printer. */
function drawComputer(scene: Phaser.Scene) {
  canvasTexture(scene, 'computer', COMPUTER_SPRITE_W, 60, (c) => {
    // Stand
    rect(c, '#2e3138', 17, 33, 12, 5);
    rect(c, '#44474f', 18, 33, 3, 4);
    rounded(c, '#3a3d45', 12, 37, 22, 3);
    rect(c, '#555861', 13, 37, 20, 1);

    // Monitor
    rounded(c, '#6c7078', 1, 1, 44, 32);
    rect(c, '#a4a8ae', 2, 1, 42, 1);
    rect(c, '#555860', 1, 29, 44, 3);
    rect(c, '#2d3036', 3, 3, 40, 26);
    rect(c, '#68d0ea', 4, 4, 38, 24);
    rect(c, '#6ee04a', 36, 30, 2, 1);

    // The screen's right side: blue, with SHOP in a brighter panel and a chart below
    rect(c, '#2f62c0', 5, 5, 36, 22);
    rect(c, '#2f8a48', 34, 5, 3, 2);
    rect(c, '#d84a4a', 38, 5, 3, 2);
    rect(c, '#3f7ce0', 15, 8, 26, 10);
    rect(c, '#6ea4f0', 15, 8, 26, 1);
    disc(c, '#60cc40', 21, 22, 3);
    rect(c, '#f05878', 21, 19, 2, 1);
    rect(c, '#f05878', 21, 20, 3, 1);
    rect(c, '#f05878', 21, 21, 4, 1);
    [[26, 20], [26, 22], [26, 24]].forEach(([lx, ly], i) => {
      rect(c, ['#60cc40', '#f05878', '#60cc40'][i], lx, ly, 1, 1);
      rect(c, '#9cd8f4', lx + 2, ly, i === 1 ? 9 : 12, 1);
    });

    // The screen's left side: the check-out list
    rect(c, '#e0f4dc', 5, 5, 9, 22);
    rect(c, '#2d3036', 6, 6, 7, 1);
    rect(c, '#a8b4a8', 5, 8, 9, 1);
    for (let ly = 10; ly < 20; ly += 2) {
      rect(c, '#2f8a48', 6, ly, 1, 1);
      rect(c, '#8a948c', 8, ly, ly % 4 === 0 ? 2 : 3, 1);
      rect(c, '#8a948c', 12, ly, 1, 1);
    }
    rect(c, '#a8b4a8', 5, 22, 9, 1);
    rect(c, '#e04848', 9, 24, 4, 2);

    // Keyboard
    rounded(c, '#464a50', 1, 42, 39, 16);
    rect(c, '#6a6e74', 2, 42, 37, 1);
    rect(c, '#2e3138', 2, 56, 37, 1);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 12; col++) {
        const kx = 3 + col * 3 - (row % 2);
        if (kx < 3) continue;
        rect(c, '#d4d6c4', kx, 44 + row * 3, 2, 2);
        rect(c, '#9ca092', kx, 45 + row * 3, 2, 1);
      }
    }
    rect(c, '#e8e8d8', 11, 53, 15, 2);
    rect(c, '#b0b2a4', 11, 54, 15, 1);

    // Mouse
    rounded(c, '#4f5259', 43, 47, 7, 10);
    rect(c, '#2d3036', 46, 48, 1, 3);
    rect(c, '#73767d', 44, 47, 2, 1);
    rect(c, '#383b42', 44, 55, 5, 1);

    // Receipt printer in front of the monitor's corner
    rect(c, '#f4efe0', 44, 23, 8, 8);
    rect(c, '#807a6e', 45, 25, 5, 1);
    rect(c, '#807a6e', 45, 27, 6, 1);
    rect(c, '#807a6e', 45, 29, 4, 1);
    rect(c, '#555860', 42, 31, 12, 11);
    rect(c, '#7a7d84', 42, 31, 12, 1);
    rect(c, '#23262e', 43, 33, 10, 1);
    rect(c, '#6ee04a', 51, 38, 1, 1);

    outline(c, COMPUTER_SPRITE_W, 60, INK);
    rect(c, COUNTER_SHADOW, 2, 59, 38, 1);
  });
}

/** Card terminal: a blue handset on its dock, with a card pushed into the bottom. */
function drawTerminal(scene: Phaser.Scene) {
  canvasTexture(scene, 'terminal', 54, 62, (c) => {
    // Curled cable on the left and the dock showing on the right
    rect(c, '#5c6068', 2, 40, 3, 1);
    rect(c, '#5c6068', 1, 41, 1, 6);
    rect(c, '#5c6068', 2, 47, 2, 1);
    rect(c, '#5c6068', 3, 48, 2, 6);
    rect(c, '#44474f', 49, 14, 3, 34);
    rect(c, '#62656d', 49, 14, 1, 34);

    // Body
    rounded(c, '#3a6aa8', 5, 1, 44, 54);
    rect(c, '#6aa2d4', 6, 1, 42, 1);
    rect(c, '#5a90c8', 5, 2, 1, 50);
    rect(c, '#2b4e80', 47, 2, 2, 51);
    rect(c, '#62c0d0', 6, 52, 41, 1);
    rect(c, '#2b4e80', 6, 53, 41, 2);

    // Dark faceplate: contactless mark, screen and four soft keys
    rounded(c, '#30323a', 7, 2, 40, 21);
    const wave = '#6cd8c0';
    rect(c, wave, 26, 5, 2, 1);
    [[24, 4], [23, 5], [24, 6], [21, 3], [20, 4], [20, 5], [20, 6], [21, 7]].forEach(([wx, wy]) => {
      rect(c, wave, wx, wy, 1, 1);
      rect(c, wave, 53 - wx, wy, 1, 1);
    });
    rect(c, '#1c1e24', 8, 8, 38, 10);
    rect(c, '#94a49e', 9, 8, 36, 10);
    for (let sy = 9; sy < 18; sy += 2) rect(c, '#8a9a94', 9, sy, 36, 1);
    [[10, '#eda43a'], [18, '#eda43a'], [28, '#9096a0'], [36, '#9096a0']].forEach(([kx, tone]) => rect(c, tone as string, kx as number, 20, 7, 2));

    // The same layout as the keypad on screen: digits, CLR, 0, DEL and a tall OK
    const key = (x: number, y: number, w: number, h: number, colour: string, shine: string, shade: string) => {
      rect(c, shade, x, y, w, h + 1);
      rect(c, colour, x, y, w, h);
      rect(c, shine, x, y, w, 1);
    };
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const kx = 8 + col * 10;
        const ky = 24 + row * 7;
        key(kx, ky, 9, 6, '#e6e4d2', '#fafaec', '#7a7c74');
        tinyText(c, '#30323a', kx + 1, ky + 1, String(row * 3 + col + 1));
        rect(c, '#9a9c90', kx + 5, ky + 3, 3, 1);
      }
    }
    key(8, 45, 9, 6, '#d84a3c', '#f47e70', '#842218');
    key(18, 45, 9, 6, '#e6e4d2', '#fafaec', '#7a7c74');
    tinyText(c, '#30323a', 19, 46, '0');
    rect(c, '#9a9c90', 23, 48, 3, 1);
    key(28, 45, 9, 6, '#f2b82e', '#ffdc70', '#94701a');
    key(38, 24, 8, 27, '#4fae3c', '#8ae068', '#266e24');
    rect(c, '#e8f8dc', 43, 34, 1, 5);
    rect(c, '#e8f8dc', 40, 38, 4, 1);
    rect(c, '#e8f8dc', 41, 37, 1, 3);

    // The card pushed into the bottom
    rect(c, '#1c1e24', 13, 55, 28, 1);
    rect(c, '#e6c490', 14, 56, 26, 5);
    rect(c, '#f4dcb0', 14, 56, 26, 1);
    disc(c, '#e8483c', 19, 58, 1);
    rect(c, '#f4a820', 18, 60, 3, 1);
    rect(c, '#faf4e0', 26, 57, 1, 1);
    rect(c, '#faf4e0', 26, 59, 1, 1);
    rect(c, '#e8483c', 32, 57, 3, 4);
    rect(c, '#3ca0b8', 35, 57, 1, 4);

    outline(c, 54, 62, INK);
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

/** Sizes of the money in the drawer, which follow the size of its slots. */
export function drawerMoneySizes() {
  const d = drawerLayout();
  return { ...d, billW: Math.min(d.slotW - 8, 40), billSpriteH: Math.min(d.billH - 1, 64) };
}

/** The open drawer: dark slots in a teal tray, in the same colours as the till on the counter. */
function drawDrawerTray(scene: Phaser.Scene) {
  const d = drawerLayout();
  canvasTexture(scene, 'drawer_tray', d.w, d.h, (c) => {
    rect(c, '#2c2a33', 0, 0, d.w, d.h);
    rect(c, '#1f6a68', 1, 1, d.w - 2, d.h - 2);
    rect(c, '#2f8f8c', 1, 1, d.w - 2, 2);
    const slot = (col: number, top: number, h: number) => {
      const x = d.slotX(col) - d.x;
      const y = top - d.y;
      rect(c, '#0d2c2d', x, y, d.slotW, h);
      rect(c, '#123c3d', x + 1, y + 3, d.slotW - 2, h - 3);
      rect(c, '#07191a', x, y, d.slotW, 2);
      // The floor of the slot catches the light
      rect(c, '#1f6a68', x + 1, y + h - 1, d.slotW - 2, 1);
    };
    for (let col = 0; col < 4; col++) {
      slot(col, d.billTop, d.billH);
      slot(col, d.coinTop, d.coinH);
    }
    // Metal dividers between the slots
    for (let col = 1; col < 4; col++) {
      const x = d.slotX(col) - d.x - d.divider;
      rect(c, '#8c969e', x, 2, d.divider, d.h - 4);
      rect(c, '#c6ced4', x, 2, 1, d.h - 4);
    }
    const shelfY = d.coinTop - d.y - d.divider;
    rect(c, '#8c969e', 2, shelfY, d.w - 4, d.divider);
    rect(c, '#c6ced4', 2, shelfY, d.w - 4, 1);
  });
}

function drawMoney(scene: Phaser.Scene) {
  const drawer = drawerMoneySizes();
  drawDrawerTray(scene);
  for (const [cents, b] of Object.entries(BILLS)) {
    // Bills stand on end in the drawer, with a couple more showing behind the front one
    canvasTexture(scene, `drawer_${cents}`, drawer.billW, drawer.billSpriteH, (c) => {
      const w = drawer.billW - 2;
      const h = drawer.billSpriteH;
      rect(c, b.dark, 2, 0, w, h);
      rect(c, b.light, 3, 1, w - 2, 1);
      rect(c, '#2c2a33', 0, 3, w, h - 3);
      rect(c, b.dark, 1, 3, w - 2, 1);
      rect(c, b.dark, 0, 5, w, h - 5);
      rect(c, b.base, 1, 6, w - 2, h - 7);
      rect(c, b.dark, 3, 8, w - 6, 1);
      rect(c, b.dark, 3, h - 4, w - 6, 1);
      rect(c, b.dark, 3, 8, 1, h - 11);
      rect(c, b.dark, w - 4, 8, 1, h - 11);
      for (const [cx, cy] of [[5, 10], [w - 9, 10], [5, h - 9], [w - 9, h - 9]]) {
        rect(c, b.light, cx, cy, 4, 4);
        rect(c, b.dark, cx + 1, cy + 1, 2, 2);
      }
      // The pale panel behind the printed value
      const mid = 5 + Math.floor((h - 5) / 2);
      rect(c, '#efe8cf', 5, mid - 7, w - 10, 14);
      rect(c, b.dark, 5, mid - 8, w - 10, 1);
      rect(c, b.dark, 5, mid + 7, w - 10, 1);
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
    // A small pile in its cup: two coins behind the labelled one
    const r = Math.min(m.r, Math.floor((drawer.coinH - 6) / 2));
    const sideways = Math.floor((drawer.slotW - 2 * r - 3) / 2);
    const w = drawer.slotW;
    const h = 2 * r + 5;
    canvasTexture(scene, `drawer_${cents}`, w, h, (c) => {
      const coin = (cx: number, cy: number) => {
        disc(c, '#14100e', cx, cy + 1, r);
        disc(c, m.dark, cx, cy, r);
        disc(c, m.base, cx, cy, r - 1);
        disc(c, m.light, cx - 1, cy - 1, r - 3);
        disc(c, m.base, cx, cy, r - 3);
      };
      const mid = Math.floor(w / 2);
      coin(mid - sideways, r);
      coin(mid + sideways, r);
      coin(mid, r + 3);
    });
    const deskR = Math.max(7, Math.round(m.r * 0.6));
    canvasTexture(scene, `desk_${cents}`, deskR * 2 + 3, deskR * 2 + 3, (c) => {
      const mid = deskR + 1;
      disc(c, m.dark, mid, mid, deskR);
      disc(c, m.base, mid, mid, deskR - 1);
      disc(c, m.light, mid - 1, mid - 1, deskR - 2);
      disc(c, m.base, mid, mid, deskR - 2);
      outline(c, deskR * 2 + 3, deskR * 2 + 3, '#2c2a33');
    });
  }
}

function drawCard(scene: Phaser.Scene) {
  // A small stack of bills, so it reads as cash at a glance
  canvasTexture(scene, 'held_cash', 34, 24, (c) => {
    const bill = (x: number, y: number, base: string, dark: string, light: string) => {
      rect(c, '#2c2a33', x, y, 30, 18);
      rect(c, dark, x + 1, y + 1, 28, 16);
      rect(c, base, x + 2, y + 2, 26, 14);
      rect(c, light, x + 3, y + 3, 24, 1);
      rect(c, light, x + 3, y + 14, 24, 1);
    };
    bill(4, 0, '#8f9c62', '#5c6a35', '#cdd6a3');
    bill(2, 3, '#5d7fb3', '#35507e', '#b0c6e4');
    bill(0, 6, '#5f9a63', '#2f6b3f', '#a9d39f');
    disc(c, '#efe8cf', 15, 15, 6);
    disc(c, '#2f6b3f', 15, 15, 5);
    disc(c, '#efe8cf', 15, 15, 4);
    // Dollar sign
    const ink = '#2f6b3f';
    rect(c, ink, 15, 11, 1, 9);
    rect(c, ink, 13, 12, 5, 1);
    rect(c, ink, 13, 13, 1, 2);
    rect(c, ink, 13, 15, 5, 1);
    rect(c, ink, 17, 16, 1, 2);
    rect(c, ink, 13, 18, 5, 1);
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

function drawTail(scene: Phaser.Scene) {
  // Points at the speaker. Its right column overlaps the bubble's edge, joining the two outlines.
  canvasTexture(scene, 'bubble_tail', 8, 8, (c) => {
    for (let y = 0; y < 8; y++) {
      const left = 7 - y;
      rect(c, '#fbf1d8', left, y, 8 - left, 1);
      rect(c, '#2c2a33', left, y, 1, 1);
    }
    rect(c, '#2c2a33', 0, 7, 8, 1);
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
  canvasTexture(scene, 'menu_icon', 13, 11, (c) => {
    rect(c, '#fbf3df', 0, 0, 13, 2);
    rect(c, '#fbf3df', 0, 4, 13, 2);
    rect(c, '#fbf3df', 0, 8, 13, 2);
  });
}

// ---- The TV, the calendar and the sign's stars ----------------------------

export const TV_W = 30;
export const TV_H = 28;
export const TV_FRAMES = 4;
export const CALENDAR_W = 30;
export const CALENDAR_H = 28;
const SCREEN_W = 22;
const SCREEN_H = 14;

function drawCloud(c: Ctx, x: number, y: number, colour: string) {
  rect(c, colour, x + 1, y + 2, 10, 3);
  rect(c, colour, x + 3, y, 5, 2);
  rect(c, colour, x, y + 3, 12, 2);
}

function drawSun(c: Ctx, cx: number, cy: number, frame: number) {
  disc(c, '#ffd65c', cx, cy, 3);
  const rays = frame % 2 === 0 ? [[0, -5], [0, 5], [-5, 0], [5, 0]] : [[-4, -4], [4, -4], [-4, 4], [4, 4]];
  rays.forEach(([dx, dy]) => rect(c, '#fff0a8', cx + dx, cy + dy));
}

/** Each picture on the TV is a short loop, chosen by tomorrow's forecast. */
const SCREENS: Record<string, (c: Ctx, frame: number) => void> = {
  sunny(c, frame) {
    rect(c, '#62b6e8', 0, 0, SCREEN_W, SCREEN_H);
    drawSun(c, 11, 6, frame);
    rect(c, '#2f8fc4', 0, 12, SCREEN_W, 2);
    for (let x = frame * 2; x < SCREEN_W; x += 8) rect(c, '#bfe6f7', x, 12, 3, 1);
  },
  heatwave(c, frame) {
    rect(c, '#f08a3c', 0, 0, SCREEN_W, SCREEN_H);
    rect(c, '#f6b04f', 0, 8, SCREEN_W, 6);
    disc(c, '#fff0a8', 11, 5, 4);
    // Heat shimmer rising off the sand
    for (let row = 0; row < 3; row++) {
      for (let x = (frame + row) % 4; x < SCREEN_W; x += 4) rect(c, '#ffd65c', x, 9 + row * 2, 2, 1);
    }
  },
  rainy(c, frame) {
    rect(c, '#55677c', 0, 0, SCREEN_W, SCREEN_H);
    drawCloud(c, 5, 1, '#c9d3dd');
    for (let i = 0; i < 6; i++) {
      const x = 2 + i * 3 + (i % 2);
      rect(c, '#9fd6f5', x, 7 + ((frame * 2 + i * 3) % 6), 1, 2);
    }
  },
  cloudy(c, frame) {
    rect(c, '#9db4c6', 0, 0, SCREEN_W, SCREEN_H);
    drawCloud(c, -2 + frame * 2, 1, '#eef3f6');
    drawCloud(c, 12 - frame, 7, '#d3dee6');
  },
};

function drawInfoBoard(scene: Phaser.Scene) {
  canvasTexture(scene, 'tv', TV_W, TV_H, (c) => {
    // Rabbit ears
    rect(c, '#2c2a33', 10, 0, 1, 2);
    rect(c, '#2c2a33', 19, 0, 1, 2);
    rect(c, '#2c2a33', 11, 2, 8, 1);
    // Case
    rect(c, '#2c2a33', 0, 3, TV_W, TV_H - 3);
    rect(c, '#6d4f2b', 1, 4, TV_W - 2, TV_H - 5);
    rect(c, '#8f6a3b', 1, 4, TV_W - 2, 1);
    rect(c, '#14100e', 3, 4, SCREEN_W + 2, SCREEN_H + 2);
  });
  for (const [id, draw] of Object.entries(SCREENS)) {
    for (let frame = 0; frame < TV_FRAMES; frame++) {
      canvasTexture(scene, `tv_${id}_${frame}`, SCREEN_W, SCREEN_H, (c) => draw(c, frame));
    }
  }

  canvasTexture(scene, 'calendar', CALENDAR_W, CALENDAR_H, (c) => {
    rect(c, '#2c2a33', 0, 0, CALENDAR_W, CALENDAR_H);
    rect(c, '#fbf1d8', 1, 1, CALENDAR_W - 2, CALENDAR_H - 2);
    rect(c, '#c9503f', 1, 1, CALENDAR_W - 2, 9);
    rect(c, '#e8604f', 1, 1, CALENDAR_W - 2, 1);
  });

  const star = (key: string, fill: string, edge: string) =>
    canvasTexture(scene, key, 7, 7, (c) => {
      ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'].forEach((row, y) => {
        [...row].forEach((px, x) => {
          if (px === '#') rect(c, y === 2 || x === 3 ? fill : edge, x, y);
        });
      });
    });
  star('star_on', '#ffd65c', '#f0a93a');
  star('star_off', '#7a5a38', '#6d4f2b');

  // The guiding arrow, pointing down. It's flipped to point up.
  canvasTexture(scene, 'guide_arrow', 15, 16, (c) => {
    rect(c, '#ffc65c', 5, 1, 5, 8);
    rect(c, '#ffe19c', 5, 1, 2, 8);
    for (let row = 0; row < 6; row++) {
      rect(c, row < 2 ? '#ffe19c' : '#ffc65c', 1 + row, 9 + row, 13 - row * 2, 1);
    }
    outline(c, 15, 16, '#2c2a33');
  });
  canvasTexture(scene, 'raindrop', 1, 4, (c) => rect(c, '#cfe6f5', 0, 0, 1, 4));
  canvasTexture(scene, 'pixel_white', 2, 2, (c) => rect(c, '#ffffff', 0, 0, 2, 2));

  // A stretch of new shelf, for the unlock celebration
  canvasTexture(scene, 'new_shelf', 60, 26, (c) => {
    rect(c, '#2c2a33', 0, 0, 60, 26);
    rect(c, '#b98a58', 1, 1, 58, 24);
    rect(c, '#dcb483', 1, 1, 58, 1);
    for (let col = 0; col < 4; col++) {
      rect(c, '#6f4d31', 2 + col * 14 + 1, 3, 12, 15);
      rect(c, '#8a6240', 2 + col * 14 + 1, 6, 12, 12);
      rect(c, '#e3bf8e', 2 + col * 14 + 1, 18, 12, 1);
      rect(c, '#fbf1d8', 2 + col * 14 + 1, 20, 12, 3);
    }
  });
}

export function createTextures(scene: Phaser.Scene): void {
  drawShop(scene);
  drawMoney(scene);
  drawProps(scene);
  drawCard(scene);
  drawTail(scene);
  drawProducts(scene);
  drawInfoBoard(scene);
}
