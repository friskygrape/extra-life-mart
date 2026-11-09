import Phaser from 'phaser';
import { L } from '../layout';
import { DECANTER_STATES, type DecanterState } from '../logic/appliances';

export { DECANTER_STATES, decanterState, type DecanterState } from '../logic/appliances';

/**
 * The user's coffee machine and decanter, cut from their art at its exact pixels.
 * Everything here is measured in the art's own pixels.
 */
export const COFFEE_ART = {
  machine: { key: 'coffee_machine', w: 143, h: 195 },
  /** The filter basket, where the filter and beans go and the coffee drips from. */
  basket: { x: 35, y: 50, w: 80, h: 35 },
  drip: { x: 73, from: 86, to: 97 },
  /** The red power switch on the left pillar. */
  power: { x: 12, y: 129, w: 10, h: 19 },
  /** Where the decanter stands, on the warming plate. */
  decanter: { x: 41, y: 89, w: 90, h: 73 },
  /** The decanter's spout, in its own pixels. */
  spout: { x: 1, y: 9 },
};

export const decanterKey = (state: DecanterState) => `coffee_decanter_${state}`;

/** The machine with its decanter, smoothed down to a small size, for the shelf bay and the celebration. */
export const smallCoffeeKey = (state: DecanterState, height: number) => `coffee_small_${state}_${height}`;

export function createSmallCoffee(scene: Phaser.Scene, height: number): void {
  const r = L.renderScale;
  const { machine, decanter } = COFFEE_ART;
  const s = height / machine.h;
  for (const state of DECANTER_STATES) {
    const key = smallCoffeeKey(state, height);
    if (scene.textures.exists(key)) continue;
    // Put the full-size picture together first, then shrink it in one smooth step.
    const full = document.createElement('canvas');
    full.width = machine.w;
    full.height = machine.h;
    const fc = full.getContext('2d')!;
    fc.drawImage(scene.textures.get(machine.key).getSourceImage() as HTMLImageElement, 0, 0);
    fc.drawImage(scene.textures.get(decanterKey(state)).getSourceImage() as HTMLImageElement, decanter.x, decanter.y);
    const tex = scene.textures.createCanvas(key, Math.round(machine.w * s * r), Math.round(machine.h * s * r))!;
    const c = tex.getContext();
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(full, 0, 0, tex.width, tex.height);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}

/** Shows the small machine at its game size, its texture holding one pixel per screen pixel. */
export function smallCoffeeImage(scene: Phaser.Scene, x: number, y: number, state: DecanterState, height: number) {
  createSmallCoffee(scene, height);
  return scene.add.image(x, y, smallCoffeeKey(state, height)).setOrigin(0).setScale(1 / L.renderScale);
}

/**
 * The coffee station from the user's mock-up: their counter with the beans jar, filters, cups and ice bin, and the
 * machine and warmer, all at the mock-up's own pixels. The decanter has been taken off the warmer, since it moves.
 * Positions are in the mock-up's pixels, from the top of this picture.
 */
export const STATION = {
  key: 'coffee_station',
  w: 1536,
  h: 1330,
  /** Rows above the counter's edge: only the top of the machine shows there, overlapping the counter. */
  overCounter: 54,
  power: { x: 420, y: 442, w: 24, h: 54 },
  basket: { x: 505, y: 170, w: 230 },
  drip: { x: 620, from: 272, to: 300 },
  /** The decanter's size, and where its bottom-left stands in the machine and on the warmer. */
  decanter: { h: 250, inMachine: { x: 516, y: 544 }, onWarmer: { x: 974, y: 570 } },
  beans: { x: 44, y: 162, w: 296, h: 500 },
  filters: { x: 50, y: 842, w: 430, h: 350 },
  hotCups: { x: 564, y: 732, w: 171, h: 400 },
  icedCups: { x: 750, y: 697, w: 190, h: 435 },
  ice: { x: 980, y: 732, w: 530, h: 460 },
  /** Where a cup stands to be filled and served: in front of the machine. */
  cup: { x: 615, y: 742, h: 230 },
  /** The wall above the warmer, clear for the close button and the hint. */
  wall: { x: 900, y: 62, w: 620, h: 175 },
};
export const ICE_ART = { key: 'coffee_ice', w: 140, h: 94 };

/** A copy of some art redrawn at a given size, smoothed, holding one pixel per screen pixel. */
export function scaledTexture(scene: Phaser.Scene, srcKey: string, w: number, h: number): string {
  const r = L.renderScale;
  const key = `${srcKey}_at_${Math.round(w * r)}x${Math.round(h * r)}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, Math.max(1, Math.round(w * r)), Math.max(1, Math.round(h * r)))!;
    const c = tex.getContext();
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(scene.textures.get(srcKey).getSourceImage() as HTMLImageElement, 0, 0, tex.width, tex.height);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  return key;
}
