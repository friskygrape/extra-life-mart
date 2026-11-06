import Phaser from 'phaser';
import { TINY_GLYPHS, tinyAdvance } from './tinyGlyphs';

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
const TINY_CHAR_W = 6;
const TINY_CHAR_H = 6;
export const CHAR_W = 6;
export const CHAR_H = 8;

/** Builds the white 3x5 font, with a narrow word space so long names fit one line. */
function createTinyFont(scene: Phaser.Scene): void {
  const chars = Object.keys(TINY_GLYPHS).join('');
  const tex = scene.textures.createCanvas(TINY_FONT_KEY, chars.length * TINY_CHAR_W, TINY_CHAR_H)!;
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  [...chars].forEach((ch, i) => {
    TINY_GLYPHS[ch].split('|').forEach((row, y) => {
      [...row].forEach((px, x) => {
        if (px === '#') ctx.fillRect(i * TINY_CHAR_W + x, y, 1, 1);
      });
    });
  });
  tex.refresh();
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: TINY_FONT_KEY,
    width: TINY_CHAR_W,
    height: TINY_CHAR_H,
    chars,
    charsPerRow: chars.length,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 1,
  });
  // The parsed font is fixed-width, so give each letter its own width. Phaser's types don't cover these fields.
  const font = data as unknown as { data: { chars: Record<number, { width: number; u0: number; u1: number; xAdvance: number }> } };
  for (const ch of chars) {
    const glyph = font.data.chars[ch.charCodeAt(0)];
    const width = Math.max(1, tinyAdvance(ch) - 1);
    glyph.u1 = glyph.u0 + ((glyph.u1 - glyph.u0) * width) / TINY_CHAR_W;
    glyph.width = width;
    glyph.xAdvance = tinyAdvance(ch);
  }
  scene.cache.bitmapFont.add(TINY_FONT_KEY, data);
}

/** Builds a white 5x7 bitmap font from the glyph table; tint it for colour. */
export function createPixelFont(scene: Phaser.Scene): void {
  const chars = Object.keys(GLYPHS).join('');
  const tex = scene.textures.createCanvas(FONT_KEY, chars.length * CHAR_W, CHAR_H)!;
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  [...chars].forEach((ch, i) => {
    GLYPHS[ch].split('|').forEach((row, y) => {
      [...row].forEach((px, x) => {
        if (px === '#') ctx.fillRect(i * CHAR_W + x, y, 1, 1);
      });
    });
  });
  tex.refresh();
  scene.cache.bitmapFont.add(
    FONT_KEY,
    Phaser.GameObjects.RetroFont.Parse(scene, {
      image: FONT_KEY,
      width: CHAR_W,
      height: CHAR_H,
      chars,
      charsPerRow: chars.length,
      'offset.x': 0,
      'offset.y': 0,
      'spacing.x': 0,
      'spacing.y': 0,
      lineSpacing: 2,
    }),
  );
  createTinyFont(scene);
}
