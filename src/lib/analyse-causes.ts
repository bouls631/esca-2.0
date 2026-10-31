import type { Axis, Bloc, Cause } from './types';
import type { Voie } from '../db';

// Analyse des causes de chute → jauges Force/Endurance/Technique/Mental + prescriptions.

export function axisOf(cause: Cause): Axis {
  switch (cause) {
    case 'force':
    case 'doigts': return 'force';
    case 'souffle': return 'endurance';
    case 'technique': return 'technique';
    case 'mental': return 'mental';
  }
}

interface Gauge { score: number | null; n: number }

/** Jauges : base 80 sur les axes touchés dans la fenêtre ; chute −10, top +2 (top = tous les axes ont tenu). */
export function gauges(voies: Voie[]): Record<Axis, Gauge> {
  const g: Record<Axis, Gauge> = {
    force: { score: null, n: 0 },
    endurance: { score: null, n: 0 },
    technique: { score: null, n: 0 },
    mental: { score: null, n: 0 },
  };
  if (voies.length === 0) return g;
  let tops = 0;
  for (const v of voies) {
    if (v.chute === 'top') { tops++; continue; }
    const key = v.cause ? axisOf(v.cause) : null;
    if (!key) continue;
    const prev = g[key].score ?? 80;
    g[key].score = Math.max(10, prev - 10);
    g[key].n++;
  }
  const topBoost = 2 * tops;
  for (const key of Object.keys(g) as Axis[]) {
    g[key].score = g[key].score === null ? null : Math.min(100, g[key].score + topBoost);
  }
  return g;
}

export interface Prescription {
  deficit: 'endurance' | 'lockoff' | 'mental';
  titre: string;
  detail: string;
}

/** Analyse automatique sur la fenêtre passée (généralement 14 j). */
export function analyses(voies: Voie[]): Prescription[] {
  const out: Prescription[] = [];
  const finCount = voies.filter((v) => v.chute === 'fin').length;
  const milieuDevers = voies.filter(
    (v) => v.chute === 'milieu' && (v.profil === 'devers' || v.profil === 'toit'),
  ).length;
  const mentalCount = voies.filter((v) => v.cause === 'mental').length;

  // Toujours "Fin" → déficit endurance → plus de volume jeudi
  if (finCount >= 3) {
    out.push({
      deficit: 'endurance',
      titre: 'Déficit endurance',
      detail: 'Tu lâches sur le haut des voies. Jeudi : ajoute +1 voie à l\'enchaînement (priorité volume, pas d\'essai projet supplémentaire).',
    });
  }
  // Toujours "Milieu" sur dévers/toit → déficit lock-off → poutre
  if (milieuDevers >= 2) {
    out.push({
      deficit: 'lockoff',
      titre: 'Déficit lock-off (dévers/toit)',
      detail: 'Chutes en milieu de voie sur dévers/toit. Mercredi : micro-workout force sur poutre (3×5 lock-offs 10s + 3×8 tractions anneaux).',
    });
  }
  // Mental récurrent → respiration / visualisation
  if (mentalCount >= 2) {
    out.push({
      deficit: 'mental',
      titre: 'Mental récurrent',
      detail: 'Le mental lâche avant les bras. Avant chaque séance : 5 min respiration 4-7-8 + visualisation de la passe critique.',
    });
  }
  return out;
}

/** Micro-workout maison de 10 min, prescription selon la DERNIÈRE cause de chute (mercredi/vendredi). */
export function microWorkout(cause: Cause | undefined): Bloc[] {
  const b = (titre: string, detail: string, restMin?: number): Bloc => ({
    id: `mw-${titre.toLowerCase().replace(/\W+/g, '-')}`,
    titre, detail, restMin,
  });
  switch (cause) {
    case 'force':
    case 'doigts':
      return [
        b('Lock-offs poutre', '3 × 5 lock-offs de 10s (poutre verticale), 2 min de repos entre séries.', 2),
        b('Anneaux', '3 × 8 tractions lent, gainé.', 2),
      ];
    case 'souffle':
      return [
        b('Corde à sauter', '3 × 3 min en continu (endurance ≠ force).', 1),
        b('Voies faciles', 'Si tu peux grimper : 2 voies faciles en tête, sans t\'arrêter dans la pompe.', 0),
      ];
    case 'technique':
      return [b('Footwork poutre', '10 min "silent feet" : montées avec pieds silencieux, pose précise.', 0)];
    case 'mental':
      return [
        b('Respiration 4-7-8', '5 min : inspire 4s, bloque 7s, expire 8s. 6 cycles.', 0),
        b('Visualisation', '4 min : revois ta passe critique, geste exact, jusqu\'au relais.', 0),
      ];
    default:
      return [b('Mobilité complète', '10 min : épaules, hanches, colonne.', 0)];
  }
}

/** Cause de la TOUTE DERNIÈRE chute (pour la prescription micro-workout du lendemain). */
export function lastFailCause(voies: Voie[]): { cause: Cause | undefined; date: number } | null {
  const lastFail = voies.filter((v) => v.chute !== 'top').sort((a, b) => b.date - a.date)[0];
  return lastFail ? { cause: lastFail.cause, date: lastFail.date } : null;
}
