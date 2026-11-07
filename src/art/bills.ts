import Phaser from 'phaser';
import { L, TENDER_BILL_H, TENDER_BILL_W, drawerBillSize } from '../layout';

export const BILL_CENTS = [2000, 1000, 500, 100];

/** The user's bill art, smoothed to four times its size so it can be drawn sharp at any size. */
export const billSource = (cents: number) => `bill_src_${cents}`;

/** The drawer's bills, and the small ones on the counter. */
export const billKey = (cents: number, small = false) => `bill_${cents}${small ? '_small' : ''}`;

/** One bill, standing on end, drawn from the user's art at the screen's own resolution so it stays sharp. Its value reads sideways, as in their art. */
function drawBill(scene: Phaser.Scene, key: string, cents: number, wid: number, len: number) {
  const r = L.renderScale;
  const tex = scene.textures.createCanvas(key, Math.round(wid * r), Math.round(len * r))!;
  const c = tex.getContext();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.translate(0, tex.height);
  c.rotate(-Math.PI / 2);
  c.drawImage(scene.textures.get(billSource(cents)).getSourceImage() as HTMLImageElement, 0, 0, tex.height, tex.width);
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
