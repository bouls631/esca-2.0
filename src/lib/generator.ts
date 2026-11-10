import type { Bloc, Energy, Intent, Profil, SessionType } from './types';
import type { Checkin, Seance } from '../db';

export interface GenCtx {
  type: SessionType;
  location: 'club' | 'maison' | 'repos_force';
  energy: Energy;
  intent: Intent;
  readinessDrop: boolean;
  fail6c: boolean;
  mardiIntense: boolean;
  focus: Profil | null;
  focusAutre: Profil | null;
  liberation: boolean;
  gate7a: boolean;
  maisonSeries: number;
}

let seq = 0;
function bloc(titre: string, detail: string, opts: Partial<Bloc> = {}): Bloc {
  seq = (seq + 1) % 1000;
  return { id: `b${Date.now().toString(36)}${seq}`, titre, detail, ...opts };
}
const profilText = (p: Profil | null) => (p ? `profils : ${p}` : 'profils au choix');

/** Génère la séance adaptative du jour (mardi intensité / jeudi volume) ou un plan maison/repos. */
export function generateSeance(ctx: GenCtx): { type: SessionType; note?: string; blocs: Bloc[] } {
  if (ctx.location === 'repos_force') {
    return {
      type: 'volume',
      note: 'Repos forcé — mobilité 20 min, aucune prise.',
      blocs: [
        bloc('Mobilité', 'Épaules (sleeper, wall slide), colonne (chat-vache), hanches (couch stretch). 20 min au total.', { restMin: 1 }),
        bloc('Respiration', '2 séries de 10 respirations 4-7-8, détendu.', { restMin: 0 }),
      ],
    };
  }
  if (ctx.location === 'maison') {
    const why = ctx.maisonSeries === 2 ? ' — dernière séance maison dure, on allège' : ctx.maisonSeries === 4 ? ' — dernière séance maison facile, on monte' : '';
    return { type: 'volume', note: `Séance maison — poutre, anneaux, corde à sauter. ${ctx.maisonSeries} séries${why}.`, blocs: maisonPlan(ctx.maisonSeries) };
  }
  if (ctx.type === 'intensite') {
    // Règle dure : 2 échecs consécutifs sur le même projet → stop, volume 6b
    if (ctx.fail6c) {
      const v = volumeBlocs(true, null); // mardiIntense=true → pas de finisher 6c, juste du volume fluide
      return {
        type: 'volume',
        note: '⚠ 2 échecs 6c consécutifs → projet en pause. Volume 6b aujourd\'hui.',
        blocs: v,
      };
    }
    // Forme basse ou reporter → bascule en mode volume
    if (ctx.energy <= 2 || ctx.intent === 'reporter') {
      const v = volumeBlocs(ctx.mardiIntense, ctx.focus);
      return {
        type: 'volume',
        note: 'Forme basse → bascule en mode volume jeudi.',
        blocs: v,
      };
    }
    if (ctx.readinessDrop) {
      // Test readiness en baisse (>20%) → intensité -20% : moins d'essais projet, plus de volume facile
      return {
        type: 'intensite',
        note: '📉 Readiness en baisse → intensité réduite de 20% (essayes le projet, mais reste lucide ; volume facile à la fin).',
        blocs: [
          bloc('Échauffement', `2 voies 5+/6a fluides (${profilText(ctx.focus)}), note mentale sur chaque pied.`, { niveau: '6a', restMin: 5 }),
          bloc('Projet 6c', '1 essai chrono (relief honnête, 15 min de repos avant). Pas de 2e essai en cas d\'échec franc.', { niveau: '6c', restMin: 15 }),
          bloc('Technique facile', `5 voies 6b max, lecture précise, sans échec (${profilText(ctx.focus)}).`, { niveau: '6b', restMin: 8 }),
          bloc('Retour au calme', '1 voie 6a fluide + étirements 5 min.', { niveau: '6a', restMin: 0 }),
        ],
      };
    }
    if (ctx.energy === 4) {
      // Forme 🔥 + readiness OK
      if (ctx.gate7a) {
        return {
          type: 'intensite',
          note: '🔥 Porte 7a ouverte : 1 projet 7a (3 essais max), repos 20 min entre essais.',
          blocs: [
            bloc('Échauffement', '2 voies 5+/6a fluides, zéro échec.', { niveau: '6a', restMin: 5 }),
            bloc('Projet 7a', '3 essais max, 20 min de repos entre essais. Note ton point de chute à chaque essai.', { niveau: '7a', restMin: 20 }),
            bloc('Consolidation 6c', '1 voie 6c à top propre (1-2 essais) pour ancrer la référence.', { niveau: '6c', restMin: 15 }),
            bloc('Retour au calme', '1 voie 6a fluide + étirements.', { niveau: '6a', restMin: 0 }),
          ],
        };
      }
    }
    return {
      type: 'intensite',
      note: `Séance intensité : 5c → 6a → 2× 6c → 6b → 6a (${profilText(ctx.focus)}).`,
      blocs: [
        bloc('Échauffement 5c', `1 voie 5c fluide (${profilText(ctx.focus)}).`, { niveau: '5+', restMin: 5 }),
        bloc('6a', '1 voie 6a fluide, zéro échec.', { niveau: '6a', restMin: 5 }),
        bloc('6c #1', `2 essais max sur un 6c (${profilText(ctx.focus)}). 15 min de repos entre essais.`, { niveau: '6c', restMin: 15 }),
        bloc('6c #2', '2 essais max sur un second 6c (profil différent du #1).', { niveau: '6c', restMin: 15 }),
        bloc('6b', '1 voie 6b, lecture précise.', { niveau: '6b', restMin: 10 }),
        bloc('Retour au calme', '1 voie 6a fluide + étirements.', { niveau: '6a', restMin: 0 }),
      ],
    };
  }
  // Jeudi — volume / endurance
  return {
    type: 'volume',
    note: ctx.mardiIntense
      ? 'Mardi était intense → 7 voies max, aucun 6c en finisher. Chute sur 6b → redescends tout de suite : voie suivante, pas de nouvel essai.'
      : `Mardi facile → 9 voies dont 1× 6c "test fatigue" en finisher (${profilText(ctx.focus)}). Chute sur 6b → redescends : voie suivante, pas de nouvel essai.`,
    blocs: volumeBlocs(ctx.mardiIntense, ctx.focus),
  };
}

function volumeBlocs(mardiIntense: boolean, focus: Profil | null): Bloc[] {
  // +3 voies : l'utilisateur grimpe toujours au moins 3 voies de plus que le plan → déjà comptées.
  const n = mardiIntense ? 7 : 9;
  const finisher = mardiIntense
    ? undefined
    : bloc('Finisher 6c', '1 voie 6c "test fatigue" : l\'objectif est de tenir dans la pompe, pas de top.', { niveau: '6c', restMin: 12 });
  const enchainement: Bloc[] = [
    bloc('Enchaînement', `${n} voies 6a/6b d'affilée (restes 8–12 min, timer). Focus : ${profilText(focus)}.`, { niveau: mardiIntense ? '6b' : '6b', restMin: 10 }),
  ];
  if (finisher) enchainement.push(finisher);
  return [
    bloc('Échauffement', '1 voie 6a fluide + 5 min de pied.', { niveau: '6a', restMin: 8 }),
    ...enchainement,
    bloc('Retour au calme', 'Descente douce, brassage, étirements 10 min.', { restMin: 0 }),
  ];
}

function maisonPlan(series: number): Bloc[] {
  return [
    bloc('Corde à sauter', `${series} × 3 min, 1 min de repos entre chaque.`, { restMin: 1 }),
    bloc('Poutre lock-offs', `${series} × 5 lock-offs de 10s (poutre verticale, prise confortable). Si douleur doigts → ${series}×30s deadhang léger.`, { restMin: 2 }),
    bloc('Anneaux', `${series} × 8 tractions en pronation, corps gainé.`, { restMin: 2 }),
    bloc('Footwork silent feet', '10 min sur la poutre : montées avec pieds silencieux.', { restMin: 0 }),
    bloc('Étirements', '5 min : avant-bras, épaules, hanches.', { restMin: 0 }),
  ];
}

/** Séries d'exos maison suivantes : 2 si la dernière séance maison a été dure (≥2 blocs « dur »), 4 si ≥2 faciles et aucun dur, sinon 3. */
export function maisonSeriesFor(seances: Seance[], checkins: Checkin[]): number {
  const maisonIds = new Set(checkins.filter((c) => c.location === 'maison' && c.id !== undefined).map((c) => c.id));
  const last = seances
    .filter((s) => s.checkinId !== undefined && maisonIds.has(s.checkinId) && s.blocs.some((b) => b.ressenti !== undefined))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const r = (last?.blocs ?? []).map((b) => b.ressenti);
  if (r.filter((x) => x === 'dur').length >= 2) return 2;
  if (r.filter((x) => x === 'facile').length >= 2 && !r.includes('dur')) return 4;
  return 3;
}
