import type { FingerSession, Voie } from '../db';
import type { Profil } from './types';

// Échelle Escalade Pro Training (niveau 1..9 → 5b..8a, 5 = 6c) + cycle de 12 semaines + protocoles chrono.
export const PLAN_GRADES = ['4a', '4b', '4c', '5a', '5b', '5c', '6a', '6b', '6c', '7a', '7b', '7c', '8a'] as const;
export const BASE_GRADE = '6c';
export const HOLD_LABELS: Record<string, string> = {
  '20mm': '20mm — gros',
  '15mm': '15mm — moyen',
  '10mm': '10mm — petit',
  '8mm': '8mm — micro',
};
export const FINGER_SETUP_S = 10;

export interface LevelConfig {
  level: number;
  d: number;
  grade: string;
  cruise: string;
  easy: string;
  vol: number;
  tries: number;
  hold: string;
  holdLabel: string;
  lest: string;
  charge: string;
  strengthSets: number;
}

function shiftGrade(delta: number): string {
  const i = PLAN_GRADES.indexOf(BASE_GRADE) + delta;
  return PLAN_GRADES[Math.max(0, Math.min(PLAN_GRADES.length - 1, i))];
}

export function levelConfig(rawLevel = 5): LevelConfig {
  const level = Math.max(1, Math.min(9, Math.round(rawLevel) || 5));
  const d = level - 5;
  const hold = d <= -3 ? '20mm' : d <= -1 ? '15mm' : d >= 2 ? '10mm' : '15mm';
  return {
    level,
    d,
    grade: shiftGrade(d),
    cruise: shiftGrade(d - 1),
    easy: shiftGrade(d - 2),
    vol: d <= -3 ? 2 : d <= -1 ? 3 : d >= 3 ? 6 : 4,
    tries: d <= -1 ? 5 : d >= 2 ? 3 : 4,
    hold,
    holdLabel: HOLD_LABELS[hold],
    lest: d <= 0 ? 'Poids du corps' : d >= 3 ? '+10 à +15 kg' : '+5 kg',
    charge: d <= -3 ? 'très légère' : d <= -1 ? 'modérée' : d >= 3 ? 'maximale' : 'élevée',
    strengthSets: 3 + Math.max(0, d),
  };
}

export type CyclePhase = '1-4' | '5-8' | '9-12';

export interface CycleInfo {
  week: number; // 1..12
  phase: CyclePhase;
  phaseName: 'Adaptation' | 'Intensification' | 'Conversion';
  deload: boolean;
  startIso: string;
}

export function cycleInfo(now: Date, cycleStart?: string, weekOffset = 0): CycleInfo {
  const startIso = cycleStart || now.toISOString().slice(0, 10);
  const startMs = new Date(startIso + 'T00:00:00').getTime();
  const auto = Math.max(1, Math.min(12, Math.floor((now.getTime() - startMs) / 86_400_000 / 7) + 1));
  const week = Math.max(1, Math.min(12, auto + (weekOffset || 0)));
  const phase: CyclePhase = week <= 4 ? '1-4' : week <= 8 ? '5-8' : '9-12';
  const phaseName = phase === '1-4' ? 'Adaptation' : phase === '5-8' ? 'Intensification' : 'Conversion';
  return { week, phase, phaseName, deload: week % 4 === 0, startIso };
}

export interface SeqStep {
  k: 'count' | 'wait';
  d?: number; // secondes si count
  t: string;
  tone: 'sky' | 'lime' | 'amber';
}

export function fingerSpec(cfg: LevelConfig, cyc: CycleInfo) {
  const sets = Math.max(2, (cfg.d >= 3 ? 6 : 5) - (cyc.deload ? 1 : 0));
  const work = cyc.phase === '9-12' ? 5 : 7;
  const rest = cyc.phase === '9-12' ? 55 : 53;
  const seq: SeqStep[] = [];
  for (let i = 1; i <= sets; i++) {
    seq.push({ k: 'count', d: FINGER_SETUP_S, t: `Mise en place — série ${i}/${sets}`, tone: 'sky' });
    seq.push({ k: 'count', d: work, t: `Travail — série ${i}/${sets}`, tone: 'lime' });
    if (i < sets) seq.push({ k: 'count', d: rest, t: `Repos — série ${i}/${sets}`, tone: 'amber' });
  }
  return { sets, work, rest, setup: FINGER_SETUP_S, seq };
}

const HOME_REST = [120, 90, 90, 45];

export function homeSpec(cfg: LevelConfig, cyc: CycleInfo) {
  const sets = Math.max(2, cfg.strengthSets - (cyc.deload ? 1 : 0));
  const coreSets = cyc.deload ? 2 : 3;
  const restFor = (n: number) => HOME_REST[n] + Math.max(0, cfg.d) * (n === 0 ? 15 : 5);
  const items = [
    { titre: 'Tractions aux anneaux', sets, reps: '6 reps (descente 3s)', rest: restFor(0) },
    { titre: 'Pompes', sets, reps: '12 reps (poignets neutres)', rest: restFor(1) },
    { titre: 'Dips aux anneaux', sets, reps: '6 reps (coudes près du corps)', rest: restFor(2) },
    { titre: 'Gainage hollow body', sets: coreSets, reps: '30 s', rest: restFor(3) },
  ];
  const seq: SeqStep[] = [];
  items.forEach((it, idx) => {
    for (let s = 1; s <= it.sets; s++) {
      seq.push({ k: 'wait', t: `${it.titre} (${it.reps}) — série ${s}/${it.sets}`, tone: 'lime' });
      if (s < it.sets || idx < items.length - 1) {
        seq.push({ k: 'count', d: it.rest, t: `Repos — ${it.titre.toLowerCase()}`, tone: 'amber' });
      }
    }
  });
  return { sets, items, seq };
}

export function fingerBestByHold(sessions: FingerSession[]): Record<string, number> {
  const best: Record<string, number> = {};
  for (const s of sessions) {
    if (s.kg > (best[s.hold] ?? -1)) best[s.hold] = s.kg;
  }
  return best;
}

/** Taux de réussite (top) par profil et profil le plus faible (si ≥2 profils avec ≥2 voies chacun). */
export function profileSuccessStats(voies: Voie[]): { list: { profil: Profil; n: number; pct: number }[]; weak: { profil: Profil; n: number; pct: number } | null } {
  const by: Partial<Record<Profil, boolean[]>> = {};
  for (const v of voies.slice().sort((a, b) => b.date - a.date).slice(0, 40)) {
    (by[v.profil] = by[v.profil] ?? []).push(v.chute === 'top');
  }
  const list = (Object.keys(by) as Profil[])
    .map((profil) => {
      const arr = by[profil]!;
      return { profil, n: arr.length, pct: Math.round((arr.filter(Boolean).length / arr.length) * 100) };
    })
    .sort((a, b) => a.pct - b.pct);
  const eligible = list.filter((x) => x.n >= 2);
  return { list, weak: eligible.length >= 2 ? eligible[0] : null };
}

/** Verdict du coach sur la cotation cible (21 derniers jours, min 5 voies sur 3 jours différents). */
export function coachLevelVerdict(voies: Voie[], targetGrade: string, now: Date): {
  need?: number;
  grade: string;
  rate?: number;
  n?: number;
  days?: number;
  delta?: -1 | 0 | 1;
} {
  const since = now.getTime() - 21 * 86_400_000;
  const at = voies.filter((v) => v.niveau === targetGrade && v.date >= since);
  const days = new Set(at.map((v) => new Date(v.date).toISOString().slice(0, 10))).size;
  if (at.length < 5 || days < 3) return { need: at.length, grade: targetGrade };
  const rate = at.filter((v) => v.chute === 'top').length / at.length;
  const delta: -1 | 0 | 1 = rate >= 0.7 ? 1 : rate <= 0.2 ? -1 : 0;
  return { grade: targetGrade, rate, n: at.length, days, delta };
}
