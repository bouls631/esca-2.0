import type { ReadinessTest, Seance, Voie } from '../db';
import type { Verdict } from './surmenage';

// Readiness : test hebdo (dimanche). Baisse >20% vs moyenne des 4 précédentes → intensité -20%.

export interface ReadinessAssessment {
  last?: ReadinessTest;
  factor: number; // 1 ou 0.8
  drop: boolean;
  enoughTests: boolean;
  pct: number; // 1 = stable
}

export function readinessAssessment(tests: ReadinessTest[]): ReadinessAssessment {
  const sorted = [...tests].sort((a, b) => a.createdAt - b.createdAt);
  const last = sorted[sorted.length - 1];
  const prev = sorted.slice(-5, -1);
  if (!last || prev.length < 2) {
    return { last, factor: 1, drop: false, enoughTests: prev.length >= 2, pct: 1 };
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const md = mean(prev.map((t) => t.deadhangS));
  const mt = mean(prev.map((t) => t.tractions));
  const pct = Math.min(md > 0 ? last.deadhangS / md : 1, mt > 0 ? last.tractions / mt : 1);
  return { last, factor: 0.8, drop: pct < 0.8, enoughTests: true, pct };
}

/** Porte 7a : 3× 6c réussis le mardi en 4 semaines + readiness stable + pas de blocage 14j. */
export function ready7a(
  data: { seances: Seance[]; voies: Voie[]; readiness: ReadinessTest[] },
  now: Date,
  verdict: Verdict,
): { ready: boolean; checks: { ok: boolean; label: string }[] } {
  const from = now.getTime() - 28 * 24 * 3600 * 1000;
  const intensiteIds = new Set(data.seances.filter((s) => s.type === 'intensite').map((s) => s.id));
  const topSessions = new Set(
    data.voies
      .filter((v) =>
        v.niveau === '6c' && v.chute === 'top' && v.date >= from
        && (v.seanceId === undefined ? new Date(v.date).getDay() === 2 : intensiteIds.has(v.seanceId)))
      .map((v) => v.seanceId ?? `tuer-${v.date}`),
  );
  const ra = readinessAssessment(data.readiness);
  const checks = [
    { ok: topSessions.size >= 3, label: '3 tops sur 6c (mardi) en 4 semaines' },
    {
      ok: ra.enoughTests ? !ra.drop : false,
      label: ra.enoughTests ? 'Readiness stable (pas de chute >20%)' : 'Pas assez de tests readiness (min 2)',
    },
    { ok: verdict.state !== 'bloque', label: 'Pas de blocage surmenage (14 jours)' },
  ];
  return { ready: checks.every((c) => c.ok), checks };
}
