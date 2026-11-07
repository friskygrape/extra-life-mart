import Phaser from 'phaser';
import { L } from '../layout';
import { AMOUNT_STYLE, BIG_STYLE, BIG_TITLE_STYLE, FONT_FAMILY, MAIN_STYLE, TINY_STYLE, TITLE_STYLE, charAdvance, digitInset, fontPx, type TextStyle } from './fontMetrics';

export const FONT_KEY = 'text';
export const TINY_FONT_KEY = 'text_tiny';
export const AMOUNT_FONT_KEY = 'text_amount';
export const BIG_FONT_KEY = 'text_big';
export const TITLE_FONT_KEY = 'text_title';
export const BIG_TITLE_FONT_KEY = 'text_big_title';
/** The size to ask for. Each font's real size comes from its style. */
export const TEXT_SIZE = 1;

/** The fonts hold capitals, digits and punctuation, plus the check mark. Text is always shown in capitals. */
const CHARS = [...Array.from({ length: 0x40 }, (_, i) => String.fromCharCode(0x20 + i)), '✓'];
/** Letters can lean slightly past their width, so each gets a little room on either side. */
const PAD = 2;
const COLUMNS = 13;
/** Empty space between letters on the sheet, so one can't bleed into another. */
const GAP = 4;

/** Fetches the font, so it's ready to draw letters from. If it can't load, the text falls back to a plain font. */
export async function loadGameFont(): Promise<void> {
  const load = async (file: string, weight: number) => {
    const face = new FontFace(FONT_FAMILY, `url(${import.meta.env.BASE_URL}fonts/BalsamiqSans-${file}.woff2)`, { weight: String(weight) });
    document.fonts.add(await face.load());
  };
  // The game is still playable without it, so a failure here isn't an error.
  await Promise.allSettled([load('Bold', TITLE_STYLE.weight), load('Regular', MAIN_STYLE.weight)]);
}

/** Draws a font's letters at the screen's own resolution, keeping their smooth edges. */
function buildFont(scene: Phaser.Scene, key: string, style: TextStyle, size: number) {
  const scale = L.renderScale;
  const px = fontPx(style) * scale;
  const cellW = Math.ceil(px * 1.1) + PAD * 2;
  const cellH = Math.ceil(style.height * scale);
  const rows = Math.ceil(CHARS.length / COLUMNS);
  const texW = (cellW + GAP) * COLUMNS;
  const texH = (cellH + GAP) * rows;
  const tex = scene.textures.createCanvas(key, texW, texH)!;
  const ctx = tex.getContext();
  ctx.font = `${style.weight} ${px}px "${FONT_FAMILY}", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';

  const chars: Record<number, object> = {};
  CHARS.forEach((ch, i) => {
    const x = (i % COLUMNS) * (cellW + GAP);
    const y = Math.floor(i / COLUMNS) * (cellH + GAP);
    // Anything hanging past its cell is cut off, or it would show on the letter next to it.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cellW, cellH);
    ctx.clip();
    ctx.fillText(ch, x + PAD + digitInset(ch, style) * scale, y + style.baseline * scale);
    ctx.restore();
    chars[ch.charCodeAt(0)] = {
      x,
      y,
      width: cellW,
      height: cellH,
      centerX: Math.floor(cellW / 2),
      centerY: Math.floor(cellH / 2),
      xOffset: -PAD,
      yOffset: 0,
      xAdvance: charAdvance(ch, style) * scale,
      data: {},
      kerning: {},
      u0: x / texW,
      v0: y / texH,
      u1: (x + cellW) / texW,
      v1: (y + cellH) / texH,
    };
  });
  tex.refresh();
  // The art stays blocky, but text should stay smooth if it's ever shown off the pixel grid, such as mid-animation.
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);

  scene.cache.bitmapFont.add(key, {
    // Shown at the requested size, each canvas pixel of a letter lands on exactly one pixel of the screen.
    data: { retroFont: true, font: key, size: size * scale, lineHeight: style.lineHeight * scale, chars },
    frame: null,
    texture: key,
  });
}

/** Builds the white fonts; tint them for colour. */
export function createGameFont(scene: Phaser.Scene): void {
  buildFont(scene, FONT_KEY, MAIN_STYLE, TEXT_SIZE);
  buildFont(scene, TINY_FONT_KEY, TINY_STYLE, TEXT_SIZE);
  buildFont(scene, AMOUNT_FONT_KEY, AMOUNT_STYLE, TEXT_SIZE);
  buildFont(scene, BIG_FONT_KEY, BIG_STYLE, TEXT_SIZE);
  buildFont(scene, TITLE_FONT_KEY, TITLE_STYLE, TEXT_SIZE);
  buildFont(scene, BIG_TITLE_FONT_KEY, BIG_TITLE_STYLE, TEXT_SIZE);
}
