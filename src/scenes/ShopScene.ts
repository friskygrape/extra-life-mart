import Phaser from 'phaser';
import {
  ENTRANCE, MAP_H, MAP_W, MAP_ROWS, PLAYER_REGISTER_SPOT, PLAYER_START, QUEUE_SPOTS, REGISTER_TILE, SHELF_SPOTS, TILE,
  isWalkable, neighbours, tileAt, type Tile,
} from '../data/map';
import { getProduct } from '../data/products';
import { Customer } from '../entities/Customer';
import { ShelfView } from '../entities/ShelfView';
import { MAP_X, MAP_Y, Walker, tileCentre } from '../entities/Walker';
import { nextSpawnDelay } from '../logic/customers';
import { endDay } from '../logic/day';
import { findShelfWith, takeFromShelf } from '../logic/inventory';
import { formatCents } from '../logic/money';
import { findPath } from '../logic/pathfinding';
import { session } from '../session';
import { COLOURS, WIDTH, label } from '../ui';

const MAX_CUSTOMERS = 10;
const PLAYER_SPEED = 72;

const openForPlayer = (t: Tile) => isWalkable(t.x, t.y, false);
const openForCustomer = (t: Tile) => isWalkable(t.x, t.y, true);

const TILE_TEXTURES: Record<string, string> = {
  '#': 'wall', '.': 'floor', ',': 'floor2', D: 'door_inner', E: 'door_entrance',
  C: 'computer', S: 'crate', T: 'counter', R: 'register', F: 'floor', G: 'floor',
};

export class ShopScene extends Phaser.Scene {
  private player!: Walker;
  private shelves = new Map<string, ShelfView>();
  private customers: Customer[] = [];
  private queue: Customer[] = [];
  private spawnIn = 0;
  private marker!: Phaser.GameObjects.Image;
  private alert!: Phaser.GameObjects.BitmapText;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'e', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('Shop');
  }

  create() {
    MAP_ROWS.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const pos = tileCentre({ x, y });
        const isFurniture = 'CSTR'.includes(ch);
        this.add.image(pos.x, pos.y, TILE_TEXTURES[ch]).setDepth(isFurniture || ch === '#' ? pos.y + 8 : 0);
      });
    });
    for (const spot of SHELF_SPOTS) this.shelves.set(spot.id, new ShelfView(this, spot));

    this.player = new Walker(this, 'char_player', PLAYER_START, PLAYER_SPEED);
    this.marker = this.add.image(0, 0, 'marker').setDepth(1).setVisible(false);
    const reg = tileCentre(REGISTER_TILE);
    this.alert = label(this, reg.x, reg.y - 26, '!', COLOURS.gold, 'center').setScale(2).setDepth(1000).setVisible(false);
    this.tweens.add({ targets: this.alert, y: reg.y - 30, duration: 300, yoyo: true, repeat: -1 });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, e: K.E,
    }) as typeof this.keys;
    this.keys.e.on('down', () => this.useNearby());

    session.events.on('shelves-changed', this.refreshShelves, this);
    session.events.on('open-shop', this.openShop, this);
    session.events.on('begin-day', this.beginDay, this);

    this.scene.launch('Hud');
    this.beginDay();
  }

  private beginDay() {
    session.phase = 'morning';
    session.clock = 0;
    session.modal = false;
    this.refreshShelves();
  }

  private refreshShelves() {
    for (const shelf of session.state.shelves) this.shelves.get(shelf.id)?.refresh(shelf);
  }

  private openShop() {
    if (session.phase !== 'morning') return;
    session.phase = 'open';
    session.clock = 0;
    session.save();
    this.spawnIn = 1.5;
    session.toast("WE'RE OPEN!");
  }

  private onTap(pointer: Phaser.Input.Pointer) {
    if (session.modal || session.phase === 'summary') return;
    const x = Math.floor((pointer.worldX - MAP_X) / TILE);
    const y = Math.floor((pointer.worldY - MAP_Y) / TILE);
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    const target = { x, y };
    const ch = tileAt(x, y);

    if (ch === 'R' || ch === 'T') {
      this.walkAndDo([PLAYER_REGISTER_SPOT], target, () => this.useRegister());
    } else if (ch === 'F' || ch === 'G') {
      const spot = SHELF_SPOTS.find((s) => s.x === x && s.y === y)!;
      this.walkAndDo(neighbours(target), target, () => this.openShelf(spot.id));
    } else if (ch === 'C') {
      this.walkAndDo(neighbours(target), target, () => this.openOrdering());
    } else if (ch === 'S') {
      this.walkAndDo(neighbours(target), target, () => this.reportStock());
    } else if (openForPlayer(target)) {
      this.walkAndDo([target], target, null);
    }
  }

  private walkAndDo(goals: Tile[], lookAt: Tile, action: (() => void) | null) {
    const path = findPath(this.player.tile, goals, openForPlayer);
    if (!path) return;
    const pos = tileCentre(lookAt);
    this.marker.setPosition(pos.x, pos.y).setVisible(true).setAlpha(1).setDepth(action ? 1000 : 1);
    this.tweens.killTweensOf(this.marker);
    this.tweens.add({ targets: this.marker, alpha: 0, duration: 450, delay: 150 });
    this.player.follow(path, () => {
      if (!action) return;
      this.player.faceTile(lookAt);
      action();
    });
  }

  /** Keyboard "use": whichever object the player is facing, otherwise anything beside them. */
  private useNearby() {
    if (session.modal || session.phase === 'summary') return;
    const here = this.player.tile;
    for (const t of [this.player.facing, ...neighbours(here)]) {
      const ch = tileAt(t.x, t.y);
      if (ch === 'R') return this.useRegister();
      if (ch === 'C') return this.openOrdering();
      if (ch === 'S') return this.reportStock();
      if (ch === 'F' || ch === 'G') return this.openShelf(SHELF_SPOTS.find((s) => s.x === t.x && s.y === t.y)!.id);
    }
  }

  private openShelf(shelfId: string) {
    this.openModal('Stock', { shelfId });
  }

  private openOrdering() {
    this.openModal('Order');
  }

  private reportStock() {
    const total = Object.values(session.state.stockroom).reduce((sum, n) => sum + n, 0);
    session.toast(`${total} ITEMS IN THE BACK ROOM`);
  }

  private useRegister() {
    const front = this.queue[0];
    if (!front || !this.isAtFront(front)) {
      session.toast('NO ONE IN LINE');
      return;
    }
    this.openModal('Register', {
      items: front.items,
      onDone: (total: number) => this.finishSale(front, total),
    });
  }

  private openModal(scene: string, data?: object) {
    if (session.modal) return;
    session.modal = true;
    this.player.stop();
    this.scene.launch(scene, data);
  }

  private finishSale(customer: Customer, total: number) {
    this.queue.shift();
    const pos = customer.walker.sprite;
    this.floatText(pos.x, pos.y - 18, `+${formatCents(total)}`, COLOURS.green);
    this.leave(customer);
    this.queue.forEach((c, i) => this.sendToQueueSpot(c, i));
  }

  private isAtFront(c: Customer): boolean {
    const t = c.walker.tile;
    return !c.walker.moving && t.x === QUEUE_SPOTS[0].x && t.y === QUEUE_SPOTS[0].y;
  }

  private spawnCustomer() {
    const customer = new Customer(this);
    this.customers.push(customer);
    this.nextItem(customer);
  }

  /** Works through the wishlist one item at a time, looking at what's on the shelves right now. */
  private nextItem(c: Customer) {
    const productId = c.wishlist.shift();
    if (!productId) return this.finishShopping(c);

    const shelf = findShelfWith(session.state, productId);
    if (!shelf) {
      this.recordMissed(c, productId);
      this.time.delayedCall(500, () => this.nextItem(c));
      return;
    }
    const spot = SHELF_SPOTS.find((s) => s.id === shelf.id)!;
    const path = findPath(c.walker.tile, neighbours(spot), openForCustomer) ?? [];
    c.walker.follow(path, () => {
      c.walker.faceTile(spot);
      if (takeFromShelf(session.state, shelf.id, productId)) {
        c.items.push(productId);
        this.refreshShelves();
        this.showPickup(c, productId);
      } else {
        this.recordMissed(c, productId);
      }
      this.time.delayedCall(700, () => this.nextItem(c));
    });
  }

  private recordMissed(c: Customer, productId: string) {
    session.state.stats.missedSales += 1;
    const s = c.walker.sprite;
    this.floatText(s.x, s.y - 18, `NO ${getProduct(productId).name}`, COLOURS.red);
  }

  private showPickup(c: Customer, productId: string) {
    const s = c.walker.sprite;
    const icon = this.add.image(s.x, s.y - 16, `item_${productId}`).setDepth(1000);
    this.tweens.add({ targets: icon, y: icon.y - 8, alpha: 0, duration: 700, onComplete: () => icon.destroy() });
  }

  private floatText(x: number, y: number, text: string, color: number) {
    const halfWidth = (text.length * 6) / 2;
    const clampedX = Phaser.Math.Clamp(x, halfWidth, WIDTH - halfWidth);
    const t = label(this, clampedX, y, text, color, 'center').setDepth(1001);
    this.tweens.add({ targets: t, y: y - 10, alpha: 0, duration: 1100, delay: 300, onComplete: () => t.destroy() });
  }

  private finishShopping(c: Customer) {
    if (c.items.length === 0) return this.leave(c);
    c.stage = 'queueing';
    this.queue.push(c);
    this.sendToQueueSpot(c, this.queue.length - 1);
  }

  private sendToQueueSpot(c: Customer, index: number) {
    const spot = QUEUE_SPOTS[Math.min(index, QUEUE_SPOTS.length - 1)];
    const path = findPath(c.walker.tile, [spot], openForCustomer) ?? [];
    c.walker.follow(path, () => c.walker.faceTile(index === 0 ? REGISTER_TILE : QUEUE_SPOTS[index - 1]));
  }

  private leave(c: Customer) {
    c.stage = 'leaving';
    const path = findPath(c.walker.tile, [ENTRANCE], openForCustomer) ?? [];
    c.walker.follow(path, () => {
      c.walker.sprite.destroy();
      this.customers = this.customers.filter((other) => other !== c);
    });
  }

  private readKeyboard(): Tile | null {
    if (session.modal) return null;
    const k = this.keys;
    const { x, y } = this.player.tile;
    if (k.left.isDown || k.a.isDown) return { x: x - 1, y };
    if (k.right.isDown || k.d.isDown) return { x: x + 1, y };
    if (k.up.isDown || k.w.isDown) return { x, y: y - 1 };
    if (k.down.isDown || k.s.isDown) return { x, y: y + 1 };
    return null;
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 100) / 1000;

    if (session.phase !== 'summary') {
      const next = this.readKeyboard();
      if (next) this.player.stepTo(next, openForPlayer(next));
    }
    this.player.update(dt);
    for (const c of [...this.customers]) c.walker.update(dt);

    if (session.phase === 'open') {
      session.clock += dt;
      this.spawnIn -= dt;
      if (this.spawnIn <= 0 && this.customers.length < MAX_CUSTOMERS) {
        this.spawnCustomer();
        this.spawnIn = nextSpawnDelay(session.state.day);
      }
      if (session.clock >= session.dayLength) {
        session.phase = 'closing';
        session.toast('CLOSING TIME!');
      }
    } else if (session.phase === 'closing' && this.customers.length === 0 && !session.modal) {
      this.closeBooks();
    }

    session.queueReady = this.queue.length > 0 && this.isAtFront(this.queue[0]) ? this.queue.length : 0;
    this.alert.setVisible(session.queueReady > 0 && !session.modal);
  }

  private closeBooks() {
    session.phase = 'summary';
    const events = endDay(session.state);
    session.save();
    session.modal = true;
    this.scene.launch('Summary', events);
  }
}
