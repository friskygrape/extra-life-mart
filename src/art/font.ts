import Phaser from 'phaser';
import { FONT_FAMILY, MAIN_STYLE, TINY_STYLE, charAdvance, digitInset, fontPx, type TextStyle } from './fontMetrics';

export const FONT_KEY = 'text';
export const TINY_FONT_KEY = 'text_tiny';
/** Sizes to ask for: half of each font's own size, so its letters land on the canvas's finer grid. */
export const FONT_SIZE = 6;
export const TINY_FONT_SIZE = 4;

/** The canvas's letters are capitals, digits and punctuation, plus the check mark. Text is always shown in capitals. */
const CHARS = [...Array.from({ length: 0x40 }, (_, i) => String.fromCharCode(0x20 + i)), '✓'];
/** Letters can lean slightly past their width, so each gets a little room on either side. */
const PAD = 2;
/** Below this, a letter's soft edge is dropped, keeping the text as crisp as the rest of the art. */
const EDGE_ALPHA = 96;

/** Fetches the font, so it's ready to draw letters from. If it can't load, the text falls back to a plain font. */
export async function loadGameFont(): Promise<void> {
  const load = async (file: string, weight: number) => {
    const face = new FontFace(FONT_FAMILY, `url(${import.meta.env.BASE_URL}fonts/BalsamiqSans-${file}.woff2)`, { weight: String(weight) });
    document.fonts.add(await face.load());
  };
  // The game is still playable without it, so a failure here isn't an error.
  await Promise.allSettled([load('Bold', MAIN_STYLE.weight), load('Regular', TINY_STYLE.weight)]);
}

function buildFont(scene: Phaser.Scene, key: string, style: TextStyle, size: number) {
  const px = fontPx(style);
  const cellW = Math.ceil(px * 1.1) + PAD * 2;
  const texW = cellW * CHARS.length;
  const tex = scene.textures.createCanvas(key, texW, style.height)!;
  const ctx = tex.getContext();
  ctx.font = `${style.weight} ${px}px "${FONT_FAMILY}", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';

  const chars: Record<number, object> = {};
  CHARS.forEach((ch, i) => {
    const x = i * cellW;
    ctx.fillText(ch, x + PAD + digitInset(ch, style), style.baseline);
    chars[ch.charCodeAt(0)] = {
      x,
      y: 0,
      width: cellW,
      height: style.height,
      centerX: Math.floor(cellW / 2),
      centerY: Math.floor(style.height / 2),
      xOffset: -PAD,
      yOffset: 0,
      xAdvance: charAdvance(ch, style),
      data: {},
      kerning: {},
      u0: x / texW,
      v0: 0,
      u1: (x + cellW) / texW,
      v1: 1,
    };
  });

  const image = ctx.getImageData(0, 0, texW, style.height);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i] >= EDGE_ALPHA ? 255 : 0;
  ctx.putImageData(image, 0, 0);
  tex.refresh();

  scene.cache.bitmapFont.add(key, {
    data: { retroFont: true, font: key, size, lineHeight: style.lineHeight, chars },
    frame: null,
    texture: key,
  });
}

/** Builds the two white fonts; tint them for colour. */
export function createGameFont(scene: Phaser.Scene): void {
  buildFont(scene, FONT_KEY, MAIN_STYLE, FONT_SIZE * 2);
  buildFont(scene, TINY_FONT_KEY, TINY_STYLE, TINY_FONT_SIZE * 2);
}
