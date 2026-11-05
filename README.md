# Extra Life Mart

A pixel art shop game for phone browsers. Run a little beachfront convenience store: order snacks by the box, stock your shelves, and serve customers through the window by hand.

![Gameplay](docs/gameplay.gif)

## How to play

1. **Morning:** tap an empty shelf to stock it. Use the computer on the counter to order more snacks, which come in boxes of 10. A delivery box lands on the counter, and tapping it unpacks everything into your stock crate. You can't open until something is on a shelf.
2. **Open:** customers come to your window one at a time, say what they want, and say whether they're paying cash or card. They'll wait as long as it takes.
   - Tap a shelf to move an item onto the counter, or tap an item on the counter to put it back. Once you have everything, payment starts on its own.
   - **Cash:** the register shows the change due. Tap bills and coins to count it out. Too little is refused. Too much goes through, and you lose the extra.
   - **Card:** key the exact total into the terminal.
   - Press **Back** during payment to change the order first.
3. **Close:** check the day's sales, missed sales and profit, then start the next day. Progress saves automatically.

## Getting ahead

Customers only buy what's on your shelves. If they go for a snack you're licensed to sell but haven't stocked, they'll say they wish you had it, and that's a sale you missed.

Starter snacks sell, but they barely pay. Spend your profits at the computer: licences unlock snacks with better margins, and extra rows of shelves give you room to stock them.

## Controls

Tap on a phone, or click on desktop. On desktop, Esc also closes the stock and supplier screens and backs out of payment, and number keys, Backspace and Enter work on the card terminal.

## Run it locally

```sh
npm install
npm run dev          # add -- --host to open it on your phone over Wi-Fi
npm test             # game rule tests
npm run build        # production build in dist/
```

## How it's built

Phaser 3, TypeScript and Vite, deployed to GitHub Pages by GitHub Actions. Customer portraits are in `public/customers/`. Everything else is drawn in code (`src/art/`), including the pixel font, and the sound effects are synthesised at runtime (`src/audio.ts`). Game rules live in `src/logic/` with no Phaser dependency, so they can be unit tested. All of the game's art and content is original.
