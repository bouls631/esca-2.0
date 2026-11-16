import type { Limite } from './types';

// Bilan initial (tests avant programme) : 8 mesures → facteur limitant → prescription.
// Repères calibrés pour un grimpeur 6a → 7a (cf. programme-escalade.md).

export interface BilanScores {
  flash: number; // % de flash sur 8 voies (2 par profil)
  doigtsMax: number; // kg ajoutés à 7 s sur 20 mm (0 = poids du corps)
  doigtsRes: number; // répétitions 7 s / 3 s au poids du corps
  bras: number; // tractions strictes max
  gainage: number; // secondes de hollow hold
  endurance: number; // voies réussies sur le 4×4 (0..16)
  mobiliteDouleur: boolean;
  recup: number; // qualité sommeil / readiness 1..5
}

export const LIMITE_LABELS: Record<Limite, string> = {
  doigts: 'Doigts',
  technique: 'Technique / lecture',
  endurance: 'Endurance',
  bras: 'Force bras',
  mobilite: 'Mobilité',
  recup: 'Récupération',
};

// Égalité → l'axe qui casse l'enchaînement passe avant (cf. programme).
const PRIORITY: Limite[] = ['doigts', 'technique', 'endurance', 'bras', 'mobilite', 'recup'];

export const PRESCRIPTION: Record<Limite, string[]> = {
  doigts: ['2 séances doigts/semaine (lundi + samedi)', '−1 voie de projet le mardi', '3 min de repos entre séries'],
  technique: ['3 voies de lecture avant la séance', '1 vidéo de ta grimpe par semaine', 'pieds silencieux'],
  endurance: ['4×4 en début de séance jeudi', '+2 voies de volume', 'repos stricts 8–12 min'],
  bras: ['+1 série de tractions le vendredi', 'anneaux, descente 3 s'],
  mobilite: ['10 min de mobilité quotidienne', 'pas de projet sur le profil douloureux'],
  recup: ['−1 séance/semaine', '7 h de sommeil', 'pas de lest sur les doigts'],
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Chaque axe ramené sur 100 pour être comparable. */
export function bilanScoresNormalises(s: BilanScores): Record<Limite, number> {
  return {
    doigts: Math.min(clamp(40 + s.doigtsMax * 4), clamp((s.doigtsRes / 12) * 100)),
    technique: clamp(s.flash),
    endurance: clamp((s.endurance / 16) * 100),
    bras: clamp((s.bras / 15) * 100),
    mobilite: s.mobiliteDouleur ? 20 : 100,
    recup: clamp((s.recup / 5) * 100),
  };
}

/** Le facteur limitant = l'axe le plus faible, départageé par PRIORITY. */
export function analyseBilan(s: BilanScores): { limite: Limite; score: number; scores: Record<Limite, number>; prescription: string[] } {
  const scores = bilanScoresNormalises(s);
  const min = Math.min(...Object.values(scores));
  const limite = PRIORITY.find((k) => scores[k] === min) ?? 'recup';
  return { limite, score: scores[limite], scores, prescription: PRESCRIPTION[limite] };
}
