import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { timer } from '../lib/timer';

export const cx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ');

const BTN: Record<string, string> = {
  primary: 'bg-emerald-600 text-zinc-950 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500',
  danger: 'bg-red-600 text-zinc-100 hover:bg-red-500',
  warn: 'bg-amber-500 text-zinc-950 hover:bg-amber-400',
  ghost: 'bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-800',
};

export function Btn({
  variant = 'primary',
  size = 'md',
  className: cn,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'warn' | 'ghost'; size?: 'md' | 'lg' }) {
  return (
    <button
      className={cx(
        'rounded-xl font-mono font-bold uppercase tracking-wide transition-colors active:scale-[.98] select-none',
        size === 'lg' ? 'min-h-14 px-5 text-base w-full' : 'min-h-10 px-4 text-sm',
        BTN[variant],
        cn,
      )}
      {...props}
    />
  );
}

export function Card({ children, className: cn }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg shadow-black/30', cn)}>
      {children}
    </section>
  );
}

export function Chip({ selected, className: cn, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      className={cx(
        'rounded-lg border px-3 py-2 font-mono text-sm font-semibold transition-colors active:scale-[.97]',
        selected
          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
          : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800',
        cn,
      )}
      {...props}
    />
  );
}

export function Tag({ tone = 'zinc', children }: { tone?: 'zinc' | 'emerald' | 'red' | 'amber' | 'sky'; children: ReactNode }) {
  const tones: Record<string, string> = {
    zinc: 'border-zinc-700 text-zinc-400',
    emerald: 'border-emerald-500 text-emerald-400',
    red: 'border-red-500 text-red-400',
    amber: 'border-amber-500 text-amber-400',
    sky: 'border-sky-500 text-sky-400',
  };
  return (
    <span className={cx('inline-block rounded border px-2 py-0.5 font-mono text-xs font-bold uppercase', tones[tone])}>
      {children}
    </span>
  );
}

export function Bar({ label, score, n }: { label: string; score: number | null; n: number }) {
  return (
    <div>
      <div className="flex justify-between font-mono text-xs text-zinc-400">
        <span>{label}</span>
        <span>{score === null ? '— pas de donnée' : `${score}${n ? ` · ${n} chute(s)` : ''}`}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cx(
            'h-full rounded-full transition-all',
            score === null ? 'bg-zinc-700' : score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500',
          )}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export function useTimer() {
  return useSyncExternalStore(timer.subscribe, timer.get);
}

export function TimerCard({ presets = [20, 15, 12, 10, 8, 5] }: { presets?: number[] }) {
  const t = useTimer();
  const mm = Math.floor(t.left / 60).toString().padStart(2, '0');
  const ss = (t.left % 60).toString().padStart(2, '0');
  const pct = t.total ? t.left / t.total : 0;
  return (
    <Card>
      <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Timer récupération</p>
      <div className="mt-2 flex items-center gap-3">
        <p className={cx('w-28 text-4xl font-mono font-black tabular-nums', t.running ? 'text-emerald-400' : 'text-zinc-100')}>
          {mm}:{ss}
        </p>
        <div className="flex-1 h-6 overflow-hidden rounded bg-zinc-800">
          <div
            className="h-full bg-emerald-500/50 transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((m) => (
          <Chip key={m} onClick={() => timer.start(m)}>{m}′</Chip>
        ))}
        {t.total > 0 && (
          <>
            <Chip onClick={() => (t.running ? timer.pause() : timer.resume())}>{t.running ? '⏸' : '▶'}</Chip>
            <Chip onClick={() => timer.stop()}>✕</Chip>
          </>
        )}
      </div>
    </Card>
  );
}
