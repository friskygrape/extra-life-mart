import Phaser from 'phaser';

/**
 * Placeholder art for the appliances and what they make, drawn in code until the user's art arrives.
 * The machines are drawn on Graphics in their own small units, scaled to fit wherever they're shown,
 * with their moving parts (the coffee, the jar's contents, the drips) left for the scenes to draw on top.
 */

type Ctx = CanvasRenderingContext2D;
const ITEM_W = 36;
const ITEM_H = 46;
const ITEM_INK = '#121216';

/** The colour of each smoothie and its fruit. */
export const SMOOTHIE_COLOURS: Record<string, { fill: number; light: number }> = {
  smoothie_mango: { fill: 0xffa62b, light: 0xffd27a },
  smoothie_pineapple: { fill: 0xf5d63a, light: 0xfff1a0 },
  smoothie_watermelon: { fill: 0xf2566a, light: 0xff9fab },
};
export const COFFEE_COLOUR = 0x4a2a16;

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function rect(c: Ctx, colour: string, x: number, y: number, w = 1, h = 1) {
  c.fillStyle = colour;
  c.fillRect(x, y, w, h);
}

function ball(c: Ctx, colours: string[], cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r + 0.3) continue;
      // Lit from the top left
      const shade = (x + y) / (r * 2) + d / (r * 3);
      const i = Math.max(0, Math.min(colours.length - 1, Math.floor((shade + 0.5) * colours.length * 0.8)));
      rect(c, colours[i], cx + x, cy + y);
    }
  }
}

/** A dark line round everything drawn, like the snacks have. */
function outline(c: Ctx) {
  const data = c.getImageData(0, 0, ITEM_W, ITEM_H).data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < ITEM_W && y < ITEM_H && data[(y * ITEM_W + x) * 4 + 3] > 0;
  for (let y = 0; y < ITEM_H; y++) {
    for (let x = 0; x < ITEM_W; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) rect(c, ITEM_INK, x, y);
    }
  }
}

/** A paper cup with a lid and a sleeve. */
function coffeeCup(c: Ctx) {
  // Steam
  for (const [x, y] of [[13, 2], [14, 4], [13, 6], [21, 1], [22, 3], [21, 5]]) rect(c, 'rgba(255,255,255,0.75)', x, y, 1, 2);
  // Lid
  rect(c, '#efeae0', 8, 9, 20, 2);
  rect(c, '#d8d0c2', 7, 11, 22, 3);
  rect(c, '#bdb4a4', 7, 13, 22, 1);
  // Cup, narrowing to the bottom
  for (let y = 14; y < 44; y++) {
    const inset = Math.floor((y - 14) / 6);
    rect(c, '#fbf8f2', 9 + inset, y, 18 - inset * 2, 1);
    rect(c, '#e2dccf', 25 - inset, y, 2, 1);
  }
  // Sleeve
  for (let y = 23; y < 34; y++) {
    const inset = Math.floor((y - 14) / 6);
    rect(c, '#9a6236', 9 + inset, y, 18 - inset * 2, 1);
  }
  rect(c, '#c48a52', 11, 24, 12, 1);
  rect(c, '#f4e3c4', 16, 27, 4, 4);
}

/** A clear cup of smoothie with a domed lid and a straw. */
function smoothieCup(c: Ctx, colour: { fill: number; light: number }) {
  // Straw
  for (let y = 1; y < 14; y++) rect(c, y % 4 < 2 ? '#3fae5a' : '#ffffff', 21 + Math.floor((14 - y) / 5), y, 2, 1);
  // Dome
  for (let y = 7; y < 14; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 49 - (14 - y) ** 2)) * 1.6);
    rect(c, 'rgba(225,245,250,0.85)', 18 - half, y, half * 2, 1);
  }
  rect(c, '#cfe6ec', 6, 13, 24, 2);
  // Cup and smoothie
  for (let y = 15; y < 44; y++) {
    const inset = Math.floor((y - 15) / 7);
    rect(c, hex(colour.fill), 8 + inset, y, 20 - inset * 2, 1);
  }
  for (let y = 16; y < 42; y++) rect(c, hex(colour.light), 10 + Math.floor((y - 15) / 7), y, 2, 1);
  rect(c, 'rgba(255,255,255,0.5)', 8, 15, 20, 1);
}

const ITEMS: Record<string, (c: Ctx) => void> = {
  coffee: coffeeCup,
  smoothie_mango: (c) => smoothieCup(c, SMOOTHIE_COLOURS.smoothie_mango),
  smoothie_pineapple: (c) => smoothieCup(c, SMOOTHIE_COLOURS.smoothie_pineapple),
  smoothie_watermelon: (c) => smoothieCup(c, SMOOTHIE_COLOURS.smoothie_watermelon),
  // A burlap sack of beans, tied at the top
  beans: (c) => {
    for (let y = 12; y < 44; y++) {
      const bulge = Math.round(Math.sin(((y - 12) / 32) * Math.PI) * 4);
      rect(c, '#c49a64', 7 - bulge, y, 22 + bulge * 2, 1);
      rect(c, '#a87c48', 25 + bulge, y, 4, 1);
    }
    for (let y = 14; y < 42; y += 3) rect(c, 'rgba(120,80,40,0.25)', 6, y, 24, 1);
    rect(c, '#7a5230', 12, 10, 12, 3);
    // Beans spilling over the top
    for (const [x, y] of [[11, 6], [16, 4], [21, 6], [14, 8], [19, 8]]) {
      rect(c, '#5a3418', x, y, 4, 3);
      rect(c, '#3a200e', x + 1, y + 1, 2, 1);
    }
    rect(c, '#f4e3c4', 13, 24, 10, 7);
    rect(c, '#5a3418', 15, 26, 6, 3);
  },
  mango: (c) => {
    ball(c, ['#ffe07a', '#ffb33a', '#f27a2a', '#c24e1e'], 18, 27, 13);
    rect(c, '#5a8a2a', 17, 10, 2, 5);
    for (let i = 0; i < 6; i++) rect(c, '#4caa3a', 19 + i, 9 - Math.floor(i / 2), 2, 2);
    rect(c, 'rgba(255,255,255,0.6)', 11, 19, 3, 2);
  },
  pineapple: (c) => {
    // Crown
    for (let i = 0; i < 8; i++) {
      rect(c, '#3f9a3a', 17 - Math.floor(i / 2), 2 + i, 2, 2);
      rect(c, '#57b84a', 18 + Math.floor(i / 2), 2 + i, 2, 2);
      rect(c, '#2f7a2c', 18, 1 + i, 1, 2);
    }
    // Body with its criss-cross skin
    for (let y = 12; y < 44; y++) {
      const half = Math.round(Math.sin(((y - 11) / 33) * Math.PI) * 11) + 1;
      for (let x = -half; x < half; x++) {
        const grid = ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0);
        rect(c, grid ? '#b8862a' : x < -2 ? '#ffe46a' : '#f2c53a', 18 + x, y);
      }
    }
  },
  watermelon: (c) => {
    // A thick slice: rind below, red flesh above, with seeds
    for (let y = 0; y < 24; y++) {
      const half = Math.round(Math.sqrt(Math.max(0, 24 * 24 - (24 - y) ** 2)) * 0.7);
      const row = 14 + y;
      if (y > 20) rect(c, '#2e8a3a', 18 - half, row, half * 2, 1);
      else if (y > 17) rect(c, '#bfe8a0', 18 - half, row, half * 2, 1);
      else rect(c, '#f2475a', 18 - half, row, half * 2, 1);
    }
    for (const [x, y] of [[12, 22], [18, 19], [24, 22], [15, 27], [21, 27]]) rect(c, '#1a1a1a', x, y, 2, 3);
    rect(c, 'rgba(255,255,255,0.4)', 10, 17, 8, 1);
  },
};

/** Item art for the drinks and ingredients, the same size as the snacks'. */
export function createDrinkTextures(scene: Phaser.Scene): void {
  for (const [id, draw] of Object.entries(ITEMS)) {
    const key = `item_${id}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, ITEM_W, ITEM_H)!;
    const c = tex.getContext();
    draw(c);
    outline(c);
    tex.refresh();
  }
}

// ---- The machines, drawn on Graphics -------------------------------------

const INK = 0x1b1d28;

/** The coffee machine is 36 × 44 units. Where its working parts are: */
export const COFFEE_MACHINE = {
  w: 36,
  h: 44,
  /** The glass carafe's inside, where the coffee shows. */
  carafe: { x: 6, y: 24, w: 13, h: 14 },
  /** Where the filter basket sits, and the coffee drips from. */
  basket: { x: 5, y: 12, w: 16, h: 4 },
  spout: { x: 12.5, y: 16 },
  button: { x: 27, y: 22, r: 3 },
};

/** Draws the coffee machine, its top-left at (x, y), each unit `s` game pixels. The coffee goes on top. */
export function drawCoffeeMachine(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, on = false) {
  const r = (fx: number, fy: number, w: number, h: number, colour: number, alpha = 1) => g.fillStyle(colour, alpha).fillRect(x + fx * s, y + fy * s, w * s, h * s);
  // Base and warming plate
  r(0, 40, 36, 4, INK);
  r(1, 40, 34, 3, 0x3a3f46);
  r(4, 38, 17, 2, 0x2a2d33);
  // Tower and hood
  r(21, 1, 15, 40, INK);
  r(22, 2, 13, 38, 0xd9534a);
  r(22, 2, 3, 38, 0xe8786e);
  r(32, 2, 3, 38, 0xb43e36);
  r(1, 1, 22, 12, INK);
  r(2, 2, 21, 10, 0xd9534a);
  r(2, 2, 21, 2, 0xe8786e);
  // Filter basket under the hood
  r(4, 12, 18, 5, INK);
  r(5, 12, 16, 4, 0x2a2d33);
  // ON button, lit while brewing
  const b = COFFEE_MACHINE.button;
  g.fillStyle(INK).fillCircle(x + b.x * s, y + b.y * s, (b.r + 1) * s);
  g.fillStyle(on ? 0x7fe05a : 0x5a6a52).fillCircle(x + b.x * s, y + b.y * s, b.r * s);
  // The carafe: glass with a handle
  const cf = COFFEE_MACHINE.carafe;
  r(cf.x - 1, cf.y - 2, cf.w + 2, cf.h + 3, INK);
  r(cf.x, cf.y - 1, cf.w, cf.h + 1, 0xd8eef3, 0.95);
  r(cf.x + cf.w + 1, cf.y + 2, 2, 8, INK);
  r(cf.x + cf.w + 2, cf.y + 3, 1, 6, 0x2a2d33);
  r(cf.x + 1, cf.y, 2, cf.h - 2, 0xffffff, 0.7);
}

/** The blender is 30 × 52 units. Where its jar is: */
export const BLENDER = {
  w: 30,
  h: 52,
  /** The jar's inside, where the fruit and smoothie show. */
  jar: { x: 6, y: 8, w: 18, h: 28 },
  button: { x: 15, y: 46, r: 3 },
};

/** Draws the blender, its top-left at (x, y), each unit `s` game pixels. The contents go on top, then `drawBlenderGlass`. */
export function drawBlender(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, on = false) {
  const r = (fx: number, fy: number, w: number, h: number, colour: number, alpha = 1) => g.fillStyle(colour, alpha).fillRect(x + fx * s, y + fy * s, w * s, h * s);
  // Base with its dial
  r(2, 38, 26, 14, INK);
  r(3, 39, 24, 12, 0x3b8f8a);
  r(3, 39, 24, 2, 0x5cb8b0);
  r(3, 49, 24, 2, 0x2a6a66);
  const b = BLENDER.button;
  g.fillStyle(INK).fillCircle(x + b.x * s, y + b.y * s, (b.r + 1) * s);
  g.fillStyle(on ? 0x7fe05a : 0xe8e4dc).fillCircle(x + b.x * s, y + b.y * s, b.r * s);
  // Collar and lid
  r(5, 35, 20, 4, INK);
  r(6, 36, 18, 2, 0x8a939a);
  r(6, 3, 18, 5, INK);
  r(7, 4, 16, 3, 0x2a2d33);
  r(13, 1, 4, 3, INK);
  // The empty jar
  const j = BLENDER.jar;
  r(j.x - 1, j.y, j.w + 2, j.h, INK);
  r(j.x, j.y, j.w, j.h - 1, 0xd8eef3, 0.9);
}

/** The jar's glass shine and blades, drawn over whatever's inside. */
export function drawBlenderGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number) {
  const r = (fx: number, fy: number, w: number, h: number, colour: number, alpha = 1) => g.fillStyle(colour, alpha).fillRect(x + fx * s, y + fy * s, w * s, h * s);
  const j = BLENDER.jar;
  r(j.x + 1, j.y + 1, 2, j.h - 3, 0xffffff, 0.6);
  r(j.x + 5, j.y + j.h - 3, 8, 1, 0x5a6a72);
  r(j.x + 8, j.y + j.h - 4, 2, 2, 0x5a6a72);
}
