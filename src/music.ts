/**
 * Original 80s pop background music, synthesised at runtime like the sound effects. A small
 * sequencer schedules notes a little ahead of time, so the beat holds steady even when
 * the game is busy. The arrangement follows the time of day.
 */
import { context } from './audio';

export type MusicMood = 'morning' | 'day' | 'evening';

const MUSIC_KEY = 'extra-life-mart-music';
const VOLUME = 1;
const FADE_SECONDS = 0.6;
const LOOKAHEAD_SECONDS = 0.35;
const TICK_MS = 120;
const STEPS_PER_BAR = 16;
const STEPS_PER_BEAT = 4;
const REVERB_SECONDS = 0.9;

interface Chord {
  /** The bass note. Note numbers: 60 is middle C. */
  bass: number;
  /** What the brass stabs and bells play. */
  notes: number[];
}

const CHORDS: Record<string, Chord> = {
  C: { bass: 48, notes: [60, 64, 67] },
  G: { bass: 43, notes: [59, 62, 67] },
  Am: { bass: 45, notes: [60, 64, 69] },
  F: { bass: 41, notes: [60, 65, 69] },
  Dm: { bass: 50, notes: [62, 65, 69] },
  Em: { bass: 52, notes: [59, 64, 67] },
};

/** bar, step within the bar, note, length in steps */
type LeadNote = [number, number, number, number];

interface Arrangement {
  bpm: number;
  chords: Chord[];
  lead: LeadNote[];
  leadVolume: number;
  padVolume: number;
  /** step, then how many notes above the bass note: the octave jumps are what make it bounce */
  bass: [number, number][];
  bassVolume: number;
  stabSteps: number[];
  stabVolume: number;
  bellSteps: number[];
  bellVolume: number;
  kick: number[];
  snare: number[];
  hat: number[];
  openHat: number[];
}

const EVERY_16TH = Array.from({ length: STEPS_PER_BAR }, (_, i) => i);
const EVERY_8TH = EVERY_16TH.filter((i) => i % 2 === 0);
/** A bouncing, syncopated funk-pop bass line. */
const BOUNCE: [number, number][] = [[0, 0], [3, 0], [4, 12], [6, 0], [8, 0], [10, 12], [11, 0], [14, 7]];

const ARRANGEMENTS: Record<MusicMood, Arrangement> = {
  // Getting ready: light and cheerful, with sparkling bells over a gentle beat
  morning: {
    bpm: 112,
    chords: [CHORDS.C, CHORDS.Am, CHORDS.F, CHORDS.G, CHORDS.C, CHORDS.Am, CHORDS.F, CHORDS.G],
    lead: [
      [0, 0, 84, 2], [0, 3, 79, 2], [0, 6, 76, 2], [0, 8, 79, 4],
      [1, 0, 81, 2], [1, 3, 76, 2], [1, 6, 72, 2], [1, 8, 76, 4],
      [2, 0, 77, 2], [2, 3, 81, 2], [2, 6, 84, 2], [2, 8, 81, 4],
      [3, 0, 79, 2], [3, 3, 83, 2], [3, 6, 86, 6],
      [4, 0, 84, 2], [4, 3, 79, 2], [4, 6, 76, 2], [4, 8, 79, 4],
      [5, 0, 81, 2], [5, 3, 84, 2], [5, 6, 88, 6],
      [6, 0, 86, 2], [6, 3, 84, 2], [6, 6, 81, 2], [6, 8, 77, 4],
      [7, 0, 79, 2], [7, 3, 83, 2], [7, 6, 84, 2], [7, 8, 86, 6],
    ],
    leadVolume: 0,
    padVolume: 0.014,
    bass: [[0, 0], [6, 0], [8, 0], [14, 7]],
    bassVolume: 0.09,
    stabSteps: [],
    stabVolume: 0,
    bellSteps: EVERY_8TH,
    bellVolume: 0.05,
    kick: [0, 8],
    snare: [4, 12],
    hat: EVERY_8TH,
    openHat: [],
  },
  // Open for business: the full band, bouncy, bright and catchy
  day: {
    bpm: 126,
    chords: [CHORDS.C, CHORDS.G, CHORDS.Am, CHORDS.F, CHORDS.C, CHORDS.G, CHORDS.F, CHORDS.G],
    lead: [
      [0, 0, 76, 2], [0, 3, 79, 2], [0, 6, 84, 2], [0, 8, 81, 2], [0, 11, 79, 3], [0, 14, 76, 2],
      [1, 0, 74, 2], [1, 3, 79, 2], [1, 6, 83, 2], [1, 8, 81, 2], [1, 11, 79, 5],
      [2, 0, 72, 2], [2, 3, 76, 2], [2, 6, 81, 2], [2, 8, 79, 2], [2, 11, 76, 3], [2, 14, 74, 2],
      [3, 0, 72, 2], [3, 3, 77, 2], [3, 6, 81, 2], [3, 8, 84, 4], [3, 12, 81, 2], [3, 14, 79, 2],
      [4, 0, 76, 2], [4, 3, 79, 2], [4, 6, 84, 2], [4, 8, 81, 2], [4, 11, 79, 3], [4, 14, 76, 2],
      [5, 0, 74, 2], [5, 3, 79, 2], [5, 6, 83, 2], [5, 8, 86, 2], [5, 11, 83, 5],
      [6, 0, 81, 2], [6, 3, 84, 2], [6, 6, 88, 2], [6, 8, 86, 2], [6, 11, 84, 3], [6, 14, 81, 2],
      [7, 0, 79, 2], [7, 2, 81, 2], [7, 4, 83, 2], [7, 6, 86, 6],
    ],
    leadVolume: 0.03,
    padVolume: 0.012,
    bass: BOUNCE,
    bassVolume: 0.1,
    stabSteps: [0, 3, 6, 10, 14],
    stabVolume: 0.022,
    bellSteps: [2, 6, 10, 12],
    bellVolume: 0.028,
    kick: [0, 6, 8, 14],
    snare: [4, 12],
    hat: EVERY_16TH,
    openHat: [2, 10],
  },
  // Winding down: still sunny, with a warm and easy groove
  evening: {
    bpm: 104,
    chords: [CHORDS.F, CHORDS.G, CHORDS.Em, CHORDS.Am, CHORDS.Dm, CHORDS.G, CHORDS.C, CHORDS.C],
    lead: [
      [0, 0, 81, 3], [0, 3, 84, 3], [0, 6, 81, 2], [0, 8, 77, 4], [0, 12, 76, 4],
      [1, 0, 74, 3], [1, 3, 79, 3], [1, 6, 83, 2], [1, 8, 79, 8],
      [2, 0, 79, 3], [2, 3, 83, 3], [2, 6, 79, 2], [2, 8, 76, 4], [2, 12, 74, 4],
      [3, 0, 72, 3], [3, 3, 76, 3], [3, 6, 81, 2], [3, 8, 84, 8],
      [4, 0, 86, 3], [4, 3, 84, 3], [4, 6, 81, 2], [4, 8, 77, 8],
      [5, 0, 79, 3], [5, 3, 83, 3], [5, 6, 86, 2], [5, 8, 83, 8],
      [6, 0, 84, 3], [6, 3, 79, 3], [6, 6, 76, 2], [6, 8, 72, 8],
    ],
    leadVolume: 0.024,
    padVolume: 0.018,
    bass: [[0, 0], [3, 0], [6, 12], [8, 0], [11, 0], [14, 7]],
    bassVolume: 0.09,
    stabSteps: [3, 11],
    stabVolume: 0.016,
    bellSteps: [0, 4, 8, 12],
    bellVolume: 0.03,
    kick: [0, 8, 10],
    snare: [4, 12],
    hat: EVERY_8TH,
    openHat: [14],
  },
};

const LEAD_LOOKUP: Record<MusicMood, Map<number, LeadNote>> = {
  morning: leadLookup('morning'),
  day: leadLookup('day'),
  evening: leadLookup('evening'),
};

function leadLookup(mood: MusicMood): Map<number, LeadNote> {
  return new Map(ARRANGEMENTS[mood].lead.map((n) => [n[0] * STEPS_PER_BAR + n[1], n]));
}

const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Everything the voices play into: the mix and a little shared space. */
export interface MusicBus {
  dry: AudioNode;
  reverb: AudioNode;
  echo: AudioNode;
  echoDelay: DelayNode;
  noise: AudioBuffer;
}

function reverbImpulse(ac: BaseAudioContext): AudioBuffer {
  const length = Math.ceil(ac.sampleRate * REVERB_SECONDS);
  const impulse = ac.createBuffer(2, length, ac.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return impulse;
}

export function createBus(ac: BaseAudioContext, out: AudioNode): MusicBus {
  const glue = ac.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.ratio.value = 3;
  glue.attack.value = 0.006;
  glue.release.value = 0.12;
  glue.connect(out);

  const dry = ac.createGain();
  dry.connect(glue);

  const reverbIn = ac.createGain();
  const convolver = ac.createConvolver();
  convolver.buffer = reverbImpulse(ac);
  const reverbOut = ac.createGain();
  reverbOut.gain.value = 0.4;
  reverbIn.connect(convolver).connect(reverbOut).connect(glue);

  const echoIn = ac.createGain();
  const echoDelay = ac.createDelay(2);
  const echoFeedback = ac.createGain();
  echoFeedback.gain.value = 0.25;
  const echoOut = ac.createGain();
  echoOut.gain.value = 0.3;
  echoIn.connect(echoDelay);
  echoDelay.connect(echoFeedback).connect(echoDelay);
  echoDelay.connect(echoOut).connect(glue);

  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  return { dry, reverb: reverbIn, echo: echoIn, echoDelay, noise };
}

/** A volume shape starting silent, so nothing clicks on its first sample. */
function envelope(ac: BaseAudioContext, at: number, attack: number, peak: number, length: number): GainNode {
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  return gain;
}

function oscillator(ac: BaseAudioContext, type: OscillatorType, note: number, detune: number, at: number, length: number): OscillatorNode {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency(note);
  osc.detune.value = detune;
  osc.start(at);
  osc.stop(at + length + 0.02);
  return osc;
}

/** A filter that snaps shut, which is what makes synths sound bright and punchy. */
function snappyFilter(ac: BaseAudioContext, at: number, from: number, to: number, time: number, resonance: number): BiquadFilterNode {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = resonance;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + time);
  return filter;
}

function playNoise(ac: BaseAudioContext, bus: MusicBus, at: number, length: number, filter: BiquadFilterNode, gain: GainNode, out: AudioNode) {
  const source = ac.createBufferSource();
  source.buffer = bus.noise;
  source.connect(filter).connect(gain).connect(out);
  source.start(at, Math.random() * 0.5, length + 0.02);
}

function playKick(ac: BaseAudioContext, bus: MusicBus, at: number) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, at);
  osc.frequency.exponentialRampToValueAtTime(55, at + 0.08);
  osc.connect(envelope(ac, at, 0.002, 0.36, 0.17)).connect(bus.dry);
  osc.start(at);
  osc.stop(at + 0.19);
}

/** A punchy snare with handclaps layered on top. */
function playSnare(ac: BaseAudioContext, bus: MusicBus, at: number) {
  const body = ac.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(260, at);
  body.frequency.exponentialRampToValueAtTime(170, at + 0.06);
  body.connect(envelope(ac, at, 0.002, 0.13, 0.1)).connect(bus.dry);
  body.start(at);
  body.stop(at + 0.12);

  [0, 0.012, 0.024].forEach((offset, i) => {
    const tone = ac.createBiquadFilter();
    tone.type = 'bandpass';
    tone.frequency.value = 1800;
    tone.Q.value = 0.8;
    const length = i === 2 ? 0.13 : 0.02;
    const gain = envelope(ac, at + offset, 0.001, 0.12, length);
    playNoise(ac, bus, at + offset, length, tone, gain, bus.dry);
    gain.connect(bus.reverb);
  });
}

function playHat(ac: BaseAudioContext, bus: MusicBus, at: number, length: number, volume: number) {
  const tone = ac.createBiquadFilter();
  tone.type = 'highpass';
  tone.frequency.value = 8000;
  playNoise(ac, bus, at, length, tone, envelope(ac, at, 0.001, volume, length), bus.dry);
}

/** A tumbling drum fill to lead back into the top of the tune. */
function playTom(ac: BaseAudioContext, bus: MusicBus, at: number, pitch: number) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch * 1.6, at);
  osc.frequency.exponentialRampToValueAtTime(pitch, at + 0.07);
  const gain = envelope(ac, at, 0.002, 0.16, 0.15);
  osc.connect(gain).connect(bus.dry);
  gain.connect(bus.reverb);
  osc.start(at);
  osc.stop(at + 0.17);
}

/** A slappy, rubbery bass. */
function playBass(ac: BaseAudioContext, bus: MusicBus, note: number, at: number, length: number, volume: number) {
  const filter = snappyFilter(ac, at, 3000, 500, 0.09, 5);
  oscillator(ac, 'sawtooth', note, -4, at, length).connect(filter);
  oscillator(ac, 'square', note, 4, at, length).connect(filter);
  filter.connect(envelope(ac, at, 0.003, volume, length)).connect(bus.dry);
}

/** A short, bright synth brass hit on the whole chord. */
function playStab(ac: BaseAudioContext, bus: MusicBus, chord: Chord, at: number, length: number, volume: number) {
  const filter = snappyFilter(ac, at, 5500, 1400, length, 1);
  const gain = envelope(ac, at, 0.006, volume, length);
  for (const note of chord.notes) {
    [-8, 8].forEach((detune) => {
      const pan = ac.createStereoPanner();
      pan.pan.value = detune < 0 ? -0.5 : 0.5;
      oscillator(ac, 'sawtooth', note + 12, detune, at, length).connect(pan).connect(filter);
    });
  }
  filter.connect(gain);
  gain.connect(bus.dry);
  gain.connect(bus.reverb);
}

/** The glassy digital electric piano of the decade: one sine bending another. */
function playBell(ac: BaseAudioContext, bus: MusicBus, note: number, at: number, length: number, volume: number) {
  const hz = frequency(note);
  const modulator = ac.createOscillator();
  modulator.frequency.value = hz * 3.5;
  const amount = ac.createGain();
  amount.gain.value = 0;
  amount.gain.setValueAtTime(hz * 2.2, at);
  amount.gain.exponentialRampToValueAtTime(1, at + length * 0.6);
  modulator.connect(amount);
  const carrier = ac.createOscillator();
  carrier.frequency.value = hz;
  amount.connect(carrier.frequency);
  const gain = envelope(ac, at, 0.002, volume, length);
  carrier.connect(gain);
  gain.connect(bus.dry);
  gain.connect(bus.echo);
  gain.connect(bus.reverb);
  modulator.start(at);
  carrier.start(at);
  modulator.stop(at + length + 0.02);
  carrier.stop(at + length + 0.02);
}

/** A soft bed of chord behind everything, to fill out the middle. */
function playPad(ac: BaseAudioContext, bus: MusicBus, chord: Chord, at: number, length: number, volume: number) {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.05);
  gain.gain.setValueAtTime(volume, at + length - 0.05);
  gain.gain.linearRampToValueAtTime(0, at + length + 0.03);
  filter.connect(gain).connect(bus.dry);
  for (const note of chord.notes) oscillator(ac, 'sawtooth', note, 6, at, length + 0.03).connect(filter);
}

/** A bright, singing synth lead that hops from note to note. */
function playLead(ac: BaseAudioContext, bus: MusicBus, note: number, at: number, length: number, volume: number) {
  const filter = snappyFilter(ac, at, 6500, 2600, 0.12, 2);
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.008);
  gain.gain.setValueAtTime(volume, at + Math.max(0.01, length - 0.04));
  gain.gain.linearRampToValueAtTime(0, at + length);
  const wobble = ac.createOscillator();
  wobble.frequency.value = 6;
  const depth = ac.createGain();
  depth.gain.value = 7;
  wobble.connect(depth);
  wobble.start(at);
  wobble.stop(at + length + 0.02);
  (['square', 'sawtooth'] as const).forEach((type, i) => {
    const osc = oscillator(ac, type, note, i === 0 ? -4 : 5, at, length);
    depth.connect(osc.detune);
    osc.connect(filter);
  });
  filter.connect(gain);
  gain.connect(bus.dry);
  gain.connect(bus.echo);
  gain.connect(bus.reverb);
}

const LAST_BAR_FILL: Record<number, number> = { 12: 220, 13: 180, 14: 150, 15: 120 };

/** Plays one step of an arrangement. Separate from the clock, so it can also be rendered offline. */
export function playStep(ac: BaseAudioContext, bus: MusicBus, mood: MusicMood, step: number, at: number): number {
  const arr = ARRANGEMENTS[mood];
  const stepSeconds = 60 / arr.bpm / STEPS_PER_BEAT;
  const bars = arr.chords.length;
  const stepInLoop = step % (bars * STEPS_PER_BAR);
  const bar = Math.floor(stepInLoop / STEPS_PER_BAR);
  const inBar = stepInLoop % STEPS_PER_BAR;
  const chord = arr.chords[bar];
  const fill = bar === bars - 1 ? LAST_BAR_FILL[inBar] : undefined;

  if (inBar === 0) {
    bus.echoDelay.delayTime.setValueAtTime(stepSeconds * 3, at);
    playPad(ac, bus, chord, at, stepSeconds * STEPS_PER_BAR, arr.padVolume);
  }
  if (arr.kick.includes(inBar)) playKick(ac, bus, at);
  if (fill) playTom(ac, bus, at, fill);
  else if (arr.snare.includes(inBar)) playSnare(ac, bus, at);
  if (arr.openHat.includes(inBar)) playHat(ac, bus, at, 0.12, 0.03);
  else if (arr.hat.includes(inBar)) playHat(ac, bus, at, 0.035, inBar % 4 === 0 ? 0.03 : 0.018);

  const bass = arr.bass.find(([at16]) => at16 === inBar);
  if (bass) playBass(ac, bus, chord.bass + bass[1], at, stepSeconds * 1.6, arr.bassVolume);
  if (arr.stabSteps.includes(inBar)) playStab(ac, bus, chord, at, stepSeconds * 1.8, arr.stabVolume);
  if (arr.bellSteps.includes(inBar)) {
    const position = arr.bellSteps.indexOf(inBar);
    playBell(ac, bus, chord.notes[position % chord.notes.length] + 24, at, stepSeconds * 3, arr.bellVolume);
  }
  const lead = LEAD_LOOKUP[mood].get(stepInLoop);
  if (lead) {
    // In the morning the melody rings out on the bells instead of the lead synth.
    if (arr.leadVolume > 0) playLead(ac, bus, lead[2], at, stepSeconds * lead[3] * 0.92, arr.leadVolume);
    else playBell(ac, bus, lead[2] + 12, at, stepSeconds * 4, arr.bellVolume * 1.3);
  }
  return stepSeconds;
}

let enabled = readEnabled();
let mood: MusicMood = 'morning';
let master: GainNode | null = null;
let bus: MusicBus | null = null;
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
  if (!ac || !bus || ac.state !== 'running') return;
  // After a long stall, carry on from now rather than playing everything missed at once.
  if (nextStepAt < ac.currentTime) nextStepAt = ac.currentTime + 0.05;
  while (nextStepAt < ac.currentTime + LOOKAHEAD_SECONDS) {
    nextStepAt += playStep(ac, bus, mood, step, nextStepAt);
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
  if (!timer && enabled && bus) timer = window.setInterval(tick, TICK_MS);
}

/** Starts on the first tap, because browsers don't allow sound before one. */
export function startMusic(): void {
  const ac = context();
  if (!ac || master) return;
  master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  bus = createBus(ac, master);
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
