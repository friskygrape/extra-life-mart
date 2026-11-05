import Phaser from 'phaser';
import { isMuted, sfx, toggleMuted } from '../audio';
import { L } from '../layout';
import { isMusicOn, toggleMusic } from '../music';
import { session } from '../session';
import { BUTTONS, COLOURS, button, label } from '../ui';

const PANEL_W = 184;
const PADDING = 10;
const RESTART_RED = 0x9a3b30;

const soundLabel = () => `SOUND: ${isMuted() ? 'OFF' : 'ON'}`;
const musicLabel = () => `MUSIC: ${isMusicOn() ? 'ON' : 'OFF'}`;

/** Stops the game and shows the menu on top of it. */
export class PauseScene extends Phaser.Scene {
  private content: { destroy(): void }[] = [];
  private pausedScenes: string[] = [];

  constructor() {
    super('Pause');
  }

  create() {
    this.content = [];
    // Everything underneath stops, including a sale in progress, until you return.
    this.pausedScenes = this.game.scene.getScenes(true)
      .map((s) => s.scene.key)
      .filter((key) => key !== 'Pause');
    this.pausedScenes.forEach((key) => this.scene.pause(key));

    this.add.rectangle(0, 0, L.W, L.H, 0x0c1822, 0.72).setOrigin(0).setInteractive();
    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame());
    this.showMenu();
  }

  /** Draws a centred panel the right height for its contents, and returns its inner top. */
  private panel(height: number): { x: number; y: number; w: number } {
    const x = Math.floor((L.W - PANEL_W) / 2);
    const y = Math.floor((L.H - height) / 2);
    this.track(this.add.rectangle(x, y, PANEL_W, height, COLOURS.ink).setOrigin(0));
    this.track(this.add.rectangle(x + 1, y + 1, PANEL_W - 2, height - 2, COLOURS.bg).setOrigin(0));
    return { x: x + PADDING, y: y + PADDING, w: PANEL_W - PADDING * 2 };
  }

  private track<T extends { destroy(): void }>(obj: T): T {
    this.content.push(obj);
    return obj;
  }

  private clear() {
    this.content.forEach((o) => o.destroy());
    this.content = [];
  }

  private showMenu() {
    this.clear();
    const gap = 4;
    const h = BUTTONS.largeH;
    const { x, y, w } = this.panel(PADDING * 2 + 24 + h * 4 + gap * 3 + 8);
    this.track(label(this, Math.floor(L.W / 2), y + 2, 'PAUSE', COLOURS.gold, 'center').setScale(2));

    let rowY = y + 24;
    const sound = this.track(button(this, x, rowY, w, h, soundLabel(), () => {
      toggleMuted();
      sound.setLabel(soundLabel());
      sfx.click();
    }, COLOURS.button, null));
    rowY += h + gap;
    const music = this.track(button(this, x, rowY, w, h, musicLabel(), () => {
      toggleMusic();
      music.setLabel(musicLabel());
      sfx.click();
    }, COLOURS.button, null));
    rowY += h + gap;
    this.track(button(this, x, rowY, w, h, 'RESTART GAME', () => this.showConfirm()));
    rowY += h + gap + 8;
    this.track(button(this, x, rowY, w, h, 'RETURN TO GAME', () => this.resumeGame(), COLOURS.accent));
  }

  private showConfirm() {
    this.clear();
    const gap = 4;
    const h = BUTTONS.largeH;
    const { x, y, w } = this.panel(PADDING * 2 + 66 + h * 2 + gap);
    const question = this.track(label(this, x, y, 'ARE YOU SURE YOU WANT TO RESTART?', COLOURS.white));
    question.setMaxWidth(w);
    const warning = this.track(label(this, x, y + 22, 'YOU WILL LOSE ALL PROGRESS AND START FROM THE BEGINNING.', COLOURS.dim));
    warning.setMaxWidth(w);

    let rowY = y + 66;
    this.track(button(this, x, rowY, w, h, 'RESTART', () => this.restart(), RESTART_RED));
    rowY += h + gap;
    this.track(button(this, x, rowY, w, h, 'CANCEL', () => this.showMenu()));
  }

  private resumeGame() {
    this.pausedScenes.forEach((key) => this.scene.resume(key));
    this.scene.stop();
  }

  /** A fresh page load guarantees nothing from the old game is left on screen. */
  private restart() {
    session.reset();
    window.location.reload();
  }
}
