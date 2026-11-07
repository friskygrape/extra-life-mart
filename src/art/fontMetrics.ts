/**
 * How wide Balsamiq Sans Bold's letters are, per 1000 units of font size, taken from the font file.
 * Kept here so text can be measured without a browser, including in tests.
 */
const ADVANCE: Record<string, number> = {
  " ": 270,
  "!": 260,
  "\"": 435,
  "#": 643,
  "$": 659,
  "%": 944,
  "&": 663,
  "'": 224,
  "(": 359,
  ")": 346,
  "*": 467,
  "+": 755,
  ",": 222,
  "-": 409,
  ".": 220,
  "/": 478,
  "0": 623,
  "1": 421,
  "2": 599,
  "3": 584,
  "4": 589,
  "5": 577,
  "6": 606,
  "7": 552,
  "8": 601,
  "9": 586,
  ":": 240,
  ";": 225,
  "<": 755,
  "=": 755,
  ">": 755,
  "?": 498,
  "@": 922,
  "A": 611,
  "B": 705,
  "C": 710,
  "D": 696,
  "E": 650,
  "F": 604,
  "G": 735,
  "H": 740,
  "I": 341,
  "J": 543,
  "K": 680,
  "L": 576,
  "M": 862,
  "N": 751,
  "O": 732,
  "P": 626,
  "Q": 756,
  "R": 685,
  "S": 607,
  "T": 569,
  "U": 712,
  "V": 615,
  "W": 924,
  "X": 593,
  "Y": 588,
  "Z": 616,
  "[": 389,
  "\\": 478,
  "]": 344,
  "^": 527,
  "_": 568,
  "\u2713": 671,
};

export const FONT_FAMILY = 'Balsamiq Sans';
const CAP_RATIO = 0.715;
const DIGIT_ADVANCE = Math.max(...[...'0123456789'].map((d) => ADVANCE[d]));

/** A text size, measured on the canvas, which has twice the game's pixels. */
export interface TextStyle {
  /** Bold reads best at normal size. Small letters need the regular weight, or their gaps fill in. */
  weight: number;
  /** Height of a capital letter. */
  capPx: number;
  /** From the top of a line to the bottom of its capitals. */
  baseline: number;
  /** Room for one line, including anything that hangs below the capitals. */
  height: number;
  lineHeight: number;
  /** Extra space between letters. */
  tracking: number;
}

export const MAIN_STYLE: TextStyle = { weight: 700, capPx: 14, baseline: 15, height: 18, lineHeight: 20, tracking: 0 };
export const TINY_STYLE: TextStyle = { weight: 400, capPx: 10, baseline: 11, height: 13, lineHeight: 14, tracking: 1 };

export const fontPx = (style: TextStyle) => style.capPx / CAP_RATIO;

/** Canvas pixels from this letter to the next. All digits share one width, so counters don't jiggle as they change. */
export function charAdvance(ch: string, style: TextStyle): number {
  const units = /[0-9]/.test(ch) ? DIGIT_ADVANCE : ADVANCE[ch] ?? 0;
  return Math.round((units * fontPx(style)) / 1000) + style.tracking;
}

/** How far in a digit sits, to centre it in the shared digit width. */
export function digitInset(ch: string, style: TextStyle): number {
  return /[0-9]/.test(ch) ? Math.round((((DIGIT_ADVANCE - ADVANCE[ch]) / 2) * fontPx(style)) / 1000) : 0;
}

/** Width of text in game pixels. */
export function textWidth(text: string, style: TextStyle = MAIN_STYLE): number {
  return ([...text].reduce((sum, ch) => sum + charAdvance(ch, style), 0) - style.tracking) / 2;
}

export const tinyTextWidth = (text: string) => textWidth(text, TINY_STYLE);
