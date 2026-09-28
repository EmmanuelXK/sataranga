let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockAudio(): void {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
}

function tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType): void {
  const c = context();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export function playSound(kind: "move" | "capture" | "check" | "end"): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  if (kind === "move") tone(620, t, 0.06, 0.04, "sine");
  else if (kind === "capture") {
    tone(180, t, 0.08, 0.06, "triangle");
    tone(90, t, 0.1, 0.04, "sine");
  } else if (kind === "check") {
    tone(740, t, 0.07, 0.045, "sine");
    tone(560, t + 0.08, 0.09, 0.04, "sine");
  } else {
    tone(520, t, 0.1, 0.04, "sine");
    tone(390, t + 0.11, 0.14, 0.04, "sine");
    tone(260, t + 0.24, 0.2, 0.035, "sine");
  }
}
