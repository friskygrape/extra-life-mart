import { describe, expect, it } from 'vitest';
import { BOX_SIZE, getProduct, PRODUCTS, SHELF_CAPACITY } from '../src/data/products';
import { canAddToTable, isOrderComplete, requestLines } from '../src/logic/basket';
import { computeLayout, MIN_H, MIN_W } from '../src/layout';
import { clockLabel, lightingAt } from '../src/logic/clock';
import { checkCard, checkChange, completeSale } from '../src/logic/checkout';
import { buildRequest, IDLE_MAX_SECONDS, pickLook, shortenWhenIdle } from '../src/logic/customers';
import { applyBrokeSafeguard, dayProfit, endDay, STARTER_BOX } from '../src/logic/day';
import { anyShelfStocked, emptyShelf, returnItem, stockShelf, takeFromShelf } from '../src/logic/inventory';
import { buyLicence, buyShelfRow, lockedProducts, nextRowPrice } from '../src/logic/licences';
import { customerTender, DENOMINATIONS, formatCents, roundToNickel } from '../src/logic/money';
import { cartCost, deliverOrders, placeOrder } from '../src/logic/orders';
import { clearSave, loadGame, saveGame, type SaveStore } from '../src/logic/save';
import { newGame, type GameState } from '../src/logic/state';

const SHELF = 'shelf-0-0';
const SHELF2 = 'shelf-0-1';
const onShelf = (s: GameState, id: string) => s.shelves.find((shelf) => shelf.productId === id)?.qty ?? 0;

function memoryStore(): SaveStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** Replays fixed numbers in place of Math.random. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('money', () => {
  it('formats cents', () => {
    expect(formatCents(1999)).toBe('$19.99');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(-250)).toBe('-$2.50');
  });
  it('customers always tender more than the total', () => {
    for (const total of [1, 99, 100, 129, 500, 1000, 2000, 4276, 10000, 15996]) {
      for (const r of [0, 0.5, 0.99]) expect(customerTender(total, () => r)).toBeGreaterThan(total);
    }
  });
});

describe('no pennies', () => {
  it('rounds cash to the nearest 5 cents', () => {
    expect(roundToNickel(129)).toBe(130);
    expect(roundToNickel(149)).toBe(150);
    expect(roundToNickel(151)).toBe(150);
    expect(roundToNickel(152)).toBe(150);
    expect(roundToNickel(153)).toBe(155);
  });
  it('leaves amounts already on 5 cents alone, including whole dollars', () => {
    expect(roundToNickel(155)).toBe(155);
    expect(roundToNickel(200)).toBe(200);
    expect(roundToNickel(198)).toBe(200);
  });
  it('has a 50 cent coin and no penny', () => {
    expect(DENOMINATIONS).toContain(50);
    expect(DENOMINATIONS).not.toContain(1);
  });
  it('change on any cash sale can be made exactly with the money available', () => {
    for (let cents = 100; cents <= 3000; cents += 7) {
      const total = roundToNickel(cents);
      for (const r of [0, 0.5, 0.99]) {
        const tendered = customerTender(total, () => r);
        expect(tendered).toBeGreaterThan(total);
        let left = tendered - total;
        for (const d of DENOMINATIONS) left -= Math.floor(left / d) * d;
        expect(left).toBe(0);
      }
    }
  });
});

describe('checkout', () => {
  it('refuses short change and says how much is missing', () => {
    expect(checkChange(129, 200, 70)).toEqual({ status: 'short', missing: 1 });
  });
  it('accepts exact change', () => {
    expect(checkChange(129, 200, 71)).toEqual({ status: 'exact' });
  });
  it('accepts too much change and reports the extra', () => {
    expect(checkChange(129, 200, 171)).toEqual({ status: 'over', extra: 100 });
  });
  it('only accepts the exact amount on card', () => {
    expect(checkCard(1999, 1999)).toBe(true);
    expect(checkCard(1999, 1998)).toBe(false);
    expect(checkCard(1999, 2000)).toBe(false);
  });
  it('a sale adds the total and subtracts any overpayment', () => {
    const s = newGame();
    const before = s.balance;
    completeSale(s, 1000, 100);
    expect(s.balance).toBe(before + 900);
    expect(s.stats).toMatchObject({ revenue: 1000, overpaid: 100, customersServed: 1 });
  });
});

describe('orders', () => {
  it('charges now and delivers when unpacked', () => {
    const s = newGame();
    const cart = { chips: BOX_SIZE };
    expect(placeOrder(s, cart)).toBe(true);
    expect(s.balance).toBe(10000 - cartCost(cart));
    expect(s.stockroom.chips).toBe(12);
    expect(deliverOrders(s)).toBe(BOX_SIZE);
    expect(s.stockroom.chips).toBe(24);
    expect(s.pendingOrders).toEqual({});
  });
  it('refuses orders you cannot afford, and empty ones', () => {
    const s = newGame();
    s.balance = 100;
    expect(placeOrder(s, { chips: 10 })).toBe(false);
    expect(placeOrder(s, {})).toBe(false);
    expect(s.balance).toBe(100);
  });
});

describe('shelves', () => {
  it('moves stock from your stock', () => {
    const s = newGame();
    expect(stockShelf(s, SHELF, 'chips', 4)).toBe('ok');
    expect(s.stockroom.chips).toBe(8);
    expect(onShelf(s, 'chips')).toBe(4);
  });
  it('holds one product at a time until emptied', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 2);
    expect(stockShelf(s, SHELF, 'soda', 1)).toBe('shelf-taken');
    emptyShelf(s, SHELF);
    expect(s.stockroom.chips).toBe(12);
    expect(stockShelf(s, SHELF, 'soda', 1)).toBe('ok');
  });
  it('stops at capacity', () => {
    const s = newGame();
    s.stockroom.chips = 50;
    expect(stockShelf(s, SHELF, 'chips', 50)).toBe('ok');
    expect(onShelf(s, 'chips')).toBe(SHELF_CAPACITY);
    expect(stockShelf(s, SHELF, 'chips', 1)).toBe('shelf-full');
  });
  it('reports when there is nothing to stock', () => {
    expect(stockShelf(newGame(), SHELF, 'pie', 1)).toBe('none-in-stock');
  });
  it('knows whether you are ready to open', () => {
    const s = newGame();
    expect(anyShelfStocked(s)).toBe(false);
    stockShelf(s, SHELF, 'chips', 1);
    expect(anyShelfStocked(s)).toBe(true);
  });
  it('taking the last one frees the shelf', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 1);
    expect(takeFromShelf(s, SHELF, 'chips')).toBe(true);
    expect(takeFromShelf(s, SHELF, 'chips')).toBe(false);
    expect(s.shelves[0].productId).toBeNull();
  });
});

describe('putting items back', () => {
  it('goes back on the shelf holding that product', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 3);
    takeFromShelf(s, SHELF, 'chips');
    returnItem(s, 'chips');
    expect(onShelf(s, 'chips')).toBe(3);
  });
  it('uses an empty shelf if its own has run out', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 1);
    takeFromShelf(s, SHELF, 'chips');
    returnItem(s, 'chips');
    expect(onShelf(s, 'chips')).toBe(1);
  });
  it('goes back to stock when every shelf is taken', () => {
    const s = newGame();
    s.shelves.forEach((shelf) => Object.assign(shelf, { productId: 'soda', qty: 1 }));
    s.stockroom.chips = 0;
    returnItem(s, 'chips');
    expect(s.stockroom.chips).toBe(1);
  });
});

describe('what customers ask for', () => {
  it('only wants what is on the shelves, never more than there is', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 2);
    stockShelf(s, SHELF2, 'soda', 1);
    for (let i = 0; i < 200; i++) {
      const { wants } = buildRequest(s);
      expect(wants.length).toBeGreaterThanOrEqual(1);
      expect(wants.length).toBeLessThanOrEqual(3);
      expect(wants.filter((id) => id === 'chips').length).toBeLessThanOrEqual(2);
      expect(wants.filter((id) => id === 'soda').length).toBeLessThanOrEqual(1);
      expect(wants.every((id) => id === 'chips' || id === 'soda')).toBe(true);
    }
  });
  it('wishes for a licensed snack that is not stocked, which lowers what they buy', () => {
    const s = newGame();
    s.unlocked = ['chips', 'jerky'];
    stockShelf(s, SHELF, 'chips', 5);
    // Wants 3 items (0.5): jerky, chips, jerky.
    const { wants, wished } = buildRequest(s, sequence(0.5, 0.9, 0.1, 0.9));
    expect(wants).toEqual(['chips']);
    expect(wished).toEqual(['jerky', 'jerky']);
  });
  it('never mentions a snack you have no licence for', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 5);
    for (let i = 0; i < 200; i++) {
      const { wants, wished } = buildRequest(s);
      [...wants, ...wished].forEach((id) => expect(getProduct(id).licence).toBeUndefined());
    }
  });
  it('still buys something if they only went for unstocked snacks', () => {
    const s = newGame();
    s.unlocked = ['chips', 'jerky'];
    stockShelf(s, SHELF, 'chips', 5);
    const { wants, wished } = buildRequest(s, sequence(0, 0.9, 0));
    expect(wants).toEqual(['chips']);
    expect(wished).toEqual([]);
  });
  it('wants nothing when the shelves are bare', () => {
    const { wants, wished } = buildRequest(newGame());
    expect(wants).toEqual([]);
    expect(wished.length).toBeGreaterThan(0);
  });
});

describe('fetching items', () => {
  it('only lets you put out what was asked for, up to the amount', () => {
    expect(canAddToTable(['chips', 'chips'], ['chips'], 'chips')).toBe(true);
    expect(canAddToTable(['chips', 'chips'], ['chips', 'chips'], 'chips')).toBe(false);
    expect(canAddToTable(['chips'], [], 'soda')).toBe(false);
  });
  it('knows when the order is complete, in any order', () => {
    expect(isOrderComplete(['chips', 'soda'], ['soda'])).toBe(false);
    expect(isOrderComplete(['chips', 'soda'], ['soda', 'chips'])).toBe(true);
  });
  it('groups the request and marks finished lines', () => {
    expect(requestLines(['chips', 'chips', 'soda'], ['chips', 'soda'])).toEqual([
      { productId: 'chips', remaining: 1, done: false },
      { productId: 'soda', remaining: 0, done: true },
    ]);
  });
});

describe('day cycle', () => {
  it('profit is revenue minus overpayment and stock bought', () => {
    expect(dayProfit({ revenue: 1000, overpaid: 100, orderSpend: 300, upgradeSpend: 500, missedSales: 2, customersServed: 3 })).toBe(600);
  });
  it('ending a day summarizes and advances, and orders stay on their way', () => {
    const s = newGame();
    placeOrder(s, { chips: 10 });
    completeSale(s, 1000, 0);
    const { summary } = endDay(s);
    expect(summary).toMatchObject({ day: 1, revenue: 1000, profit: 200, newBest: true });
    expect(s.pendingOrders).toEqual({ chips: 10 });
    expect(s.day).toBe(2);
    expect(s.stats.revenue).toBe(0);
  });
  it('only flags a new best when it beats the old one', () => {
    const s = newGame();
    s.bestProfit = 1000;
    expect(endDay(s).summary.newBest).toBe(false);
    expect(s.bestProfit).toBe(1000);
  });
  it('a losing day is never a best day', () => {
    const s = newGame();
    placeOrder(s, { chips: 10 });
    expect(endDay(s).summary.newBest).toBe(false);
    expect(s.bestProfit).toBeNull();
  });
});

describe('broke safeguard', () => {
  const broke = () => {
    const s = newGame();
    s.stockroom = {};
    s.balance = 10;
    return s;
  };
  it('sends a starter box when completely stuck', () => {
    const s = broke();
    expect(applyBrokeSafeguard(s)).toBe(true);
    expect(s.stockroom).toEqual(STARTER_BOX);
  });
  it.each([
    ['money for the cheapest item', (s: GameState) => void (s.balance = 100)],
    ['stock left', (s: GameState) => void (s.stockroom.chips = 1)],
    ['an order on the way', (s: GameState) => void (s.pendingOrders.chips = 1)],
    ['stock on a shelf', (s: GameState) => void Object.assign(s.shelves[0], { productId: 'chips', qty: 1 })],
  ])('does nothing if you have %s', (_label, setup) => {
    const s = broke();
    setup(s);
    expect(applyBrokeSafeguard(s)).toBe(false);
  });
});

describe('save', () => {
  it('round-trips', () => {
    const store = memoryStore();
    const s = newGame();
    s.day = 7;
    saveGame(s, store);
    expect(loadGame(store)).toEqual(s);
    clearSave(store);
    expect(loadGame(store)).toBeNull();
  });
  it('ignores corrupt saves and other versions', () => {
    const store = memoryStore();
    store.setItem('extra-life-mart-save', '{nope');
    expect(loadGame(store)).toBeNull();
    saveGame({ ...newGame(), version: 999 }, store);
    expect(loadGame(store)).toBeNull();
  });
});

describe('licences', () => {
  it('starts with only the unlicensed snacks unlocked', () => {
    const s = newGame();
    expect(s.unlocked).toEqual(['chips', 'soda', 'choco', 'noodle']);
    expect(lockedProducts(s)[0].id).toBe('jerky');
  });
  it('charges for a licence and unlocks the snack', () => {
    const s = newGame();
    expect(buyLicence(s, 'jerky')).toBe(true);
    expect(s.balance).toBe(10000 - 4000);
    expect(s.unlocked).toContain('jerky');
    expect(s.stats.upgradeSpend).toBe(4000);
  });
  it('refuses licences you cannot afford or already own', () => {
    const s = newGame();
    expect(buyLicence(s, 'shave')).toBe(false);
    expect(buyLicence(s, 'chips')).toBe(false);
    expect(s.balance).toBe(10000);
  });
  it('a purchase does not count against the day profit', () => {
    const s = newGame();
    buyLicence(s, 'jerky');
    expect(dayProfit(s.stats)).toBe(0);
  });
  it('each licence earns more per sale than the one before, and more than any starter', () => {
    const margin = (id: string) => getProduct(id).retail - getProduct(id).wholesale;
    const starters = PRODUCTS.filter((p) => !p.licence).map((p) => margin(p.id));
    let previous = Math.max(...starters);
    for (const locked of lockedProducts(newGame())) {
      expect(margin(locked.id)).toBeGreaterThan(previous);
      previous = margin(locked.id);
    }
  });
});

describe('shelf rows', () => {
  it('starts with four shelves', () => {
    expect(newGame().shelves).toHaveLength(4);
  });
  it('buying a row adds four empty shelves and charges for it', () => {
    const s = newGame();
    const price = nextRowPrice(s)!;
    expect(buyShelfRow(s)).toBe(true);
    expect(s.shelves).toHaveLength(8);
    expect(s.balance).toBe(10000 - price);
    expect(s.rowsOwned).toBe(2);
    expect(s.stats.upgradeSpend).toBe(price);
  });
  it('refuses a row you cannot afford, and stops at three', () => {
    const s = newGame();
    s.balance = 100;
    expect(buyShelfRow(s)).toBe(false);
    s.balance = 1000000;
    buyShelfRow(s);
    buyShelfRow(s);
    expect(s.shelves).toHaveLength(12);
    expect(nextRowPrice(s)).toBeNull();
    expect(buyShelfRow(s)).toBe(false);
  });
});

describe('clock', () => {
  it('runs from 9 AM to 9 PM in 12-hour time', () => {
    expect(clockLabel(0)).toBe('9:00 AM');
    expect(clockLabel(0.25)).toBe('12:00 PM');
    expect(clockLabel(1 / 3 + 0.001)).toBe('1:00 PM');
    expect(clockLabel(1)).toBe('9:00 PM');
  });
  it('never shows 24-hour numbers', () => {
    for (let f = 0; f <= 1; f += 0.01) expect(clockLabel(f)).toMatch(/^([1-9]|1[0-2]):[0-5]0 (AM|PM)$/);
  });
});

describe('lighting', () => {
  it('stays bright until 6 PM', () => {
    expect(lightingAt(0)).toEqual({ dusk: 0, night: 0 });
    expect(lightingAt(0.75)).toEqual({ dusk: 0, night: 0 });
  });
  it('reaches dusk at 7:30 PM and full night by 9 PM', () => {
    expect(lightingAt(0.875)).toEqual({ dusk: 1, night: 0 });
    expect(lightingAt(1)).toEqual({ dusk: 1, night: 1 });
  });
  it('only ever gets darker through the evening', () => {
    let last = 0;
    for (let f = 0.75; f <= 1; f += 0.01) {
      const { dusk, night } = lightingAt(f);
      expect(dusk + night).toBeGreaterThanOrEqual(last);
      last = dusk + night;
    }
  });
});

describe('customer gaps', () => {
  it('brings the next customer soon when nobody is around', () => {
    expect(shortenWhenIdle(20, true)).toBe(IDLE_MAX_SECONDS);
    expect(shortenWhenIdle(1, true)).toBe(1);
  });
  it('leaves the timing alone when someone is being served', () => {
    expect(shortenWhenIdle(20, false)).toBe(20);
  });
});

describe('layout', () => {
  const devices = [
    ['S25 Ultra, full screen', 412, 915, 3.5],
    ['S25 Ultra, with browser bars', 412, 785, 3.5],
    ['small iPhone', 375, 667, 2],
    ['iPhone 13', 390, 844, 3],
    ['Pixel', 412, 915, 2.625],
    ['foldable', 673, 841, 2.625],
    ['iPad', 768, 1024, 2],
  ] as const;

  it.each(devices)('%s fills the screen in whole pixels', (_name, width, height, dpr) => {
    const l = computeLayout({ width, height, dpr });
    const scale = l.zoom * dpr;
    expect(scale).toBe(Math.round(scale));
    expect(l.W).toBeGreaterThanOrEqual(MIN_W);
    expect(l.H).toBeGreaterThanOrEqual(MIN_H);
    expect(l.H * l.zoom).toBeGreaterThanOrEqual(Math.min(height, 640 * l.zoom) - l.zoom);
  });
  it('fits a tall phone edge to edge', () => {
    const l = computeLayout({ width: 412, height: 785, dpr: 3.5 });
    expect(l.W * l.zoom).toBeGreaterThanOrEqual(412);
    expect(l.H * l.zoom).toBeGreaterThanOrEqual(785);
  });
  it('stacks everything down the screen with nothing left over', () => {
    for (const [, width, height, dpr] of devices) {
      const l = computeLayout({ width, height, dpr, safeBottom: 20 });
      expect(l.counterTop).toBe(l.windowY + l.windowH);
      expect(l.shelfTop).toBe(l.counterBottom + 1);
      expect(l.stripTop).toBe(l.shelfTop + l.rowH * 3);
      expect(l.stripTop + l.stripH).toBe(l.H);
    }
  });
  it('never makes the window smaller than a customer', () => {
    for (const [, width, height, dpr] of devices) {
      const l = computeLayout({ width, height, dpr });
      expect(l.windowH).toBeGreaterThanOrEqual(113);
      expect(l.windowW).toBeGreaterThanOrEqual(141);
    }
  });
  it('keeps a portrait shop on wide screens', () => {
    const l = computeLayout({ width: 1280, height: 800, dpr: 1 });
    expect(l.W).toBeLessThanOrEqual(300);
    expect(l.W).toBeLessThan(l.H);
  });
  it('scales the minimum layout down on tiny screens', () => {
    const l = computeLayout({ width: 200, height: 300, dpr: 1 });
    expect(l.W).toBe(MIN_W);
    expect(l.H).toBe(MIN_H);
    expect(l.zoom).toBeLessThan(1);
  });
  it('keeps controls clear of a notch and gesture bar', () => {
    const plain = computeLayout({ width: 390, height: 844, dpr: 3 });
    const safe = computeLayout({ width: 390, height: 844, dpr: 3, safeTop: 47, safeBottom: 34 });
    expect(safe.hudH).toBeGreaterThan(plain.hudH);
    expect(safe.stripH).toBeGreaterThan(plain.stripH);
  });
});

describe('boxes and margins', () => {
  it('a box fills exactly one shelf', () => {
    expect(BOX_SIZE).toBe(SHELF_CAPACITY);
    expect(BOX_SIZE).toBe(12);
  });
  it('a new game starts with a box of each starter snack', () => {
    Object.values(newGame().stockroom).forEach((qty) => expect(qty).toBe(BOX_SIZE));
  });
  it('every snack earns about 50% more than before', () => {
    const before: Record<string, number> = { chips: 69, soda: 59, choco: 79, noodle: 99, jerky: 169, icepop: 199, popcorn: 229, coconut: 269, pie: 319, taco: 379, lemon: 449, shave: 529 };
    for (const p of PRODUCTS) {
      const ratio = (p.retail - p.wholesale) / before[p.id];
      expect(ratio).toBeGreaterThanOrEqual(1.45);
      expect(ratio).toBeLessThanOrEqual(1.6);
    }
  });
});

describe('the line', () => {
  it('never picks a character already in view when one is free', () => {
    for (let i = 0; i < 200; i++) expect([3, 5, 7]).not.toContain(pickLook([3, 5, 7], 12));
  });
  it('still picks someone if every character is taken', () => {
    expect(pickLook([0, 1], 2)).toBeLessThan(2);
  });
});
