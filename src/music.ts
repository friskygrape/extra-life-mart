/**
 * Original synthwave background music, synthesised at runtime like the sound effects.
 * A small sequencer schedules notes a little ahead of time, so the beat holds steady even
 * when the game is busy. The arrangement follows the time of day.
 */
import { context } from './audio';

export type MusicMood = 'morning' | 'day' | 'evening';

const MUSIC_KEY = 'extra-life-mart-music';
const VOLUME = 0.8;
const FADE_SECONDS = 0.6;
const LOOKAHEAD_SECONDS = 0.35;
const TICK_MS = 120;
const STEPS_PER_BAR = 16;
const STEPS_PER_BEAT = 4;
const REVERB_SECONDS = 1.8;

interface Chord {
  /** The bass note. Note numbers: 60 is middle C. */
  bass: number;
  /** What the pads hold and the arpeggio picks through. */
  notes: number[];
}

const CHORDS: Record<string, Chord> = {
  Am: { bass: 45, notes: [57, 60, 64] },
  F: { bass: 41, notes: [57, 60, 65] },
  C: { bass: 48, notes: [55, 60, 64] },
  G: { bass: 43, notes: [55, 59, 62] },
  Dm: { bass: 50, notes: [57, 62, 65] },
  Em: { bass: 40, notes: [55, 59, 64] },
};

/** bar, step within the bar, note, length in steps */
type LeadNote = [number, number, number, number];

interface Arrangement {
  bpm: number;
  chords: Chord[];
  lead: LeadNote[];
  leadVolume: number;
  padVolume: number;
  /** Pad filter, opening across the eight bars. */
  padCutoff: [number, number];
  bassSteps: number[];
  bassVolume: number;
  arpSteps: number[];
  arpVolume: number;
  kick: number[];
  snare: number[];
  hat: number[];
  reverbSend: number;
}

const EVERY_16TH = Array.from({ length: STEPS_PER_BAR }, (_, i) => i);
const EVERY_8TH = EVERY_16TH.filter((i) => i % 2 === 0);

const ARRANGEMENTS: Record<MusicMood, Arrangement> = {
  // Sunrise: pads and an arpeggio slowly filtering in, with no drums
  morning: {
    bpm: 80,
    chords: [CHORDS.C, CHORDS.G, CHORDS.Am, CHORDS.F, CHORDS.C, CHORDS.G, CHORDS.F, CHORDS.G],
    lead: [
      [2, 0, 76, 12], [3, 8, 72, 8],
      [6, 0, 77, 8], [6, 8, 76, 8], [7, 0, 74, 16],
    ],
    leadVolume: 0.04,
    padVolume: 0.05,
    padCutoff: [500, 1900],
    bassSteps: [0, 8],
    bassVolume: 0.1,
    arpSteps: EVERY_8TH,
    arpVolume: 0.04,
    kick: [],
    snare: [],
    hat: [],
    reverbSend: 0.5,
  },
  // Open for business: night-drive energy with everything playing
  day: {
    bpm: 100,
    chords: [CHORDS.Am, CHORDS.F, CHORDS.C, CHORDS.G, CHORDS.Am, CHORDS.F, CHORDS.Dm, CHORDS.Em],
    lead: [
      [0, 0, 76, 6], [0, 6, 74, 2], [0, 8, 72, 4], [0, 12, 69, 4],
      [1, 0, 72, 6], [1, 6, 74, 2], [1, 8, 77, 8],
      [2, 0, 79, 6], [2, 6, 77, 2], [2, 8, 76, 4], [2, 12, 72, 4],
      [3, 0, 74, 8], [3, 8, 71, 4], [3, 12, 74, 4],
      [4, 0, 81, 6], [4, 6, 79, 2], [4, 8, 76, 8],
      [5, 0, 77, 4], [5, 4, 76, 2], [5, 6, 74, 2], [5, 8, 72, 8],
      [6, 0, 74, 4], [6, 4, 77, 4], [6, 8, 81, 8],
      [7, 0, 79, 6], [7, 6, 76, 2], [7, 8, 71, 8],
    ],
    leadVolume: 0.038,
    padVolume: 0.03,
    padCutoff: [1300, 2100],
    bassSteps: EVERY_8TH,
    bassVolume: 0.1,
    arpSteps: EVERY_16TH,
    arpVolume: 0.018,
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
    reverbSend: 0.3,
  },
  // Neon sunset: slow, heavy with reverb, and a little wistful
  evening: {
    bpm: 84,
    chords: [CHORDS.Am, CHORDS.Em, CHORDS.F, CHORDS.C, CHORDS.Dm, CHORDS.Am, CHORDS.F, CHORDS.G],
    lead: [
      [0, 0, 81, 10], [0, 10, 79, 2], [0, 12, 76, 4],
      [1, 0, 79, 12], [1, 12, 76, 4],
      [2, 0, 77, 8], [2, 8, 72, 8],
      [3, 0, 76, 16],
      [4, 0, 74, 8], [4, 8, 77, 4], [4, 12, 81, 4],
      [5, 0, 84, 8], [5, 8, 81, 8],
      [6, 0, 77, 8], [6, 8, 81, 4], [6, 12, 79, 4],
      [7, 0, 74, 16],
    ],
    leadVolume: 0.04,
    padVolume: 0.036,
    padCutoff: [900, 1500],
    bassSteps: EVERY_8TH,
    bassVolume: 0.09,
    arpSteps: [0, 3, 6, 8, 11, 14],
    arpVolume: 0.016,
    kick: [0, 10],
    snare: [8],
    hat: [4, 12],
    reverbSend: 0.55,
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

/** Everything the voices play into: the mix, the ducking pads, and the shared space. */
export interface MusicBus {
  dry: AudioNode;
  /** Pads pass through this, and each kick pushes it down for that breathing pump. */
  pump: GainNode;
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
  glue.threshold.value = -20;
  glue.ratio.value = 4;
  glue.attack.value = 0.008;
  glue.release.value = 0.18;
  glue.connect(out);

  const dry = ac.createGain();
  dry.connect(glue);

  const reverbIn = ac.createGain();
  const convolver = ac.createConvolver();
  convolver.buffer = reverbImpulse(ac);
  const reverbOut = ac.createGain();
  reverbOut.gain.value = 0.7;
  reverbIn.connect(convolver).connect(reverbOut).connect(glue);

  const pump = ac.createGain();
  pump.connect(glue);
  const padSend = ac.createGain();
  padSend.gain.value = 0.5;
  pump.connect(padSend).connect(reverbIn);

  // Echoes grow darker as they repeat.
  const echoIn = ac.createGain();
  const echoDelay = ac.createDelay(2);
  const echoTone = ac.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 2400;
  const echoFeedback = ac.createGain();
  echoFeedback.gain.value = 0.42;
  const echoOut = ac.createGain();
  echoOut.gain.value = 0.55;
  echoIn.connect(echoDelay).connect(echoTone);
  echoTone.connect(echoFeedback).connect(echoDelay);
  echoTone.connect(echoOut).connect(glue);
  echoOut.connect(reverbIn);

  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  return { dry, pump, reverb: reverbIn, echo: echoIn, echoDelay, noise };
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

function saw(ac: BaseAudioContext, note: number, detune: number, at: number, length: number): OscillatorNode {
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = frequency(note);
  osc.detune.value = detune;
  osc.start(at);
  osc.stop(at + length + 0.02);
  return osc;
}

function lowpass(ac: BaseAudioContext, cutoff: number, resonance = 1): BiquadFilterNode {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.Q.value = resonance;
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
  osc.frequency.setValueAtTime(170, at);
  osc.frequency.exponentialRampToValueAtTime(48, at + 0.11);
  osc.connect(envelope(ac, at, 0.002, 0.42, 0.26)).connect(bus.dry);
  osc.start(at);
  osc.stop(at + 0.28);
}

/** The huge 80s snare: a burst of noise that holds, then is cut off dead. */
function playSnare(ac: BaseAudioContext, bus: MusicBus, at: number) {
  const body = ac.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(220, at);
  body.frequency.exponentialRampToValueAtTime(150, at + 0.08);
  body.connect(envelope(ac, at, 0.002, 0.14, 0.12)).connect(bus.dry);
  body.start(at);
  body.stop(at + 0.14);

  const hold = 0.2;
  const gated = ac.createGain();
  gated.gain.value = 0;
  gated.gain.setValueAtTime(0.13, at);
  gated.gain.linearRampToValueAtTime(0.06, at + hold);
  gated.gain.linearRampToValueAtTime(0, at + hold + 0.012);
  const tone = ac.createBiquadFilter();
  tone.type = 'bandpass';
  tone.frequency.value = 2200;
  tone.Q.value = 0.6;
  playNoise(ac, bus, at, hold + 0.02, tone, gated, bus.dry);
  const send = ac.createGain();
  send.gain.value = 0.5;
  gated.connect(send).connect(bus.reverb);
}

function playHat(ac: BaseAudioContext, bus: MusicBus, at: number) {
  const tone = ac.createBiquadFilter();
  tone.type = 'highpass';
  tone.frequency.value = 7500;
  playNoise(ac, bus, at, 0.05, tone, envelope(ac, at, 0.001, 0.035, 0.05), bus.dry);
}

/** Two detuned saws, with a filter that sweeps slowly over the eight bars. */
function playBass(ac: BaseAudioContext, bus: MusicBus, note: number, at: number, length: number, volume: number, sweep: number) {
  const filter = lowpass(ac, 420 + sweep * 900, 3);
  filter.frequency.setValueAtTime(900 + sweep * 1100, at);
  filter.frequency.exponentialRampToValueAtTime(320 + sweep * 500, at + length);
  const gain = envelope(ac, at, 0.004, volume, length);
  saw(ac, note, -7, at, length).connect(filter);
  saw(ac, note, 7, at, length).connect(filter);
  filter.connect(gain).connect(bus.dry);
}

/** A wide held chord, swelling in. Each note is a detuned pair spread across the stereo field. */
function playPad(ac: BaseAudioContext, bus: MusicBus, chord: Chord, at: number, length: number, volume: number, cutoff: number) {
  const filter = lowpass(ac, cutoff, 0.8);
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.14);
  gain.gain.setValueAtTime(volume, at + length - 0.06);
  gain.gain.linearRampToValueAtTime(0, at + length + 0.1);
  filter.connect(gain).connect(bus.pump);
  for (const note of chord.notes) {
    [-11, 11].forEach((detune) => {
      const pan = ac.createStereoPanner();
      pan.pan.value = detune < 0 ? -0.55 : 0.55;
      saw(ac, note, detune, at, length + 0.1).connect(pan).connect(filter);
    });
  }
}

function playArp(ac: BaseAudioContext, bus: MusicBus, note: number, at: number, length: number, volume: number) {
  const filter = lowpass(ac, 3200, 2);
  filter.frequency.setValueAtTime(3200, at);
  filter.frequency.exponentialRampToValueAtTime(900, at + length);
  const gain = envelope(ac, at, 0.003, volume, length);
  saw(ac, note, 0, at, length).connect(filter).connect(gain);
  gain.connect(bus.dry);
  gain.connect(bus.echo);
}

/** The soaring lead: a saw with a slight second voice, gliding from its last note, with vibrato that comes in late. */
function playLead(ac: BaseAudioContext, bus: MusicBus, note: number, from: number | null, at: number, length: number, volume: number) {
  const filter = lowpass(ac, 3400, 1.5);
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.025);
  gain.gain.setValueAtTime(volume, at + Math.max(0.03, length - 0.08));
  gain.gain.linearRampToValueAtTime(0, at + length);
  const vibrato = ac.createOscillator();
  vibrato.frequency.value = 5.2;
  const depth = ac.createGain();
  depth.gain.value = 0;
  depth.gain.setValueAtTime(0, at + 0.18);
  depth.gain.linearRampToValueAtTime(14, at + 0.4);
  vibrato.connect(depth);
  vibrato.start(at);
  vibrato.stop(at + length + 0.02);

  [-5, 6].forEach((detune) => {
    const osc = saw(ac, note, detune, at, length);
    if (from !== null) {
      osc.frequency.setValueAtTime(frequency(from), at);
      osc.frequency.exponentialRampToValueAtTime(frequency(note), at + 0.05);
    }
    depth.connect(osc.detune);
    osc.connect(filter);
  });
  filter.connect(gain);
  gain.connect(bus.dry);
  gain.connect(bus.echo);
  const send = ac.createGain();
  send.gain.value = 0.35;
  gain.connect(send).connect(bus.reverb);
}

/** The note before this one in the melody, to glide from, if it runs right up to this one. */
function previousLeadNote(mood: MusicMood, stepInLoop: number): number | null {
  for (const [bar, at, note, len] of ARRANGEMENTS[mood].lead) {
    if (bar * STEPS_PER_BAR + at + len === stepInLoop) return note;
  }
  return null;
}

/** Plays one step of an arrangement. Separate from the clock, so it can also be rendered offline. */
export function playStep(ac: BaseAudioContext, bus: MusicBus, mood: MusicMood, step: number, at: number): number {
  const arr = ARRANGEMENTS[mood];
  const stepSeconds = 60 / arr.bpm / STEPS_PER_BEAT;
  const bars = arr.chords.length;
  const stepInLoop = step % (bars * STEPS_PER_BAR);
  const bar = Math.floor(stepInLoop / STEPS_PER_BAR);
  const inBar = stepInLoop % STEPS_PER_BAR;
  const chord = arr.chords[bar];
  // Rises and falls across the eight bars
  const sweep = 0.5 - 0.5 * Math.cos((2 * Math.PI * stepInLoop) / (bars * STEPS_PER_BAR));

  if (inBar === 0) {
    bus.echoDelay.delayTime.setValueAtTime(stepSeconds * 3, at);
    const [low, high] = arr.padCutoff;
    playPad(ac, bus, chord, at, stepSeconds * STEPS_PER_BAR, arr.padVolume, low + (high - low) * sweep);
  }
  if (arr.kick.includes(inBar)) {
    playKick(ac, bus, at);
    bus.pump.gain.setValueAtTime(0.3, at);
    bus.pump.gain.linearRampToValueAtTime(1, at + stepSeconds * STEPS_PER_BEAT * 0.8);
  }
  if (arr.snare.includes(inBar)) playSnare(ac, bus, at);
  if (arr.hat.includes(inBar)) playHat(ac, bus, at);
  if (arr.bassSteps.includes(inBar)) {
    const length = arr.bassSteps.length > 2 ? stepSeconds * 1.7 : stepSeconds * 7;
    playBass(ac, bus, chord.bass, at, length, arr.bassVolume, sweep);
  }
  if (arr.arpSteps.includes(inBar)) {
    const notes = [...chord.notes, chord.notes[0] + 12, chord.notes[1] + 12, chord.notes[2] + 12];
    const position = arr.arpSteps.indexOf(inBar);
    playArp(ac, bus, notes[position % notes.length] + 12, at, stepSeconds * 2.2, arr.arpVolume);
  }
  const lead = LEAD_LOOKUP[mood].get(stepInLoop);
  if (lead) playLead(ac, bus, lead[2], previousLeadNote(mood, stepInLoop), at, stepSeconds * lead[3], arr.leadVolume);
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
