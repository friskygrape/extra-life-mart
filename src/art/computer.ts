import Phaser from 'phaser';
import { L } from '../layout';

/**
 * The shop computer, redrawn in code from the user's art: a beige CRT showing a desktop with a MANAGE STORE
 * window, on a stand, with a keyboard, a coiled cable and a mouse.
 *
 * Everything is measured in the art's own pixels (252 × 208) and scaled to fit, so the proportions match it.
 * The parts are separate layers, all the same size and stacked at the same corner, so each can be animated:
 * the body, the desktop on the screen, the window, the power light, and the window's words, which are real text.
 */
const ART_W = 252;
const ART_H = 208;
/** Wide enough for the window to hold MANAGE in the small font. */
const W = 110;
const S = W / ART_W;
const H = Math.round(ART_H * S);
const g = (v: number) => v * S;

export const COMPUTER_KEYS = {
  body: 'computer_body',
  desktop: 'computer_desktop',
  window: 'computer_window',
  led: 'computer_led',
} as const;

/** Where the computer's parts sit, in game pixels from its top-left corner. */
export const COMPUTER = {
  w: W,
  h: H,
  monitorCentreX: g(119.5),
  screen: { x: g(64), y: g(25), w: g(111), h: g(81) },
  window: { x: g(86), y: g(35), w: g(81), h: g(54) },
  /** The words in the window, centred on x, with y at the top of the line. */
  words: [
    { text: 'MANAGE', x: g(126.5), y: g(48) - 1 },
    { text: 'STORE', x: g(126.5), y: g(66) - 1 },
  ],
  wordColour: 0x64d082,
  led: { x: g(165), y: g(117), w: g(6), h: g(2) },
};

// Colours sampled from the user's art
const INK = '#060227';
const SHELL = '#b9a571';
const SHELL_LIGHT = '#dcbe89';
const SHELL_EDGE = '#cdb47e';
const SHELL_SHADE = '#a8916a';
const SHELL_DARK = '#a3835d';
const RECESS_SIDE = '#918062';
const RECESS_TOP = '#6d594b';
const RECESS_BOTTOM = '#c3ab78';
const KEY = '#bba57a';
const KEY_TOP = '#d4bd8e';
const KEY_SHADE = '#94805f';
const MOD = '#595247';
const MOD_TOP = '#6e6555';
const MOD_SHADE = '#3d383b';
const GAP = '#231d3c';

type Pt = [number, number];

/** Draws in the art's pixels, snapped to the texture's own pixels so edges stay crisp. */
class Painter {
  constructor(readonly c: CanvasRenderingContext2D, readonly k: number) {}
  private r(v: number) {
    return Math.round(v * this.k);
  }
  rect(x: number, y: number, w: number, h: number, colour: string | CanvasGradient) {
    this.c.fillStyle = colour;
    this.c.fillRect(this.r(x), this.r(y), Math.max(1, this.r(x + w) - this.r(x)), Math.max(1, this.r(y + h) - this.r(y)));
  }
  poly(points: Pt[], colour: string | CanvasGradient) {
    this.c.fillStyle = colour;
    this.c.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? this.c.moveTo(this.r(x), this.r(y)) : this.c.lineTo(this.r(x), this.r(y))));
    this.c.closePath();
    this.c.fill();
  }
  roundPath(x: number, y: number, w: number, h: number, radius: number) {
    this.c.beginPath();
    this.c.roundRect(this.r(x), this.r(y), this.r(x + w) - this.r(x), this.r(y + h) - this.r(y), radius * this.k);
  }
  round(x: number, y: number, w: number, h: number, radius: number, colour: string | CanvasGradient) {
    this.c.fillStyle = colour;
    this.roundPath(x, y, w, h, radius);
    this.c.fill();
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, colour: string | CanvasGradient, stroke = 0) {
    this.c.beginPath();
    this.c.ellipse(cx * this.k, cy * this.k, rx * this.k, ry * this.k, 0, 0, Math.PI * 2);
    if (stroke) {
      this.c.strokeStyle = colour;
      this.c.lineWidth = stroke * this.k;
      this.c.stroke();
    } else {
      this.c.fillStyle = colour;
      this.c.fill();
    }
  }
  /** A smooth line through the points. */
  curve(points: Pt[], colour: string, width: number) {
    const c = this.c;
    c.strokeStyle = colour;
    c.lineWidth = width * this.k;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(points[0][0] * this.k, points[0][1] * this.k);
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i][0] + points[i + 1][0]) / 2;
      const my = (points[i][1] + points[i + 1][1]) / 2;
      c.quadraticCurveTo(points[i][0] * this.k, points[i][1] * this.k, mx * this.k, my * this.k);
    }
    const last = points[points.length - 1];
    c.lineTo(last[0] * this.k, last[1] * this.k);
    c.stroke();
  }
  vgrad(y0: number, y1: number, stops: [number, string][]): CanvasGradient {
    const grad = this.c.createLinearGradient(0, y0 * this.k, 0, y1 * this.k);
    stops.forEach(([at, colour]) => grad.addColorStop(at, colour));
    return grad;
  }
  hgrad(x0: number, x1: number, stops: [number, string][]): CanvasGradient {
    const grad = this.c.createLinearGradient(x0 * this.k, 0, x1 * this.k, 0);
    stops.forEach(([at, colour]) => grad.addColorStop(at, colour));
    return grad;
  }
}

function layer(scene: Phaser.Scene, key: string, draw: (p: Painter) => void) {
  const r = L.renderScale;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.ceil(W * r), Math.ceil(H * r))!;
  const c = tex.getContext();
  draw(new Painter(c, S * r));
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

// ---- Body ------------------------------------------------------------------

function drawCables(p: Painter) {
  // The mouse cord, from behind the monitor round to the mouse
  p.curve([[176, 127], [196, 130], [214, 137], [229, 147], [232, 160], [230, 178]], INK, 2.2);
  p.curve([[176, 127], [196, 130], [214, 137], [229, 147], [232, 160], [230, 178]], '#3a3346', 0.9);

  // The coiled keyboard cable, looping down from the stand to the keyboard's corner
  const path: Pt[] = [[78, 133], [70, 135], [68, 142], [62, 147], [50, 149], [38, 150], [26, 151], [18, 155], [16, 160]];
  p.curve(path, INK, 7.5);
  p.curve(path, '#2a2433', 5.5);
  // Rings along the path
  const pts: Pt[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 2.4));
    for (let s = 0; s < steps; s++) pts.push([ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps]);
  }
  const c = p.c;
  pts.forEach(([x, y], i) => {
    const [nx, ny] = pts[Math.min(pts.length - 1, i + 1)];
    const angle = Math.atan2(ny - y, nx - x);
    c.save();
    c.translate(x * p.k, y * p.k);
    c.rotate(angle);
    c.beginPath();
    c.ellipse(0, 0, 1 * p.k, 2.6 * p.k, 0, -Math.PI / 2, Math.PI / 2);
    c.strokeStyle = i % 2 === 0 ? '#7a6b5c' : '#5f544c';
    c.lineWidth = 0.9 * p.k;
    c.stroke();
    c.restore();
  });
}

function drawMonitor(p: Painter) {
  // Underside and stand, behind the shell
  p.round(61, 121, 118, 11, 2, INK);
  p.rect(62, 124, 116, 7, p.vgrad(124, 131, [[0, '#353339'], [0.3, '#524341'], [0.6, '#6c5a4c'], [1, '#6c5a4c']]));
  p.poly([[83, 129], [157, 129], [161, 147], [79, 147]], INK);
  p.poly([[84, 130], [156, 130], [158, 141], [82, 141]], p.vgrad(130, 141, [[0, '#5c4f47'], [0.4, '#67594d'], [1, '#695749']]));
  p.ellipse(120, 131, 29, 6, '#3c303c', 0.9);
  p.rect(81, 141, 79, 1.2, '#b39d79');
  p.rect(81, 142.2, 79, 3.8, '#735e4b');

  // Shell
  p.round(47, 1, 145, 124, 6, INK);
  p.round(48, 2, 143, 122, 5, SHELL);
  // The top face, set back, with a bright edge where it meets the front
  p.poly([[56, 2], [183, 2], [190.5, 9.5], [48.5, 9.5]], '#bba672');
  p.rect(49, 9.5, 141, 2.2, SHELL_LIGHT);
  // Light down the left side, shade down the right and along the bottom
  p.rect(48, 11.5, 1.6, 110, SHELL_EDGE);
  p.rect(188.8, 11.5, 2.2, 110, SHELL_SHADE);
  p.rect(50, 121.5, 139, 2.5, SHELL_DARK);

  // The recessed bezel round the screen
  p.poly([[62, 20], [178, 20], [181, 23], [181, 108], [178, 111], [62, 111], [59, 108], [59, 23]], RECESS_SIDE);
  p.rect(61, 20, 118, 4.5, p.vgrad(20, 24.5, [[0, '#7d6849'], [1, RECESS_TOP]]));
  p.poly([[61, 106], [179, 106], [181, 108], [178, 111], [62, 111], [59, 108]], RECESS_BOTTOM);
  p.rect(62, 109.5, 116, 1.4, '#e0bc92');
  p.poly([[59, 23], [62, 20], [64, 20], [61, 23]], SHELL_LIGHT);
  p.poly([[181, 23], [178, 20], [176, 20], [179, 23]], '#cdb27f');
  // The screen's dark rim
  p.round(63, 24, 114, 84, 3.5, INK);

  // Power light housing; the light itself is its own layer
  p.rect(163.5, 115.5, 9, 4.5, '#86715b');
  p.rect(164.5, 116.5, 7, 2.5, '#6c6a46');
}

/** One key: its face, a bright top edge and a shaded front. */
function key(p: Painter, x: number, y: number, w: number, h: number, dark: boolean) {
  p.rect(x, y, w, h, dark ? MOD : KEY);
  p.rect(x, y, w, 0.8, dark ? MOD_TOP : KEY_TOP);
  p.rect(x, y + h - 1, w, 1, dark ? MOD_SHADE : KEY_SHADE);
}

/** A row of keys spread across a span, some of them dark. */
function keyRow(p: Painter, x0: number, x1: number, y: number, h: number, widths: number[], darks: Set<number>) {
  const total = widths.reduce((a, b) => a + b, 0);
  const unit = (x1 - x0) / total;
  let x = x0;
  widths.forEach((w, i) => {
    key(p, x + 0.4, y, w * unit - 0.8, h, darks.has(i));
    x += w * unit;
  });
}

function drawKeyboard(p: Painter) {
  // Case
  p.poly([[11.5, 158.5], [201.5, 158.5], [208.5, 199], [208.5, 207], [8.5, 207], [8.5, 199]], INK);
  p.poly([[12.5, 159.5], [200.5, 159.5], [207, 199], [10, 199]], p.vgrad(159.5, 199, [[0, '#ab956e'], [1, '#a68f67']]));
  p.rect(12.5, 159.5, 188, 1.2, '#c4ad80');
  p.rect(9.5, 199, 198, 3, '#a99268');
  p.rect(9.5, 202, 198, 4, '#857057');

  // Function row
  p.rect(13, 162.5, 10.5, 7, GAP);
  key(p, 13.6, 163, 9.3, 5.6, true);
  for (const [x0, x1] of [[30, 63], [65.5, 98.5], [101.5, 134.5], [136.5, 160]] as const) {
    p.rect(x0 - 0.6, 162.5, x1 - x0 + 1.2, 7, GAP);
    keyRow(p, x0, x1, 163, 5.6, x0 === 136.5 ? [1, 1, 1] : [1, 1, 1, 1], new Set([0, 1, 2, 3]));
  }
  // Status lights
  p.rect(165, 163.5, 34, 3.2, '#9c8664');
  p.rect(168, 164.3, 4, 1.6, '#55a02c');
  p.rect(178, 164.3, 4, 1.6, '#2d2f3d');
  p.rect(188, 164.3, 4, 1.6, '#343a4c');

  // Main block: five rows, with the dark keys at either end
  const top = 170.5;
  const rowH = 4.6;
  p.rect(12.4, top - 0.6, 122.2, rowH * 5 + 1.2, GAP);
  const rows: { widths: number[]; darks: number[] }[] = [
    { widths: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], darks: [13] },
    { widths: [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5], darks: [0, 13] },
    { widths: [1.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.2], darks: [0, 12] },
    { widths: [2.3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.7], darks: [0, 11] },
    { widths: [1.5, 1.2, 1.5, 7, 1.5, 1.2, 1.5], darks: [0, 1, 2, 4, 5, 6] },
  ];
  rows.forEach((row, i) => keyRow(p, 12.8, 134.2, top + i * rowH, rowH - 0.6, row.widths, new Set(row.darks)));

  // Editing keys and arrows
  p.rect(136, top - 0.6, 24.6, rowH * 2 + 1.2, GAP);
  keyRow(p, 136.4, 160.2, top, rowH - 0.6, [1, 1, 1], new Set([0, 1, 2]));
  keyRow(p, 136.4, 160.2, top + rowH, rowH - 0.6, [1, 1, 1], new Set([0, 1, 2]));
  p.rect(144, top + rowH * 3 - 0.6, 8.6, rowH + 1.2, GAP);
  key(p, 144.4, top + rowH * 3, 7.8, rowH - 0.6, true);
  p.rect(136, top + rowH * 4 - 0.6, 24.6, rowH + 1.2, GAP);
  keyRow(p, 136.4, 160.2, top + rowH * 4, rowH - 0.6, [1, 1, 1], new Set([0, 1, 2]));

  // Number pad, its tall keys down the right
  p.rect(164.6, top - 0.6, 36, rowH * 5 + 1.2, GAP);
  for (let i = 0; i < 5; i++) keyRow(p, 165, 191.4, top + i * rowH, rowH - 0.6, [1, 1, 1], new Set(i === 0 ? [0, 1, 2] : []));
  key(p, 191.8, top, 8.4, rowH - 0.6, true);
  key(p, 191.8, top + rowH, 8.4, rowH * 2 - 0.6, true);
  key(p, 191.8, top + rowH * 3, 8.4, rowH * 2 - 0.6, true);
}

function drawMouse(p: Painter) {
  // An egg-shaped body, narrower at the back, lit on top with a darker skirt along the front and right
  p.ellipse(233, 192, 18.5, 15.5, INK);
  p.ellipse(233, 192, 17.3, 14.3, '#84745b');
  p.ellipse(231.8, 189.5, 15.8, 12.2, p.hgrad(216, 248, [[0, '#a8916c'], [0.35, '#c6a977'], [0.6, '#ae976d'], [1, '#a38d67']]));
  p.curve([[219, 196], [231, 199.5], [245, 196]], '#cdad78', 0.9);
  // The buttons
  p.curve([[218.5, 187.5], [232, 184.5], [247.5, 184]], '#5a4c46', 0.8);
  p.curve([[232.5, 177.6], [232.5, 181], [232.5, 184.5]], '#5a4c46', 0.8);
}

// ---- Screen ----------------------------------------------------------------

function drawDesktop(p: Painter) {
  const c = p.c;
  c.save();
  p.roundPath(64.5, 25.5, 111, 81.5, 2.5);
  c.clip();
  // Teal glass, darker at the top and edges like a curved tube
  p.rect(64, 25, 112, 83, p.vgrad(25, 107, [[0, '#1b2932'], [0.07, '#21434d'], [0.2, '#3a575f'], [0.35, '#4b666b'], [0.75, '#46626a'], [0.88, '#3b5a60'], [1, '#2d4f5a']]));
  p.rect(64, 25, 112, 83, p.hgrad(64, 176, [[0, 'rgba(10,20,30,0.55)'], [0.06, 'rgba(10,20,30,0.15)'], [0.15, 'rgba(10,20,30,0)'], [0.85, 'rgba(10,20,30,0)'], [0.94, 'rgba(10,20,30,0.2)'], [1, 'rgba(10,20,30,0.6)']]));
  // Faint scan lines
  for (let y = 26; y < 107; y += 2) p.rect(64, y, 112, 0.5, 'rgba(0,0,0,0.07)');

  // Desktop icons: a computer and two folders
  p.rect(73, 32.5, 9, 7, '#979392');
  p.rect(74.2, 33.6, 6.6, 4.6, '#35797f');
  p.rect(74.2, 33.6, 6.6, 1.2, '#438789');
  p.rect(75.5, 39.5, 4, 1, '#697279');
  p.rect(72.5, 40.5, 10, 2, '#7c7e89');
  for (const y of [51, 68]) {
    p.rect(73, y, 4.5, 1.5, '#a09b7d');
    p.rect(73, y + 1.4, 10, 6.6, '#7f784a');
    p.rect(73, y + 1.4, 10, 1, '#a09b7d');
    p.rect(73, y + 7, 10, 1, '#615d3e');
  }

  // Taskbar with its start button and tray
  p.rect(64, 96, 112, 8, '#71757b');
  p.rect(64, 96, 112, 0.8, '#9a9ea4');
  p.rect(64, 103.2, 112, 1, '#4a4d55');
  p.rect(67.5, 97.2, 13.5, 5.6, '#4a4d55');
  p.rect(67.5, 97.2, 13, 5, '#9a9ea4');
  p.rect(68.2, 97.9, 12.3, 4.3, '#80848a');
  p.rect(68.8, 98.5, 1.3, 1.3, '#941f3a');
  p.rect(70.3, 98.5, 1.3, 1.3, '#3f8a3c');
  p.rect(68.8, 100, 1.3, 1.3, '#6c5699');
  p.rect(70.3, 100, 1.3, 1.3, '#c9a43a');
  p.rect(72.6, 99, 6.8, 1.6, '#132754');
  p.rect(82.5, 97.5, 0.8, 5, '#5a5d64');
  p.rect(160, 97.6, 14, 5, '#666a71');
  p.rect(160, 97.6, 14, 0.7, '#4a4d55');
  c.restore();
}

function drawWindow(p: Painter) {
  // Frame
  p.rect(86, 35, 81, 54.5, '#818490');
  p.rect(86.8, 35.8, 79.6, 53, '#62657a');
  // Title bar and its buttons
  p.rect(87, 36, 79.2, 4.6, p.hgrad(87, 166, [[0, '#444967'], [0.5, '#4b5674'], [1, '#4b5b7a']]));
  [154, 158, 162].forEach((x, i) => {
    p.rect(x, 36.6, 3.4, 3.2, '#8b8789');
    p.rect(x, 36.6, 3.4, 0.6, '#b0acab');
    p.rect(x, 39.2, 3.4, 0.6, '#5e5e66');
    if (i === 0) p.rect(x + 0.8, 38.4, 1.8, 0.6, '#2c2f3d');
    if (i === 1) p.rect(x + 0.8, 37.5, 1.8, 1.4, '#2c2f3d');
    if (i === 2) {
      p.rect(x + 0.8, 37.5, 1.8, 0.5, '#2c2f3d');
      p.rect(x + 0.8, 38.6, 1.8, 0.5, '#2c2f3d');
    }
  });
  p.rect(87, 40.6, 79.2, 0.6, '#666b77');
  // The dark pane the words sit on
  p.rect(87, 41.2, 79.2, 47.2, p.vgrad(41, 88, [[0, '#3d464f'], [0.3, '#35414a'], [1, '#2a363d']]));
  for (let y = 42; y < 88; y += 2) p.rect(87, y, 79.2, 0.5, 'rgba(0,0,0,0.08)');
  p.rect(87, 88, 79.2, 0.8, '#706f82');
}

function drawLed(p: Painter) {
  p.rect(164.5, 116.5, 7, 2.5, '#7fe05a');
  p.rect(164.5, 116.5, 7, 0.9, '#c4f59a');
}

/** Draws the computer's layers at the screen's own resolution. */
export function createComputer(scene: Phaser.Scene): void {
  layer(scene, COMPUTER_KEYS.body, (p) => {
    drawCables(p);
    drawMonitor(p);
    drawKeyboard(p);
    drawMouse(p);
  });
  layer(scene, COMPUTER_KEYS.desktop, drawDesktop);
  layer(scene, COMPUTER_KEYS.window, drawWindow);
  layer(scene, COMPUTER_KEYS.led, drawLed);
}

export interface ComputerParts {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  desktop: Phaser.GameObjects.Image;
  window: Phaser.GameObjects.Image;
  led: Phaser.GameObjects.Image;
  words: Phaser.GameObjects.BitmapText[];
}

/** Puts the computer together at (x, y), with each part kept so it can be animated. */
export function addComputer(scene: Phaser.Scene, x: number, y: number, makeWord: (x: number, y: number, text: string) => Phaser.GameObjects.BitmapText): ComputerParts {
  const image = (key: string) => scene.add.image(0, 0, key).setOrigin(0).setScale(1 / L.renderScale);
  const body = image(COMPUTER_KEYS.body);
  const desktop = image(COMPUTER_KEYS.desktop);
  const window = image(COMPUTER_KEYS.window);
  const led = image(COMPUTER_KEYS.led);
  const words = COMPUTER.words.map((w) => makeWord(w.x, w.y, w.text));
  const container = scene.add.container(x, y, [body, desktop, window, ...words, led]);
  return { container, body, desktop, window, led, words };
}
