# Extra Life Mart

A top-down pixel art shop game for phone browsers. Run your own corner store selling snacks and video games: order stock, fill the shelves, open up, and ring up every customer by hand.

![Gameplay](docs/gameplay.gif)

## How to play

1. **Morning:** tap a shelf to stock it from the back room, and use the back room PC to order more. Orders arrive the next morning. Press **Open** when you're ready.
2. **Open:** customers browse, pick up 1–4 items and line up. They'll wait as long as it takes. Tap the register to serve the next one.
   - **Cash:** work out the change and tap bills and coins into the tray. Too little is refused. Too much goes through, and you lose the extra.
   - **Card:** key the exact total into the terminal.
3. **Close:** check the day's sales, missed sales and profit, then start the next day. Progress saves automatically.

## Controls

| | Move | Use something |
|---|---|---|
| **Phone** | Tap the floor | Tap the object |
| **Desktop** | Click the floor, or WASD / arrow keys | Click the object, or press E |

On desktop, Esc closes the stock and supplier screens, and number keys, Backspace and Enter work on the card terminal.

## Run it locally

```sh
npm install
npm run dev          # add -- --host to open it on your phone over Wi-Fi
npm test             # game rule tests
npm run build        # production build in dist/
```

## How it's built

Phaser 3, TypeScript and Vite, deployed to GitHub Pages by GitHub Actions. There are no image files: all sprites and the pixel font are drawn in code (`src/art/`). Game rules live in `src/logic/` with no Phaser dependency, so they can be unit tested. Everything in the game, including its name, art and products, is original.
