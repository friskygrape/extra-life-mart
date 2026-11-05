import Phaser from 'phaser';
import { formatCents } from '../logic/money';
import { session } from '../session';
import { Button, COLOURS, HEIGHT, WIDTH, button, label } from '../ui';

const BOTTOM_Y = 276;

export class HudScene extends Phaser.Scene {
  private dayText!: Phaser.GameObjects.BitmapText;
  private clockText!: Phaser.GameObjects.BitmapText;
  private moneyText!: Phaser.GameObjects.BitmapText;
  private hint!: Phaser.GameObjects.BitmapText;
  private openButton!: Button;

  constructor() {
    super('Hud');
  }

  create() {
    this.add.rectangle(0, 0, WIDTH, 20, COLOURS.panel).setOrigin(0);
    this.add.rectangle(0, BOTTOM_Y, WIDTH, HEIGHT - BOTTOM_Y, COLOURS.panel).setOrigin(0);
    this.dayText = label(this, 4, 6, '');
    this.clockText = label(this, 62, 6, '', COLOURS.dim);
    this.moneyText = label(this, WIDTH - 4, 6, '', COLOURS.gold, 'right');
    this.hint = label(this, 6, BOTTOM_Y + 8, '');
    this.hint.setMaxWidth(106);
    this.openButton = button(this, 116, BOTTOM_Y + 6, 58, 32, 'OPEN', () => session.events.emit('open-shop'), COLOURS.accent);
  }

  update() {
    const { state, phase } = session;
    this.dayText.setText(`DAY ${state.day}`);
    this.clockText.setText(session.clockLabel());
    this.moneyText.setText(formatCents(state.balance));
    const morning = phase === 'morning';
    this.openButton.setVisible(morning);
    this.hint.setMaxWidth(morning ? 106 : 168);
    this.hint.setText(this.hintText());
  }

  private hintText(): string {
    if (performance.now() < session.messageUntil) return session.message;
    const { state, phase, queueReady } = session;
    if (phase === 'morning') {
      const anyStocked = state.shelves.some((s) => s.qty > 0);
      return anyStocked ? 'PC ORDERS STOCK. OPEN WHEN READY' : 'TAP A SHELF TO STOCK IT';
    }
    if (queueReady > 0) return `${queueReady} IN LINE. TAP THE REGISTER`;
    if (phase === 'closing') return 'LAST CUSTOMERS FINISHING UP';
    return 'SHOP OPEN. KEEP SHELVES FULL';
  }
}
