import Phaser from 'phaser';
import { getProduct, shelfLabelName } from '../data/products';
import { flickerSteps, nextFlickerSeconds } from '../logic/flicker';
import { SHELF_ROWS, SHELF_SLOTS, type ShelfSlot } from '../data/shelves';
import { REGULARS } from '../data/regulars';
import { BROKEN_TAPE_H, CALENDAR_GRID, CALENDAR_H, CALENDAR_W, CLOSED_SIGN_H, CLOSED_SIGN_W, COMPUTER_SPRITE_W, CUSTOMER_LOOKS, DOOR_FRAMES, ITEM_SCALE, MONITOR_CENTRE_X, REGISTER_DISPLAY_H, REGISTER_DISPLAY_W, SHELF_LABEL_H, TV_FRAMES, TV_H, TV_SCREEN_X, TV_SCREEN_Y, TV_W, columnX, shelfGlowKey, wallTop } from '../art/textures';
import { sfx } from '../audio';
import { setMusicMood } from '../music';
import { WEATHER, type WeatherId } from '../data/weather';
import { eventOnDay } from '../data/events';
import { pickGreeting } from '../logic/dialogue';
import { calendarHeading, isRentDay, weekOf, weekdayIndex } from '../logic/calendar';
import { EMPTY_SHELVES_POINTS, MAX_STARS, MISSED_SALE_POINTS, SLOW_TIMES, changeReputation, greatServiceSeconds, stars } from '../logic/reputation';
import { canAddToTable, isOrderComplete, requestLines } from '../logic/basket';
import { lightingAt } from '../logic/clock';
import { buildRequest, chooseCash, emptyShelfComment, idleWait, nextSpawnDelay, pickLook, shortenWhenIdle } from '../logic/customers';
import { endDay, nothingToSell } from '../logic/day';
import { anyShelfStocked, returnItem, takeFromShelf } from '../logic/inventory';
import { onboardingStep, type OnboardingStep } from '../logic/onboarding';
import { saleTotal } from '../logic/checkout';
import { customerTender, formatCents, tenderBills } from '../logic/money';
import { deliverOrders } from '../logic/orders';
import { L, TENDER_BILL_H, TENDER_BILL_W, bubbleW, bubbleX, bubbleY, portraitX, receiptHeight, tenderLayout } from '../layout';
import { session } from '../session';
import { BUBBLE_PAD, COLOURS, drawBubble, drawPaper, label, tinyLabel, titleLabel } from '../ui';

const TABLE_CAPACITY = 4;
const DELIVERY_SECONDS = 3;
const MAX_FLYING_ITEMS = 14;
const MAX_WAITING = 3;
const SHADOW_COLOUR = 0x24344a;
const SHADOW_SPACING = 32;
const SHADOW_SCALE = 0.94;
/** Each person further back in line is fainter. */
const SHADOW_ALPHAS = [0.8, 0.5, 0.3];
const STEP_FORWARD_MS = 520;
const COMPLAINT = 0xb0352b;
const PORTRAIT_OFFSCREEN = 90;
const DONE_GREEN = 0x1f8f55;
/** Which part of the background sits in the window, in its own pixels. */
const SCENE_FOCUS_LEFT = 238;
const SCENE_FOCUS_BOTTOM = 205;
const SCENE_W = 479;
const SCENE_H = 267;
/** A short beat after the last item lands, so you can see the order complete. */
const PAYMENT_DELAY_MS = 350;
const EMPTY_HANDED_MS = 2600;
/** Long enough to read what they say, however much that is. Tapping moves on sooner. */
const greetingMs = (text: string) => Math.min(3000, 1100 + text.length * 30);
/** How many of their lines to remember, so they don't repeat themselves straight away. */
const RECENT_LINES = 30;
const NAME_INK = 0x8a4a1c;
const PAY_ROW = 0xc97440;
const CALENDAR_HEADER = 0x33383f;
const CALENDAR_FUTURE = 0xffffff;
const CALENDAR_PAST = 0xc8ccd0;
const CALENDAR_TODAY = 0x2c2a33;
const SHELF_PLUS = 0x8a5a34;
const REGISTER_GREEN = 0x5fd06a;
const REGISTER_RIGHT = 78;
/** The till's art, measured from its top-left corner: its display, and the slot its paper comes from. */
const REGISTER_ART_H = 72;
const DISPLAY_X = 38;
const DISPLAY_Y = 0;
const PAPER_X = 22;
const PAPER_TOP = 14;
/** How much paper is out of the till: a little by default, and all of it once a receipt has printed. */
const PAPER_FULL_H = 15;
const PAPER_SHORT_H = 5;
/** The paper leans over as it comes out, so its tip stays in the chute while it's short. */
const PAPER_LEAN = 0.4;
const PAPER_STEP_MS = 70;
const BANNER_BG = 0x1b1d28;
const DOORS_SHUT_DEPTH = 3;
/** Once open, the doors stand behind the customers. */
const DOORS_OPEN_DEPTH = 1;
const DOOR_FRAME_MS = 65;
const TAPE_INK = 0x1b1d28;
/** How much of a shelf's glow remains while its light blinks off. */
const SHELF_LIGHT_OFF = 0.12;

/** Where the calendar and TV hang, clear of the menu button, the bubble and the receipt. */
const wallY = wallTop;
const TIP_BAR_W = 40;
const RAIN_DROPS = 36;
const TV_FRAME_MS = 420;
const RENT_RED = 0xc9503f;
/** The first instruction waits a beat after loading. The next follows almost at once. */
const FIRST_GUIDE_SECONDS = 0.6;
const NEXT_GUIDE_SECONDS = 0.15;
const GUIDE_DEPTH = 7.5;
const SHELF_NOTE = 'REPAIR THESE SHELVES FOR\nMORE SPACE. SELECT UPGRADES\nON THE COMPUTER.';
const SHELF_NOTE_MS = 4000;
const COMPUTER_W = COMPUTER_SPRITE_W;
const computerTop = () => L.counterBottom - 6 + 2 - 60;
const shelfIsEmpty = (id: string) => session.state.shelves.find((s) => s.id === id)?.qty === 0;
const GUIDE_TEXT: Record<OnboardingStep, string> = {
  shelf: 'ADD ITEMS TO\nTHE SHELF\nBEFORE OPENING',
  sign: "OPEN THE STORE\nWHEN YOU'RE READY\nTO START SELLING",
  computer: 'ORDER MORE SNACKS TO\nKEEP SHELVES STOCKED',
  close: 'THE STORE CLOSES\nAT 9 PM. TAP THE\nDOORS TO CLOSE UP\nAND GO HOME.',
};
const WEATHER_TINT: Record<WeatherId, { colour: number; alpha: number }> = {
  sunny: { colour: 0xffffff, alpha: 0 },
  heatwave: { colour: 0xff9a30, alpha: 0.16 },
  rainy: { colour: 0x3f5068, alpha: 0.42 },
  cloudy: { colour: 0x8a99a8, alpha: 0.3 },
};

/** Under the customer, starting just clear of the register. */
const tipBarX = () => Math.max(REGISTER_RIGHT + 2, portraitX() - TIP_BAR_W / 2);
const tableItemX = (i: number) => 92 + i * 21;
const tableY = () => L.counterTop + Math.floor((L.counterBottom - L.counterTop) / 2) - 1;
/** Cash or card lands right beside the register, in front of the customer. */
const propX = () => 98;
const propY = () => L.counterTop + 16;
const boxX = () => L.W - 74;
const slotLeft = (slot: ShelfSlot) => columnX(slot.col);
const slotWidth = (slot: ShelfSlot) => columnX(slot.col + 1) - columnX(slot.col);
const slotTop = (slot: ShelfSlot) => L.shelfTop + slot.row * L.rowH;

function mixColour(a: number, b: number, t: number): number {
  const mix = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift;
  return mix(16) | mix(8) | mix(0);
}

/** Someone in line. What they want is decided when they reach the window. */
interface Waiting {
  look: number;
  paidByCash: boolean;
  /** Their dark outline, standing behind whoever is ahead of them. */
  shadow: Phaser.GameObjects.Image;
}

interface Customer extends Omit<Waiting, 'shadow'> {
  name: string;
  /** What they say first. Their order shows once this is cleared. */
  greeting: string | null;
  wants: string[];
  wished: string[];
  /** Keeps their cash the same if you back out of payment and return with the same total. */
  tender?: { total: number; amount: number };
}

interface TableItem {
  productId: string;
  image: Phaser.GameObjects.Image;
}

export class ShackScene extends Phaser.Scene {
  private duskScene!: Phaser.GameObjects.Image;
  private nightScene!: Phaser.GameObjects.Image;
  private warmLight!: Phaser.GameObjects.Rectangle;
  private doorLeft!: Phaser.GameObjects.Image;
  private doorRight!: Phaser.GameObjects.Image;
  private closedBoard!: Phaser.GameObjects.Image;
  /** Set once the doors have swung shut for the evening. */
  private shutForTheNight = false;
  private closedSign!: Phaser.GameObjects.BitmapText;
  private doorHint!: Phaser.GameObjects.BitmapText;
  private registerText!: Phaser.GameObjects.BitmapText;
  private paper!: Phaser.GameObjects.Image;
  private paperOut = PAPER_SHORT_H;
  private paperFeed: Phaser.Tweens.Tween | null = null;
  private portrait!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Graphics;
  private bubbleTail!: Phaser.GameObjects.Image;
  private speech!: Phaser.GameObjects.Graphics;
  private speechTail!: Phaser.GameObjects.Image;
  /** The customer's bills on the counter. */
  private heldMoney!: Phaser.GameObjects.Container;
  private heldCard!: Phaser.GameObjects.Image;
  private bubbleLines: { destroy(): void }[] = [];
  private spoken = '';
  private spokenColour: number = COLOURS.ink;
  private slotArt = new Map<string, Phaser.GameObjects.GameObject[]>();
  private rowArt: Phaser.GameObjects.GameObject[] = [];
  /** While paying, the receipt replaces the list: how many lines it has. */
  private receiptLines: number | null = null;
  private receiptTop = 0;
  private table: TableItem[] = [];
  private queue: Waiting[] = [];
  private current: Customer | null = null;
  private busy = false;
  private readyToPay = false;
  private spawnIn = 0;
  private dayText!: Phaser.GameObjects.BitmapText;
  private clockText!: Phaser.GameObjects.BitmapText;
  private moneyText!: Phaser.GameObjects.BitmapText;
  private banner!: Phaser.GameObjects.BitmapText;
  private bannerBack!: Phaser.GameObjects.Rectangle;
  private box: Phaser.GameObjects.Image | null = null;
  private boxOpening = false;
  private deliveryIn = 0;
  private weatherTint!: Phaser.GameObjects.Rectangle;
  private rain: Phaser.GameObjects.Image[] = [];
  private tvScreen!: Phaser.GameObjects.Image;
  private tvFrame = 0;
  private calendarDay!: Phaser.GameObjects.BitmapText;
    private calendarHeader!: Phaser.GameObjects.Rectangle;
  private calendarCells: Phaser.GameObjects.Rectangle[][] = [];
  private shelfLights = new Map<string, Phaser.GameObjects.Image>();
  private starIcons: Phaser.GameObjects.Image[] = [];
  private tipBar!: Phaser.GameObjects.Rectangle;
  private tipBarBack!: Phaser.GameObjects.Rectangle;
  private recentLines: string[] = [];
  private shelfNote!: Phaser.GameObjects.Graphics;
  private shelfNoteText!: Phaser.GameObjects.BitmapText;
  private shelfNoteTimer: Phaser.Time.TimerEvent | null = null;
  /** A tap that only cleared the note shouldn't also open or close the store. */
  private tapClearedNote = false;
  private guideArrow!: Phaser.GameObjects.Image;
  private guideNote!: Phaser.GameObjects.Graphics;
  private guideText!: Phaser.GameObjects.BitmapText;
  private guideStep: OnboardingStep | null = null;
  private guideShown = false;
  private guideWait = FIRST_GUIDE_SECONDS;
  /** The shelf a first-day customer just emptied, once they've been served. */
  private soldOutShelf: string | null = null;
  private soldOutPending: string | null = null;
  private computerTipDone = false;

  constructor() {
    super('Shack');
  }

  create() {
    const { W, windowX, windowY, windowW, windowH } = L;
    const cropLeft = Math.max(0, Math.min(SCENE_W - windowW, SCENE_FOCUS_LEFT - Math.round((windowW - 141) * 0.3)));
    const cropBottom = Math.min(SCENE_H, SCENE_FOCUS_BOTTOM + Math.round((windowH - 113) * 0.5));
    const cropTop = Math.max(0, cropBottom - windowH);
    const sceneX = windowX - cropLeft;
    const sceneY = windowY - cropTop;
    this.add.image(sceneX, sceneY, 'beach').setOrigin(0).setDepth(0);
    this.duskScene = this.add.image(sceneX, sceneY, 'beach_dusk').setOrigin(0).setDepth(0.1).setAlpha(0);
    this.nightScene = this.add.image(sceneX, sceneY, 'beach_night').setOrigin(0).setDepth(0.2).setAlpha(0);
    this.portrait = this.add.image(-PORTRAIT_OFFSCREEN, windowY + windowH, 'cust_0').setOrigin(0.5, 1).setDepth(2);
    const doorLeftW = Math.floor(windowW / 2);
    this.doorLeft = this.add.image(windowX, windowY, 'door_l_0').setOrigin(0).setScale(0.5).setDepth(DOORS_SHUT_DEPTH);
    this.doorRight = this.add.image(windowX + doorLeftW, windowY, 'door_r_0').setOrigin(0).setScale(0.5).setDepth(DOORS_SHUT_DEPTH);
    const doorCentre = windowX + Math.floor(windowW / 2);
    const boardTop = windowY + Math.floor(windowH / 2) - 30;
    this.closedBoard = this.add.image(doorCentre - Math.floor(CLOSED_SIGN_W / 2), boardTop, 'closed_sign').setOrigin(0).setDepth(3.4);
    this.closedSign = label(this, doorCentre, boardTop + CLOSED_SIGN_H - 25, 'CLOSED', COLOURS.ink, 'center').setDepth(3.5);
    this.doorHint = tinyLabel(this, doorCentre, boardTop + CLOSED_SIGN_H - 14, '', COLOURS.ink, 'center').setDepth(3.5);
    this.add.image(0, 0, 'shop').setOrigin(0).setScale(0.5).setDepth(4);
    this.warmLight = this.add.rectangle(0, 0, W, L.H, 0xffa050, 0).setOrigin(0).setDepth(4.05);

    // The front doors: tap them to open up in the morning, and to shut up shop at night.
    this.add.rectangle(windowX, windowY, windowW, windowH, 0xffffff, 0).setOrigin(0).setDepth(3.6).setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (session.modal || this.tapClearedNote) return;
        if (session.phase === 'morning') this.openUp();
        else if (this.everyoneServed()) this.closeUp();
        else if (this.current?.greeting) this.skipGreeting();
        else if (this.current && this.readyToPay) this.startPayment();
      });

    const standBottom = L.counterBottom - 6;
    this.add.image(1, standBottom, 'register').setOrigin(0, 1).setScale(0.5).setDepth(4.5);
    const registerTop = standBottom - REGISTER_ART_H;
    this.add.image(1 + DISPLAY_X, registerTop + DISPLAY_Y, 'register_display').setOrigin(0).setScale(0.5).setDepth(4.52);
    this.registerText = tinyLabel(this, 1 + DISPLAY_X + REGISTER_DISPLAY_W - 3, registerTop + DISPLAY_Y + Math.floor((REGISTER_DISPLAY_H - 7) / 2), '$0.00', REGISTER_GREEN, 'right').setDepth(4.6);
    this.paper = this.add.image(0, 0, 'register_paper').setOrigin(0).setScale(0.5).setDepth(4.51);
    this.showPaper(PAPER_SHORT_H);
    const computerX = W - COMPUTER_W - 2;
    const computerY = computerTop();
    this.add.image(computerX, computerY, 'computer').setOrigin(0).setDepth(4.5);
    tinyLabel(this, computerX + 28, computerY + 10, 'SHOP', COLOURS.white, 'center').setDepth(4.6);
    this.add.rectangle(computerX, computerY, COMPUTER_W, 60, 0xffffff, 0).setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.finishComputerTip();
        // Always named, because a scene launched without one reuses the page it was last given.
        this.openModal('Computer', { page: 'menu' });
      });

    this.bubble = this.add.graphics().setDepth(5).setVisible(false);
    this.bubbleTail = this.add.image(0, 0, 'bubble_tail').setOrigin(0).setDepth(5.2).setVisible(false);
    this.speech = this.add.graphics().setDepth(5).setVisible(false);
    this.speechTail = this.add.image(0, 0, 'bubble_tail').setOrigin(0).setDepth(5.2).setVisible(false);
    this.add.image(Math.floor(W / 2), L.signY, 'sign').setOrigin(0.5, 0).setScale(0.5).setDepth(4.9);
    this.buildStars();
    this.buildWeather();
    this.buildTv();
    this.buildCalendar();
    this.buildGuide();
    this.shelfNote = this.add.graphics().setDepth(GUIDE_DEPTH).setVisible(false);
    this.shelfNoteText = label(this, 0, 0, '', COLOURS.ink).setDepth(GUIDE_DEPTH + 0.1).setVisible(false);
    // Any tap clears it. A tap on a broken shelf brings it straight back.
    this.input.on('pointerdown', () => {
      this.tapClearedNote = this.shelfNote.visible;
      this.setShelfNoteVisible(false);
    });
    this.heldMoney = this.add.container(0, 0).setDepth(5.1).setVisible(false);
    this.heldCard = this.add.image(propX(), propY(), 'held_card').setDepth(5.1).setVisible(false);

    // A little past the top edge, so rounding can't leave a sliver of the beach showing.
    this.add.image(0, -4, 'hud_bar').setOrigin(0).setDepth(6);
    const hudText = L.hudH - 11;
    this.add.image(11, L.hudH - 8, 'menu_icon').setDepth(7);
    this.dayText = label(this, 23, hudText, '').setDepth(7);
    this.add.rectangle(0, 0, 22, L.hudH + 8, 0xffffff, 0).setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        // Full-screen menus cover this button, so only the shop and payment screens can reach it.
        if (this.scene.isActive('Pause') || session.phase === 'summary') return;
        sfx.click();
        this.scene.launch('Pause');
      });
    this.clockText = label(this, Math.floor(W / 2) + 6, hudText, '', COLOURS.dim, 'center').setDepth(7);
    this.moneyText = label(this, W - 4, hudText, '', COLOURS.gold, 'right').setDepth(7);

    SHELF_SLOTS.forEach((slot) => {
      this.shelfLights.set(slot.id, this.add.image(slotLeft(slot), slotTop(slot), shelfGlowKey(slotWidth(slot))).setOrigin(0).setScale(0.5).setDepth(4.1));
      this.add.rectangle(slotLeft(slot), slotTop(slot), slotWidth(slot), L.rowH, 0xffffff, 0)
        .setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.tapSlot(slot));
    });

    this.bannerBack = this.add.rectangle(0, 0, 0, 0, BANNER_BG, 0.88).setOrigin(0.5, 0).setDepth(6.8).setVisible(false);
    this.banner = label(this, windowX + Math.floor(windowW / 2), windowY + 3, '', COLOURS.white, 'center').setDepth(7).setVisible(false);
    this.banner.setMaxWidth(windowW - 10);

    session.events.on('shelves-changed', this.refreshShelves, this);
    session.events.on('begin-day', this.beginDay, this);
    session.events.on('say', this.say, this);
    session.events.on('receipt-feed', this.feedReceipt, this);
    session.events.on('show-tender', () => {
      if (this.current) this.showPayment(this.current);
    });
    // The payment screen takes their cash into the drawer, flying its own copies of these bills down.
    session.events.on('tender-taken', () => {
      this.tweens.killTweensOf(this.heldMoney);
      this.heldMoney.setVisible(false);
    });
    session.events.on('order-placed', (rush: boolean) => {
      if (rush) this.deliveryIn = DELIVERY_SECONDS;
      this.finishComputerTip();
    });
    this.scheduleFlicker();
    this.beginDay();
    // A game that ended stays ended, even after a refresh.
    if (session.state.closed) {
      session.modal = true;
      this.scene.launch('GameOver');
    }
  }

  // ---- First-day guide ----------------------------------------------------

  /** Purely a picture: it never takes a tap, so the shelves and the sign underneath keep working. */
  private buildGuide() {
    this.guideArrow = this.add.image(0, 0, 'guide_arrow').setDepth(GUIDE_DEPTH).setVisible(false);
    this.guideNote = this.add.graphics().setDepth(GUIDE_DEPTH).setVisible(false);
    this.guideText = label(this, 0, 0, '', COLOURS.ink).setDepth(GUIDE_DEPTH + 0.1).setVisible(false);
  }

  private setGuideVisible(visible: boolean) {
    this.guideArrow.setVisible(visible);
    this.guideNote.setVisible(visible);
    this.guideText.setVisible(visible);
  }

  /** The arrow's place, and a note that stays clear of whatever matters at that step. */
  private guidePlacement(step: OnboardingStep, noteW: number, noteH: number) {
    const arrowH = this.guideArrow.height;
    const inWindow = L.windowX + Math.floor((L.windowW - noteW) / 2);
    if (step === 'computer') {
      // The note goes at the top of the doorway, because near the computer it would cover the customer's order.
      return {
        arrowX: L.W - COMPUTER_W - 2 + MONITOR_CENTRE_X,
        arrowY: computerTop() - arrowH / 2 + 1,
        noteX: inWindow,
        noteY: L.windowY + 2,
      };
    }
    if (step === 'close') {
      // The note hangs in the empty doorway, pointing down at the open door on the right.
      const noteY = L.windowY + 6;
      return { arrowX: L.windowX + L.windowW - 17, arrowY: noteY + noteH + arrowH / 2 + 1, noteX: inWindow, noteY };
    }
    const arrowX = step === 'sign' ? L.windowX + Math.floor(L.windowW / 2) : columnX(1) + Math.floor((columnX(2) - columnX(1)) / 2);
    // Beside the arrow, staying clear of the till on the left and the computer on the right.
    const noteX = Math.max(REGISTER_RIGHT + 1, Math.min(L.W - COMPUTER_W - 3 - noteW, arrowX - Math.floor(noteW / 2)));
    if (step === 'sign') {
      // Below the sign, pointing up at it.
      const arrowY = L.windowY + Math.floor(L.windowH / 2) + 7 + arrowH / 2;
      return { arrowX, arrowY, noteX, noteY: arrowY + arrowH / 2 + 1 };
    }
    // Above the shelf, pointing down at it.
    const arrowY = L.shelfTop - arrowH / 2 + 1;
    return { arrowX, arrowY, noteX, noteY: arrowY - arrowH / 2 - 1 - noteH };
  }

  private showGuide(step: OnboardingStep) {
    const pointsAtSign = step === 'sign';
    this.guideText.setText(GUIDE_TEXT[step]);
    const noteH = this.guideText.height + 5;
    const noteW = Math.ceil(this.guideText.width) + 7;
    const { arrowX, arrowY, noteX, noteY } = this.guidePlacement(step, noteW, noteH);
    drawPaper(this.guideNote, noteX, noteY, noteW, noteH, false);
    this.guideText.setPosition(noteX + 3, noteY + 3);

    this.tweens.killTweensOf(this.guideArrow);
    this.guideArrow.setPosition(arrowX, arrowY).setFlipY(pointsAtSign).setScale(0.3);
    this.tweens.add({ targets: this.guideArrow, scale: 1, duration: 220, ease: 'Back.easeOut' });
    // Bobs towards what it's pointing at
    this.tweens.add({ targets: this.guideArrow, y: arrowY + (pointsAtSign ? -3 : 3), duration: 420, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    this.setGuideVisible(true);
    sfx.hint();
  }

  /** Once they've gone to the computer or refilled the shelf, the tip has done its job. */
  private finishComputerTip() {
    if (this.soldOutShelf) this.computerTipDone = true;
  }

  private shelfStillSoldOut(): boolean {
    if (!this.soldOutShelf || this.computerTipDone) return false;
    const shelf = session.state.shelves.find((s) => s.id === this.soldOutShelf);
    if (shelf && shelf.qty > 0) this.computerTipDone = true;
    return !this.computerTipDone;
  }

  private updateGuide(dt: number) {
    const step = onboardingStep(session.state, session.phase, this.shelfStillSoldOut(), this.everyoneServed());
    if (step !== this.guideStep) {
      // The very first instruction keeps its longer wait.
      if (this.guideStep !== null) this.guideWait = NEXT_GUIDE_SECONDS;
      this.guideStep = step;
      this.guideShown = false;
      this.setGuideVisible(false);
    }
    if (!step) return;
    // Out of the way behind other screens, and back without another chime.
    if (session.modal) return this.setGuideVisible(false);
    if (this.guideShown) {
      this.setGuideVisible(true);
      return;
    }
    this.guideWait -= dt;
    if (this.guideWait <= 0) {
      this.guideShown = true;
      this.showGuide(step);
    }
  }

  // ---- The sign, the TV, the calendar and the weather ---------------------

  private buildStars() {
    const gap = 9;
    const left = Math.floor(L.W / 2) - gap * 2;
    for (let i = 0; i < MAX_STARS; i++) {
      this.starIcons.push(this.add.image(left + i * gap, L.signY + 35, 'sign_star_off').setScale(0.5).setDepth(5));
    }
  }

  private buildWeather() {
    const { windowX, windowY, windowW, windowH } = L;
    this.weatherTint = this.add.rectangle(windowX, windowY, windowW, windowH, 0xffffff, 0).setOrigin(0).setDepth(0.5);
    for (let i = 0; i < RAIN_DROPS; i++) {
      const drop = this.add.image(windowX + Math.random() * windowW, windowY + Math.random() * windowH, 'raindrop')
        .setDepth(2.5).setAlpha(0.7).setVisible(false);
      this.rain.push(drop);
    }
    this.tipBarBack = this.add.rectangle(tipBarX(), L.counterTop - 4, TIP_BAR_W, 3, 0x2c2a33).setOrigin(0).setDepth(5.05).setVisible(false);
    this.tipBar = this.add.rectangle(tipBarX() + 1, L.counterTop - 3, TIP_BAR_W - 2, 1, COLOURS.green).setOrigin(0).setDepth(5.06).setVisible(false);
  }

  private buildTv() {
    const x = L.W - TV_W - 1;
    const y = wallY();
    this.add.image(x, y, 'tv').setOrigin(0).setDepth(4.5);
    this.tvScreen = this.add.image(x + TV_SCREEN_X, y + TV_SCREEN_Y, 'tv_sunny_0').setOrigin(0).setDepth(4.55);
    tinyLabel(this, x + Math.floor(TV_W / 2), y + 9, 'TMRW', COLOURS.white, 'center').setDepth(4.6);
    this.time.addEvent({
      delay: TV_FRAME_MS,
      loop: true,
      callback: () => {
        this.tvFrame = (this.tvFrame + 1) % TV_FRAMES;
        this.tvScreen.setTexture(`tv_${session.state.forecast}_${this.tvFrame}`);
      },
    });
    this.add.rectangle(x, y, TV_W, TV_H, 0xffffff, 0).setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        if (session.modal) return;
        sfx.click();
        session.toast(`TOMORROW: ${WEATHER[session.state.forecast].short}`);
      });
  }

  private buildCalendar() {
    const x = 1;
    const y = wallY();
    const centre = x + Math.floor(CALENDAR_W / 2);
    this.add.image(x, y, 'calendar').setOrigin(0).setDepth(4.5);
    this.calendarHeader = this.add.rectangle(x + 1, y + 2, CALENDAR_W - 2, 8, CALENDAR_HEADER).setOrigin(0).setDepth(4.55);
    this.calendarDay = tinyLabel(this, centre, y + 4, '', COLOURS.white, 'center').setDepth(4.6);
    const { x: gridX, y: gridY, cell, gap, rows } = CALENDAR_GRID;
    for (let row = 0; row < rows; row++) {
      const cells: Phaser.GameObjects.Rectangle[] = [];
      for (let col = 0; col < 7; col++) {
        cells.push(this.add.rectangle(x + gridX + col * (cell + gap), y + gridY + row * (cell + gap), cell, cell, 0xffffff).setOrigin(0).setDepth(4.6));
      }
      this.calendarCells.push(cells);
    }
    this.add.rectangle(x, y, CALENDAR_W, CALENDAR_H, 0xffffff, 0).setOrigin(0).setDepth(8).setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.openModal('Calendar'));
  }

  private refreshInfoBoard() {
    const { day, weather, forecast, rentBehind } = session.state;
    const week = weekOf(day);
    this.calendarDay.setText(calendarHeading(day));
    this.calendarHeader.setFillStyle(rentBehind > 0 ? 0xc9402f : CALENDAR_HEADER);
    // The grid shows this month's weeks as they really are, with this week moving down a row each Monday.
    const today = weekdayIndex(day);
    const monday = day - today;
    const thisRow = (week - 1) % CALENDAR_GRID.rows;
    this.calendarCells.forEach((cells, row) => cells.forEach((cell, col) => {
      const date = monday + (row - thisRow) * 7 + col;
      let colour = CALENDAR_FUTURE;
      if (date < day) colour = CALENDAR_PAST;
      else if (date === day) colour = CALENDAR_TODAY;
      else if (isRentDay(date)) colour = RENT_RED;
      else if (eventOnDay(date)) colour = 0x2f8fc4;
      cell.setFillStyle(colour);
    }));
    this.tvScreen.setTexture(`tv_${forecast}_${this.tvFrame}`);
    const tint = WEATHER_TINT[weather];
    this.weatherTint.setFillStyle(tint.colour, tint.alpha);
    this.rain.forEach((drop) => drop.setVisible(weather === 'rainy'));
    this.refreshStars();
  }

  private refreshStars() {
    const earned = stars(session.state);
    this.starIcons.forEach((icon, i) => {
      const key = i < earned ? 'sign_star_on' : 'sign_star_off';
      if (icon.texture.key !== key) icon.setTexture(key);
    });
  }

  private updateRain(dt: number) {
    if (session.state.weather !== 'rainy') return;
    const { windowX, windowY, windowW, windowH } = L;
    for (const drop of this.rain) {
      drop.y += dt * 170;
      drop.x -= dt * 26;
      if (drop.y > windowY + windowH) drop.y = windowY - 4;
      if (drop.x < windowX) drop.x = windowX + windowW;
      drop.setPosition(Math.round(drop.x), drop.y);
    }
  }

  /** A slim bar under the customer: what's left of their tip. */
  private updateTipBar(dt: number) {
    const customer = this.current;
    const serving = customer !== null && !this.busy && customer.greeting === null && customer.wants.length > 0;
    this.tipBar.setVisible(serving);
    this.tipBarBack.setVisible(serving);
    if (!serving) return;
    if (!session.servicePaused) session.serviceSeconds += dt;
    const limit = greatServiceSeconds(customer.wants.length) * SLOW_TIMES;
    const left = Math.max(0, 1 - session.serviceSeconds / limit);
    this.tipBar.setSize(Math.max(0, Math.round((TIP_BAR_W - 2) * left)), 1);
    this.tipBar.setFillStyle(left > 0.6 ? 0x35c46f : left > 0.3 ? COLOURS.gold : COLOURS.red);
  }

  private beginDay() {
    session.phase = 'morning';
    session.clock = 0;
    session.modal = false;
    this.deliveryIn = 1;
    this.queue.forEach((w) => w.shadow.destroy());
    this.queue = [];
    this.current = null;
    this.busy = false;
    this.readyToPay = false;
    this.receiptLines = null;
    this.hidePayment();
    this.clearTable();
    this.portrait.setX(-PORTRAIT_OFFSCREEN);
    this.shutForTheNight = false;
    this.setDoors(0, DOORS_SHUT_DEPTH);
    this.closedBoard.setVisible(true);
    this.closedSign.setVisible(true);
    this.doorHint.setVisible(true);
    this.refreshInfoBoard();
    this.refreshShelves();
    if (performance.now() >= session.messageUntil && !onboardingStep(session.state, session.phase)) {
      session.toast(this.todayMessage(), 3500);
    }
  }

  private todayMessage(): string {
    const event = eventOnDay(session.state.day);
    return event ? `TODAY: ${event.name}!` : `TODAY: ${WEATHER[session.state.weather].short}`;
  }

  // ---- Shelves and table --------------------------------------------------

  private refreshShelves() {
    for (const slot of SHELF_SLOTS) {
      this.slotArt.get(slot.id)?.forEach((o) => o.destroy());
      this.slotArt.delete(slot.id);
      const shelf = session.state.shelves.find((s) => s.id === slot.id);
      if (!shelf) continue;
      const art: Phaser.GameObjects.GameObject[] = [];
      const x = slotLeft(slot);
      const y = slotTop(slot);
      const w = slotWidth(slot);
      const labelY = y + L.rowH - SHELF_LABEL_H;
      if (shelf.productId && shelf.qty > 0) {
        art.push(...this.shelfStock(shelf.productId, shelf.qty, x, w, labelY - 1));
        const name = shelfLabelName(getProduct(shelf.productId), shelf.qty, w - 6);
        art.push(tinyLabel(this, x + 3, labelY + 3, name, COLOURS.ink).setDepth(6));
        art.push(tinyLabel(this, x + w - 3, labelY + 3, String(shelf.qty), COLOURS.ink, 'right').setDepth(6));
      } else {
        art.push(label(this, x + Math.floor(w / 2), y + Math.floor((L.rowH - SHELF_LABEL_H - 7) / 2), '+', SHELF_PLUS, 'center').setDepth(6));
      }
      this.slotArt.set(slot.id, art);
    }
    this.refreshLockedRows();
    this.renderBubble();
  }

  /** A neat row of up to three. The plate underneath gives the exact count. */
  private shelfStock(productId: string, qty: number, x: number, w: number, floorY: number): Phaser.GameObjects.Image[] {
    const centre = x + Math.floor(w / 2);
    if (productId === 'choco' && qty >= 3) {
      return [this.add.image(centre, floorY, 'choco_group').setOrigin(0.5, 1).setScale(ITEM_SCALE).setDepth(5.2)];
    }
    const key = `item_${productId}`;
    const itemW = this.textures.get(key).getSourceImage().width * ITEM_SCALE;
    const count = Math.min(qty, 3);
    const step = Math.min(itemW + 2, (w - 4 - itemW) / 2);
    return Array.from({ length: count }, (_, i) => {
      const middleFirst = count === 3 && i === 1;
      return this.add.image(Math.round(centre + (i - (count - 1) / 2) * step), floorY, key)
        .setOrigin(0.5, 1).setScale(ITEM_SCALE).setDepth(middleFirst ? 5.21 : 5.2);
    });
  }

  /** Rows you haven't repaired yet. */
  private refreshLockedRows() {
    this.rowArt.forEach((o) => o.destroy());
    this.rowArt = [];
    for (let row = session.state.rowsOwned; row < SHELF_ROWS; row++) {
      const y = L.shelfTop + row * L.rowH;
      this.rowArt.push(this.add.image(0, y, 'broken_row').setOrigin(0).setScale(0.5).setDepth(5));
      this.rowArt.push(label(this, Math.floor(L.W / 2), y + Math.floor(L.rowH / 2) - BROKEN_TAPE_H + 3, 'OUT OF ORDER', TAPE_INK, 'center').setDepth(6));
    }
  }

  /** Every so often, one lit shelf's light stutters. */
  private scheduleFlicker() {
    this.time.delayedCall(nextFlickerSeconds() * 1000, () => {
      this.flickerRandomShelf();
      this.scheduleFlicker();
    });
  }

  private flickerRandomShelf() {
    const owned = SHELF_SLOTS.filter((slot) => slot.row < session.state.rowsOwned);
    const light = this.shelfLights.get(owned[Math.floor(Math.random() * owned.length)].id);
    if (!light) return;
    let wait = 0;
    for (const step of flickerSteps()) {
      this.time.delayedCall(wait, () => light.setAlpha(step.on ? 1 : SHELF_LIGHT_OFF));
      wait += step.ms;
    }
  }

  private tapSlot(slot: ShelfSlot) {
    if (session.modal) return;
    if (slot.row >= session.state.rowsOwned) return this.showShelfNote(slot.row);
    const shelf = session.state.shelves.find((s) => s.id === slot.id)!;
    if (this.current?.greeting) return this.skipGreeting();
    if (shelf.qty > 0 && this.current && !this.busy) return this.fetch(slot, shelf.productId!);
    this.openModal('Stock', { shelfId: slot.id });
  }

  /** Over the broken row: what it would take to fix it. */
  private showShelfNote(row: number) {
    sfx.click();
    this.shelfNoteTimer?.remove();
    this.shelfNoteText.setText(SHELF_NOTE);
    const w = Math.ceil(this.shelfNoteText.width) + 8;
    const h = Math.ceil(this.shelfNoteText.height) + 5;
    const x = Math.floor((L.W - w) / 2);
    const y = L.shelfTop + row * L.rowH + Math.floor((L.rowH - h) / 2);
    drawPaper(this.shelfNote, x, y, w, h, false);
    this.shelfNoteText.setPosition(x + 4, y + 3);
    this.setShelfNoteVisible(true);
    this.shelfNoteTimer = this.time.delayedCall(SHELF_NOTE_MS, () => this.setShelfNoteVisible(false));
  }

  private setShelfNoteVisible(visible: boolean) {
    this.shelfNote.setVisible(visible);
    this.shelfNoteText.setVisible(visible);
  }

  private fetch(slot: ShelfSlot, productId: string) {
    const customer = this.current!;
    if (customer.wants.length === 0) return;
    if (this.readyToPay || !canAddToTable(customer.wants, session.table, productId)) {
      sfx.error();
      this.say(`NO ${getProduct(productId).short}, THANKS`, COMPLAINT);
      return;
    }
    if (this.table.length >= TABLE_CAPACITY) return;
    if (!takeFromShelf(session.state, slot.id, productId)) return;
    if (session.state.day === 1 && shelfIsEmpty(slot.id)) this.soldOutPending = slot.id;
    sfx.pickUp();
    this.spoken = '';
    const image = this.add.image(slotLeft(slot) + slotWidth(slot) / 2, slotTop(slot) + 20, `item_${productId}`).setScale(ITEM_SCALE).setDepth(9);
    const item: TableItem = { productId, image };
    this.table.push(item);
    image.setInteractive({ useHandCursor: true }).on('pointerup', () => this.takeBack(item));
    this.layoutTable();
    this.refreshShelves();

    if (isOrderComplete(customer.wants, session.table)) {
      this.time.delayedCall(PAYMENT_DELAY_MS, () => {
        // They may have taken something back during the pause.
        if (this.current !== customer || !isOrderComplete(customer.wants, session.table)) return;
        if (session.modal) {
          // A menu opened during the pause, so wait for them to come back to it.
          this.readyToPay = true;
          this.renderBubble();
        } else {
          this.startPayment();
        }
      });
    }
  }

  private takeBack(item: TableItem) {
    if (session.modal) return;
    sfx.putBack();
    this.table = this.table.filter((other) => other !== item);
    item.image.destroy();
    returnItem(session.state, item.productId);
    this.spoken = '';
    this.readyToPay = false;
    this.layoutTable();
    this.refreshShelves();
  }

  private layoutTable() {
    this.table.forEach((item, i) => {
      this.tweens.killTweensOf(item.image);
      this.tweens.add({ targets: item.image, x: tableItemX(i), y: tableY(), duration: 140, ease: 'Quad.easeOut' });
    });
    session.table = this.table.map((t) => t.productId);
    this.showRunningTotal();
  }

  /** The till's display adds up what's on the counter, the same way the receipt will. */
  private showRunningTotal() {
    this.registerText.setText(formatCents(saleTotal(session.table, this.current?.paidByCash ?? false)));
  }

  /** Only what's come out of the slot shows, so its curled tip is always the first thing out. */
  private showPaper(out: number) {
    const shown = Math.round(out * 2) / 2;
    const hidden = PAPER_FULL_H - shown;
    this.paperOut = out;
    this.paper
      .setPosition(1 + PAPER_X - hidden * PAPER_LEAN, L.counterBottom - 6 - REGISTER_ART_H + PAPER_TOP + hidden)
      .setCrop(0, 0, this.paper.width, shown * 2);
  }

  private feedPaperTo(out: number, duration: number, delay = 0) {
    this.paperFeed?.stop();
    this.paperFeed = this.tweens.addCounter({
      from: this.paperOut,
      to: out,
      duration,
      delay,
      onUpdate: (tween) => this.showPaper(tween.getValue() ?? out),
    });
  }

  /** Paper feeds out of the till in step with the receipt on screen, from a short tip to its full length. */
  private feedReceipt(fraction: number) {
    this.feedPaperTo(PAPER_SHORT_H + (PAPER_FULL_H - PAPER_SHORT_H) * fraction, PAPER_STEP_MS);
  }

  /** Torn off once the sale is over or called off, leaving the tip of the next one. */
  private tearReceipt() {
    this.paperFeed?.stop();
    const torn = this.add.image(this.paper.x, this.paper.y, 'register_paper').setOrigin(0).setScale(0.5).setDepth(4.51)
      .setCrop(0, 0, this.paper.width, this.paperOut * 2);
    this.tweens.add({ targets: torn, y: torn.y - 10, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => torn.destroy() });
    this.showPaper(0);
    this.feedPaperTo(PAPER_SHORT_H, 220, 260);
  }

  private clearTable() {
    this.table.forEach((t) => t.image.destroy());
    this.table = [];
    session.table = [];
    this.showRunningTotal();
  }

  // ---- Deliveries ---------------------------------------------------------

  private hasArrivals(): boolean {
    return Object.values(session.state.arrivals).some((qty) => qty > 0);
  }

  private tickDelivery(dt: number) {
    if (this.box && !this.boxOpening && !this.hasArrivals()) {
      this.box.destroy();
      this.box = null;
    }
    if (this.box || !this.hasArrivals()) return;
    this.deliveryIn -= dt;
    // Boxes never land mid-sale: they wait until the current customer has been dealt with.
    if (this.deliveryIn <= 0 && !this.current && !session.modal) this.dropBox();
  }

  private dropBox() {
    const box = this.add.image(boxX(), tableY() - 44, 'box_closed').setDepth(4.8);
    this.box = box;
    box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.openBox());
    this.tweens.add({
      targets: box,
      y: tableY(),
      duration: 480,
      ease: 'Bounce.easeOut',
      onUpdate: (tween) => {
        if (tween.progress > 0.35 && !box.getData('landed')) {
          box.setData('landed', true);
          sfx.thud();
        }
      },
    });
    session.toast('DELIVERY! TAP THE BOX');
  }

  private openBox() {
    const box = this.box;
    if (!box || session.modal || this.boxOpening) return;
    this.boxOpening = true;
    this.tweens.killTweensOf(box);
    box.setPosition(boxX(), tableY()).setTexture('box_open').disableInteractive();
    sfx.rip();

    // One icon per box of stock would be too few to see, so show them unit by unit, up to a limit.
    const items = Object.entries(session.state.arrivals).flatMap(([id, qty]) => Array.from({ length: qty }, () => id));
    const step = Math.max(1, Math.floor(items.length / MAX_FLYING_ITEMS));
    const shown = items.filter((_, i) => i % step === 0).slice(0, MAX_FLYING_ITEMS);
    shown.forEach((id, i) => {
      this.time.delayedCall(180 + i * 90, () => {
        sfx.pop();
        const icon = this.add.image(boxX(), tableY() - 4, `item_${id}`).setDepth(10).setScale(ITEM_SCALE * 0.5);
        this.tweens.add({
          targets: icon,
          y: tableY() - 30,
          x: boxX() - 6 + (i % 3) * 6,
          scale: 1,
          duration: 180,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: icon,
              x: L.W - COMPUTER_W - 2 + MONITOR_CENTRE_X,
              y: computerTop() + 16,
              scale: 0.5,
              duration: 360,
              ease: 'Quad.easeIn',
              onComplete: () => icon.destroy(),
            });
          },
        });
      });
    });

    this.time.delayedCall(180 + shown.length * 90 + 560, () => {
      const delivered = deliverOrders(session.state);
      if (session.phase === 'morning') session.save();
      sfx.stored();
      session.toast(`${delivered} ITEMS ADDED TO STOCK`);
      this.boxOpening = false;
      this.box = null;
      this.tweens.add({ targets: box, alpha: 0, duration: 220, onComplete: () => box.destroy() });
    });
  }

  // ---- Customers ----------------------------------------------------------

  /** The next person in line steps forward, turning from a silhouette into full colour. */
  private callNext() {
    const next = this.queue.shift();
    if (!next) return;
    const request = buildRequest(session.state);
    const greeting = request.wants.length > 0 ? pickGreeting(session.state, next.look, this.recentLines) : null;
    const customer: Customer = { look: next.look, paidByCash: next.paidByCash, name: REGULARS[next.look].name, greeting, ...request };
    if (greeting) this.recentLines = [greeting, ...this.recentLines].slice(0, RECENT_LINES);
    this.current = customer;
    session.serviceSeconds = 0;
    if (request.wants.length === 0) changeReputation(session.state, EMPTY_SHELVES_POINTS);
    else if (request.wished.length > 0) changeReputation(session.state, MISSED_SALE_POINTS);
    this.refreshStars();
    this.busy = true;
    this.spoken = '';
    this.readyToPay = false;
    session.wants = customer.wants;
    session.payingCash = customer.paidByCash;
    session.state.stats.missedSales += customer.wished.length;
    sfx.customer();
    const { shadow } = next;
    this.portrait.setTexture(`cust_${next.look}`).setX(shadow.x).setAlpha(0);
    this.tweens.add({
      targets: shadow,
      x: portraitX(),
      scale: 1,
      alpha: 0,
      duration: STEP_FORWARD_MS,
      ease: 'Quad.easeOut',
      onComplete: () => shadow.destroy(),
    });
    this.tweens.add({
      targets: this.portrait,
      x: portraitX(),
      alpha: 1,
      duration: STEP_FORWARD_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.busy = false;
        // With nothing at all on the shelves, they say so and move on.
        if (customer.wants.length === 0) {
          this.spoken = emptyShelfComment();
          this.spokenColour = COLOURS.ink;
        }
        this.renderBubble();
        if (customer.wants.length === 0) {
          this.time.delayedCall(EMPTY_HANDED_MS, () => {
            if (this.current === customer) this.dismiss();
          });
        } else if (customer.greeting) {
          this.time.delayedCall(greetingMs(customer.greeting), () => {
            if (this.current === customer) this.skipGreeting();
          });
        }
      },
    });
  }

  /** They've finished saying hello: on to what they want. */
  private skipGreeting() {
    if (!this.current?.greeting) return;
    this.current.greeting = null;
    this.renderBubble();
  }

  /** Someone new joins the back of the line, walking in from the right. */
  private joinLine() {
    const taken = [...this.queue.map((w) => w.look), ...(this.current ? [this.current.look] : [])];
    const look = pickLook(taken, CUSTOMER_LOOKS);
    const shadow = this.add.image(L.W + PORTRAIT_OFFSCREEN, L.windowY + L.windowH, `cust_${look}`)
      .setOrigin(0.5, 1).setScale(SHADOW_SCALE).setTintFill(SHADOW_COLOUR);
    this.queue.push({ look, paidByCash: chooseCash(), shadow });
  }

  /** Eases everyone in line towards their place behind the customer. */
  private updateLine(dt: number) {
    this.queue.forEach((waiting, i) => {
      const target = portraitX() + SHADOW_SPACING * (i + 1);
      waiting.shadow.setDepth(1.5 - i * 0.1).setAlpha(SHADOW_ALPHAS[i] ?? 0);
      waiting.shadow.x += (target - waiting.shadow.x) * Math.min(1, dt * 5);
    });
  }

  /** Once the order is ready, their cash or card comes down onto the counter. */
  private showPayment(customer: Customer) {
    if (customer.wants.length === 0) return;
    const held = customer.paidByCash ? this.heldMoney : this.heldCard;
    this.tweens.killTweensOf(held);
    let restY = propY();
    if (customer.paidByCash) {
      // The bills they actually pay with, largest first.
      this.heldMoney.removeAll(true);
      const bills = tenderBills(customer.tender?.amount ?? 0);
      tenderLayout(bills.length).forEach(({ x, y }, i) => {
        this.heldMoney.add(this.add.image(x, y, `bill_${bills[i]}_up`).setOrigin(0).setDisplaySize(TENDER_BILL_W, TENDER_BILL_H));
      });
      restY = 0;
    }
    held.setY(restY - 22).setVisible(true).setAlpha(0);
    (customer.paidByCash ? sfx.bill : sfx.keypad)();
    this.tweens.add({ targets: held, y: restY, alpha: 1, duration: 260, ease: 'Quad.easeOut' });
  }

  private hidePayment() {
    [this.heldMoney, this.heldCard].forEach((held) => {
      this.tweens.killTweensOf(held);
      if (!held.visible) return;
      this.tweens.add({ targets: held, y: held.y - 22, alpha: 0, duration: 200, onComplete: () => held.setVisible(false) });
    });
  }

  private dismiss() {
    this.hidePayment();
    this.current = null;
    session.wants = null;
    this.busy = true;
    this.spoken = '';
    this.readyToPay = false;
    this.receiptLines = null;
    this.renderBubble();
    // Out to the left, making room for the next person to step up.
    this.tweens.add({
      targets: this.portrait,
      x: -PORTRAIT_OFFSCREEN,
      duration: 400,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.busy = false;
      },
    });
  }

  private say(text: string, colour: number = COLOURS.ink) {
    this.spoken = text;
    this.spokenColour = colour;
    this.renderBubble();
  }

  private renderBubble() {
    this.bubbleLines.forEach((t) => t.destroy());
    this.bubbleLines = [];
    const customer = this.current;
    const visible = customer !== null && !this.busy;
    const hasList = visible && customer.wants.length > 0 && customer.greeting === null && this.receiptLines === null;
    this.bubble.setVisible(hasList);
    this.bubbleTail.setVisible(hasList);
    this.speech.setVisible(false);
    this.speechTail.setVisible(false);
    if (!visible) return;

    const put = (y: number, text: string, colour: number, write = label) => {
      const t = write(this, bubbleX() + BUBBLE_PAD, y, text, colour).setDepth(6);
      t.setMaxWidth(bubbleW() - BUBBLE_PAD * 2);
      this.bubbleLines.push(t);
      return t;
    };
    const place = (box: Phaser.GameObjects.Graphics, tail: Phaser.GameObjects.Image, top: number, bottom: number, ruleY: number | null, showTail = true) => {
      drawBubble(box, bubbleX(), top, bubbleW(), bottom - top, ruleY);
      box.setVisible(true);
      tail.setPosition(bubbleX() + 2, bottom - 3).setVisible(showTail);
    };

    // First they say hello, with their name at the top
    if (customer.greeting !== null) {
      const top = bubbleY();
      put(top + 4, customer.name, NAME_INK, titleLabel);
      const said = put(top + 15, customer.greeting, COLOURS.ink);
      place(this.speech, this.speechTail, top, top + 15 + said.height + 3, top + 12);
      return;
    }

    // The list: finished lines become a solid green row with a check mark
    const listTop = hasList ? this.listBubbleTop(requestLines(customer.wants, session.table).length + (this.readyToPay ? 1 : 0)) : bubbleY();
    let y = this.receiptLines === null ? listTop + 4 : this.receiptTop + receiptHeight(this.receiptLines, this.current?.paidByCash ?? false) + 11;
    if (hasList) {
      put(y, customer.name, NAME_INK, titleLabel);
      const ruleY = y + 8;
      y += 11;
      requestLines(customer.wants, session.table).forEach((line) => {
        const name = getProduct(line.productId).name;
        if (line.done) {
          const row = this.add.rectangle(bubbleX() + 3, y - 1, bubbleW() - 6, 10, DONE_GREEN).setOrigin(0).setDepth(5.5);
          this.bubbleLines.push(row);
          put(y, `\u2713 ${name}`, COLOURS.white);
        } else {
          put(y, `${line.remaining} ${name}`, COLOURS.ink);
        }
        y += 11;
      });
      if (this.readyToPay) {
        const row = this.add.rectangle(bubbleX() + 3, y - 1, bubbleW() - 6, 10, PAY_ROW).setOrigin(0).setDepth(5.5);
        this.bubbleLines.push(row);
        put(y, 'TAP TO PAY', COLOURS.white);
        y += 11;
      }
      // A bubble below takes over the tail, since the two would overlap.
      place(this.bubble, this.bubbleTail, listTop, y + 2, ruleY, !this.spoken);
      y += 9;
    }

    // Anything else they say goes in its own bubble below
    const speechTop = y - 4;
    if (this.spoken) {
      const said = put(y, this.spoken, this.spokenColour);
      y += said.height + 3;
      place(this.speech, this.speechTail, speechTop, y, null);
    }
  }

  /** Normally level with the customer's face, but moves up if a comment below it would run into the counter's machines. */
  private listBubbleTop(lines: number): number {
    if (!this.spoken) return bubbleY();
    const measure = label(this, 0, 0, this.spoken).setMaxWidth(bubbleW() - BUBBLE_PAD * 2);
    const spokenH = measure.height;
    measure.destroy();
    const listH = 4 + 11 + lines * 11 + 2;
    const commentH = 3 + 4 + spokenH + 3;
    return Math.max(L.windowY + 3, Math.min(bubbleY(), L.counterTop - 8 - listH - commentH));
  }

  private startPayment() {
    const customer = this.current;
    if (!customer || session.modal) return;
    this.readyToPay = false;
    const items = session.table.slice();
    const charged = saleTotal(items, customer.paidByCash);
    if (customer.tender?.total !== charged) customer.tender = { total: charged, amount: customerTender(charged) };
    this.setDeskClear(true);
    this.receiptLines = Math.min(items.length, 4);
    // Moves up if needed, so the receipt and speech bubble stay clear of the things on the counter.
    const speechH = 18;
    this.receiptTop = Math.max(L.windowY + 8, Math.min(bubbleY(), L.counterTop - 20 - speechH - 8 - receiptHeight(this.receiptLines, customer.paidByCash)));
    this.renderBubble();
    this.openModal('Register', {
      items,
      receiptTop: this.receiptTop,
      total: charged,
      paidByCash: customer.paidByCash,
      tendered: customer.paidByCash ? customer.tender.amount : 0,
      onDone: (tip: number) => {
        this.tearReceipt();
        this.setDeskClear(false);
        this.clearTable();
        this.dismiss();
        this.floatMoney(charged + tip);
        this.refreshStars();
        // Saved until now, so the first-day tip can't appear in the middle of a sale.
        if (this.soldOutPending) this.soldOutShelf = this.soldOutPending;
      },
      onBack: () => {
        this.tearReceipt();
        this.hidePayment();
        this.setDeskClear(false);
        this.receiptLines = null;
        this.readyToPay = true;
        this.say('');
      },
    });
  }

  /** Payment uses the desk for counting out change, so what's on it steps aside. */
  private setDeskClear(clear: boolean) {
    this.table.forEach((t) => t.image.setVisible(!clear));
    this.box?.setVisible(!clear);
  }

  private floatMoney(total: number) {
    const t = label(this, 110, tableY(), `+${formatCents(total)}`, 0x1f7a5a, 'center').setDepth(9);
    this.tweens.add({ targets: t, y: tableY() - 15, alpha: 0, duration: 1100, delay: 300, onComplete: () => t.destroy() });
  }

  /** Shows the doors at one point in their swing: frame 0 is shut. */
  private setDoors(frame: number, depth: number) {
    this.doorLeft.setTexture(`door_l_${frame}`).setDepth(depth);
    this.doorRight.setTexture(`door_r_${frame}`).setDepth(depth);
  }

  private swingDoors(from: number, to: number, then: () => void) {
    const step = from < to ? 1 : -1;
    this.setDoors(from, DOORS_SHUT_DEPTH);
    for (let i = 1; i <= Math.abs(to - from); i++) {
      this.time.delayedCall(i * DOOR_FRAME_MS, () => {
        this.setDoors(from + step * i, DOORS_SHUT_DEPTH);
        if (i === Math.abs(to - from)) then();
      });
    }
  }

  /** The day's done: swing the doors shut, then go over the day's receipt. */
  private closeUp() {
    if (this.shutForTheNight) return;
    this.shutForTheNight = true;
    session.modal = true;
    sfx.doorClose();
    this.swingDoors(DOOR_FRAMES - 1, 0, () => {
      this.closedBoard.setVisible(true);
      this.closedSign.setVisible(true);
      this.closeBooks();
    });
  }

  /** With nothing to sell, the only way forward is tomorrow's delivery. */
  private openUp() {
    if (nothingToSell(session.state)) {
      sfx.click();
      this.closeBooks();
    } else {
      this.openShop();
    }
  }

  private openShop() {
    if (!anyShelfStocked(session.state)) {
      sfx.error();
      session.toast(nothingToSell(session.state) ? 'NOTHING TO SELL TODAY' : 'STOCK YOUR SHELVES BEFORE OPENING', 3000);
      return;
    }
    session.phase = 'open';
    session.clock = 0;
    session.state.hasOpened = true;
    session.save();
    this.spawnIn = 1;
    session.toast("WE'RE OPEN!");
    sfx.doorOpen();
    this.closedSign.setVisible(false);
    this.closedBoard.setVisible(false);
    this.doorHint.setVisible(false);
    this.swingDoors(0, DOOR_FRAMES - 1, () => this.setDoors(DOOR_FRAMES - 1, DOORS_OPEN_DEPTH));
  }

  private openModal(scene: string, data?: object) {
    if (session.modal || session.phase === 'summary') return;
    session.modal = true;
    this.scene.launch(scene, data);
  }

  // ---- Frame update -------------------------------------------------------

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 100) / 1000;

    if (session.phase === 'open') {
      session.clock += dt;
      const idle = !this.current && !this.busy && this.queue.length === 0;
      this.spawnIn = shortenWhenIdle(this.spawnIn, idle, idleWait(session.state)) - dt;
      if (this.spawnIn <= 0) {
        if (this.queue.length < MAX_WAITING) {
          this.joinLine();
        }
        this.spawnIn = nextSpawnDelay(session.state);
      }
      if (session.clock >= session.dayLength) {
        session.phase = 'closing';
        session.toast('CLOSING TIME!');
      }
    }
    if (session.phase === 'open' || session.phase === 'closing') {
      if (!this.current && !this.busy && !session.modal && this.queue.length > 0) this.callNext();
    }
    this.tickDelivery(dt);
    this.updateRain(dt);
    this.updateGuide(dt);
    this.updateTipBar(dt);
    this.applyLighting();
    session.waiting = this.queue.length;
    this.updateLine(dt);
    this.updateHud();
  }

  /** Daylight until 6 PM, then the scene fades through dusk to night by closing. */
  private applyLighting() {
    const { dusk, night } = lightingAt(session.dayFraction());
    this.duskScene.setAlpha(dusk);
    this.nightScene.setAlpha(night);
    // Customers are outside but lit by the shop, so they shift gently and stay readable.
    const tint = mixColour(mixColour(0xffffff, 0xffe2cc, dusk), 0xbcc4e2, night);
    this.portrait.setTint(tint);
    this.warmLight.setFillStyle(0xffa050, 0.1 * Math.max(dusk * 0.5, night));
    setMusicMood(session.phase === 'morning' ? 'morning' : dusk > 0 ? 'evening' : 'day');
  }

  /** Past closing time with nobody left to serve: the day waits for you to close it. */
  private everyoneServed(): boolean {
    return session.phase === 'closing' && !this.current && !this.busy && this.queue.length === 0;
  }

  private updateHud() {
    const { state, phase } = session;
    this.dayText.setText(`DAY ${state.day}`);
    this.clockText.setText(session.clockLabel());
    this.moneyText.setText(formatCents(state.balance));
    if (phase === 'morning') this.doorHint.setText(nothingToSell(state) ? 'TAP TO SKIP DAY' : 'TAP TO OPEN');
    this.updateBanner();
    if (session.modal) this.setShelfNoteVisible(false);
  }

  /** A short message at the top of the doorway, out of the way of the customer. */
  private updateBanner() {
    const text = this.bannerText();
    const show = text !== '' && !session.modal;
    this.banner.setVisible(show);
    this.bannerBack.setVisible(show);
    if (!show) return;
    if (this.banner.text !== text) this.banner.setText(text);
    this.bannerBack.setPosition(this.banner.x, this.banner.y - 2).setSize(Math.ceil(this.banner.width) + 8, Math.ceil(this.banner.height) + 3);
  }

  private bannerText(): string {
    // These notes are at the top of the doorway, and already say what to do.
    if ((this.guideStep === 'computer' || this.guideStep === 'close') && this.guideNote.visible) return '';
    if (performance.now() < session.messageUntil) return session.message;
    return this.everyoneServed() && !this.shutForTheNight ? 'TAP THE DOORS TO CLOSE UP' : '';
  }

  private closeBooks() {
    session.phase = 'summary';
    const events = endDay(session.state);
    session.save();
    session.modal = true;
    this.scene.launch('Summary', events);
  }
}

