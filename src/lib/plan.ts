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
  const hold = d >= 2 ? '10mm' : '20mm';
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

export type FingerMode = 'repeaters' | 'max' | 'recovery' | 'test';

const FINGER_REPS = 6;
const FINGER_SERIES_REST = 180;

/**
 * Lundi — plan poutre 8 semaines (Rocklands) : répétitions 7 s/3 s en S1-3, récupération en S4,
 * suspensions max 10 s en S5-7, test 10 s en S8. Le cycle de 12 semaines reboucle sur ces 8.
 */
export function fingerSpec(cfg: LevelConfig, cyc: CycleInfo) {
  const week = ((cyc.week - 1) % 8) + 1;
  const seq: SeqStep[] = [];
  const setup = (t: string) => seq.push({ k: 'count', d: FINGER_SETUP_S, t, tone: 'sky' });

  if (week === 4) {
    const sets = 2;
    for (let s = 1; s <= sets; s++) {
      setup(`Mise en place — suspension longue ${s}/${sets}`);
      seq.push({ k: 'count', d: 30, t: `Suspension longue facile ${s}/${sets} (40 mm, sans forcer)`, tone: 'lime' });
      if (s < sets) seq.push({ k: 'count', d: 60, t: 'Repos', tone: 'amber' });
    }
    return {
      week, mode: 'recovery' as FingerMode, sets, work: 30, rest: 60,
      badge: 'Récupération',
      hint: 'Semaine 4 : on laisse les tendons assimiler. Suspensions très faciles, aucune douleur.',
      meta: [
        { label: 'Séries', val: '2' },
        { label: 'Tenue', val: '30s' },
        { label: 'Repos', val: '60s' },
      ],
      seq,
    };
  }

  if (week === 8) {
    setup('Mise en place — test 10 s sur 20 mm, 4 doigts semi-arquée');
    seq.push({ k: 'count', d: 10, t: 'Test 10 s — note le réglage (prise + poids dans les pieds)', tone: 'lime' });
    return {
      week, mode: 'test' as FingerMode, sets: 1, work: 10, rest: 0,
      badge: 'Test 10 s',
      hint: 'Cherche le réglage qui te fait tenir 10 s, pas plus. Un cran gagné depuis le début du cycle = progrès.',
      meta: [
        { label: 'Test', val: '10s' },
        { label: 'Prise', val: '20 mm' },
        { label: 'Doigts', val: '4' },
      ],
      seq,
    };
  }

  const max = week >= 5;
  const sets = max ? 5 : week >= 3 ? 4 : 3;
  for (let s = 1; s <= sets; s++) {
    setup(`Mise en place — ${max ? 'suspension max' : 'série'} ${s}/${sets}`);
    if (max) {
      seq.push({ k: 'count', d: 10, t: `Suspension max 10 s ${s}/${sets} — garde 3 s de marge`, tone: 'lime' });
    } else {
      for (let r = 1; r <= FINGER_REPS; r++) {
        seq.push({ k: 'count', d: 7, t: `Travail ${r}/${FINGER_REPS} — série ${s}/${sets}`, tone: 'lime' });
        seq.push({ k: 'count', d: 3, t: `Relâche ${r}/${FINGER_REPS}`, tone: 'amber' });
      }
    }
    if (s < sets) seq.push({ k: 'count', d: FINGER_SERIES_REST, t: 'Repos 3 min', tone: 'amber' });
  }
  return {
    week, mode: (max ? 'max' : 'repeaters') as FingerMode,
    sets, work: max ? 10 : 7, rest: FINGER_SERIES_REST,
    badge: `${cfg.hold} · ${max ? 'max 10 s' : 'répétitions'}`,
    hint: max
      ? `Choisis une prise tenue ~13 s et arrête à 10 s. ${cfg.hold}, ${cfg.lest}, 3 min de repos.`
      : `7 s de suspension, 3 s de relâche, 6 fois = 1 série. ${cfg.hold}, ${cfg.lest}, 3 min de repos entre séries.`,
    meta: max
      ? [
          { label: 'Séries', val: String(sets) },
          { label: 'Travail', val: '10s' },
          { label: 'Repos', val: '3 min' },
          { label: 'Prépa', val: `${FINGER_SETUP_S}s` },
        ]
      : [
          { label: 'Séries', val: String(sets) },
          { label: 'Répétitions', val: `${FINGER_REPS}×` },
          { label: 'Travail', val: '7s' },
          { label: 'Relâche', val: '3s' },
        ],
    seq,
  };
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

type Tier = 'debutant' | 'inter' | 'avance';
const tierOf = (cfg: LevelConfig): Tier => (cfg.d <= -2 ? 'debutant' : cfg.d >= 2 ? 'avance' : 'inter');

const MOB_HOLD: Record<Tier, number> = { debutant: 30, inter: 40, avance: 50 };
const MOB_ROUNDS = 2;
const MOB_ITEMS = [
  { titre: 'Hanches', detail: 'couch stretch, genou au sol, bassin rentré', sides: ['gauche', 'droite'] },
  { titre: 'Épaules', detail: 'sleeper stretch, coude à 90°, pousse doucement', sides: ['gauche', 'droite'] },
  { titre: 'Ischios & mollets', detail: 'fente basse, talon au sol, dos plat', sides: ['gauche', 'droite'] },
  { titre: 'Avant-bras', detail: 'fléchisseurs puis extenseurs, bras tendu', sides: ['gauche', 'droite'] },
  { titre: 'Colonne', detail: 'chat-vache lent, une respiration par mouvement', sides: [''] },
];
const MOB_THORACIC = { titre: 'Rotation thoracique', detail: 'allongé sur le côté, genoux pliés, bras ouvert', sides: ['gauche', 'droite'] };

/** Mobilité du mercredi : tenue et nombre d'exos selon le niveau (débutant → avancé). */
export function mobiliteSpec(cfg: LevelConfig) {
  const tier = tierOf(cfg);
  const hold = MOB_HOLD[tier];
  const items = tier === 'debutant' ? MOB_ITEMS : [...MOB_ITEMS, MOB_THORACIC];
  const seq: SeqStep[] = [];
  for (let r = 1; r <= MOB_ROUNDS; r++) {
    for (const it of items) {
      for (const side of it.sides) {
        seq.push({ k: 'count', d: hold, t: `${it.titre}${side ? ` (${side})` : ''} — tour ${r}/${MOB_ROUNDS}`, tone: 'lime' });
      }
    }
  }
  const total = seq.reduce((s, x) => s + (x.d ?? 0), 0);
  return { tier, hold, rounds: MOB_ROUNDS, items, seq, minutes: Math.round(total / 60) };
}

const RENFO_ITEMS: { titre: string; reps: Record<Tier, string>; rest: number }[] = [
  { titre: 'Fentes bulgares', reps: { debutant: '8 par jambe', inter: '10 par jambe', avance: '12 par jambe, pied arrière surélevé' }, rest: 90 },
  { titre: 'Pompes', reps: { debutant: '10 sur les genoux', inter: '12 classiques', avance: '10 pieds surélevés' }, rest: 75 },
  { titre: 'Gainage latéral', reps: { debutant: '20 s par côté', inter: '30 s par côté', avance: '40 s par côté' }, rest: 60 },
  { titre: 'Y-T-W épaules', reps: { debutant: '8 de chaque lettre', inter: '8 de chaque lettre, lent', avance: '10 de chaque lettre, lent' }, rest: 60 },
  { titre: 'Poignets', reps: { debutant: '15 extensions, bouteille 1 L', inter: '15 extensions, bouteille 1,5 L', avance: '15 extensions + flexions, haltère 2 kg' }, rest: 60 },
];

/** Renforcement du samedi (hors anneaux, déjà couverts le vendredi) : séries et charge selon le niveau, décharge en S4/S8/S12. */
export function renfoSpec(cfg: LevelConfig, cyc: CycleInfo) {
  const tier = tierOf(cfg);
  const base = cfg.d >= 2 ? 4 : cfg.d >= 0 ? 3 : 2;
  const sets = cyc.deload ? Math.max(2, base - 1) : base;
  const seq: SeqStep[] = [];
  RENFO_ITEMS.forEach((it, idx) => {
    for (let s = 1; s <= sets; s++) {
      seq.push({ k: 'wait', t: `${it.titre} (${it.reps[tier]}) — série ${s}/${sets}`, tone: 'lime' });
      if (s < sets || idx < RENFO_ITEMS.length - 1) {
        seq.push({ k: 'count', d: it.rest, t: `Repos — ${it.titre.toLowerCase()}`, tone: 'amber' });
      }
    }
  });
  return { tier, sets, items: RENFO_ITEMS.map((it) => ({ titre: it.titre, reps: it.reps[tier] })), seq };
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
