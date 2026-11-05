import Phaser from 'phaser';
import { TILE, type Tile } from '../data/map';
import type { CharDir } from '../art/textures';

export const MAP_X = 2;
export const MAP_Y = 20;

export const tileCentre = (t: Tile) => ({ x: MAP_X + t.x * TILE + TILE / 2, y: MAP_Y + t.y * TILE + TILE / 2 });

/** A character that moves tile by tile and animates as it goes. */
export class Walker {
  readonly sprite: Phaser.GameObjects.Image;
  private standing: Tile;
  private stepTarget: Tile | null = null;
  private path: Tile[] = [];
  private onArrive: (() => void) | null = null;
  private dir: CharDir = 'down';
  private walkTime = 0;

  constructor(scene: Phaser.Scene, texture: string, start: Tile, private readonly speed: number) {
    const pos = tileCentre(start);
    this.standing = { ...start };
    this.sprite = scene.add.image(pos.x, pos.y, texture, 'down0').setOrigin(0.5, 0.75);
    this.sprite.setDepth(pos.y);
  }

  /** The tile to plan new routes from: where this walker is, or is about to be. */
  get tile(): Tile {
    return this.stepTarget ?? this.standing;
  }

  get facing(): Tile {
    const { x, y } = this.tile;
    if (this.dir === 'up') return { x, y: y - 1 };
    if (this.dir === 'down') return { x, y: y + 1 };
    return { x: x + (this.sprite.flipX ? -1 : 1), y };
  }

  get moving(): boolean {
    return this.stepTarget !== null || this.path.length > 0;
  }

  /** Follow a route, finishing any step in progress first. */
  follow(path: Tile[], onArrive: (() => void) | null = null) {
    this.path = path.slice();
    this.onArrive = onArrive;
    if (!this.moving) this.arrive();
  }

  stop() {
    this.path = [];
    this.onArrive = null;
  }

  /** Keyboard movement: take a single step if not already mid-step. */
  stepTo(next: Tile, open: boolean) {
    this.path = [];
    this.onArrive = null;
    if (this.stepTarget) return;
    this.face(next);
    if (open) this.stepTarget = next;
  }

  faceTile(t: Tile) {
    this.face(t);
    this.showFrame(0);
  }

  update(dt: number) {
    if (!this.stepTarget && this.path.length > 0) {
      const next = this.path.shift()!;
      this.face(next);
      this.stepTarget = next;
    }
    if (!this.stepTarget) {
      this.walkTime = 0;
      this.showFrame(0);
      return;
    }
    const goal = tileCentre(this.stepTarget);
    const remaining = this.speed * dt;
    const dx = goal.x - this.sprite.x;
    const dy = goal.y - this.sprite.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= remaining) {
      this.sprite.setPosition(goal.x, goal.y);
      this.standing = this.stepTarget;
      this.stepTarget = null;
      if (this.path.length === 0) this.arrive();
    } else {
      this.sprite.x += Math.sign(dx) * remaining;
      this.sprite.y += Math.sign(dy) * remaining;
    }
    this.sprite.setDepth(this.sprite.y);
    this.walkTime += dt;
    this.showFrame(Math.floor(this.walkTime * 7) % 2 === 0 ? 1 : 2);
  }

  private arrive() {
    const done = this.onArrive;
    this.onArrive = null;
    done?.();
  }

  private face(t: Tile) {
    const dx = t.x - this.tile.x;
    const dy = t.y - this.tile.y;
    if (dx !== 0) {
      this.dir = 'side';
      this.sprite.setFlipX(dx < 0);
    } else if (dy !== 0) {
      this.dir = dy < 0 ? 'up' : 'down';
      this.sprite.setFlipX(false);
    }
  }

  private showFrame(step: number) {
    this.sprite.setFrame(`${this.dir}${step}`);
  }
}
