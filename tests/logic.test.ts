import { describe, expect, it } from 'vitest';
import { calendarHeading } from '../src/logic/calendar';
import { flickerSteps, nextFlickerSeconds } from '../src/logic/flicker';
import { BOX_SIZE, getProduct, PRODUCTS, SHELF_CAPACITY, shelfLabelLines } from '../src/data/products';

const SHELF_PRODUCTS = PRODUCTS.filter((p) => p.kind === 'shelf');
import { tinyTextWidth } from '../src/art/fontMetrics';
import { canAddToTable, isOrderComplete, lineName, requestLines, tagWant, wantTag } from '../src/logic/basket';
import { computeLayout, MIN_H, MIN_W } from '../src/layout';
import { clockLabel, lightingAt } from '../src/logic/clock';
import { checkCard, checkChange, completeSale, saleTotal } from '../src/logic/checkout';
import { buildRequest, crowdFactor, emptyShelfComment, IDLE_MAX_SECONDS, idleWait, nextSpawnDelay, pickLook, shortenWhenIdle, snackDemand } from '../src/logic/customers';
import { applyBrokeSafeguard, dayProfit, endDay, nothingToSell, STARTER_BOX } from '../src/logic/day';
import { anyShelfStocked, emptyShelf, returnItem, stockShelf, takeFromShelf, totalInStore } from '../src/logic/inventory';
import { buyLicence, buyShelfRow, lockedProducts, nextRowPrice, orderableProducts, unlockedProducts } from '../src/logic/licences';
import { buyAppliance, drinksAvailable, pourDrink, startBlend, startBrew, tickAppliances } from '../src/logic/appliances';
import { customerTender, DENOMINATIONS, formatCents, roundToNickel, tenderBills } from '../src/logic/money';
import { cartCost, deliverOrders, placeOrder, receiveOvernight, rushCost } from '../src/logic/orders';
import { clearSave, loadGame, saveGame, type SaveStore } from '../src/logic/save';
import { newGame, SAVE_VERSION, type GameState } from '../src/logic/state';
import { daysUntilRent, isRentDay, weekdayName, weekOf } from '../src/logic/calendar';
import { rentDue, weeklyRent } from '../src/logic/rent';
import { changeReputation, MAX_STARS, serviceRating, settleService, stars, START_REPUTATION, tipFor } from '../src/logic/reputation';
import { allGreetingLines, pickGreeting } from '../src/logic/dialogue';
import { rollWeather, WEATHER } from '../src/data/weather';
import { eventOnDay, nextEvent } from '../src/data/events';
import { REGULARS } from '../src/data/regulars';
import { onboardingStep } from '../src/logic/onboarding';
import { CUSTOMER_LOOKS } from '../src/art/looks';

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
  it('pays with the fewest bills, largest first', () => {
    expect(tenderBills(500)).toEqual([500]);
    expect(tenderBills(1300)).toEqual([1000, 100, 100, 100]);
    expect(tenderBills(4600)).toEqual([2000, 2000, 500, 100]);
    expect(tenderBills(5000)).toEqual([2000, 2000, 1000]);
    expect(tenderBills(6000)).toEqual([2000, 2000, 2000]);
  });
  it('every amount a customer hands over is made of bills that add up to it', () => {
    for (let total = 5; total <= 6000; total += 35) {
      for (const r of [0, 0.5, 0.99]) {
        const tendered = customerTender(total, () => r);
        expect(tenderBills(tendered).reduce((a, b) => a + b, 0)).toBe(tendered);
      }
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
    expect(s.pendingOrders.chips).toBe(BOX_SIZE);
    // Nothing arrives until morning.
    expect(deliverOrders(s)).toBe(0);
    receiveOvernight(s);
    expect(s.pendingOrders).toEqual({});
    expect(deliverOrders(s)).toBe(BOX_SIZE);
    expect(s.stockroom.chips).toBe(24);
    expect(s.arrivals).toEqual({});
  });
  it('a rush is a flat $20 on top, however big the order, and comes today', () => {
    const s = newGame();
    const cart = { chips: BOX_SIZE };
    expect(rushCost(cart)).toBe(960 + 2000);
    expect(rushCost({ chips: BOX_SIZE * 5 })).toBe(960 * 5 + 2000);
    expect(placeOrder(s, cart, true)).toBe(true);
    expect(s.balance).toBe(10000 - 2960);
    expect(s.stats.orderSpend).toBe(2960);
    expect(s.pendingOrders).toEqual({});
    expect(s.arrivals.chips).toBe(BOX_SIZE);
  });
  it('refuses a rush you can only afford at the normal price', () => {
    const s = newGame();
    s.balance = 2000;
    expect(placeOrder(s, { chips: BOX_SIZE }, true)).toBe(false);
    expect(placeOrder(s, { chips: BOX_SIZE })).toBe(true);
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
      { want: 'chips', tag: null, remaining: 1, done: false },
      { want: 'soda', tag: null, remaining: 0, done: true },
    ]);
  });
});

describe('asking for a kind of snack', () => {
  const drink = tagWant('drinks');
  it('takes any product of that kind, and nothing else', () => {
    expect(canAddToTable([drink], [], 'soda')).toBe(true);
    expect(canAddToTable([drink], [], 'lemon')).toBe(true);
    expect(canAddToTable([drink], [], 'chips')).toBe(false);
    expect(canAddToTable([drink], ['lemon'], 'soda')).toBe(false);
  });
  it('fills named items first, then the kind', () => {
    const wants = ['soda', drink];
    expect(canAddToTable(wants, ['soda'], 'soda')).toBe(true);
    expect(canAddToTable(wants, ['soda', 'soda'], 'lemon')).toBe(false);
    expect(isOrderComplete(wants, ['soda'])).toBe(false);
    expect(isOrderComplete(wants, ['soda', 'coconut'])).toBe(true);
    expect(isOrderComplete(wants, ['coconut', 'soda'])).toBe(true);
  });
  it('lists the kind last', () => {
    expect(requestLines([drink, 'chips'], ['lemon'])).toEqual([
      { want: 'chips', tag: null, remaining: 1, done: false },
      { want: drink, tag: 'drinks', remaining: 0, done: true },
    ]);
  });
  it('names the product when only one would do', () => {
    const s = newGame();
    Object.assign(s.shelves[0], { productId: 'soda', qty: 3 });
    Object.assign(s.shelves[1], { productId: 'lemon', qty: 1 });
    const [line] = requestLines([drink], []);
    expect(lineName(s, [drink], [], line)).toBe('COLD DRINK');
    expect(lineName(s, ['lemon', drink], [], requestLines(['lemon', drink], [])[1])).toBe('GRAPE SODA');
  });
  it('is only asked for when two different products of that kind are free', () => {
    const s = newGame();
    s.unlocked = ['soda', 'lemon'];
    Object.assign(s.shelves[0], { productId: 'soda', qty: 5 });
    let tags = 0;
    for (let i = 0; i < 300; i++) if (buildRequest(s).wants.some((w) => wantTag(w))) tags += 1;
    expect(tags).toBe(0);
    Object.assign(s.shelves[1], { productId: 'lemon', qty: 1 });
    for (let i = 0; i < 600; i++) {
      const { wants } = buildRequest(s);
      if (!wants.some((w) => wantTag(w))) continue;
      tags += 1;
      // The lemonade can't be both named and stand in for the drink.
      expect(wants.filter((w) => w === 'lemon').length).toBe(0);
      expect(wants.filter((w) => wantTag(w)).length).toBe(1);
    }
    expect(tags).toBeGreaterThan(20);
  });
});

describe('day cycle', () => {
  it('profit is revenue and tips minus overpayment and stock bought', () => {
    expect(dayProfit({ revenue: 1000, tips: 50, overpaid: 100, orderSpend: 300, upgradeSpend: 500, missedSales: 2, customersServed: 3 })).toBe(650);
  });
  it('ending a day summarizes and advances, and orders reach the counter by morning', () => {
    const s = newGame();
    placeOrder(s, { chips: 10 });
    completeSale(s, 1000, 0);
    const { summary } = endDay(s);
    expect(summary).toMatchObject({ day: 1, revenue: 1000, profit: 200, newBest: true });
    expect(s.pendingOrders).toEqual({});
    expect(s.arrivals).toEqual({ chips: 10 });
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
  it('helps when you can afford a snack but not a whole box', () => {
    const s = broke();
    s.balance = 500;
    expect(applyBrokeSafeguard(s)).toBe(true);
  });
  it('sends a starter box when completely stuck', () => {
    const s = broke();
    expect(applyBrokeSafeguard(s)).toBe(true);
    expect(s.stockroom).toEqual(STARTER_BOX);
  });
  it.each([
    ['money for the cheapest box', (s: GameState) => void (s.balance = 840)],
    ['stock left', (s: GameState) => void (s.stockroom.chips = 1)],
    ['an order on the way', (s: GameState) => void (s.pendingOrders.chips = 1)],
    ['a box on the counter', (s: GameState) => void (s.arrivals.chips = 1)],
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
  it('brings a version 4 save up to date without losing progress', () => {
    const store = memoryStore();
    const { arrivals, weather, forecast, reputation, rentBehind, closed, totalServed, hasOpened, ...rest } = newGame();
    const { tips, ...oldStats } = rest.stats;
    store.setItem('extra-life-mart-save', JSON.stringify({ ...rest, version: 4, day: 23, balance: 54321, stats: oldStats, pendingOrders: { soda: 12 } }));
    const loaded = loadGame(store)!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(weekdayName(loaded.day)).toBe('MON');
    expect(loaded.hasOpened).toBe(true);
    expect(loaded).toMatchObject({ day: 22, balance: 54321, rentBehind: 0, closed: false, reputation: START_REPUTATION, pendingOrders: {}, arrivals: { soda: 12 } });
    expect(loaded.stats.tips).toBe(0);
    expect(WEATHER[loaded.forecast]).toBeDefined();
  });
  it('brings a version 5 save up to date, finishing the guide for anyone past day 1', () => {
    const store = memoryStore();
    const { hasOpened, ...old } = newGame();
    store.setItem('extra-life-mart-save', JSON.stringify({ ...old, version: 5, day: 1 }));
    expect(loadGame(store)).toMatchObject({ version: SAVE_VERSION, day: 1, hasOpened: false });
    store.setItem('extra-life-mart-save', JSON.stringify({ ...old, version: 5, day: 9, balance: 777 }));
    expect(loadGame(store)).toMatchObject({ version: SAVE_VERSION, day: 9, balance: 777, hasOpened: true });
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
    const starters = SHELF_PRODUCTS.filter((p) => !p.licence).map((p) => margin(p.id));
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
  it('refuses a row you cannot afford, and stops at two, above the appliances', () => {
    const s = newGame();
    s.balance = 100;
    expect(buyShelfRow(s)).toBe(false);
    s.balance = 1000000;
    buyShelfRow(s);
    expect(s.shelves).toHaveLength(8);
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
  it('moves on every minute', () => {
    expect(clockLabel(1 / 720)).toBe('9:01 AM');
    expect(clockLabel(37 / 720)).toBe('9:37 AM');
  });
  it('never shows 24-hour numbers', () => {
    for (let f = 0; f <= 1; f += 0.01) expect(clockLabel(f)).toMatch(/^([1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/);
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
      expect(l.shelfTop + l.rowH * 3).toBe(l.H);
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
  it('gives the canvas one pixel for each of the screen\'s own, so text stays sharp', () => {
    for (const [, width, height, dpr] of devices) {
      const l = computeLayout({ width, height, dpr });
      expect(l.renderScale).toBe(Math.round(l.zoom * dpr));
    }
  });
  it('leaves no empty strip for a large gesture bar', () => {
    const plain = computeLayout({ width: 412, height: 785, dpr: 3.5 });
    const safe = computeLayout({ width: 412, height: 785, dpr: 3.5, safeBottom: 48 });
    expect(safe.safeBottom).toBeLessThanOrEqual(6);
    expect(safe.shelfTop + safe.rowH * 3).toBe(safe.H);
    expect(safe.rowH).toBe(plain.rowH);
  });
  it('keeps controls clear of a notch and gesture bar', () => {
    const plain = computeLayout({ width: 390, height: 844, dpr: 3 });
    const safe = computeLayout({ width: 390, height: 844, dpr: 3, safeTop: 47, safeBottom: 34 });
    expect(safe.hudH).toBeGreaterThan(plain.hudH);
    expect(safe.safeBottom).toBeGreaterThan(plain.safeBottom);
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
    for (const p of SHELF_PRODUCTS) {
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

describe('shelf labels', () => {
  // The narrowest shelf is 54 game pixels wide, leaving 48 inside its plate.
  const narrowest = 48;

  it('keep the full name on one line when it fits', () => {
    expect(shelfLabelLines(getProduct('chips'), '$1.89', 80)).toEqual({ lines: ['BBQ CHIPS'], rightLine: 0 });
  });

  it('break the full name over two lines on narrow shelves', () => {
    expect(shelfLabelLines(getProduct('chips'), '$1.89', narrowest)).toEqual({ lines: ['BBQ', 'CHIPS'], rightLine: 0 });
  });

  it('show every full name on the narrowest shelf, with room for its price', () => {
    for (const p of SHELF_PRODUCTS) {
      const price = formatCents(p.retail);
      const { lines, rightLine } = shelfLabelLines(p, price, narrowest);
      expect(lines.join(' ').trim()).toBe(p.name);
      lines.forEach((line, i) => {
        const right = i === rightLine ? 2 + tinyTextWidth(price) : 0;
        expect(tinyTextWidth(line) + right).toBeLessThanOrEqual(narrowest);
      });
    }
  });
});

describe('stock in the store', () => {
  it('counts the stockroom and the shelves, and nothing else', () => {
    const s = newGame();
    s.stockroom.chips = 3;
    s.shelves[0].productId = 'chips';
    s.shelves[0].qty = 4;
    s.pendingOrders.chips = 12;
    expect(totalInStore(s, 'chips')).toBe(7);
  });
  it('is zero only when there are none anywhere', () => {
    const s = newGame();
    s.stockroom.chips = 0;
    s.shelves[0].productId = 'chips';
    s.shelves[0].qty = 1;
    expect(totalInStore(s, 'chips')).toBe(1);
    s.shelves[0].qty = 0;
    expect(totalInStore(s, 'chips')).toBe(0);
  });
});

describe('sale total', () => {
  it('adds up exact cents for a card', () => {
    expect(saleTotal(['chips', 'soda'], false)).toBe(189 + 159);
  });
  it('rounds to the nickel for cash, at every step', () => {
    expect(saleTotal(['chips'], true)).toBe(190);
    expect(saleTotal(['chips', 'soda'], true)).toBe(350);
  });
  it('is nothing for an empty counter', () => {
    expect(saleTotal([], true)).toBe(0);
  });
});

describe('calendar heading', () => {
  it('fits the 32 pixel header on every weekday, even in very late weeks', () => {
    for (const day of [1, 2, 3, 4, 5, 6, 7, 64, 86, 700, 6999]) {
      expect(tinyTextWidth(calendarHeading(day))).toBeLessThanOrEqual(32);
    }
  });
});

describe('shelf light flicker', () => {
  it('stays occasional, at both ends of the random range', () => {
    expect(nextFlickerSeconds(() => 0)).toBeGreaterThanOrEqual(8);
    expect(nextFlickerSeconds(() => 0.999)).toBeLessThanOrEqual(25);
  });

  it('is brief, and always ends with the light back on', () => {
    for (const r of [0, 0.5, 0.999]) {
      const steps = flickerSteps(() => r);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[steps.length - 1].on).toBe(true);
      expect(steps.reduce((sum, step) => sum + step.ms, 0)).toBeLessThan(800);
    }
  });
});

describe('empty shelves', () => {
  it('gives the customer something to say, every time', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) expect(emptyShelfComment(() => r).length).toBeGreaterThan(0);
  });
});

describe('calendar', () => {
  it('starts on a Monday and rolls into new weeks', () => {
    expect(weekdayName(1)).toBe('MON');
    expect(weekdayName(7)).toBe('SUN');
    expect(weekdayName(8)).toBe('MON');
    expect(weekOf(7)).toBe(1);
    expect(weekOf(8)).toBe(2);
  });
  it('rent day is every Sunday', () => {
    expect(isRentDay(6)).toBe(false);
    expect(isRentDay(7)).toBe(true);
    expect(isRentDay(14)).toBe(true);
    expect(daysUntilRent(1)).toBe(6);
    expect(daysUntilRent(7)).toBe(0);
  });
});

describe('rent', () => {
  /** Runs the store to the close of a given day with this much money. */
  const closeDay = (s: GameState, day: number, balance: number) => {
    s.day = day;
    s.balance = balance;
    return endDay(s, () => 0).summary;
  };
  it('rises each week up to a cap', () => {
    expect(weeklyRent(1)).toBe(5000);
    expect(weeklyRent(4)).toBe(20000);
    expect(weeklyRent(5)).toBe(22500);
    expect(weeklyRent(1000)).toBe(40000);
    for (let w = 1; w < 40; w++) expect(weeklyRent(w + 1)).toBeGreaterThanOrEqual(weeklyRent(w));
  });
  it('only comes out on Sundays', () => {
    const s = newGame();
    expect(closeDay(s, 6, 100000).rent).toBeNull();
    expect(s.balance).toBe(100000);
    expect(closeDay(s, 7, 100000).rent).toEqual({ status: 'paid', amount: 5000 });
    expect(s.balance).toBe(95000);
  });
  it('a first miss takes nothing, warns, and adds it to next week', () => {
    const s = newGame();
    const { rent } = closeDay(s, 7, 4000);
    expect(rent).toEqual({ status: 'missed', amount: 5000, owedNext: 15000 });
    expect(s.balance).toBe(4000);
    expect(s.closed).toBe(false);
    expect(rentDue(s)).toBe(15000);
  });
  it('paying both rents clears what you owe', () => {
    const s = newGame();
    closeDay(s, 7, 4000);
    expect(closeDay(s, 14, 20000).rent).toEqual({ status: 'paid', amount: 15000 });
    expect(s.balance).toBe(5000);
    expect(s.rentBehind).toBe(0);
    expect(rentDue(s)).toBe(weeklyRent(3));
  });
  it('a second miss in a row closes the store', () => {
    const s = newGame();
    closeDay(s, 7, 4000);
    expect(closeDay(s, 14, 14999).rent).toEqual({ status: 'closed', amount: 15000 });
    expect(s.closed).toBe(true);
  });
  it('misses that are not in a row only warn', () => {
    const s = newGame();
    closeDay(s, 7, 4000);
    closeDay(s, 14, 15000);
    expect(closeDay(s, 21, 0).rent?.status).toBe('missed');
    expect(s.closed).toBe(false);
  });
  it('a closed store stays closed after a reload', () => {
    const store = memoryStore();
    const s = newGame();
    closeDay(s, 7, 0);
    closeDay(s, 14, 0);
    saveGame(s, store);
    expect(loadGame(store)!.closed).toBe(true);
  });
});

describe('weather and demand', () => {
  it('always rolls a known weather', () => {
    for (let r = 0; r < 1; r += 0.05) expect(WEATHER[rollWeather('sunny', () => r)]).toBeDefined();
  });
  it('forecast comes true the next day', () => {
    const s = newGame();
    const forecast = s.forecast;
    endDay(s);
    expect(s.weather).toBe(forecast);
  });
  it('even the starter snacks respond to every kind of unusual weather', () => {
    const starters = ['chips', 'soda', 'choco', 'noodle'];
    for (const w of ['heatwave', 'rainy', 'cloudy'] as const) {
      const s = newGame();
      s.weather = w;
      expect(starters.some((id) => snackDemand(s, id) > 1)).toBe(true);
    }
  });
  it('weather moves every product of a kind together', () => {
    const s = newGame();
    s.weather = 'heatwave';
    expect(snackDemand(s, 'soda')).toBe(snackDemand(s, 'lemon'));
    expect(snackDemand(s, 'soda')).toBeGreaterThan(1);
    expect(snackDemand(s, 'pie')).toBeLessThan(1);
  });
  it('customers mostly ask for what suits the weather', () => {
    const s = newGame();
    s.weather = 'rainy';
    s.shelves[0].productId = 'noodle';
    s.shelves[0].qty = 12;
    s.shelves[1].productId = 'soda';
    s.shelves[1].qty = 12;
    s.unlocked = ['noodle', 'soda'];
    const counts: Record<string, number> = { noodle: 0, soda: 0 };
    for (let i = 0; i < 2000; i++) buildRequest(s).wants.forEach((id) => (counts[id] += 1));
    expect(counts.noodle).toBeGreaterThan(counts.soda * 3);
  });
  it('rain keeps people away and a heatwave brings them out', () => {
    const s = newGame();
    const normal = crowdFactor(s);
    s.weather = 'rainy';
    expect(crowdFactor(s)).toBeLessThan(normal);
    expect(idleWait(s)).toBeGreaterThan(IDLE_MAX_SECONDS);
    s.weather = 'heatwave';
    expect(crowdFactor(s)).toBeGreaterThan(normal);
    expect(idleWait(s)).toBe(IDLE_MAX_SECONDS);
  });
  it('a bigger crowd means shorter gaps between customers', () => {
    const s = newGame();
    const normal = nextSpawnDelay(s, () => 0.5);
    s.weather = 'heatwave';
    expect(nextSpawnDelay(s, () => 0.5)).toBeLessThan(normal);
  });
});

describe('events', () => {
  it('come every 5 to 9 days', () => {
    const days = Array.from({ length: 200 }, (_, i) => i + 1).filter((d) => eventOnDay(d));
    expect(days[0]).toBe(6);
    for (let i = 1; i < days.length; i++) {
      const gap = days[i] - days[i - 1];
      expect(gap).toBeGreaterThanOrEqual(5);
      expect(gap).toBeLessThanOrEqual(9);
    }
  });
  it('can be seen coming', () => {
    expect(nextEvent(3, 3)?.day).toBe(6);
    expect(nextEvent(1, 3)).toBeNull();
  });
  it('boost their favourite snacks', () => {
    const s = newGame();
    s.day = 6;
    const event = eventOnDay(6)!;
    const fan = PRODUCTS.find((p) => p.tag === event.favourites[0])!.id;
    expect(snackDemand(s, fan)).toBeGreaterThan(1);
    s.day = 1;
    expect(snackDemand(s, fan)).toBe(1);
  });
  it('every event favours at least one starter snack', () => {
    const starters = ['chips', 'soda', 'choco', 'noodle'];
    for (let d = 1; d < 200; d++) {
      const event = eventOnDay(d);
      if (event) expect(starters.some((id) => event.favourites.includes(getProduct(id).tag))).toBe(true);
    }
  });
});

describe('regulars and greetings', () => {
  const DRAWABLE = /^[A-Z0-9 $.,!?:\-+/'&()]+$/;
  /** The narrowest speech bubble holds 16 characters a line and 5 lines. */
  const wrappedLines = (text: string, width = 16) => {
    let lines = 1;
    let used = 0;
    for (const word of text.split(' ')) {
      if (used > 0 && used + 1 + word.length > width) {
        lines += 1;
        used = word.length;
      } else used += (used > 0 ? 1 : 0) + word.length;
    }
    return lines;
  };
  const eventLines = () => {
    const out: string[] = [];
    for (let d = 1; d < 60; d++) {
      const s = newGame();
      s.day = d;
      const coming = nextEvent(d + 1, 2);
      if (coming) out.push(pickGreeting(s, 0, [], sequence(0)));
      const today = eventOnDay(d);
      if (today) out.push(today.today);
    }
    return out;
  };
  it('has a name and lines for every portrait', () => {
    expect(REGULARS).toHaveLength(CUSTOMER_LOOKS);
    expect(new Set(REGULARS.map((r) => r.name)).size).toBe(CUSTOMER_LOOKS);
    for (const r of REGULARS) expect(r.lines.length).toBeGreaterThanOrEqual(10);
  });
  it('every line can be drawn and fits the narrowest bubble', () => {
    for (const line of [...allGreetingLines(), ...eventLines()]) {
      expect(line).toMatch(DRAWABLE);
      expect(wrappedLines(line), line).toBeLessThanOrEqual(5);
    }
  });
  it('hints at an event ahead of time, naming the day', () => {
    const s = newGame();
    s.day = 4;
    const line = pickGreeting(s, 0, [], () => 0);
    expect(line).toContain(eventOnDay(6)!.name);
    expect(line).toContain('ON SAT');
  });
  it('mentions tomorrow\'s weather', () => {
    const s = newGame();
    s.forecast = 'rainy';
    // No rent trouble and no events yet: the first roll decides the forecast line.
    expect(pickGreeting(s, 0, [], sequence(0))).toMatch(/RAIN|UMBRELLA/);
  });
  it('avoids lines heard recently', () => {
    const s = newGame();
    const look = 3;
    const never = REGULARS[look].lines[0];
    for (let i = 0; i < 300; i++) expect(pickGreeting(s, look, [never])).not.toBe(never);
  });
});

describe('tips and reputation', () => {
  it('rates service by time per order size', () => {
    expect(serviceRating(10, 1)).toBe('great');
    expect(serviceRating(12, 1)).toBe('good');
    expect(serviceRating(20, 1)).toBe('ok');
    expect(serviceRating(100, 1)).toBe('slow');
    expect(serviceRating(20, 4)).toBe('great');
  });
  it('tips shrink as service slows, and five stars earns the full 20%', () => {
    const s = newGame();
    s.reputation = 100;
    expect(stars(s)).toBe(MAX_STARS);
    expect(tipFor(s, 1000, 'great')).toBe(200);
    expect(tipFor(s, 1000, 'good')).toBe(100);
    expect(tipFor(s, 1000, 'ok')).toBe(50);
    expect(tipFor(s, 1000, 'slow')).toBe(0);
  });
  it('a lower reputation means smaller tips', () => {
    const s = newGame();
    s.reputation = 0;
    expect(tipFor(s, 1000, 'great')).toBe(150);
  });
  it('tips reach the balance and the day stats', () => {
    const s = newGame();
    completeSale(s, 1000, 0, 200);
    expect(s.balance).toBe(10000 + 1200);
    expect(s.stats.tips).toBe(200);
    expect(s.totalServed).toBe(1);
  });
  it('good service builds reputation and slow service costs it', () => {
    const s = newGame();
    settleService(s, 1000, 1, 5, 0);
    expect(s.reputation).toBe(START_REPUTATION + 0.5);
    settleService(s, 1000, 1, 100, 0);
    expect(s.reputation).toBe(START_REPUTATION + 0.25);
  });
  it('overpaying means no tip and costs reputation', () => {
    const s = newGame();
    expect(settleService(s, 1000, 1, 5, 100).tip).toBe(0);
    expect(s.reputation).toBe(START_REPUTATION - 1);
  });
  it('stays within bounds', () => {
    const s = newGame();
    changeReputation(s, 1000);
    expect(s.reputation).toBe(100);
    changeReputation(s, -1000);
    expect(s.reputation).toBe(0);
    expect(stars(s)).toBe(0);
  });
  it('more stars bring more customers', () => {
    const s = newGame();
    s.reputation = 0;
    const low = crowdFactor(s);
    s.reputation = 100;
    expect(crowdFactor(s)).toBeGreaterThan(low);
  });
});

describe('days with nothing to sell', () => {
  it('knows when there is nothing on hand', () => {
    const s = newGame();
    expect(nothingToSell(s)).toBe(false);
    s.stockroom = {};
    expect(nothingToSell(s)).toBe(true);
    s.arrivals = { chips: 12 };
    expect(nothingToSell(s)).toBe(false);
  });
  it('an overnight order does not count until it arrives', () => {
    const s = newGame();
    s.stockroom = {};
    s.pendingOrders = { chips: 12 };
    expect(nothingToSell(s)).toBe(true);
    endDay(s);
    expect(nothingToSell(s)).toBe(false);
  });
});

describe('first-day guide', () => {
  it('starts by pointing at the shelves', () => {
    expect(onboardingStep(newGame(), 'morning')).toBe('shelf');
  });
  it('moves to the sign once something is on a shelf', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 1);
    expect(onboardingStep(s, 'morning')).toBe('sign');
  });
  it('goes back if the shelves are emptied again', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 1);
    emptyShelf(s, SHELF);
    expect(onboardingStep(s, 'morning')).toBe('shelf');
  });
  it('is gone once the store opens', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 1);
    expect(onboardingStep(s, 'open')).toBeNull();
    expect(onboardingStep(s, 'closing')).toBeNull();
  });
  it('never shows after day 1', () => {
    const s = newGame();
    s.day = 2;
    expect(onboardingStep(s, 'morning')).toBeNull();
  });
  it('stays gone after opening, even back on that same morning', () => {
    const s = newGame();
    stockShelf(s, SHELF, 'chips', 1);
    s.hasOpened = true;
    expect(onboardingStep(s, 'morning')).toBeNull();
    emptyShelf(s, SHELF);
    expect(onboardingStep(s, 'morning')).toBeNull();
  });
  it('points to the computer when a shelf sells out on the first day', () => {
    const s = newGame();
    s.hasOpened = true;
    expect(onboardingStep(s, 'open', true)).toBe('computer');
    expect(onboardingStep(s, 'closing', true, true)).toBe('close');
    expect(onboardingStep(s, 'closing', true, false)).toBe('computer');
    expect(onboardingStep(s, 'closing', true)).toBe('computer');
    expect(onboardingStep(s, 'open', false)).toBeNull();
    expect(onboardingStep(s, 'summary', true)).toBeNull();
  });
  it('does not point to the computer after the first day', () => {
    const s = newGame();
    s.day = 2;
    expect(onboardingStep(s, 'open', true)).toBeNull();
  });
  it('does not ask for stock the player does not have', () => {
    const s = newGame();
    s.stockroom = {};
    expect(onboardingStep(s, 'morning')).toBeNull();
  });
});

describe('appliances', () => {
  const withCoffee = () => {
    const s = newGame();
    s.balance = 100000;
    expect(buyAppliance(s, 'coffee')).toBe(true);
    return s;
  };

  it('buying one unlocks its drinks and ingredients, but not for the shelves or licences', () => {
    const s = withCoffee();
    expect(s.unlocked).toContain('coffee');
    expect(s.unlocked).toContain('beans');
    expect(unlockedProducts(s).map((p) => p.id)).not.toContain('beans');
    expect(orderableProducts(s).map((p) => p.id)).toContain('beans');
    expect(orderableProducts(s).map((p) => p.id)).not.toContain('coffee');
    expect(lockedProducts(s).every((p) => p.kind === 'shelf')).toBe(true);
    expect(buyAppliance(s, 'coffee')).toBe(false);
  });

  it('brews a pot of five from one bag of beans, only once the pot is empty', () => {
    const s = withCoffee();
    expect(startBrew(s)).toBe(false);
    s.stockroom.beans = 2;
    expect(startBrew(s)).toBe(true);
    expect(s.stockroom.beans).toBe(1);
    tickAppliances(s, 4.9);
    expect(s.coffeePot).toBe(0);
    tickAppliances(s, 0.2);
    expect(s.coffeePot).toBe(5);
    expect(startBrew(s)).toBe(false);
    for (let i = 0; i < 5; i++) expect(pourDrink(s, 'coffee')).toBe(true);
    expect(pourDrink(s, 'coffee')).toBe(false);
    expect(startBrew(s)).toBe(true);
  });

  it('blends one fruit into one smoothie', () => {
    const s = newGame();
    s.balance = 100000;
    buyAppliance(s, 'blender');
    s.stockroom.mango = 1;
    expect(startBlend(s, 'pineapple')).toBe(false);
    expect(startBlend(s, 'mango')).toBe(true);
    expect(s.stockroom.mango).toBe(0);
    expect(pourDrink(s, 'smoothie_mango')).toBe(false);
    tickAppliances(s, 5);
    expect(pourDrink(s, 'smoothie_pineapple')).toBe(false);
    expect(pourDrink(s, 'smoothie_mango')).toBe(true);
    expect(s.blenderJar).toBeNull();
  });

  it('counts what could be served from the pot and the beans', () => {
    const s = withCoffee();
    expect(drinksAvailable(s, 'coffee')).toBe(0);
    s.coffeePot = 3;
    s.stockroom.beans = 2;
    expect(drinksAvailable(s, 'coffee')).toBe(13);
    expect(drinksAvailable(s, 'smoothie_mango')).toBe(0);
  });

  it('customers only ask for drinks you could make', () => {
    const s = withCoffee();
    s.unlocked = ['coffee', 'beans'];
    for (let i = 0; i < 100; i++) expect(buildRequest(s).wants).toEqual([]);
    s.coffeePot = 5;
    const wants = buildRequest(s).wants;
    expect(wants.length).toBeGreaterThan(0);
    expect(wants.every((w) => w === 'coffee')).toBe(true);
  });

  it('a made drink never stands in for a kind of snack', () => {
    expect(canAddToTable([tagWant('drinks')], [], 'smoothie_mango')).toBe(false);
    expect(canAddToTable(['smoothie_mango'], [], 'smoothie_mango')).toBe(true);
  });

  it('a drink taken back goes back into the pot or jar', () => {
    const s = withCoffee();
    s.coffeePot = 4;
    returnItem(s, 'coffee');
    expect(s.coffeePot).toBe(5);
    returnItem(s, 'coffee');
    expect(s.coffeePot).toBe(5);
    expect(s.shelves.every((shelf) => shelf.productId !== 'coffee')).toBe(true);
  });
});

describe('the appliance bay replacing the bottom shelves', () => {
  it('refunds the third row and returns its stock from an older save', () => {
    const old = { ...newGame(), version: 6, rowsOwned: 3, balance: 500 } as GameState;
    old.shelves = [0, 1, 2].flatMap((row) => [0, 1, 2, 3].map((col) => ({ id: `shelf-${row}-${col}`, productId: null, qty: 0 })));
    old.shelves[8] = { id: 'shelf-2-0', productId: 'jerky', qty: 7 };
    old.stockroom = { jerky: 1 };
    delete (old as Partial<GameState>).appliances;
    const store = memoryStore();
    store.setItem('extra-life-mart-save', JSON.stringify(old));
    const loaded = loadGame(store)!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.rowsOwned).toBe(2);
    expect(loaded.shelves).toHaveLength(8);
    expect(loaded.stockroom.jerky).toBe(8);
    expect(loaded.balance).toBe(500 + 15000);
    expect(loaded.appliances).toEqual([]);
  });
});
