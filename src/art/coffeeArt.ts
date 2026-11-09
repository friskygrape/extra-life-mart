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
