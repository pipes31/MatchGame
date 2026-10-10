import { storage } from "./storage";

const MUTED_KEY = "gamerz:muted";

let ctx: AudioContext | null = null;
let muted = storage.get(MUTED_KEY) === "1";

function audio(): AudioContext | null {
  if (muted || typeof window.AudioContext === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOptions {
  type?: OscillatorType;
  volume?: number;
  slideTo?: number;
  delay?: number;
}

/** Plays a short synthesized blip, so the game ships without audio files. */
function tone(
  freq: number,
  duration: number,
  { type = "triangle", volume = 0.1, slideTo, delay = 0 }: ToneOptions = {}
) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export const sfx = {
  get muted() {
    return muted;
  },
  setMuted(value: boolean) {
    muted = value;
    storage.set(MUTED_KEY, value ? "1" : "0");
  },
  select: () => tone(660, 0.06, { type: "square", volume: 0.04 }),
  swap: () => tone(420, 0.12, { slideTo: 640, volume: 0.07 }),
  invalid: () => tone(220, 0.18, { type: "square", slideTo: 140, volume: 0.05 }),
  tick: () => tone(980, 0.05, { type: "square", volume: 0.03 }),
  match(combo: number) {
    const base = 440 * 2 ** (((combo - 1) * 2) / 12);
    tone(base, 0.12);
    tone(base * 1.5, 0.16, { delay: 0.06 });
  },
  start() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, { delay: i * 0.08 }));
  },
  gameOver() {
    [784, 659, 523, 392].forEach((f, i) =>
      tone(f, 0.2, { delay: i * 0.12, volume: 0.08 })
    );
  },
};
