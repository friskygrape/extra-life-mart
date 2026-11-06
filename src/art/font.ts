import Phaser from 'phaser';
import { TINY_GLYPHS } from './tinyGlyphs';

export { TINY_GLYPHS };

export const GLYPHS: Record<string, string> = {
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '#####|...#.|..#..|...#.|....#|#...#|.###.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
  $: '..#..|.####|#.#..|.###.|..#.#|####.|..#..',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  ',': '.....|.....|.....|.....|.##..|..#..|.#...',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....',
  '-': '.....|.....|.....|.###.|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  "'": '.##..|..#..|.#...|.....|.....|.....|.....',
  '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.',
  ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.',
  '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
  '\u2713': '.....|....#|...##|#.##.|###..|.#...|.....',
};

export const FONT_KEY = 'pixel';
export const TINY_FONT_KEY = 'pixel_tiny';
/** Sizes to ask for: Phaser measures these against a font's cell width, so half of it lands on the fine grid. */
export const FONT_SIZE = 6;
export const TINY_FONT_SIZE = 4;
export const CHAR_W = 6;
export const CHAR_H = 8;

/** Everything is drawn at twice the game's pixels, so text can have the mock-up's finer shapes. */
const FINE_SCALE = 2;
const MAIN_CELL = { w: CHAR_W * FINE_SCALE, h: CHAR_H * FINE_SCALE };
const SMALL_CELL = { w: 8, h: 12 };
/** A plain zero for small text, and one with a centre dot for large text, in place of the table's slashed one. */
const PLAIN_ZERO = '.###.|#...#|#...#|#...#|#...#|#...#|.###.';
const DOTTED_ZERO = '.###.|#...#|#...#|#.#.#|#...#|#...#|.###.';

type Raster = (ctx: CanvasRenderingContext2D, ox: number, glyph: string) => void;

/** Traces a glyph's 5x7 skeleton with a pen of the given width, then softens its outer corners. */
function tracer(mapX: (x: number) => number, mapY: (y: number) => number, pen: number, soften: boolean): Raster {
  return (ctx, ox, glyph) => {
    const on = new Set<string>();
    glyph.split('|').forEach((row, y) => [...row].forEach((px, x) => {
      if (px !== '#') return;
      for (let dy = 0; dy < pen; dy++) for (let dx = 0; dx < pen; dx++) on.add(`${mapX(x) + dx},${mapY(y) + dy}`);
    }));
    const has = (x: number, y: number) => on.has(`${x},${y}`);
    for (const key of on) {
      const [x, y] = key.split(',').map(Number);
      const corner = (!has(x - 1, y) || !has(x + 1, y)) && (!has(x, y - 1) || !has(x, y + 1))
        && [has(x - 1, y), has(x + 1, y), has(x, y - 1), has(x, y + 1)].filter(Boolean).length === 2;
      if (!(soften && corner)) ctx.fillRect(ox + x, y, 1, 1);
    }
  };
}

function buildFont(scene: Phaser.Scene, key: string, cell: { w: number; h: number }, raster: Raster, zero: string, lineSpacing: number) {
  const chars = Object.keys(GLYPHS).join('');
  const tex = scene.textures.createCanvas(key, chars.length * cell.w, cell.h)!;
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  [...chars].forEach((ch, i) => raster(ctx, i * cell.w, ch === '0' ? zero : GLYPHS[ch]));
  tex.refresh();
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: key,
    width: cell.w,
    height: cell.h,
    chars,
    charsPerRow: chars.length,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing,
  });
  scene.cache.bitmapFont.add(key, data);
  return data;
}

/** Builds the two white fonts; tint them for colour. */
export function createPixelFont(scene: Phaser.Scene): void {
  buildFont(scene, FONT_KEY, MAIN_CELL, tracer((x) => x * 2, (y) => y * 2, 3, true), DOTTED_ZERO, 4);
  const small = buildFont(scene, TINY_FONT_KEY, SMALL_CELL, tracer((x) => [0, 1, 3, 4, 5][x], (y) => [0, 1, 3, 4, 5, 7, 8][y], 2, false), PLAIN_ZERO, 2);
  // A narrow word space helps long names fit one line. Phaser's types don't cover this field.
  const font = small as unknown as { data: { chars: Record<number, { xAdvance: number }> } };
  font.data.chars[' '.charCodeAt(0)].xAdvance = 4;
}
