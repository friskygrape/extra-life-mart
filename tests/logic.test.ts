import { describe, expect, it } from 'vitest';
import { SHELF_SLOTS } from '../src/data/shelves';
import { getProduct, SHELF_CAPACITY } from '../src/data/products';
import { checkHandOver, requestLines } from '../src/logic/basket';
import { checkCard, checkChange, completeSale } from '../src/logic/checkout';
import { buildWishlist } from '../src/logic/customers';
import { applyBrokeSafeguard, dayProfit, endDay, STARTER_BOX } from '../src/logic/day';
import { emptyShelf, findShelfWith, returnItem, stockShelf, takeFromShelf } from '../src/logic/inventory';
import { customerTender, formatCents } from '../src/logic/money';
import { cartCost, deliverOrders, placeOrder } from '../src/logic/orders';
import { clearSave, loadGame, saveGame, type SaveStore } from '../src/logic/save';
import { newGame } from '../src/logic/state';

const foodShelf = () => SHELF_SLOTS.find((s) => s.kind === 'food')!.id;
const gameShelf = () => SHELF_SLOTS.find((s) => s.kind === 'game')!.id;

function memoryStore(): SaveStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

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
  it('charges now and delivers later', () => {
    const s = newGame();
    const cart = { jerky: 2 };
    expect(placeOrder(s, cart)).toBe(true);
    expect(s.balance).toBe(20000 - cartCost(cart));
    expect(s.stockroom.jerky).toBeUndefined();
    expect(deliverOrders(s)).toBe(2);
    expect(s.stockroom.jerky).toBe(2);
    expect(s.pendingOrders).toEqual({});
  });
  it('refuses orders you cannot afford, and empty ones', () => {
    const s = newGame();
    s.balance = 100;
    expect(placeOrder(s, { cave: 1 })).toBe(false);
    expect(placeOrder(s, {})).toBe(false);
    expect(s.balance).toBe(100);
  });
});

describe('shelves', () => {
  it('moves stock from the stockroom', () => {
    const s = newGame();
    expect(stockShelf(s, foodShelf(), 'chips', 4)).toBe('ok');
    expect(s.stockroom.chips).toBe(6);
    expect(findShelfWith(s, 'chips')?.qty).toBe(4);
  });
  it('keeps food and games on their own shelves', () => {
    const s = newGame();
    expect(stockShelf(s, gameShelf(), 'chips', 1)).toBe('wrong-kind');
    expect(stockShelf(s, foodShelf(), 'golf', 1)).toBe('wrong-kind');
  });
  it('holds one product at a time until emptied', () => {
    const s = newGame();
    stockShelf(s, foodShelf(), 'chips', 2);
    expect(stockShelf(s, foodShelf(), 'soda', 1)).toBe('shelf-taken');
    emptyShelf(s, foodShelf());
    expect(s.stockroom.chips).toBe(10);
    expect(stockShelf(s, foodShelf(), 'soda', 1)).toBe('ok');
  });
  it('stops at capacity', () => {
    const s = newGame();
    s.stockroom.chips = 50;
    expect(stockShelf(s, foodShelf(), 'chips', 50)).toBe('ok');
    expect(findShelfWith(s, 'chips')?.qty).toBe(SHELF_CAPACITY.food);
    expect(stockShelf(s, foodShelf(), 'chips', 1)).toBe('shelf-full');
  });
  it('reports when there is nothing to stock', () => {
    expect(stockShelf(newGame(), foodShelf(), 'pie', 1)).toBe('none-in-stock');
  });
  it('customers take one at a time and an emptied shelf frees up', () => {
    const s = newGame();
    stockShelf(s, foodShelf(), 'chips', 1);
    expect(takeFromShelf(s, foodShelf(), 'chips')).toBe(true);
    expect(takeFromShelf(s, foodShelf(), 'chips')).toBe(false);
    expect(findShelfWith(s, 'chips')).toBeNull();
  });
});

describe('day cycle', () => {
  it('profit is revenue minus overpayment and stock bought', () => {
    expect(dayProfit({ revenue: 1000, overpaid: 100, orderSpend: 300, missedSales: 2, customersServed: 3 })).toBe(600);
  });
  it('ending a day summarizes, delivers and advances', () => {
    const s = newGame();
    placeOrder(s, { jerky: 1 });
    completeSale(s, 500, 0);
    const { summary, delivered } = endDay(s);
    expect(summary).toMatchObject({ day: 1, revenue: 500, profit: 500 - 130, newBest: true });
    expect(delivered).toBe(1);
    expect(s.day).toBe(2);
    expect(s.stats.revenue).toBe(0);
  });
  it('only flags a new best when it beats the old one', () => {
    const s = newGame();
    s.bestProfit = 1000;
    expect(endDay(s).summary.newBest).toBe(false);
    expect(s.bestProfit).toBe(1000);
  });
});

describe('best day', () => {
  it('a losing day is never a best day', () => {
    const s = newGame();
    placeOrder(s, { jerky: 1 });
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
    ['money for the cheapest item', (s: ReturnType<typeof newGame>) => void (s.balance = 50)],
    ['stock in the stockroom', (s: ReturnType<typeof newGame>) => void (s.stockroom.chips = 1)],
    ['an order on the way', (s: ReturnType<typeof newGame>) => void (s.pendingOrders.chips = 1)],
    ['stock on a shelf', (s: ReturnType<typeof newGame>) => void Object.assign(s.shelves[0], { productId: 'chips', qty: 1 })],
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

describe('wishlists', () => {
  it('have 1 to 4 real products', () => {
    for (let i = 0; i < 200; i++) {
      const list = buildWishlist();
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.length).toBeLessThanOrEqual(4);
      list.forEach((id) => expect(getProduct(id)).toBeTruthy());
    }
  });
});

describe('handing items over', () => {
  const never = () => false;
  it('accepts exactly what was asked for', () => {
    expect(checkHandOver(['chips', 'soda'], ['soda', 'chips'], never)).toEqual({ status: 'ok', missed: 0 });
  });
  it('refuses the wrong item or too many', () => {
    expect(checkHandOver(['chips'], ['soda'], never)).toEqual({ status: 'extra', productId: 'soda' });
    expect(checkHandOver(['chips'], ['chips', 'chips'], never)).toEqual({ status: 'extra', productId: 'chips' });
  });
  it('refuses to skip an item that is still on a shelf', () => {
    expect(checkHandOver(['chips', 'soda'], ['chips'], (id) => id === 'soda')).toEqual({
      status: 'still-on-shelf',
      productId: 'soda',
    });
  });
  it('counts sold-out items as missed sales', () => {
    expect(checkHandOver(['chips', 'chips', 'soda'], ['chips'], never)).toEqual({ status: 'ok', missed: 2 });
  });
  it('lets you send someone away only if you have nothing they want', () => {
    expect(checkHandOver(['chips', 'soda'], [], never)).toEqual({ status: 'nothing', missed: 2 });
    expect(checkHandOver(['chips'], [], () => true).status).toBe('still-on-shelf');
  });
  it('groups the request and marks finished lines', () => {
    expect(requestLines(['chips', 'chips', 'soda'], ['chips', 'soda'])).toEqual([
      { productId: 'chips', qty: 2, done: false },
      { productId: 'soda', qty: 1, done: true },
    ]);
  });
});

describe('putting items back', () => {
  it('goes back on the shelf holding that product', () => {
    const s = newGame();
    stockShelf(s, foodShelf(), 'chips', 3);
    takeFromShelf(s, foodShelf(), 'chips');
    returnItem(s, 'chips');
    expect(findShelfWith(s, 'chips')?.qty).toBe(3);
  });
  it('uses an empty shelf if its own has run out', () => {
    const s = newGame();
    stockShelf(s, foodShelf(), 'chips', 1);
    takeFromShelf(s, foodShelf(), 'chips');
    returnItem(s, 'chips');
    expect(findShelfWith(s, 'chips')?.qty).toBe(1);
  });
  it('goes to the back room when every shelf is taken', () => {
    const s = newGame();
    s.shelves.forEach((shelf) => Object.assign(shelf, { productId: shelf.kind === 'food' ? 'soda' : 'golf', qty: 1 }));
    s.stockroom.chips = 0;
    returnItem(s, 'chips');
    expect(s.stockroom.chips).toBe(1);
  });
});
