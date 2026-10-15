let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockAudio(): void {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const n = Math.floor(c.sampleRate * 0.25);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

/** Dry wood click: a short noise burst through a bandpass, like a piece on a board. */
function wood(c: AudioContext, t: number, freq: number, q: number, dur: number, gain: number): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(freq, t);
  bp.Q.setValueAtTime(q, t);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.03);
}

/** Soft body of the board, so the click is not just hiss. */
function body(c: AudioContext, t: number, freq: number, dur: number, gain: number): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(48, freq * 0.7), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function schedule(c: AudioContext, kind: "move" | "capture" | "check" | "end"): void {
  const t = c.currentTime;
  if (kind === "move") {
    wood(c, t, 1680, 0.9, 0.042, 0.7);
    body(c, t, 210, 0.045, 0.07);
  } else if (kind === "capture") {
    wood(c, t, 420, 0.7, 0.085, 0.85);
    wood(c, t + 0.01, 980, 1.3, 0.04, 0.28);
    body(c, t, 120, 0.09, 0.16);
  } else if (kind === "check") {
    wood(c, t, 1500, 1, 0.036, 0.4);
    body(c, t, 880, 0.08, 0.09);
    body(c, t + 0.068, 1318, 0.11, 0.075);
  } else {
    body(c, t, 784, 0.11, 0.07);
    body(c, t + 0.1, 659, 0.11, 0.07);
    body(c, t + 0.2, 523, 0.16, 0.065);
  }
}

const SOUND_KEY = "sataranga-sound";

export function soundEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(SOUND_KEY) !== "0";
}

export function setSoundEnabled(on: boolean): void {
  localStorage.setItem(SOUND_KEY, on ? "1" : "0");
}

export function playSound(kind: "move" | "capture" | "check" | "end"): void {
  if (!soundEnabled()) return;
  const c = context();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume().then(() => schedule(c, kind));
    return;
  }
  schedule(c, kind);
}
