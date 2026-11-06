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

/** Draws in game pixels on a canvas with twice the detail. Half-pixel coordinates are allowed. Show it at half scale. */
function hiTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  const tex = scene.textures.createCanvas(key, w * 2, h * 2)!;
  const c = tex.getContext();
  c.scale(2, 2);
  draw(c);
  tex.refresh();
}

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

// Storefront colours, sampled from the mock-up
const PANEL = '#70bfaa';
const PANEL_SHADE = '#5bb6ad';
const PANEL_SEAM = '#35918c';
const PANEL_LIGHT = '#94dcc8';
const FRAME = '#47a1a1';
const FRAME_LIGHT = '#72bea9';
const FRAME_DARK = '#236067';
const CREAM = '#efd4b6';
const CREAM_LIGHT = '#f6e4ca';
const CREAM_SHADE = '#ddb68b';
const CREAM_EDGE = '#a8845c';
const BUBBLE_PAPER = '#f7ebcf';
const SHUTTER = '#6f94a2';
const SHUTTER_LIGHT = '#8cadb8';
const SHUTTER_DARK = '#4f7485';

/** Vertical wall panels. */
function drawPanels(c: Ctx, x: number, y: number, w: number, h: number) {
  rect(c, PANEL, x, y, w, h);
  for (let px = 0; px < w; px += 20) {
    rect(c, PANEL_SHADE, x + px + 12, y, 8, h);
    rect(c, PANEL_SEAM, x + px, y, 1, h);
    rect(c, PANEL_LIGHT, x + px + 1, y, 1, h);
  }
}

/** Grey-blue roller shutter slats, used for locked shelves. */
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

/** Where the parts of a shelf sit, measured from its corner. */
function nicheBounds(w: number, h: number) {
  const left = 2;
  const top = 2;
  const width = w - 4;
  const floor = h - SHELF_LABEL_H - 3;
  const side = 5;
  const ceiling = 6;
  return { left, top, width, floor, side, ceiling, backLeft: left + side, backWidth: width - side * 2, backTop: top + ceiling };
}

/** A recessed shelf with its light off. The light goes on top, so it can flicker. */
function drawShelfCubby(c: Ctx, x: number, y: number, w: number, h: number) {
  const n = nicheBounds(w, h);
  const niche = n.floor + 4 - n.top;
  // Dark frame, rounded at the corners
  rounded(c, FRAME_DARK, x + 1, y + 1, w - 2, niche + 2);
  // Side walls
  rect(c, '#f1bf92', x + n.left, y + n.top, n.width, niche);
  // Back wall, dimmed while the light is off
  rect(c, '#dcae84', x + n.backLeft, y + n.backTop, n.backWidth, n.floor - n.backTop);
  rect(c, '#e8b184', x + n.backLeft - 0.5, y + n.backTop, 0.5, n.floor - n.backTop);
  rect(c, '#e8b184', x + n.backLeft + n.backWidth, y + n.backTop, 0.5, n.floor - n.backTop);
  // Ceiling, narrowing towards the back with mitred corners
  for (let i = 0; i < n.ceiling * 2; i++) {
    rect(c, '#d39e72', x + n.left + i * 0.42, y + n.top + i * 0.5, n.width - i * 0.84, 0.5);
  }
  // Unlit lamp
  rect(c, '#a9896a', x + Math.floor(w / 2) - 6, y + n.top + 0.5, 12, 2.5);
  // Floor, widening towards the front
  for (let i = 0; i < 8; i++) rect(c, '#f9e6b7', x + n.backLeft - i * 0.6, y + n.floor + i * 0.5, n.backWidth + i * 1.2, 0.5);
  // Name plate
  const plateY = y + h - SHELF_LABEL_H;
  rounded(c, FRAME_DARK, x + 1, plateY, w - 2, 11);
  rect(c, FRAME_LIGHT, x + 2, plateY + 0.5, w - 4, 1);
  rect(c, '#fbeed5', x + 2, plateY + 1.5, w - 4, 8);
  rect(c, FRAME, x + 2, plateY + 9.5, w - 4, 0.5);
}

/** Left edge of a shelf column, so four columns always span the full width. */
export const columnX = (col: number) => Math.round((col * L.W) / 4);

/** Texture key for the light of a shelf this wide. Column widths can differ by a pixel. */
export const shelfGlowKey = (w: number) => `shelf_glow_${w}`;

function drawShelfGlow(scene: Phaser.Scene, w: number, h: number) {
  const key = shelfGlowKey(w);
  if (scene.textures.exists(key)) return;
  hiTexture(scene, key, w, h, (c) => {
    const n = nicheBounds(w, h);
    const cx = Math.floor(w / 2);
    // The back wall when lit
    rect(c, '#fbcea2', n.backLeft, n.backTop, n.backWidth, n.floor - n.backTop);
    // The dome of light spreading from the lamp, with a softer edge
    const coneH = n.floor - n.backTop;
    const widest = Math.min(n.backWidth / 2, 17);
    for (let i = 0; i < coneH * 2; i++) {
      const t = i / (coneH * 2);
      const half = Math.min(widest, 7 + (widest - 7) * Math.sqrt(t) * 1.15);
      const y = n.backTop + i * 0.5;
      rect(c, '#fddcae', cx - half, y, half * 2, 0.5);
      if (half > 2) rect(c, '#ffeab8', cx - half + 1.5, y, half * 2 - 3, 0.5);
    }
    // Lamp, with the yellow glow under it
    for (let i = 0; i < 7; i++) rect(c, '#f0d38e', cx - 6.5 - i * 0.5, n.top + 2.5 + i * 0.5, 13 + i, 0.5);
    rect(c, '#fcfcca', cx - 6, n.top + 0.5, 12, 2.5);
    rect(c, '#ffffe8', cx - 5, n.top + 1, 10, 1);
  });
}

/** How far each door swings. These are their widths once open, in game pixels. */
const DOOR_OPEN_LEFT = 10;
const DOOR_OPEN_RIGHT = 34;
export const DOOR_FRAMES = 8;

/** One glass door at one point in its swing. Hinged at its outer edge, with the free edge moving away from you. */
function drawDoor(c: Ctx, w: number, h: number, openWidth: number, t: number, hingeOnLeft: boolean) {
  const totalW = w * 2;
  const totalH = h * 2;
  const across = Math.max(6, Math.round(totalW + (openWidth * 2 - totalW) * t));
  const stile = Math.max(3, Math.round((10 * across) / totalW));
  for (let i = 0; i < across; i++) {
    const u = i / (across - 1);
    const px = hingeOnLeft ? i : totalW - 1 - i;
    const top = Math.round(u * t * 44);
    const bottom = totalH - Math.round(u * t * 16);
    const edge = i === 0 || i === across - 1;
    const isStile = i < stile || i >= across - stile;
    const fill = (colour: string, y0: number, y1: number) => {
      c.fillStyle = colour;
      c.fillRect(px, y0, 1, Math.max(0, y1 - y0));
    };
    if (edge) {
      fill(FRAME_DARK, top, bottom);
      continue;
    }
    if (isStile) {
      const light = i === 1 || i === across - stile;
      fill(light ? FRAME_LIGHT : FRAME, top, bottom);
      fill(FRAME_DARK, top, top + 1);
      fill(FRAME_DARK, bottom - 1, bottom);
      continue;
    }
    const railTop = top + 10;
    const railBottom = bottom - 22;
    fill(FRAME_DARK, top, top + 1);
    fill(FRAME_LIGHT, top + 1, top + 3);
    fill(FRAME, top + 3, railTop - 1);
    fill(FRAME_DARK, railTop - 1, railTop);
    // Glass, with a soft diagonal reflection
    fill('rgba(205, 238, 236, 0.28)', railTop, railBottom);
    const band = (i * 2 + 40) % 150;
    if (band < 34) fill('rgba(255, 255, 255, 0.22)', railTop + 8 + band, railBottom - 40);
    fill(FRAME_DARK, railBottom, railBottom + 1);
    fill(FRAME, railBottom + 1, bottom - 2);
    fill(FRAME_LIGHT, railBottom + 1, railBottom + 2);
    fill(FRAME_DARK, bottom - 2, bottom);
  }
  // Long handle near the free edge
  const handleAt = across - stile - 5;
  if (handleAt > stile) {
    const u = handleAt / (across - 1);
    const px = hingeOnLeft ? handleAt : totalW - 4 - handleAt;
    const mid = (Math.round(u * t * 44) + totalH - Math.round(u * t * 16)) / 2;
    c.fillStyle = FRAME_DARK;
    c.fillRect(px - 1, mid - 26, 5, 52);
    c.fillStyle = '#d8dee0';
    c.fillRect(px, mid - 25, 3, 50);
    c.fillStyle = '#ffffff';
    c.fillRect(px, mid - 25, 1, 50);
  }
}

function drawShop(scene: Phaser.Scene) {
  const { W, H, windowX: x, windowY: y, windowW: w, windowH: h } = L;
  hiTexture(scene, 'shop', W, H, (c) => {
    // Panelled wall
    drawPanels(c, 0, 0, W, L.counterTop + 2);

    // The door frame: wide cream jambs and a lintel, with a teal inner frame against the opening
    const jamb = 12;
    const inner = 5;
    const lintel = 11;
    const outerLeft = x - inner - jamb;
    const outerW = w + (inner + jamb) * 2;
    const frameTop = y - lintel - 2;
    rect(c, CREAM_EDGE, outerLeft - 1, frameTop - 1, outerW + 2, L.counterTop - frameTop + 1);
    [outerLeft, x + w + inner].forEach((jx) => {
      rect(c, CREAM, jx, frameTop, jamb, L.counterTop - frameTop);
      rect(c, CREAM_LIGHT, jx + 1, frameTop, 3, L.counterTop - frameTop);
      rect(c, CREAM_SHADE, jx + jamb - 4, frameTop, 4, L.counterTop - frameTop);
    });
    rect(c, CREAM_LIGHT, outerLeft, frameTop, outerW, 2);
    rect(c, CREAM, outerLeft, frameTop + 2, outerW, lintel - 3);
    rect(c, CREAM_SHADE, outerLeft, frameTop + lintel - 1, outerW, 3);
    rect(c, FRAME_DARK, x - inner - 0.5, y - inner, w + inner * 2 + 1, h + inner);
    rect(c, FRAME, x - inner, y - inner + 0.5, w + inner * 2, h + inner);
    rect(c, FRAME_LIGHT, x - inner + 1, y - inner + 0.5, w + inner * 2 - 2, 1);
    rect(c, FRAME_LIGHT, x - inner + 1, y - inner + 1, 1, h + inner);
    rect(c, FRAME_LIGHT, x + w + 2, y - inner + 1, 1, h + inner);
    rect(c, FRAME_DARK, x - 1, y - 1, 1, h + 1);
    rect(c, FRAME_DARK, x + w, y - 1, 1, h + 1);
    rect(c, FRAME_DARK, x - 1, y - 1, w + 2, 1);
    c.clearRect(x, y, w, h);

    // Sill along the bottom of the opening
    rect(c, FRAME_DARK, x - inner - 0.5, L.counterTop - 4, w + inner * 2 + 1, 1);
    rect(c, '#62c0b0', x - inner, L.counterTop - 3, w + inner * 2, 2);
    rect(c, FRAME, x - inner, L.counterTop - 1, w + inner * 2, 1);

    // The straps the calendar hangs from
    [7, 27].forEach((sx) => {
      rect(c, '#b49a74', sx, 0, 2, wallTop() + 2);
      rect(c, '#e4d2ac', sx, 0, 1, wallTop() + 2);
    });

    // Smooth sand-coloured counter
    const top = L.counterTop;
    const bottom = L.counterBottom;
    rect(c, '#f4e4c2', 0, top, W, 1);
    rect(c, '#bfa070', 0, top + 1, W, 1);
    rect(c, '#dbbc8d', 0, top + 2, W, bottom - top - 8);
    rect(c, '#e3c79a', 0, top + 2, W, 2);
    rect(c, '#efdcb4', 0, bottom - 6, W, 2);
    rect(c, '#a98a5c', 0, bottom - 4, W, 2);
    rect(c, FRAME_DARK, 0, bottom - 2, W, 3);

    // The register's shadow on the counter
    rect(c, COUNTER_SHADOW, 2, bottom - 6, 74, 1.5);

    // The shelf wall and its shelves
    drawPanels(c, 0, L.shelfTop, W, L.rowH * 3);
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

  // The pair of front doors, drawn through their swing
  const leftW = Math.floor(w / 2);
  const rightW = w - leftW;
  for (let i = 0; i < DOOR_FRAMES; i++) {
    const t = i / (DOOR_FRAMES - 1);
    const swing = 1 - Math.pow(1 - t, 2);
    const leftTex = scene.textures.createCanvas(`door_l_${i}`, leftW * 2, h * 2)!;
    drawDoor(leftTex.getContext(), leftW, h, DOOR_OPEN_LEFT, swing, true);
    leftTex.refresh();
    const rightTex = scene.textures.createCanvas(`door_r_${i}`, rightW * 2, h * 2)!;
    drawDoor(rightTex.getContext(), rightW, h, DOOR_OPEN_RIGHT, swing, false);
    rightTex.refresh();
  }

  // The sign that hangs on the closed doors
  canvasTexture(scene, 'closed_sign', 64, 30, (c) => {
    rect(c, '#2d3036', 7, 0, 1, 9);
    rect(c, '#2d3036', 56, 0, 1, 9);
    rounded(c, INK, 0, 8, 64, 22);
    rounded(c, FRAME, 1, 9, 62, 20);
    rounded(c, CREAM_LIGHT, 3, 11, 58, 16);
  });

  // A locked row: wall panels with room for the MORE SHELVES button
  canvasTexture(scene, 'more_shelves_row', W, L.rowH, (c) => {
    const rng = seeded(55);
    drawPanels(c, 0, 0, W, L.rowH);
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
    drawPanels(c, 0, 0, W, rowH);
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

/** Snack sprites hold twice the game's pixels, so they show at half scale. */
export const ITEM_SCALE = 0.5;
const SNACK_W = 36;
const SNACK_H = 46;
const SNACK_INK = '#121216';

/** A vertical stretch shaded left to right, which reads as a rounded surface. */
function shaded(c: Ctx, ramp: string[], x: number, y: number, w: number, h: number) {
  for (let i = 0; i < w; i++) {
    const t = i / Math.max(1, w - 1);
    // Lit a little left of centre, falling away to the right edge
    const lit = 1 - Math.min(1, Math.abs(t - 0.32) * 1.7);
    rect(c, ramp[Math.round((1 - lit) * (ramp.length - 1))], x + i, y, 1, h);
  }
}

function ball(c: Ctx, ramp: string[], cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d > (r + 0.3) * (r + 0.3)) continue;
      const light = ((x + r * 0.45) ** 2 + (y + r * 0.5) ** 2) / ((r * 1.5) ** 2);
      rect(c, ramp[Math.min(ramp.length - 1, Math.floor(light * ramp.length))], cx + x, cy + y);
    }
  }
}

// The soda, chips, choco bar and noodle cup come straight from the mock-up, in public/shop.
const SNACK_ART: Record<string, (c: Ctx) => void> = {
  // Kraft pouch with a clear window onto three sticks
  jerky: (c) => {
    const kraft = ['#ecd09c', '#dcb980', '#c99f66', '#a87e4c'];
    shaded(c, kraft, 5, 5, 26, 38);
    rect(c, '#8a6238', 5, 2, 26, 4);
    for (let x = 5; x < 31; x += 2) rect(c, '#b08a58', x, 2, 1, 4);
    rect(c, '#4a3220', 16, 3, 4, 2);
    // Red band across the top with gold lettering
    shaded(c, ['#ef6a52', '#d83f2c', '#b82c1e', '#8e1f14'], 5, 8, 26, 9);
    rect(c, '#f6cf5a', 9, 10, 3, 1);
    rect(c, '#f6cf5a', 9, 11, 1, 3);
    [14, 18, 22].forEach((x) => rect(c, '#f6cf5a', x, 10, 3, 4));
    [15, 19, 23].forEach((x) => rect(c, '#b82c1e', x, 11, 1, 2));
    rect(c, '#8e1f14', 5, 17, 26, 1);
    // The window and its sticks
    rect(c, '#6a4a2c', 8, 19, 20, 20);
    rect(c, '#f4e6c8', 9, 20, 18, 18);
    [10, 16, 22].forEach((x, i) => {
      shaded(c, ['#a55c30', '#7f4120', '#5f2c14', '#431d0c'], x, 20 + (i === 1 ? 0 : 1), 5, 17);
      rect(c, '#c98454', x + 1, 24 + i * 3, 1, 3);
      rect(c, '#2f1408', x + 3, 29 - i * 2, 1, 2);
      rect(c, '#c98454', x + 2, 33 - i, 1, 1);
    });
    rect(c, 'rgba(255, 255, 255, 0.35)', 9, 20, 2, 18);
    rect(c, '#8a6238', 5, 41, 26, 2);
  },
  // Three-colour pop with a bitten corner and a frost sheen
  icepop: (c) => {
    shaded(c, ['#f6dfb0', '#e8c88e', '#c9a468', '#a88348'], 15, 31, 6, 13);
    rect(c, '#a88348', 17, 36, 1, 3);
    const body = (y: number, h: number, ramp: string[]) => shaded(c, ramp, 8, y, 20, h);
    body(4, 9, ['#ff9aa8', '#f2607a', '#d8405e', '#a82a48']);
    rect(c, '#f2607a', 10, 2, 16, 2);
    rect(c, '#ffb6c2', 11, 2, 8, 1);
    body(13, 9, ['#ffffff', '#f6f2ec', '#dcd8d4', '#b8b4b8']);
    body(22, 10, ['#8ccaf6', '#449ce6', '#2a78c4', '#1c5494']);
    // Drips where the colours meet
    [10, 15, 21, 25].forEach((x, i) => rect(c, ['#f2607a', '#d8405e'][i % 2], x, 13, 2, 2 + (i % 2)));
    [12, 18, 23].forEach((x) => rect(c, '#f6f2ec', x, 22, 2, 2));
    rect(c, '#ffffff', 11, 5, 2, 7);
    rect(c, '#ffffff', 11, 14, 2, 6);
    rect(c, '#cdeafc', 11, 24, 2, 6);
    // Frost
    [[20, 6], [24, 9], [18, 16], [23, 26], [15, 28]].forEach(([x, y]) => rect(c, 'rgba(255,255,255,0.7)', x, y, 1, 1));
  },
  // Striped tub heaped with popcorn
  popcorn: (c) => {
    const kernels: [number, number, number][] = [[9, 15, 4], [15, 11, 4], [22, 12, 4], [27, 16, 4], [12, 7, 3], [19, 5, 4], [25, 8, 3], [18, 15, 4], [7, 19, 3], [29, 20, 3]];
    kernels.forEach(([x, y, r]) => {
      ball(c, ['#fffbe0', '#fbeeb0', '#f4d97c', '#d8a83e'], x, y, r);
      rect(c, '#c98e2c', x, y + 1, 1, 1);
    });
    for (let y = 21; y <= 43; y++) {
      const half = Math.round(15 - ((y - 21) * 4) / 22);
      for (let x = -half; x < half; x++) {
        const stripe = Math.floor(((x + half) / (half * 2)) * 6) % 2 === 0;
        const t = (x + half) / (half * 2);
        const shadeLevel = t > 0.82 ? 2 : t > 0.62 ? 1 : 0;
        const colour = stripe ? ['#e23e30', '#c22c22', '#96201a'][shadeLevel] : ['#fdf8ee', '#e6dfd0', '#bdb5a6'][shadeLevel];
        rect(c, colour, 18 + x, y);
      }
    }
    rect(c, '#fff4e0', 3, 21, 30, 1);
    rect(c, '#96201a', 3, 22, 30, 1);
    rect(c, '#ffffff', 8, 26, 1, 12);
    // A round label
    ball(c, ['#ffe08a', '#f6c94a', '#e0a42c'], 17, 32, 5);
    rect(c, '#c22c22', 15, 30, 5, 1);
    rect(c, '#c22c22', 15, 32, 5, 1);
    rect(c, '#c22c22', 15, 34, 5, 1);
  },
  // A husked coconut with its top cut, a striped straw and a paper umbrella
  coconut: (c) => {
    // Straw
    for (let y = 2; y < 20; y++) rect(c, y % 4 < 2 ? '#f26a5c' : '#fdf3e0', 25 + Math.floor((20 - y) / 7), y, 2, 1);
    // Umbrella
    rect(c, '#8a6238', 9, 11, 1, 10);
    for (let i = 0; i < 7; i++) {
      const half = 1 + i;
      for (let x = -half; x <= half; x++) {
        const seg = Math.floor(((x + half) / (half * 2 + 1)) * 4);
        rect(c, ['#f65a78', '#ffc65c', '#3cb8c8', '#f65a78'][seg], 9 + x, 3 + i, 1, 1);
      }
    }
    rect(c, '#b84060', 2, 10, 15, 1);
    // Husk
    ball(c, ['#b47a4c', '#8e5a32', '#6e4222', '#4e2c14', '#341c0c'], 18, 29, 14);
    // Fibres
    [[8, 27, 3], [11, 34, 4], [14, 38, 3], [18, 31, 4], [23, 36, 3], [27, 30, 3], [12, 24, 3], [20, 25, 3], [25, 25, 2], [17, 40, 4]].forEach(([x, y, l]) => {
      rect(c, '#2c1608', x, y, l, 1);
      rect(c, '#c49064', x + 1, y - 1, 1, 1);
    });
    // Cut top: white flesh around the water
    for (let i = 0; i < 6; i++) {
      const half = [7, 10, 11, 11, 10, 7][i];
      rect(c, '#fdfbf0', 18 - half, 16 + i, half * 2, 1);
    }
    rect(c, '#cfe8e0', 12, 18, 12, 2);
    rect(c, '#a8d8d0', 14, 18, 8, 1);
    rect(c, '#d4c8a8', 11, 21, 14, 1);
  },
  // A golden pie in a fluted foil tin, with a lattice over a dark filling
  pie: (c) => {
    // Dome
    for (let i = 0; i < 12; i++) {
      const half = Math.round(15 * Math.sqrt(1 - ((11 - i) / 12) ** 2));
      shaded(c, ['#ffe6a8', '#f4c878', '#e0a452', '#bd7c34'], 18 - half, 18 + i, half * 2, 1);
    }
    // Filling showing between the lattice
    for (let y = 21; y < 29; y += 4) rect(c, '#7c3a1e', 8, y, 20, 2);
    for (let x = 9; x < 29; x += 5) rect(c, '#f4c878', x, 19, 2, 11);
    for (let x = 9; x < 29; x += 5) rect(c, '#ffe6a8', x, 19, 1, 9);
    // Fluted crust rim
    for (let x = 2; x < 34; x += 3) {
      ball(c, ['#ffe6a8', '#ecbe6c', '#c88c40'], x + 1, 31, 2);
    }
    // Foil tin
    for (let y = 33; y <= 43; y++) {
      const half = Math.round(16 - ((y - 33) * 4) / 10);
      for (let x = -half; x < half; x++) {
        const rib = (x + 40) % 4 === 0;
        const t = (x + half) / (half * 2);
        const base = t > 0.8 ? '#7f8894' : t > 0.55 ? '#a4acb6' : t > 0.2 ? '#d4dae0' : '#b4bcc4';
        rect(c, rib ? '#8e96a2' : base, 18 + x, y);
      }
    }
    rect(c, '#f4f8fa', 2, 33, 32, 1);
  },
  // A crisp shell packed with fish, frilly lettuce, tomato and a drizzle of sauce
  taco: (c) => {
    // Lettuce frill
    for (let x = 2; x < 34; x += 3) {
      const peak = Math.round(18 - 7 * Math.sin(((x - 2) / 32) * Math.PI));
      ball(c, ['#b4ec78', '#7fd04e', '#4ea834', '#2f7f24'], x, peak + 3, 3);
    }
    // Fish and tomato
    rect(c, '#f8c88c', 10, 11, 14, 5);
    rect(c, '#fdecc8', 11, 11, 12, 2);
    rect(c, '#d89860', 13, 14, 8, 1);
    ball(c, ['#ff8a70', '#e8483c', '#b42c22'], 6, 16, 3);
    ball(c, ['#ff8a70', '#e8483c', '#b42c22'], 27, 13, 3);
    ball(c, ['#ff8a70', '#e8483c', '#b42c22'], 30, 19, 2);
    // Sauce
    for (let x = 7; x < 28; x++) rect(c, '#fbf6e8', x, 11 + (x % 6 < 3 ? 0 : 1), 1, 1);
    // Shell, curving over the filling
    for (let y = 16; y <= 43; y++) {
      const t = (y - 16) / 27;
      const half = Math.round(17 * Math.sqrt(1 - (1 - Math.min(1, t * 1.7)) ** 2));
      if (half < 1) continue;
      shaded(c, ['#fff0a0', '#f8d262', '#eeb83e', '#c88a24', '#a06c18'], 18 - half, y, half * 2, 1);
    }
    // The fold, toasted spots and a bright edge
    for (let i = 0; i < 26; i++) {
      const a = (i / 25) * Math.PI;
      rect(c, '#fff4b8', Math.round(18 - Math.cos(a) * 13), Math.round(30 - Math.sin(a) * 11), 1, 1);
    }
    [[9, 28, 2], [14, 34, 3], [22, 31, 2], [26, 37, 2], [18, 39, 2], [10, 38, 2], [24, 24, 2]].forEach(([x, y, l]) => {
      rect(c, '#b4781e', x, y, l, 1);
      rect(c, '#b4781e', x, y + 1, 1, 1);
    });
    rect(c, '#94601a', 3, 43, 30, 1);
  },
  // A tall glass of lemonade with ice, a striped straw and a lemon slice on the rim
  lemon: (c) => {
    // Straw
    for (let y = 2; y < 40; y++) rect(c, y % 4 < 2 ? '#ec4a62' : '#fdf3e0', 14 + Math.floor((40 - y) / 8), y, 2, 1);
    // Glass
    shaded(c, ['#ffffff', '#eaf6f6', '#cfe8ea', '#a8ccd4'], 6, 9, 24, 34);
    // Lemonade
    shaded(c, ['#fff6a8', '#fbe35c', '#f2c82e', '#d4a01c'], 8, 14, 20, 27);
    rect(c, '#fffbd0', 8, 14, 20, 2);
    // Ice cubes, half lost in the lemonade
    [[11, 16], [20, 20]].forEach(([x, y]) => {
      rect(c, '#fff6b8', x, y, 6, 5);
      rect(c, '#fffde8', x, y, 4, 1);
      rect(c, '#ecd466', x + 5, y + 1, 1, 4);
    });
    // Bubbles and condensation
    [[24, 18], [25, 27], [15, 25], [23, 36]].forEach(([x, y]) => rect(c, '#fffce0', x, y, 1, 1));
    [[7, 12], [28, 13], [29, 25], [7, 33]].forEach(([x, y]) => rect(c, '#ffffff', x, y, 1, 2));
    rect(c, '#ffffff', 10, 15, 2, 24);
    // Glass base
    rect(c, '#bcdce0', 6, 41, 24, 2);
    rect(c, '#ffffff', 8, 41, 8, 1);
    // Lemon slice
    ball(c, ['#ffe25c', '#f4c420', '#d49e14'], 29, 9, 6);
    ball(c, ['#fffbd8', '#fff6b0'], 29, 9, 4);
    rect(c, '#f4c420', 29, 5, 1, 8);
    rect(c, '#f4c420', 25, 9, 8, 1);
    [[27, 7], [31, 7], [27, 11], [31, 11]].forEach(([x, y]) => rect(c, '#f4c420', x, y, 1, 1));
  },
  // Rainbow snow in a striped paper cup, with a spoon stuck in the top
  shave: (c) => {
    // Spoon
    rect(c, '#b8c0c8', 28, 2, 2, 16);
    rect(c, '#eef2f4', 28, 2, 1, 16);
    ball(c, ['#ffffff', '#d4dade', '#a0a8b0'], 29, 3, 2);
    // Dome of snow
    for (let y = 4; y < 25; y++) {
      const half = Math.round(14 * Math.sqrt(Math.max(0, 1 - ((24 - y) / 20.5) ** 2)));
      for (let x = -half; x < half; x++) {
        const t = (x + half) / (half * 2);
        const band = t < 0.36 ? ['#ffb0cc', '#f47ca8', '#d85a8c'] : t < 0.66 ? ['#fff6b0', '#f8e070', '#e0c04c'] : ['#a8e4fa', '#62c6ee', '#3aa0d0'];
        rect(c, band[(x * 7 + y * 13) % 3 === 0 ? 0 : t > 0.86 ? 2 : 1], 18 + x, y);
      }
    }
    // Icy sparkle
    for (let i = 0; i < 26; i++) {
      const px = 7 + ((i * 17) % 22);
      const py = 7 + ((i * 11) % 16);
      rect(c, '#ffffff', px, py, 1, 1);
    }
    rect(c, '#fbfafc', 12, 8, 4, 2);
    // Rim and cup
    rect(c, '#fdf3e0', 2, 25, 32, 2);
    rect(c, '#c9b48c', 2, 27, 32, 1);
    for (let y = 28; y <= 43; y++) {
      const half = Math.round(15 - ((y - 28) * 4) / 15);
      for (let x = -half; x < half; x++) {
        const t = (x + half) / (half * 2);
        const stripe = Math.floor(t * 7) % 2 === 0;
        const level = t > 0.82 ? 2 : t > 0.6 ? 1 : 0;
        rect(c, stripe ? ['#ee5a4a', '#cc4034', '#982c24'][level] : ['#fdf6e6', '#e6dcc4', '#bcb098'][level], 18 + x, y);
      }
    }
    rect(c, 'rgba(255,255,255,0.6)', 8, 30, 1, 10);
  },
};

function drawProducts(scene: Phaser.Scene) {
  for (const [id, draw] of Object.entries(SNACK_ART)) {
    canvasTexture(scene, `item_${id}`, SNACK_W, SNACK_H, (c) => {
      draw(c);
      outline(c, SNACK_W, SNACK_H, SNACK_INK);
      outline(c, SNACK_W, SNACK_H, SNACK_INK);
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
