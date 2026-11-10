import { useEffect, useRef, useState } from 'react';
import type { SeqStep } from '../lib/plan';
import { timer } from '../lib/timer';
import { Btn, Card, Tag, cx } from './ui';

function vibrateShort() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([180, 90, 180]);
  } catch { /* silencieux */ }
}

const TONE_COLOR: Record<SeqStep['tone'], string> = {
  sky: 'text-sky-400',
  lime: 'text-emerald-400',
  amber: 'text-amber-400',
};

export function SeqTimerCard({
  title,
  badge,
  seq,
  meta,
  onComplete,
  children,
}: {
  title: string;
  badge: string;
  seq: SeqStep[];
  meta?: { label: string; val: string }[];
  onComplete?: () => void;
  children?: React.ReactNode;
}) {
  const [stepIdx, setStepIdx] = useState<number>(-1);
  const [left, setLeft] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const running = stepIdx >= 0 && stepIdx < seq.length;
  const current = running ? seq[stepIdx] : null;

  function clearTick() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => () => clearTick(), []);

  useEffect(() => {
    clearTick();
    if (!current) return;
    if (current.k === 'wait') {
      setLeft(0);
      return;
    }
    const duration = current.d ?? 10;
    setLeft(duration);
    if (current.tone === 'amber') timer.startSec(duration);
    intervalRef.current = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          clearTick();
          vibrateShort();
          setStepIdx((idx) => {
            const next = idx + 1;
            if (next >= seq.length) {
              timer.stop();
              onComplete?.();
              return -1;
            }
            return next;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stepIdx]);

  function start() {
    if (seq.length === 0) return;
    setStepIdx(0);
  }

  function stop() {
    clearTick();
    timer.stop();
    setStepIdx(-1);
    setLeft(0);
  }

  function nextWait() {
    if (!current || current.k !== 'wait') return;
    vibrateShort();
    const next = stepIdx + 1;
    if (next >= seq.length) {
      stop();
      onComplete?.();
    } else {
      setStepIdx(next);
    }
  }

  const pct = current && current.k === 'count' && current.d ? ((current.d - left) / current.d) * 100 : 0;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400">{title}</p>
        <Tag tone="emerald">{badge}</Tag>
      </div>
      {meta && (
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
          {meta.map((m) => (
            <div key={m.label} className="rounded-xl bg-zinc-950 p-2">
              <p className="font-mono text-base font-black text-emerald-400">{m.val}</p>
              <p className="font-mono text-[10px] uppercase text-zinc-500">{m.label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center">
        <p className={cx('font-mono text-4xl font-black tabular-nums', current ? TONE_COLOR[current.tone] : 'text-sky-400')}>
          {!current ? 'Prêt' : current.k === 'wait' ? '•••' : `${left}s`}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-400">
          {!current
            ? 'Lance la séquence guidée'
            : current.k === 'wait'
              ? `${current.t} — valide quand la série est faite`
              : current.t}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-emerald-400 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {!running && <Btn onClick={start}>Démarrer</Btn>}
          {running && current?.k === 'wait' && <Btn onClick={nextWait}>Série faite ▶</Btn>}
          {running && <Btn variant="ghost" onClick={stop}>Stop</Btn>}
        </div>
      </div>
      {children}
    </Card>
  );
}
