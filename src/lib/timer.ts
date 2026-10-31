// Timer de récupération — store module-level : survit aux changements d'onglet dans la session.
export interface TimerState { total: number; left: number; running: boolean }

let s: TimerState = { total: 0, left: 0, running: false };
const subs = new Set<() => void>();
let h: ReturnType<typeof setInterval> | null = null;

function emit() { subs.forEach((f) => f()); }
function halt() {
  if (h) { clearInterval(h); h = null; }
}
function beep() {
  // Alarme : vibration + bip (salle bruyante → vibro gérée par l'OS)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([300, 120, 300, 120, 500]);
  } catch { /* silencieux */ }
  try {
    const AC = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.06;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => void ctx.close(), 600);
  } catch { /* silencieux */ }
}

function tick() {
  s.left = Math.max(0, s.left - 1);
  if (s.left <= 0) { halt(); s = { total: 0, left: 0, running: false }; beep(); }
  emit();
}

export const timer = {
  get: () => s,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => { subs.delete(fn); };
  },
  start(minutes: number) {
    halt();
    s = { total: minutes * 60, left: minutes * 60, running: true };
    h = setInterval(tick, 1000);
    emit();
  },
  pause() {
    if (s.running) { halt(); s = { ...s, running: false }; emit(); }
  },
  resume() {
    if (!s.running && s.left > 0) {
      s = { ...s, running: true };
      h = setInterval(tick, 1000);
      emit();
    }
  },
  stop() {
    halt();
    s = { total: 0, left: 0, running: false };
    emit();
  },
};
