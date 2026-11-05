# Extra Life Mart

A pixel art shop game for phone browsers. Run a little beachfront convenience store: order snacks by the box, stock your shelves, and serve customers through the window by hand.

![Gameplay](docs/gameplay.gif)

## How to play

1. **Morning:** tap an empty shelf, choose a snack and how many, then press **Place on Shelf**. Use the computer on the counter to order more snacks, which come in boxes of 12. A delivery box lands on the counter, and tapping it unpacks everything into your stock crate. You can't open until something is on a shelf.
2. **Open:** customers line up and come to your window one at a time, say what they want, and put cash or a card on the counter so you can see how they'll pay. They'll wait as long as it takes.
   - Tap a shelf to move an item onto the counter, or tap an item on the counter to put it back. Once you have everything, payment starts on its own.
   - A receipt prints beside the customer, and the panel below shows your next step.
   - **Cash:** there are no pennies, so totals round to the nearest 5 cents. The panel shows the change due. Tap bills and coins to lay them on the counter, and tap any piece to take it back. Too little is refused. Too much goes through, and you lose the extra.
   - **Card:** a terminal comes up on the counter. Key in the exact total.
   - To change the order during payment, press **Back** on cash, or tap outside the keypad on card.
3. **Close:** the shop runs from 9 AM to 9 PM, and evening sets in after 6 PM. Check the day's sales, missed sales and profit, then start the next day. Progress saves automatically.

## Getting ahead

Customers only buy what's on your shelves. If they go for a snack you're licensed to sell but haven't stocked, that's a sale you missed.

Starter snacks sell, but they barely pay. Spend your profits at the computer: licences unlock snacks with better margins, and extra rows of shelves give you room to stock them.

## Controls

Tap on a phone, or click on desktop. On desktop, Esc also closes the stock and supplier screens and backs out of payment, and number keys, Backspace and Enter work on the card terminal.

Use the menu at the top left to pause, turn sound on or off, or restart.

## Run it locally

```sh
npm install
npm run dev          # add -- --host to open it on your phone over Wi-Fi
npm test             # game rule tests
npm run build        # production build in dist/
```

## How it's built

Phaser 3, TypeScript and Vite, deployed to GitHub Pages by GitHub Actions. Customer portraits and the beach scene are in `public/`, and the game fits itself to each screen while keeping its pixels crisp (`src/layout.ts`). Everything else is drawn in code (`src/art/`), including the pixel font, and the sound effects are synthesised at runtime (`src/audio.ts`). Game rules live in `src/logic/` with no Phaser dependency, so they can be unit tested. All of the game's art and content is original.
