# Extra Life Mart

A pixel art shop game for phone browsers. Run a gritty little shack selling snacks and video games: order stock, fill your shelves, and serve customers through the window by hand.

![Gameplay](docs/gameplay.gif)

## How to play

1. **Morning:** tap an empty shelf to stock it. Use the terminal on the table to buy more stock: a delivery box lands on the table, and tapping it unpacks everything into your stock crate. Press **Open** when you're ready.
2. **Open:** customers come to your window one at a time and say what they want. They'll wait as long as it takes.
   - Tap a shelf to move an item onto the table, or tap an item on the table to put it back. Then press **Hand Over**.
   - Anything you've sold out of is crossed off, and the sale carries on with the rest. If you have nothing they want, press **Say Sorry**.
   - **Cash:** the register shows the change due. Tap bills and coins to count it out. Too little is refused. Too much goes through, and you lose the extra.
   - **Card:** key the exact total into the terminal.
   - Press **Back** at any time during payment to change the order first.
3. **Close:** check the day's sales, missed sales and profit, then start the next day. Progress saves automatically.

## Getting ahead

Starter items sell, but they barely pay. Use your profits to buy licences at the terminal. Each one unlocks a new product with a better margin, and customers start asking for it right away.

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

Phaser 3, TypeScript and Vite, deployed to GitHub Pages by GitHub Actions. There are no image or audio files: all sprites and the pixel font are drawn in code (`src/art/`), and the sound effects are synthesised at runtime (`src/audio.ts`). Game rules live in `src/logic/` with no Phaser dependency, so they can be unit tested. Everything in the game, including its name, art and products, is original.
