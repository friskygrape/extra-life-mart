import Phaser from 'phaser';
import { L, TENDER_BILL_H, TENDER_BILL_W, drawerBillSize } from '../layout';
import { FONT_FAMILY } from './fontMetrics';

/** Each bill's colours, from the user's bill art: paper, its shade, the engraving and the outline. */
const PALETTES: Record<number, { paper: string; tint: string; ink: string; edge: string }> = {
  100: { paper: '#a8b8a4', tint: '#899b88', ink: '#3c5146', edge: '#24342b' },
  500: { paper: '#adbbbc', tint: '#8e9ea4', ink: '#455966', edge: '#26343e' },
  1000: { paper: '#aba1a9', tint: '#8f8392', ink: '#3b3242', edge: '#241d2a' },
  2000: { paper: '#8a9078', tint: '#727a66', ink: '#303933', edge: '#1b211c' },
};

export const BILL_CENTS = [2000, 1000, 500, 100];

/** The drawer's bills, and the small ones on the counter. */
export const billKey = (cents: number, small = false) => `bill_${cents}${small ? '_small' : ''}`;

/**
 * One bill, standing on end, drawn at the screen's own resolution so it stays sharp.
 * It's laid out lying down, `len` by `wid` game pixels, then turned to stand up, which leaves its value reading sideways.
 */
function drawBill(scene: Phaser.Scene, key: string, cents: number, wid: number, len: number) {
  const r = L.renderScale;
  const tex = scene.textures.createCanvas(key, Math.ceil(wid * r), Math.ceil(len * r))!;
  const c = tex.getContext();
  const p = PALETTES[cents];
  c.scale(r, r);
  c.translate(0, len);
  c.rotate(-Math.PI / 2);
  const u = wid / 36;
  const box = (colour: string, x: number, y: number, w: number, h: number, round: number) => {
    c.fillStyle = colour;
    c.beginPath();
    c.roundRect(x, y, w, h, round);
    c.fill();
  };
  const ring = (colour: string, x: number, y: number, radius: number, lineW: number) => {
    c.strokeStyle = colour;
    c.lineWidth = lineW;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.stroke();
  };

  // Paper with a dark edge, a pale margin, then an engraved frame
  box(p.edge, 0, 0, len, wid, 1.5 * u);
  box(p.paper, 0.8 * u, 0.8 * u, len - 1.6 * u, wid - 1.6 * u, u);
  c.strokeStyle = p.ink;
  c.lineWidth = 0.9 * u;
  c.strokeRect(3.2 * u, 3.2 * u, len - 6.4 * u, wid - 6.4 * u);
  box(p.tint, 4.4 * u, 4.4 * u, len - 8.8 * u, wid - 8.8 * u, 0.5 * u);
  c.lineWidth = 0.5 * u;
  c.strokeRect(5.6 * u, 5.6 * u, len - 11.2 * u, wid - 11.2 * u);

  const cx = len / 2;
  const cy = wid / 2;
  // A rosette on either side of the middle
  [len * 0.24, len * 0.76].forEach((x) => {
    c.fillStyle = p.paper;
    c.beginPath();
    c.arc(x, cy, 5.2 * u, 0, Math.PI * 2);
    c.fill();
    ring(p.ink, x, cy, 5.2 * u, 0.8 * u);
    ring(p.ink, x, cy, 3 * u, 0.6 * u);
    c.fillStyle = p.ink;
    c.beginPath();
    c.arc(x, cy, 1.2 * u, 0, Math.PI * 2);
    c.fill();
  });
  // Laurel strokes under the medallion
  c.strokeStyle = p.ink;
  c.lineWidth = 0.7 * u;
  [-1, 1].forEach((side) => {
    c.beginPath();
    c.arc(cx, cy + 2 * u, 12.5 * u, Math.PI / 2 + side * 0.35, Math.PI / 2 + side * 1.1, side < 0);
    c.stroke();
  });

  // The medallion in the middle, carrying the value
  c.fillStyle = p.paper;
  c.beginPath();
  c.arc(cx, cy, 10 * u, 0, Math.PI * 2);
  c.fill();
  ring(p.ink, cx, cy, 10 * u, 1.1 * u);
  ring(p.tint, cx, cy, 8.2 * u, 1.2 * u);

  const value = `$${cents / 100}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `700 ${(value.length > 2 ? 9 : 11) * u}px "${FONT_FAMILY}", sans-serif`;
  c.lineJoin = 'round';
  c.lineWidth = 1.6 * u;
  c.strokeStyle = p.edge;
  c.strokeText(value, cx, cy + 0.6 * u);
  c.fillStyle = '#f4f1e2';
  c.fillText(value, cx, cy + 0.6 * u);

  // The value in each corner, where there's room to read it
  if (u >= 0.7) {
    c.font = `700 ${4.6 * u}px "${FONT_FAMILY}", sans-serif`;
    c.fillStyle = p.ink;
    const n = String(cents / 100);
    const inset = 9 * u;
    [[inset, 8.6 * u], [len - inset, 8.6 * u], [inset, wid - 8.2 * u], [len - inset, wid - 8.2 * u]].forEach(([x, y]) => c.fillText(n, x, y));
  }
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Bills are drawn to fit where they're shown: one size for the drawer and one for the counter. */
export function createBills(scene: Phaser.Scene): void {
  const drawer = drawerBillSize();
  for (const cents of BILL_CENTS) {
    drawBill(scene, billKey(cents), cents, drawer.w, drawer.h);
    drawBill(scene, billKey(cents, true), cents, TENDER_BILL_W, TENDER_BILL_H);
  }
}

/** Shows a bill at its game size: its texture holds one pixel for each of the screen's. */
export function billImage(scene: Phaser.Scene, x: number, y: number, cents: number, small = false): Phaser.GameObjects.Image {
  return scene.add.image(x, y, billKey(cents, small)).setOrigin(0).setScale(1 / L.renderScale);
}
