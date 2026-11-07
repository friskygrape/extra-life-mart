/**
 * How wide Balsamiq Sans's letters are, per 1000 units of font size, taken from the font files.
 * Kept here so text can be measured without a browser, including in tests.
 */
const REGULAR: Record<string, number> = {
  " ": 270,
  "!": 209,
  "\"": 373,
  "#": 643,
  "$": 711,
  "%": 944,
  "&": 663,
  "'": 224,
  "(": 360,
  ")": 371,
  "*": 467,
  "+": 664,
  ",": 182,
  "-": 366,
  ".": 195,
  "/": 452,
  "0": 588,
  "1": 387,
  "2": 590,
  "3": 615,
  "4": 610,
  "5": 573,
  "6": 611,
  "7": 491,
  "8": 583,
  "9": 578,
  ":": 202,
  ";": 206,
  "<": 664,
  "=": 664,
  ">": 664,
  "?": 507,
  "@": 922,
  "A": 611,
  "B": 685,
  "C": 711,
  "D": 729,
  "E": 659,
  "F": 596,
  "G": 750,
  "H": 731,
  "I": 310,
  "J": 540,
  "K": 645,
  "L": 575,
  "M": 863,
  "N": 752,
  "O": 762,
  "P": 629,
  "Q": 778,
  "R": 711,
  "S": 605,
  "T": 601,
  "U": 732,
  "V": 618,
  "W": 911,
  "X": 566,
  "Y": 584,
  "Z": 613,
  "[": 375,
  "\\": 424,
  "]": 342,
  "^": 527,
  "_": 618,
  "\u2713": 852,
};

const BOLD: Record<string, number> = {
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
const REGULAR_WEIGHT = 400;
const BOLD_WEIGHT = 700;
const widestDigit = (advances: Record<string, number>) => Math.max(...[...'0123456789'].map((d) => advances[d]));

/** A text size, in game pixels. */
export interface TextStyle {
  /** Regular for most text, and bold for titles and names. */
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

export const MAIN_STYLE: TextStyle = { weight: REGULAR_WEIGHT, capPx: 7, baseline: 7.5, height: 9, lineHeight: 10, tracking: 0 };
export const TITLE_STYLE: TextStyle = { ...MAIN_STYLE, weight: BOLD_WEIGHT };
export const TINY_STYLE: TextStyle = { weight: REGULAR_WEIGHT, capPx: 5, baseline: 5.5, height: 6.5, lineHeight: 7, tracking: 0.5 };
export const AMOUNT_STYLE: TextStyle = { weight: REGULAR_WEIGHT, capPx: 10, baseline: 10.7, height: 13, lineHeight: 14, tracking: 0 };
export const BIG_STYLE: TextStyle = { weight: REGULAR_WEIGHT, capPx: 14, baseline: 15, height: 18, lineHeight: 20, tracking: 0 };
export const BIG_TITLE_STYLE: TextStyle = { ...BIG_STYLE, weight: BOLD_WEIGHT };

const advancesFor = (style: TextStyle) => (style.weight === BOLD_WEIGHT ? BOLD : REGULAR);

export const fontPx = (style: TextStyle) => style.capPx / CAP_RATIO;

/** Game pixels from this letter to the next. All digits share one width, so counters don't jiggle as they change. */
export function charAdvance(ch: string, style: TextStyle): number {
  const advances = advancesFor(style);
  const units = /[0-9]/.test(ch) ? widestDigit(advances) : advances[ch] ?? 0;
  return (units * fontPx(style)) / 1000 + style.tracking;
}

/** How far in a digit sits, in game pixels, to centre it in the shared digit width. */
export function digitInset(ch: string, style: TextStyle): number {
  const advances = advancesFor(style);
  return /[0-9]/.test(ch) ? (((widestDigit(advances) - advances[ch]) / 2) * fontPx(style)) / 1000 : 0;
}

/** Width of text in game pixels. */
export function textWidth(text: string, style: TextStyle = MAIN_STYLE): number {
  return [...text].reduce((sum, ch) => sum + charAdvance(ch, style), 0) - style.tracking;
}

export const tinyTextWidth = (text: string) => textWidth(text, TINY_STYLE);
