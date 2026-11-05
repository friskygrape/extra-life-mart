/**
 * Original background music, synthesised at runtime like the sound effects. A small
 * sequencer schedules notes a little ahead of time, so the beat holds steady even when
 * the game is busy. The arrangement follows the time of day.
 */
import { context } from './audio';

export type MusicMood = 'morning' | 'day' | 'evening';

const MUSIC_KEY = 'extra-life-mart-music';
const VOLUME = 0.8;
const FADE_SECONDS = 0.6;
const LOOKAHEAD_SECONDS = 0.35;
const TICK_MS = 120;
const STEPS_PER_BAR = 8;

/** Note numbers: 60 is middle C. Null is a rest. The bass stays high enough for a phone speaker. */
type Part = (number | null)[];

interface Arrangement {
  bpm: number;
  /** One chord per bar: the bass note, then the notes to pick through. */
  chords: { bass: number; notes: number[] }[];
  /** Eight steps per bar. */
  melody: Part;
  melodyVolume: number;
  arpVolume: number;
  bassVolume: number;
  /** Which steps of the bar the arpeggio plays on. */
  arpSteps: number[];
  /** Soft shaker hits, or none. */
  shaker: number[];
}

const _ = null;
const CHORDS = {
  C: { bass: 48, notes: [60, 64, 67, 72] },
  Am: { bass: 45, notes: [60, 64, 69, 72] },
  F: { bass: 53, notes: [60, 65, 69, 72] },
  G: { bass: 43, notes: [59, 62, 67, 71] },
  Dm: { bass: 50, notes: [62, 65, 69, 74] },
  Em: { bass: 52, notes: [59, 64, 67, 71] },
};

const ARRANGEMENTS: Record<MusicMood, Arrangement> = {
  // Waking up: slow, sparse and hopeful
  morning: {
    bpm: 84,
    chords: [CHORDS.C, CHORDS.Em, CHORDS.F, CHORDS.C, CHORDS.Am, CHORDS.F, CHORDS.Dm, CHORDS.G],
    melody: [
      76, _, _, _, 79, _, _, _, /**/ 76, _, 74, _, _, _, _, _,
      72, _, _, _, 74, _, 76, _, /**/ 79, _, _, _, _, _, _, _,
      81, _, _, _, 79, _, 76, _, /**/ 77, _, _, _, 76, _, _, _,
      74, _, _, _, 72, _, 74, _, /**/ 74, _, _, _, _, _, _, _,
    ],
    melodyVolume: 0.05,
    arpVolume: 0.022,
    bassVolume: 0.1,
    arpSteps: [0, 2, 4, 6],
    shaker: [],
  },
  // Open for business: a bouncy beach groove
  day: {
    bpm: 108,
    chords: [CHORDS.C, CHORDS.Am, CHORDS.F, CHORDS.G, CHORDS.C, CHORDS.Em, CHORDS.F, CHORDS.G],
    melody: [
      79, _, 76, 79, _, 81, 79, _, /**/ 76, _, 72, 76, _, _, 74, _,
      77, _, 76, 74, _, 72, 74, _, /**/ 79, _, _, 74, _, _, _, _,
      79, _, 76, 79, _, 84, 83, _, /**/ 79, _, 76, _, 79, 76, 74, _,
      72, _, 74, 76, _, 77, 79, _, /**/ 74, _, 76, 74, _, 71, 74, _,
    ],
    melodyVolume: 0.045,
    arpVolume: 0.022,
    bassVolume: 0.11,
    arpSteps: [0, 1, 2, 3, 4, 5, 6, 7],
    shaker: [2, 6, 7],
  },
  // Winding down: warm, slow and a little wistful
  evening: {
    bpm: 72,
    chords: [CHORDS.Am, CHORDS.F, CHORDS.C, CHORDS.G, CHORDS.Am, CHORDS.Dm, CHORDS.F, CHORDS.G],
    melody: [
      76, _, _, _, 72, _, _, _, /**/ 77, _, _, 76, 72, _, _, _,
      79, _, _, _, 76, _, 72, _, /**/ 74, _, _, _, _, _, _, _,
      76, _, _, _, 81, _, _, _, /**/ 77, _, _, _, 74, _, _, _,
      72, _, 74, _, 76, _, _, _, /**/ 74, _, _, _, _, _, 71, _,
    ],
    melodyVolume: 0.04,
    arpVolume: 0.018,
    bassVolume: 0.09,
    arpSteps: [0, 3, 6],
    shaker: [],
  },
};

const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12);

function playNote(ac: BaseAudioContext, out: AudioNode, note: number, at: number, length: number, type: OscillatorType, volume: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  gain.gain.value = 0;
  osc.type = type;
  osc.frequency.value = frequency(note);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function playShaker(ac: BaseAudioContext, out: AudioNode, at: number) {
  const length = 0.05;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  const gain = ac.createGain();
  // Set before it starts: the default of full volume would otherwise click on the first sample.
  gain.gain.value = 0.018;
  gain.gain.setValueAtTime(0.018, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(gain).connect(out);
  source.start(at);
}

/** Plays one step of an arrangement. Separate from the clock, so it can also be rendered offline. */
export function playStep(ac: BaseAudioContext, out: AudioNode, mood: MusicMood, step: number, at: number): number {
  const arrangement = ARRANGEMENTS[mood];
  const stepSeconds = 60 / arrangement.bpm / 2;
  const bar = Math.floor(step / STEPS_PER_BAR) % arrangement.chords.length;
  const inBar = step % STEPS_PER_BAR;
  const chord = arrangement.chords[bar];

  if (inBar === 0 || inBar === 4) playNote(ac, out, chord.bass + (inBar === 4 ? 7 : 0), at, stepSeconds * 3.5, 'triangle', arrangement.bassVolume);
  if (arrangement.arpSteps.includes(inBar)) {
    playNote(ac, out, chord.notes[inBar % chord.notes.length], at, stepSeconds * 1.6, 'square', arrangement.arpVolume);
  }
  const lead = arrangement.melody[step % arrangement.melody.length];
  if (lead !== null) playNote(ac, out, lead, at, stepSeconds * 2.6, 'triangle', arrangement.melodyVolume * 2);
  if (arrangement.shaker.includes(inBar)) playShaker(ac, out, at);
  return stepSeconds;
}

let enabled = readEnabled();
let mood: MusicMood = 'morning';
let master: GainNode | null = null;
let timer = 0;
let nextStepAt = 0;
let step = 0;
let scheduled = 0;

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(MUSIC_KEY) !== '0';
  } catch {
    return true;
  }
}

function tick() {
  const ac = context();
  if (!ac || !master || ac.state !== 'running') return;
  // After a long stall, carry on from now rather than playing everything missed at once.
  if (nextStepAt < ac.currentTime) nextStepAt = ac.currentTime + 0.05;
  while (nextStepAt < ac.currentTime + LOOKAHEAD_SECONDS) {
    nextStepAt += playStep(ac, master, mood, step, nextStepAt);
    step += 1;
    scheduled += 1;
  }
}

function fadeTo(target: number) {
  const ac = context();
  if (!ac || !master) return;
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setValueAtTime(master.gain.value, ac.currentTime);
  master.gain.linearRampToValueAtTime(target, ac.currentTime + FADE_SECONDS);
}

function stopTimer() {
  window.clearInterval(timer);
  timer = 0;
}

function startTimer() {
  if (!timer && enabled && master) timer = window.setInterval(tick, TICK_MS);
}

/** Starts on the first tap, because browsers don't allow sound before one. */
export function startMusic(): void {
  const ac = context();
  if (!ac || master) return;
  master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  if (enabled) fadeTo(VOLUME);
  startTimer();
  // Silence in a pocket or a background tab.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopTimer();
      void ac.suspend();
    } else {
      void ac.resume();
      startTimer();
    }
  });
}

export function setMusicMood(next: MusicMood): void {
  if (next === mood) return;
  mood = next;
  // Each arrangement starts cleanly from its first bar.
  step = 0;
}

export const isMusicOn = () => enabled;

export function toggleMusic(): boolean {
  enabled = !enabled;
  try {
    window.localStorage.setItem(MUSIC_KEY, enabled ? '1' : '0');
  } catch {
    // The setting just won't persist.
  }
  if (enabled) {
    fadeTo(VOLUME);
    startTimer();
  } else {
    fadeTo(0);
    stopTimer();
  }
  return enabled;
}

/** For the browser test. */
export const musicStatus = () => ({ enabled, mood, scheduled, playing: timer !== 0 });
