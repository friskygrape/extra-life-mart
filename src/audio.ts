/** Retro sound effects synthesised at runtime, so the game ships with no audio files. */

const MUTE_KEY = 'extra-life-mart-muted';

let ctx: AudioContext | null = null;
let played = 0;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // The setting just won't persist.
  }
  return muted;
}

export function context(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Browsers only allow sound after a user gesture, so wake the audio on the first tap. */
export function unlockAudio(): void {
  window.addEventListener('pointerdown', () => context(), { once: true });
}

export function audioStatus() {
  return { state: ctx?.state ?? 'none', played };
}

interface ToneOptions {
  type?: OscillatorType;
  vol?: number;
  at?: number;
  slideTo?: number;
}

function tone(freq: number, duration: number, { type = 'square', vol = 0.05, at = 0, slideTo }: ToneOptions = {}) {
  const ac = context();
  if (!ac) return;
  const start = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration);
}

function noise(duration: number, { vol = 0.06, at = 0, freq = 2000 }: { vol?: number; at?: number; freq?: number } = {}) {
  const ac = context();
  if (!ac) return;
  const start = ac.currentTime + at;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(ac.destination);
  source.start(start);
}

function sound(play: () => void): () => void {
  return () => {
    if (muted) return;
    try {
      play();
      played += 1;
    } catch {
      // Sound should never be able to break the game.
    }
  };
}

export const sfx = {
  click: sound(() => tone(520, 0.04, { vol: 0.03 })),
  pickUp: sound(() => tone(330, 0.09, { slideTo: 660, vol: 0.04 })),
  putBack: sound(() => tone(520, 0.09, { slideTo: 260, vol: 0.04 })),
  bill: sound(() => noise(0.09, { freq: 3200, vol: 0.09 })),
  coin: sound(() => {
    tone(2100, 0.05, { type: 'triangle', vol: 0.07 });
    tone(3100, 0.09, { type: 'triangle', vol: 0.05, at: 0.03 });
  }),
  keypad: sound(() => tone(980, 0.05, { vol: 0.03 })),
  error: sound(() => {
    tone(150, 0.12, { vol: 0.06 });
    tone(120, 0.16, { vol: 0.06, at: 0.11 });
  }),
  sale: sound(() => {
    tone(1320, 0.08, { vol: 0.05 });
    tone(1760, 0.3, { vol: 0.05, at: 0.08 });
    noise(0.1, { freq: 4000, vol: 0.03, at: 0.08 });
  }),
  approved: sound(() => {
    tone(880, 0.07, { vol: 0.04 });
    tone(1175, 0.16, { vol: 0.04, at: 0.09 });
  }),
  customer: sound(() => {
    tone(1500, 0.14, { type: 'triangle', vol: 0.04 });
    tone(1180, 0.22, { type: 'triangle', vol: 0.04, at: 0.13 });
  }),
  /** The shop bell, as the doors swing open. */
  doorOpen: sound(() => {
    tone(1318, 0.22, { vol: 0.04 });
    tone(1760, 0.3, { vol: 0.035, at: 0.09 });
    noise(0.12, { freq: 380, vol: 0.03 });
  }),
  /** A soft thump as the doors come together. */
  doorClose: sound(() => {
    noise(0.1, { freq: 300, vol: 0.05, at: 0.42 });
    tone(150, 0.1, { vol: 0.05, at: 0.42 });
  }),
  thud: sound(() => {
    tone(130, 0.16, { type: 'sine', slideTo: 55, vol: 0.2 });
    noise(0.07, { freq: 400, vol: 0.1 });
  }),
  rip: sound(() => noise(0.22, { freq: 2600, vol: 0.09 })),
  swipe: sound(() => noise(0.2, { freq: 1500, vol: 0.06 })),
  pop: sound(() => tone(620, 0.06, { slideTo: 940, vol: 0.03 })),
  stored: sound(() => tone(200, 0.1, { type: 'triangle', slideTo: 120, vol: 0.09 })),
  fanfare: sound(() => {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.14, { vol: 0.05, at: i * 0.11 }));
    tone(1319, 0.5, { vol: 0.05, at: 0.44 });
    tone(784, 0.5, { type: 'triangle', vol: 0.07, at: 0.44 });
    noise(0.25, { freq: 5000, vol: 0.02, at: 0.44 });
  }),
  order: sound(() => {
    tone(660, 0.06, { vol: 0.04 });
    tone(880, 0.1, { vol: 0.04, at: 0.07 });
  }),
  hint: sound(() => {
    tone(880, 0.1, { type: 'triangle', vol: 0.08 });
    tone(1319, 0.22, { type: 'triangle', vol: 0.08, at: 0.1 });
  }),
  dayEnd: sound(() => {
    [784, 659, 523].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.06, at: i * 0.13 }));
  }),
};
