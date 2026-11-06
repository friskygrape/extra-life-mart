import Phaser from 'phaser';
import { L, drawerLayout } from '../layout';
import { CHAR_W, GLYPHS, TINY_GLYPHS } from './font';

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

/** Where the calendar and TV hang, just under the top bar. */
export const wallTop = () => L.hudH + 6;

/** The computer's full width, including the printer and mouse beside the monitor. */
export const COMPUTER_SPRITE_W = 55;
/** Where the monitor's centre sits inside the computer sprite. */
export const MONITOR_CENTRE_X = 23;

// Storefront colours
const WALL = '#3db4aa';
const WALL_LIGHT = '#5ccabd';
const WALL_DARK = '#2c9c97';
const FRAME = '#2a8f92';
const FRAME_LIGHT = '#7adccd';
const FRAME_DARK = '#1b6c74';
const CREAM = '#f4e3c0';
const CREAM_LIGHT = '#fdf3da';
const CREAM_SHADE = '#d6be95';
const BUBBLE_PAPER = '#f7ebcf';
const SHUTTER = '#6f94a2';
const SHUTTER_LIGHT = '#8cadb8';
const SHUTTER_DARK = '#4f7485';

/** Glazed teal wall tiles, laid like bricks. */
function drawTiles(c: Ctx, x: number, y: number, w: number, h: number) {
  rect(c, WALL, x, y, w, h);
  for (let ty = 0; ty < h; ty += 9) {
    rect(c, WALL_DARK, x, y + ty + 8, w, 1);
    rect(c, WALL_LIGHT, x, y + ty, w, 1);
    const offset = (ty / 9) % 2 === 0 ? 0 : 8;
    for (let tx = offset; tx < w; tx += 16) rect(c, WALL_DARK, x + tx, y + ty, 1, 8);
  }
}

/** Grey-blue roller shutter slats with some wear, used for the closed window and locked shelves. */
function drawSlats(c: Ctx, rng: () => number, x: number, y: number, w: number, h: number) {
  rect(c, SHUTTER, x, y, w, h);
  for (let sy = 0; sy < h; sy += 6) {
    rect(c, SHUTTER_LIGHT, x, y + sy, w, 1);
    rect(c, SHUTTER_DARK, x, y + sy + 5, w, 1);
  }
  speckle(c, rng, x, y, w, h, ['#5f8494', '#9dbac2', '#84a2ad'], 0.05);
}

/** Height of the name plate along the bottom of each shelf, including the gap under it. */
export const SHELF_LABEL_H = 14;

/** Where the lit back wall of a shelf sits, measured from the shelf's corner. */
function nicheBounds(w: number, h: number) {
  const left = 3;
  const top = 3;
  const width = w - 6;
  const floor = h - SHELF_LABEL_H - 4;
  return { left, top, width, floor, backLeft: left + 4, backWidth: width - 8, backTop: top + 4 };
}

/** A modern recessed shelf with its light off. The glow goes on top, so it can flicker. */
function drawShelfCubby(c: Ctx, x: number, y: number, w: number, h: number) {
  const n = nicheBounds(w, h);
  rounded(c, FRAME_DARK, x + 1, y + 1, w - 2, h - SHELF_LABEL_H + 1);
  rounded(c, FRAME_LIGHT, x + 1, y + 1, w - 2, 2);
  rect(c, CREAM, x + 2, y + 2, w - 4, h - SHELF_LABEL_H - 2);
  // Side walls, then the back wall
  rect(c, '#c8966a', x + n.left, y + n.top, n.width, n.floor - n.top + 4);
  rect(c, '#d3a578', x + n.backLeft, y + n.backTop, n.backWidth, n.floor - n.backTop);
  // Ceiling, narrowing towards the back
  for (let i = 0; i < 4; i++) rect(c, i === 0 ? '#94683f' : '#a97b4f', x + n.left + i, y + n.top + i, n.width - i * 2, 1);
  // Unlit fixture
  rect(c, '#8a6a48', x + Math.floor(w / 2) - 7, y + n.top, 14, 2);
  // Floor, widening towards the front
  for (let i = 0; i < 4; i++) rect(c, i === 3 ? CREAM_LIGHT : '#f3e0ba', x + n.backLeft - i, y + n.floor + i, n.backWidth + i * 2, 1);
  // Name plate
  const plateY = y + h - SHELF_LABEL_H;
  rounded(c, FRAME_DARK, x + 1, plateY, w - 2, 11);
  rect(c, FRAME_LIGHT, x + 2, plateY, w - 4, 1);
  rect(c, CREAM_LIGHT, x + 2, plateY + 1, w - 4, 9);
}

/** Left edge of a shelf column, so four columns always span the full width. */
export const columnX = (col: number) => Math.round((col * L.W) / 4);

/** Texture key for the glow of a shelf this wide. Column widths can differ by a pixel. */
export const shelfGlowKey = (w: number) => `shelf_glow_${w}`;

function drawShelfGlow(scene: Phaser.Scene, w: number, h: number) {
  const key = shelfGlowKey(w);
  if (scene.textures.exists(key)) return;
  canvasTexture(scene, key, w, h, (c) => {
    const n = nicheBounds(w, h);
    const cx = Math.floor(w / 2);
    // The lit back wall, with a cone of light spreading down from the fixture
    rect(c, '#efc698', n.backLeft, n.backTop, n.backWidth, n.floor - n.backTop);
    const coneH = n.floor - n.backTop;
    for (let i = 0; i < coneH; i++) {
      const outer = Math.min(Math.floor(n.backWidth / 2), 6 + Math.floor(i * 0.65));
      const inner = Math.min(outer - 3, 3 + Math.floor(i * 0.4));
      rect(c, '#f8dcb0', cx - outer, n.backTop + i, outer * 2, 1);
      rect(c, '#fdeac6', cx - inner, n.backTop + i, inner * 2, 1);
    }
    // The fixture itself, and its light on the ceiling
    rect(c, '#ffe9a0', cx - 9, n.top + 2, 18, 2);
    rect(c, '#fff8d6', cx - 7, n.top, 14, 2);
  });
}

// Tall hand-lettered capitals for the shop's sign.
const SIGN_GLYPHS: Record<string, string[]> = {
  E: ['#######', '#######', '##.....', '##.....', '######.', '######.', '##.....', '##.....', '##.....', '#######', '#######'],
  X: ['##...##', '##...##', '.##.##.', '.##.##.', '..###..', '..###..', '..###..', '.##.##.', '.##.##.', '##...##', '##...##'],
  T: ['#######', '#######', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..'],
  R: ['######.', '#######', '##...##', '##...##', '##..###', '######.', '#####..', '##.###.', '##..##.', '##..###', '##...##'],
  A: ['..###..', '.#####.', '.##.##.', '##...##', '##...##', '##...##', '#######', '#######', '##...##', '##...##', '##...##'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '##....', '##....', '##....', '######', '######'],
  I: ['##.', '##.', '...', '##.', '##.', '##.', '##.', '##.', '##.', '##.', '##.'],
  F: ['######', '######', '##....', '##....', '#####.', '#####.', '##....', '##....', '##....', '##....', '##....'],
  M: ['##.....##', '###...###', '####.####', '##.###.##', '##..#..##', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##'],
};

const SIGN_WORDS: { text: string; colour: string; shade: string }[] = [
  { text: 'EXTRA', colour: '#e4683a', shade: '#a84622' },
  { text: 'LIFE', colour: '#35aa9f', shade: '#1b7570' },
  { text: 'MART', colour: '#1f81a0', shade: '#125a74' },
];
const SIGN_WORD_GAP = 5;

function drawSign(c: Ctx, centre: number, top: number, maxW: number) {
  // A cream oval in a teal ring, with squared-off ends
  const h = 29;
  const halfW = Math.floor(maxW / 2);
  // Peeling the shape back a pixel at a time gives an even ring all the way round.
  const inside = (px: number, py: number) => {
    const dx = Math.abs(px + 0.5) / halfW;
    const dy = Math.abs(py + 0.5 - h / 2) / (h / 2);
    return Math.pow(dx, 2.6) + Math.pow(dy, 2.6) <= 1;
  };
  let mask = new Set<string>();
  for (let py = 0; py < h; py++) {
    for (let px = -halfW; px < halfW; px++) if (inside(px, py)) mask.add(`${px},${py}`);
  }
  [INK, FRAME, FRAME_LIGHT, CREAM].forEach((colour) => {
    const next = new Set<string>();
    for (const key of mask) {
      const [px, py] = key.split(',').map(Number);
      rect(c, colour, centre + px, top + py);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([ox, oy]) => mask.has(`${px + ox},${py + oy}`))) next.add(key);
    }
    if (colour !== CREAM) mask = next;
  });
  // Faint planks across the sign
  rect(c, '#e7d4ad', centre - halfW + 9, top + 24, maxW - 18, 1);

  // The name, with each letter bouncing a little like hand painting
  const widths = SIGN_WORDS.map(({ text }) => [...text].reduce((sum, ch) => sum + SIGN_GLYPHS[ch][0].length + 1, -1));
  let x = centre - Math.floor((widths.reduce((a, b) => a + b, 0) + SIGN_WORD_GAP * (SIGN_WORDS.length - 1)) / 2);
  let letter = 0;
  SIGN_WORDS.forEach(({ text, colour, shade }) => {
    for (const ch of text) {
      const rows = SIGN_GLYPHS[ch];
      const y = top + 4 + (letter % 2);
      rows.forEach((row, ry) => [...row].forEach((px, rx) => {
        if (px !== '#') return;
        rect(c, shade, x + rx, y + ry + 1);
      }));
      rows.forEach((row, ry) => [...row].forEach((px, rx) => {
        if (px === '#') rect(c, colour, x + rx, y + ry);
      }));
      x += rows[0].length + 1;
      letter++;
    }
    x += SIGN_WORD_GAP - 1;
  });
}

function drawShop(scene: Phaser.Scene) {
  const { W, H, windowX: x, windowY: y, windowW: w, windowH: h } = L;
  canvasTexture(scene, 'shop', W, H, (c) => {
    // Tiled wall, with cream pillars either side of the window
    drawTiles(c, 0, 0, W, L.counterTop + 2);
    [8, W - 21].forEach((px) => {
      rect(c, FRAME_DARK, px - 1, 0, 15, L.counterTop);
      rect(c, CREAM, px, 0, 13, L.counterTop);
      rect(c, CREAM_LIGHT, px + 1, 0, 3, L.counterTop);
      rect(c, CREAM_SHADE, px + 9, 0, 4, L.counterTop);
    });

    // Teal window frame
    rect(c, FRAME_DARK, x - 6, y - 2, w + 12, h + 2);
    rect(c, FRAME, x - 5, y - 1, w + 10, h + 1);
    rect(c, FRAME_LIGHT, x - 3, y - 1, 1, h + 1);
    rect(c, FRAME_LIGHT, x + w + 2, y - 1, 1, h + 1);
    c.clearRect(x, y, w, h);

    // Cream beam running behind the sign
    rect(c, FRAME_DARK, 0, y - 10, W, 1);
    rect(c, CREAM_LIGHT, 0, y - 9, W, 2);
    rect(c, CREAM, 0, y - 7, W, 4);
    rect(c, CREAM_SHADE, 0, y - 3, W, 1);
    rect(c, FRAME_LIGHT, 0, y - 2, W, 1);
    rect(c, FRAME, 0, y - 1, W, 1);

    // Teal sill along the bottom of the window
    rect(c, FRAME_DARK, x - 6, L.counterTop - 4, w + 12, 1);
    rect(c, FRAME_LIGHT, x - 5, L.counterTop - 3, w + 10, 1);
    rect(c, FRAME, x - 5, L.counterTop - 2, w + 10, 2);

    // The straps the calendar hangs from
    [7, 27].forEach((sx) => {
      rect(c, '#b49a74', sx, 0, 2, wallTop() + 2);
      rect(c, '#e4d2ac', sx, 0, 1, wallTop() + 2);
    });

    drawSign(c, Math.floor(W / 2), L.signY - 2, w + 2);

    // Smooth sand-coloured counter
    const top = L.counterTop;
    const bottom = L.counterBottom;
    rect(c, '#f4e4c2', 0, top, W, 2);
    rect(c, '#bfa070', 0, top + 2, W, 1);
    rect(c, '#d9bd8e', 0, top + 3, W, bottom - top - 9);
    rect(c, '#e0c698', 0, top + 3, W, 2);
    rect(c, '#efdcb4', 0, bottom - 6, W, 2);
    rect(c, '#a98a5c', 0, bottom - 4, W, 2);
    rect(c, FRAME_DARK, 0, bottom - 2, W, 3);

    // The shelf wall and its shelves
    drawTiles(c, 0, L.shelfTop, W, L.rowH * 3);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cellW = columnX(col + 1) - columnX(col);
        drawShelfCubby(c, columnX(col), L.shelfTop + row * L.rowH, cellW, L.rowH);
      }
    }

    // Controls strip
    rect(c, COLOUR_STRIP, 0, L.stripTop, W, H - L.stripTop);
    rect(c, '#356482', 0, L.stripTop, W, 1);
  });
  for (let col = 0; col < 4; col++) drawShelfGlow(scene, columnX(col + 1) - columnX(col), L.rowH);

  // Riveted metal bar along the top of the screen
  canvasTexture(scene, 'hud_bar', W, L.hudH + 4, (c) => {
    const rng = seeded(21);
    const barH = L.hudH + 4;
    rect(c, '#3b4954', 0, 0, W, barH);
    rect(c, '#5a6a74', 0, barH - 2, W, 1);
    rect(c, '#101820', 0, barH - 1, W, 1);
    speckle(c, rng, 0, 0, W, barH - 2, ['#7a5f50', '#4c5b66'], 0.04);
    rect(c, '#101820', 2, barH - 15, W - 4, 12);
    rect(c, '#1f2d38', 3, barH - 14, W - 6, 11);
    rect(c, '#2b3a46', 3, barH - 14, W - 6, 1);
    [1, W - 2].forEach((rx) => {
      rect(c, '#8e9ca4', rx, barH - 15, 1, 1);
      rect(c, '#8e9ca4', rx, barH - 5, 1, 1);
    });
  });

  // A glass door standing open at each side of the window, behind the customers
  canvasTexture(scene, 'window_doors', w, h, (c) => {
    // Narrow pane on the left
    rect(c, 'rgba(226, 244, 240, 0.4)', 0, 0, 8, h);
    rect(c, 'rgba(255, 255, 255, 0.5)', 3, 0, 2, h);
    rect(c, FRAME, 8, 0, 2, h);
    rect(c, FRAME_DARK, 10, 0, 1, h);
    // Open door on the right, taller at its near edge
    const doorW = 34;
    const left = w - doorW;
    for (let i = 0; i < doorW; i++) {
      const doorTop = Math.max(0, 22 - Math.floor(i * 0.55));
      const edge = i < 3 || i >= doorW - 3;
      rect(c, edge ? FRAME : 'rgba(205, 238, 236, 0.32)', left + i, doorTop + (edge ? 0 : 3), 1, h);
      if (!edge) rect(c, FRAME, left + i, doorTop, 1, 3);
      if (!edge && (i + 4) % 12 < 3) rect(c, 'rgba(255, 255, 255, 0.35)', left + i, doorTop + 6 + i % 12, 1, 16);
    }
    rect(c, FRAME_DARK, left - 1, 22, 1, h);
  });

  // Roller shutter, closed until you open up
  canvasTexture(scene, 'shutter', w, h, (c) => {
    const rng = seeded(33);
    drawSlats(c, rng, 0, 0, w, h);
    const signX = Math.floor(w / 2) - 32;
    const signY = Math.floor(h / 2) - 11;
    rect(c, '#2d3036', signX + 6, signY - 10, 1, 10);
    rect(c, '#2d3036', signX + 57, signY - 10, 1, 10);
    rounded(c, INK, signX, signY, 64, 22);
    rounded(c, FRAME, signX + 1, signY + 1, 62, 20);
    rounded(c, CREAM_LIGHT, signX + 3, signY + 3, 58, 16);
  });

  // A locked row: wall tiles with room for the MORE SHELVES button
  canvasTexture(scene, 'more_shelves_row', W, L.rowH, (c) => {
    const rng = seeded(55);
    drawTiles(c, 0, 0, W, L.rowH);
    const barH = Math.min(26, L.rowH - 12);
    const barY = Math.floor((L.rowH - barH) / 2);
    rect(c, '#5c3418', 5, barY, W - 10, barH);
    rect(c, '#ee9a62', 6, barY + 1, W - 12, barH - 2);
    rect(c, '#f9bb88', 6, barY + 1, W - 12, 1);
    rect(c, '#c97440', 6, barY + barH - 2, W - 12, 1);
    for (let i = 0; i < 26; i++) {
      rect(c, rng() < 0.5 ? '#e08a52' : '#f4a874', 8 + Math.floor(rng() * (W - 26)), barY + 3 + Math.floor(rng() * (barH - 6)), 2 + Math.floor(rng() * 8), 1);
    }
  });

  // The row after that: a padlocked shutter, stamped LOCKED
  canvasTexture(scene, 'locked_row', W, L.rowH, (c) => {
    const rng = seeded(61);
    const rowH = L.rowH;
    drawTiles(c, 0, 0, W, rowH);
    rect(c, CREAM_SHADE, 3, 3, W - 6, rowH - 6);
    rect(c, CREAM_LIGHT, 4, 3, W - 8, 2);
    rect(c, INK, 6, 6, W - 12, rowH - 12);
    drawSlats(c, rng, 7, 7, W - 14, rowH - 14);

    // The stamp: big letters leaning uphill, with a rule above and below
    const stamp = '#16303e';
    const text = 'LOCKED';
    const scale = 2;
    const stampW = text.length * CHAR_W * scale - scale;
    const stampX = Math.floor((W - stampW) / 2);
    const stampY = Math.floor(rowH / 2) - 7;
    const lean = (px: number) => 3 - Math.floor((px - stampX) / 14);
    [...text].forEach((ch, i) => {
      GLYPHS[ch].split('|').forEach((row, ry) => [...row].forEach((on, rx) => {
        if (on !== '#') return;
        const px = stampX + i * CHAR_W * scale + rx * scale;
        rect(c, stamp, px, stampY + ry * scale + lean(px), scale + 1, scale);
      }));
    });
    for (let px = stampX - 4; px < stampX + stampW + 4; px++) {
      rect(c, stamp, px, stampY - 4 + lean(px), 1, 2);
      rect(c, stamp, px, stampY + 15 + lean(px), 1, 2);
    }
    // Worn patches in the stamp
    speckle(c, rng, stampX - 2, stampY - 3, stampW + 4, 20, [SHUTTER, SHUTTER_LIGHT], 0.025);

    // Padlock over the bottom of the shutter
    const lockX = Math.floor(W / 2) - 5;
    const lockY = rowH - 15;
    rect(c, INK, lockX + 2, lockY - 1, 7, 6);
    rect(c, '#a6a8a4', lockX + 3, lockY, 5, 5);
    rect(c, INK, lockX + 4, lockY + 1, 3, 4);
    rect(c, INK, lockX, lockY + 4, 11, 10);
    rect(c, '#c6ab74', lockX + 1, lockY + 5, 9, 8);
    rect(c, '#e2cc98', lockX + 1, lockY + 5, 9, 1);
    rect(c, '#94794a', lockX + 1, lockY + 12, 9, 1);
    rect(c, INK, lockX + 5, lockY + 7, 1, 3);
    rect(c, INK, lockX + 4, lockY + 7, 3, 1);
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

/** Three-by-five digits for the printing on the machines. */
function tinyText(c: Ctx, color: string, x: number, y: number, text: string) {
  let cx = x;
  for (const ch of text) {
    const rows = TINY_GLYPHS[ch].split('|');
    rows.forEach((row, ry) => [...row].forEach((on, rx) => { if (on === '#') rect(c, color, cx + rx, y + ry, 1, 1); }));
    cx += rows[0].length + 1;
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

/** Size of a snack sprite. Everything stands on the same bottom row, so they line up on a shelf. */
export const ITEM_W = 16;
export const ITEM_H = 20;

/** A straight-sided shape, narrowing or widening by row. Gives cups, tubs and bags their outline. */
function taper(c: Ctx, color: string, cx: number, top: number, bottom: number, topHalf: number, bottomHalf: number) {
  for (let y = top; y <= bottom; y++) {
    const half = Math.round(topHalf + ((bottomHalf - topHalf) * (y - top)) / Math.max(1, bottom - top));
    rect(c, color, cx - half, y, half * 2, 1);
  }
}

const SNACK_ART: Record<string, (c: Ctx) => void> = {
  // Blue can with a silver swoosh
  soda: (c) => {
    rect(c, '#e8eef2', 5, 1, 6, 1);
    rect(c, '#aeb9c2', 4, 2, 8, 1);
    rect(c, '#8c98a4', 7, 1, 2, 1);
    rect(c, '#2a6fc0', 3, 3, 10, 14);
    rect(c, '#4f9be0', 4, 3, 2, 14);
    rect(c, '#1c4f96', 11, 3, 2, 14);
    for (let i = 0; i < 10; i++) {
      const y = 12 - Math.floor(i * 0.6);
      rect(c, '#e4e8ea', 3 + i, y, 1, 2);
      rect(c, '#9db4c6', 3 + i, y + 2, 1, 1);
    }
    rect(c, '#bfe2f8', 4, 4, 1, 11);
    rect(c, '#c8d2da', 3, 3, 10, 1);
    rect(c, '#aeb9c2', 4, 17, 8, 1);
    rect(c, '#e8eef2', 5, 18, 6, 1);
  },
  // Puffy red bag with crimped ends, a teal swoosh and a pile of chips
  chips: (c) => {
    rect(c, '#d4d0c0', 2, 1, 12, 1);
    for (let x = 2; x < 14; x += 2) rect(c, '#8f8c7c', x, 2, 1, 1);
    rect(c, '#df4522', 1, 3, 14, 14);
    rect(c, '#df4522', 2, 2, 12, 1);
    rect(c, '#f47a52', 2, 4, 2, 11);
    rect(c, '#ffc0a4', 2, 5, 1, 6);
    rect(c, '#ab2c12', 13, 4, 2, 12);
    rect(c, '#2fb0a6', 4, 4, 8, 3);
    rect(c, '#2fb0a6', 3, 5, 1, 3);
    rect(c, '#8fe0d4', 5, 4, 5, 1);
    rect(c, '#1d807c', 5, 7, 8, 1);
    disc(c, '#f7bd42', 6, 12, 2);
    disc(c, '#f7bd42', 10, 12, 2);
    rect(c, '#ffe08a', 5, 11, 2, 1);
    rect(c, '#ffe08a', 9, 11, 2, 1);
    rect(c, '#c98420', 7, 14, 2, 1);
    rect(c, '#c98420', 11, 13, 1, 2);
    rect(c, '#df4522', 2, 17, 12, 1);
    rect(c, '#d4d0c0', 2, 18, 12, 1);
    for (let x = 3; x < 14; x += 2) rect(c, '#8f8c7c', x, 18, 1, 1);
  },
  // Two purple-wrapped bars stacked flat, with silver foil ends and gold lettering
  choco: (c) => {
    const bar = (top: number, shift: number, body: string, light: string, dark: string, gold: string) => {
      for (let y = 0; y < 7; y++) {
        const x = 1 + shift + (y < 2 ? 1 : 0);
        rect(c, y < 2 ? light : y > 4 ? dark : body, x, top + y, 14 - shift - (y < 2 ? 1 : 0), 1);
      }
      rect(c, '#e2e4ea', 1 + shift, top + 2, 2, 5);
      rect(c, '#a4a8b4', 2 + shift, top + 2, 1, 5);
      rect(c, '#e2e4ea', 13, top + 2, 2, 5);
      rect(c, '#a4a8b4', 13, top + 2, 1, 5);
      rect(c, gold, 5 + shift, top + 3, 6 - shift, 1);
      rect(c, gold, 5 + shift, top + 5, 2, 1);
      rect(c, gold, 8 + shift, top + 5, 3 - shift, 1);
    };
    bar(6, 1, '#55258f', '#7747b4', '#3c1868', '#c49a38');
    bar(12, 0, '#7030bc', '#9a62dc', '#4d1f8c', '#f6d056');
  },
  // White cup with a red pattern and a peeling foil lid
  noodle: (c) => {
    rect(c, '#e8c048', 1, 4, 14, 1);
    rect(c, '#fbf8ee', 1, 5, 14, 2);
    rect(c, '#c8c2ae', 1, 6, 14, 1);
    rect(c, '#f6df8a', 10, 3, 4, 1);
    rect(c, '#e8c048', 12, 2, 3, 1);
    taper(c, '#f6f1e4', 8, 7, 18, 7, 5);
    taper(c, '#d6cfbc', 12, 7, 18, 3, 1);
    rect(c, '#d83a2e', 2, 8, 12, 1);
    rect(c, '#d83a2e', 3, 11, 10, 3);
    [4, 7, 10].forEach((x) => rect(c, '#fbf8ee', x, 12, 2, 1));
    rect(c, '#a8281e', 11, 11, 2, 3);
    rect(c, '#d83a2e', 4, 16, 8, 1);
    rect(c, '#fffdf4', 3, 8, 1, 9);
  },
  // Three smoky sticks in a kraft sleeve with a red band
  jerky: (c) => {
    [[3, '#7a3f1e', '#9c5a30'], [7, '#6a3418', '#8e4f28'], [11, '#7a3f1e', '#9c5a30']].forEach(([x, base, light], i) => {
      const top = [2, 1, 3][i];
      rect(c, base as string, x as number, top, 3, 11);
      rect(c, light as string, x as number, top, 1, 11);
      rect(c, '#4c2410', (x as number) + 2, top, 1, 11);
      rect(c, '#b4784a', (x as number) + 1, top + 2, 1, 1);
    });
    rect(c, '#d9b27a', 2, 9, 12, 9);
    rect(c, '#f0d3a0', 2, 9, 12, 1);
    rect(c, '#a98450', 12, 10, 2, 8);
    rect(c, '#d03c2c', 2, 11, 12, 4);
    rect(c, '#f0705c', 2, 11, 12, 1);
    rect(c, '#8e2418', 12, 12, 2, 3);
    rect(c, '#fbf1d8', 4, 13, 7, 1);
    rect(c, '#b08a58', 3, 17, 10, 1);
  },
  // Three-colour pop on a stick, with frost on its shoulder
  icepop: (c) => {
    rect(c, '#e8c896', 7, 14, 3, 5);
    rect(c, '#b89464', 9, 14, 1, 5);
    rect(c, '#e8506a', 4, 2, 9, 4);
    rect(c, '#e8506a', 5, 1, 7, 1);
    rect(c, '#ff94a4', 5, 2, 2, 4);
    rect(c, '#ffd6dc', 5, 2, 1, 2);
    rect(c, '#fbf6ee', 4, 6, 9, 4);
    rect(c, '#d4dae0', 11, 6, 2, 4);
    rect(c, '#3c96e4', 4, 10, 9, 4);
    rect(c, '#2a6cb4', 4, 13, 9, 1);
    rect(c, '#88c8f4', 5, 10, 2, 3);
    rect(c, '#b83850', 11, 2, 2, 4);
    rect(c, '#2a6cb4', 11, 10, 2, 3);
  },
  // Striped tub overflowing with popcorn
  popcorn: (c) => {
    taper(c, '#fbf6ee', 8, 8, 18, 7, 5);
    for (let i = 0; i < 3; i++) {
      for (let y = 8; y <= 18; y++) {
        const inset = Math.round(((y - 8) / 10) * 2);
        rect(c, '#dc3a2e', 3 + i * 4 + inset - i, y, 2, 1);
      }
    }
    taper(c, '#c8c0ac', 13, 8, 18, 2, 0);
    rect(c, '#b42a20', 1, 8, 14, 1);
    [[4, 6, 3], [8, 5, 4], [12, 6, 3], [6, 3, 3], [10, 3, 3], [8, 1, 2]].forEach(([x, y, r]) => {
      disc(c, '#f8e8a8', x, y, r > 3 ? 3 : r - 1);
      rect(c, '#fffbe4', x - 1, y - 1, 2, 1);
      rect(c, '#e0b84e', x + 1, y + 1, 1, 1);
    });
    disc(c, '#fff4c0', 8, 5, 2);
    rect(c, '#e0b84e', 5, 7, 1, 1);
    rect(c, '#e0b84e', 11, 7, 1, 1);
  },
  // A cut coconut with a straw and a little paper umbrella
  coconut: (c) => {
    rect(c, '#f07060', 12, 1, 1, 7);
    rect(c, '#fbf1d8', 12, 3, 1, 1);
    rect(c, '#fbf1d8', 12, 6, 1, 1);
    rect(c, '#b08a58', 5, 4, 1, 4);
    taper(c, '#e8506a', 5, 1, 3, 1, 5);
    rect(c, '#ffc65c', 3, 3, 2, 1);
    rect(c, '#ffc65c', 6, 3, 2, 1);
    rect(c, '#ff94a4', 4, 1, 2, 1);
    disc(c, '#6a4226', 8, 12, 6);
    rect(c, '#8c5c36', 3, 10, 4, 5);
    rect(c, '#a97648', 3, 11, 2, 2);
    rect(c, '#46280f', 11, 11, 3, 5);
    [[5, 15], [8, 16], [10, 13], [7, 12]].forEach(([x, y]) => rect(c, '#46280f', x, y, 2, 1));
    rect(c, '#fbf8ee', 3, 7, 10, 2);
    rect(c, '#a8d8d0', 5, 7, 6, 1);
  },
  // Golden pie in a foil tin, with vents in its crust
  pie: (c) => {
    rect(c, '#d9a452', 2, 8, 12, 1);
    rect(c, '#e6b868', 1, 9, 14, 3);
    rect(c, '#f6d48c', 2, 8, 8, 1);
    rect(c, '#fbe6ae', 3, 9, 4, 1);
    rect(c, '#c08438', 12, 9, 3, 3);
    for (let x = 1; x < 15; x += 2) rect(c, '#c88e42', x, 12, 1, 1);
    rect(c, '#d9a452', 1, 12, 14, 1);
    for (let x = 2; x < 15; x += 3) rect(c, '#a86e2c', x, 12, 1, 1);
    rect(c, '#8a5a24', 6, 9, 1, 2);
    rect(c, '#8a5a24', 8, 9, 1, 2);
    rect(c, '#8a5a24', 10, 9, 1, 2);
    rect(c, '#d4dae0', 1, 13, 14, 2);
    rect(c, '#f0f4f6', 1, 13, 14, 1);
    taper(c, '#b4bcc4', 8, 15, 18, 7, 5);
    rect(c, '#8a929c', 11, 15, 3, 4);
    rect(c, '#e0e4e8', 4, 16, 3, 1);
  },
  // Folded shell with fish, slaw and tomato spilling out along its top
  taco: (c) => {
    disc(c, '#62b844', 8, 16, 7);
    rect(c, '#92dc62', 3, 11, 3, 1);
    rect(c, '#92dc62', 10, 10, 3, 1);
    rect(c, '#f4f0e0', 6, 9, 4, 2);
    rect(c, '#f6b070', 7, 11, 3, 1);
    rect(c, '#e8483c', 3, 12, 2, 1);
    rect(c, '#e8483c', 11, 11, 2, 2);
    disc(c, '#c28828', 8, 20, 8);
    disc(c, '#f4c458', 8, 20, 7);
    rect(c, '#fde694', 5, 13, 6, 1);
    rect(c, '#fde694', 3, 15, 1, 2);
    [[5, 16], [9, 15], [7, 17], [11, 17], [12, 15]].forEach(([x, y]) => rect(c, '#c28828', x, y, 1, 1));
    c.clearRect(0, 19, ITEM_W, 1);
  },
  // Tall glass of lemonade with ice, a straw and a lemon slice on the rim
  lemon: (c) => {
    rect(c, '#e8506a', 8, 1, 1, 7);
    rect(c, '#fbf1d8', 8, 3, 1, 1);
    rect(c, '#fbf1d8', 8, 6, 1, 1);
    rect(c, '#e8f6f6', 3, 5, 10, 14);
    rect(c, '#c4e4e8', 12, 5, 1, 14);
    rect(c, '#f8dc4c', 4, 8, 8, 10);
    rect(c, '#fff09a', 4, 8, 8, 1);
    rect(c, '#e0b82c', 10, 9, 2, 9);
    rect(c, '#fff8c8', 5, 9, 1, 8);
    rect(c, '#fff8d0', 7, 9, 3, 2);
    rect(c, '#fff8d0', 6, 13, 3, 2);
    rect(c, '#e8cc48', 9, 10, 1, 1);
    rect(c, '#e8cc48', 8, 14, 1, 1);
    rect(c, '#a8d4dc', 4, 18, 8, 1);
    disc(c, '#f0c02e', 13, 5, 2);
    disc(c, '#fff4a8', 13, 5, 1);
    rect(c, '#f0c02e', 13, 5, 1, 1);
  },
  // Rainbow snow piled high in a striped paper cup, with a spoon
  shave: (c) => {
    disc(c, '#fbfafc', 8, 6, 5);
    rect(c, '#f07ca8', 3, 4, 4, 6);
    rect(c, '#f07ca8', 4, 2, 3, 2);
    rect(c, '#ffc8dc', 4, 3, 1, 4);
    rect(c, '#66c8f0', 9, 3, 4, 7);
    rect(c, '#66c8f0', 9, 2, 2, 1);
    rect(c, '#b0e8fc', 10, 3, 1, 3);
    rect(c, '#f8e070', 7, 1, 2, 9);
    rect(c, '#fbf8d8', 7, 2, 1, 3);
    rect(c, '#d8d4e0', 3, 9, 10, 1);
    rect(c, '#c8ccd2', 13, 2, 1, 7);
    rect(c, '#e8ecf0', 12, 1, 2, 2);
    rect(c, '#fbf1d8', 2, 10, 12, 1);
    taper(c, '#e8604f', 8, 11, 18, 6, 4);
    for (let i = 0; i < 3; i++) rect(c, '#fbf1d8', 4 + i * 3, 11, 1, 8);
    taper(c, '#b84236', 12, 11, 18, 2, 0);
  },
};

function drawProducts(scene: Phaser.Scene) {
  for (const [id, draw] of Object.entries(SNACK_ART)) {
    canvasTexture(scene, `item_${id}`, ITEM_W, ITEM_H, (c) => {
      draw(c);
      outline(c, ITEM_W, ITEM_H, '#2c2a33');
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
  // Hangs from the bubble's bottom edge towards the speaker. Its top rows overlap the frame, joining the two.
  canvasTexture(scene, 'bubble_tail', 15, 11, (c) => {
    for (let y = 0; y < 11; y++) {
      const t = y / 10;
      const left = Math.round(4 - t * 4);
      const right = Math.round(14 - t * 13);
      rect(c, INK, left, y, Math.max(1, right - left + 1), 1);
      if (right - left >= 2) rect(c, FRAME, left + 1, y, right - left - 1, 1);
      if (right - left >= 6) rect(c, BUBBLE_PAPER, left + 3, y, right - left - 5, 1);
    }
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

export const TV_W = 35;
export const TV_H = 40;
export const TV_FRAMES = 4;
export const TV_SCREEN_X = 4;
export const TV_SCREEN_Y = 17;
export const CALENDAR_W = 34;
export const CALENDAR_H = 38;
/** Where the first cell of the calendar's grid sits, and the size of each cell. */
export const CALENDAR_GRID = { x: 4, y: 13, cell: 3, gap: 1, rows: 5 };
const SCREEN_W = 27;
const SCREEN_H = 18;

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
    rect(c, '#8ccdf0', 0, 11, SCREEN_W, 4);
    drawSun(c, 11, 7, frame);
    drawCloud(c, 14 + (frame % 2), 8, '#f4f8fa');
    rect(c, '#2f8fc4', 0, 15, SCREEN_W, 3);
    for (let x = frame * 2; x < SCREEN_W; x += 8) rect(c, '#bfe6f7', x, 16, 3, 1);
  },
  heatwave(c, frame) {
    rect(c, '#f08a3c', 0, 0, SCREEN_W, SCREEN_H);
    rect(c, '#f6b04f', 0, 10, SCREEN_W, 8);
    disc(c, '#fff0a8', 13, 6, 5);
    // Heat shimmer rising off the sand
    for (let row = 0; row < 3; row++) {
      for (let x = (frame + row) % 4; x < SCREEN_W; x += 4) rect(c, '#ffd65c', x, 12 + row * 2, 2, 1);
    }
  },
  rainy(c, frame) {
    rect(c, '#55677c', 0, 0, SCREEN_W, SCREEN_H);
    drawCloud(c, 7, 2, '#c9d3dd');
    for (let i = 0; i < 8; i++) {
      const x = 2 + i * 3 + (i % 2);
      rect(c, '#9fd6f5', x, 9 + ((frame * 2 + i * 3) % 7), 1, 2);
    }
  },
  cloudy(c, frame) {
    rect(c, '#9db4c6', 0, 0, SCREEN_W, SCREEN_H);
    drawCloud(c, -2 + frame * 2, 2, '#eef3f6');
    drawCloud(c, 15 - frame, 10, '#d3dee6');
  },
};

function drawInfoBoard(scene: Phaser.Scene) {
  canvasTexture(scene, 'tv', TV_W, TV_H, (c) => {
    // Antenna
    for (let i = 0; i < 5; i++) {
      rect(c, '#2d3036', 15 - i * 2, 4 - i, 2, 1);
      rect(c, '#2d3036', 18 + i * 2, 4 - i, 2, 1);
    }
    rect(c, '#2d3036', 14, 4, 7, 1);
    // Rounded teal case
    rounded(c, INK, 0, 5, TV_W, TV_H - 5);
    rounded(c, FRAME, 1, 6, TV_W - 2, TV_H - 7);
    rect(c, FRAME_LIGHT, 2, 6, TV_W - 4, 1);
    rect(c, FRAME_DARK, 2, TV_H - 3, TV_W - 4, 1);
    // TMRW header
    rounded(c, FRAME_DARK, 3, 7, TV_W - 6, 9);
    // Screen bezel
    rounded(c, CREAM_LIGHT, TV_SCREEN_X - 1, TV_SCREEN_Y - 1, SCREEN_W + 2, SCREEN_H + 2);
    rect(c, '#e8483c', TV_W - 7, TV_H - 4, 2, 1);
  });
  for (const [id, draw] of Object.entries(SCREENS)) {
    for (let frame = 0; frame < TV_FRAMES; frame++) {
      canvasTexture(scene, `tv_${id}_${frame}`, SCREEN_W, SCREEN_H, (c) => {
        draw(c, frame);
        [[0, 0], [SCREEN_W - 1, 0], [0, SCREEN_H - 1], [SCREEN_W - 1, SCREEN_H - 1]].forEach(([cx, cy]) => c.clearRect(cx, cy, 1, 1));
      });
    }
  }

  canvasTexture(scene, 'calendar', CALENDAR_W, CALENDAR_H, (c) => {
    rounded(c, INK, 0, 0, CALENDAR_W, CALENDAR_H);
    rounded(c, FRAME, 1, 1, CALENDAR_W - 2, CALENDAR_H - 2);
    rect(c, FRAME_LIGHT, 2, 1, CALENDAR_W - 4, 1);
    // Paper, with a curled corner
    rect(c, CREAM_LIGHT, 2, 11, CALENDAR_W - 4, CALENDAR_H - 13);
    rect(c, CREAM_SHADE, CALENDAR_W - 6, CALENDAR_H - 5, 3, 1);
    rect(c, CREAM_SHADE, CALENDAR_W - 5, CALENDAR_H - 4, 2, 1);
    rect(c, FRAME, CALENDAR_W - 4, CALENDAR_H - 3, 2, 1);
    // Fine lines between the day cells, which are drawn live on top
    const { x, y, cell, gap, rows } = CALENDAR_GRID;
    rect(c, '#c9c2a4', x - 1, y - 1, 7 * (cell + gap) + 1, rows * (cell + gap) + 1);
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
  star('star_off', '#b08a58', '#94734a');

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
    rect(c, INK, 0, 0, 60, 26);
    rect(c, FRAME, 1, 1, 58, 24);
    rect(c, FRAME_LIGHT, 1, 1, 58, 1);
    for (let col = 0; col < 4; col++) {
      const cx = 3 + col * 14;
      rect(c, '#efc698', cx, 3, 12, 15);
      rect(c, '#94683f', cx, 3, 12, 1);
      rect(c, '#fff8d6', cx + 3, 4, 6, 1);
      rect(c, '#fdeac6', cx + 3, 5, 6, 13);
      rect(c, CREAM_LIGHT, cx, 18, 12, 1);
      rect(c, CREAM_LIGHT, cx, 20, 12, 3);
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
