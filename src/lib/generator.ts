import type { Bloc, CouleurBloc, Energy, Intent, Niveau, Objectif, Pratique, Profil, SessionType } from './types';
import { COULEURS_BLOC } from './types';
import type { Checkin, Seance } from '../db';
import { PLAN_GRADES } from './plan';

export interface GenCtx {
  type: SessionType;
  location: 'club' | 'maison' | 'repos_force';
  energy: Energy;
  intent: Intent;
  readinessDrop: boolean;
  mardiIntense: boolean;
  focus: Profil | null;
  focusAutre: Profil | null;
  liberation: boolean;
  gate7a: boolean;
  maisonSeries: number;
  objectif: Objectif;
  pratique: Pratique;
  objectifBloc: CouleurBloc;
}

let seq = 0;
function bloc(titre: string, detail: string, opts: Partial<Bloc> = {}): Bloc {
  seq = (seq + 1) % 1000;
  return { id: `b${Date.now().toString(36)}${seq}`, titre, detail, ...opts };
}
const profilText = (p: Profil | null) => (p ? `profils : ${p}` : 'profils au choix');

/** Cotation à `d` crans de l'objectif sur l'échelle du plan (6c −3 → 5c). */
export const grade = (obj: Objectif, d: number) => PLAN_GRADES[PLAN_GRADES.indexOf(obj) + d];
/** Niveau de bloc : tout ce qui est sous 6a = « 5+ » (cf. cotationToNiveau). */
const niveauOf = (g: string) => (g.startsWith('5') ? '5+' : g) as Niveau;
/** Couleur de bloc à `d` crans de l'objectif, bornée au jaune et au rose. */
export const couleurAt = (obj: CouleurBloc, d: number): CouleurBloc =>
  COULEURS_BLOC[Math.max(0, Math.min(COULEURS_BLOC.length - 1, COULEURS_BLOC.indexOf(obj) + d))];

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
  if (ctx.pratique === 'bloc') return blocSeance(ctx);
  const T = ctx.objectif;
  const g = (d: number) => grade(T, d);
  if (ctx.type === 'intensite') {
    // Forme basse ou reporter → bascule en mode volume
    if (ctx.energy <= 2 || ctx.intent === 'reporter') {
      const v = volumeBlocs(ctx.mardiIntense, ctx.focus, T);
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
          bloc('Échauffement', `2 voies ${g(-3)} fluides (${profilText(ctx.focus)}), note mentale sur chaque pied.`, { niveau: niveauOf(g(-3)), restMin: 5 }),
          bloc(`Projet ${T}`, `1 essai chrono (relief honnête, 15 min de repos avant). Pas de 2e essai en cas d'échec franc.`, { niveau: T, restMin: 15 }),
          bloc('Technique facile', `5 voies ${g(-1)} max, lecture précise, sans échec (${profilText(ctx.focus)}).`, { niveau: niveauOf(g(-1)), restMin: 8 }),
          bloc('Retour au calme', `1 voie ${g(-2)} fluide + étirements 5 min.`, { niveau: niveauOf(g(-2)), restMin: 0 }),
        ],
      };
    }
    if (ctx.energy === 4) {
      // Forme 🔥 + readiness OK
      if (ctx.gate7a && T === '7a') {
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
      note: `Séance intensité : ${g(-3)} → ${g(-2)} → 2× ${T} → ${g(-1)} → ${g(-2)} (${profilText(ctx.focus)}).`,
      blocs: [
        bloc(`Échauffement ${g(-3)}`, `1 voie ${g(-3)} fluide (${profilText(ctx.focus)}).`, { niveau: niveauOf(g(-3)), restMin: 5 }),
        bloc(g(-2), `1 voie ${g(-2)} fluide, zéro échec.`, { niveau: niveauOf(g(-2)), restMin: 5 }),
        bloc(`${T} #1`, `2 essais max sur un ${T} (${profilText(ctx.focus)}). 15 min de repos entre essais.`, { niveau: T, restMin: 15 }),
        bloc(`${T} #2`, `2 essais max sur un second ${T} (profil différent du #1).`, { niveau: T, restMin: 15 }),
        bloc(g(-1), `1 voie ${g(-1)}, lecture précise.`, { niveau: niveauOf(g(-1)), restMin: 10 }),
        bloc('Retour au calme', `1 voie ${g(-2)} fluide + étirements.`, { niveau: niveauOf(g(-2)), restMin: 0 }),
      ],
    };
  }
  // Jeudi — volume / endurance
  return {
    type: 'volume',
    note: ctx.mardiIntense
      ? `Mardi était intense → 7 voies max, aucun ${T} en finisher. Chute sur ${g(-1)} → redescends tout de suite : voie suivante, pas de nouvel essai.`
      : `Mardi facile → 9 voies dont 1× ${T} "test fatigue" en finisher (${profilText(ctx.focus)}). Chute sur ${g(-1)} → redescends : voie suivante, pas de nouvel essai.`,
    blocs: volumeBlocs(ctx.mardiIntense, ctx.focus, T),
  };
}

/** Séance bloc : pas de niveau sur les blocs (donc pas de journal voie), « Fait » + ressenti. */
function blocSeance(ctx: GenCtx): { type: SessionType; note?: string; blocs: Bloc[] } {
  const T = ctx.objectifBloc;
  const c = (d: number) => couleurAt(T, d);
  if (ctx.type === 'intensite' && ctx.energy > 2 && ctx.intent !== 'reporter') {
    const essais = ctx.readinessDrop ? 1 : 2;
    return {
      type: 'intensite',
      note: `Séance bloc : ${c(-3)} → ${c(-2)} → projet ${T} (${essais} essai${essais > 1 ? 's' : ''}) → ${c(-1)}.${ctx.readinessDrop ? ' 📉 Readiness en baisse → 1 essai.' : ''}`,
      blocs: [
        bloc(`Échauffement ${c(-3)}`, `2 blocs ${c(-3)} fluides, note mentale sur chaque pied.`, { restMin: 5 }),
        bloc(c(-2), `2 blocs ${c(-2)} fluides, zéro échec.`, { restMin: 5 }),
        bloc(`Projet ${T}`, `${essais} essai${essais > 1 ? 's' : ''} max sur un bloc ${T}. 15 min de repos entre essais.`, { restMin: 15 }),
        bloc(c(-1), `2 blocs ${c(-1)}, lecture précise.`, { restMin: 8 }),
        bloc('Retour au calme', `1 bloc ${c(-2)} fluide + étirements.`, { restMin: 0 }),
      ],
    };
  }
  const n = ctx.mardiIntense ? 6 : 8;
  return {
    type: 'volume',
    note: `Séance bloc volume : ${n} blocs ${c(-2)}/${c(-1)} d'affilée${ctx.mardiIntense ? '' : ` + 1× ${T} en finisher`}.`,
    blocs: [
      bloc('Échauffement', `1 bloc ${c(-2)} fluide + 5 min de pied.`, { restMin: 8 }),
      bloc('Enchaînement', `${n} blocs ${c(-2)}/${c(-1)} d'affilée (restes 8–12 min, timer).`, { restMin: 10 }),
      ...(ctx.mardiIntense ? [] : [bloc(`Finisher ${T}`, `1 bloc ${T} "test fatigue" : tenir dans la pompe, pas de top.`, { restMin: 12 })]),
      bloc('Retour au calme', 'Descente douce, étirements 10 min.', { restMin: 0 }),
    ],
  };
}

function volumeBlocs(mardiIntense: boolean, focus: Profil | null, T: Objectif): Bloc[] {
  // +3 voies : l'utilisateur grimpe toujours au moins 3 voies de plus que le plan → déjà comptées.
  const n = mardiIntense ? 7 : 9;
  const finisher = mardiIntense
    ? undefined
    : bloc(`Finisher ${T}`, `1 voie ${T} "test fatigue" : l'objectif est de tenir dans la pompe, pas de top.`, { niveau: T, restMin: 12 });
  const enchainement: Bloc[] = [
    bloc('Enchaînement', `${n} voies ${grade(T, -2)}/${grade(T, -1)} d'affilée (restes 8–12 min, timer). Focus : ${profilText(focus)}.`, { niveau: niveauOf(grade(T, -1)), restMin: 10 }),
  ];
  if (finisher) enchainement.push(finisher);
  return [
    bloc('Échauffement', `1 voie ${grade(T, -2)} fluide + 5 min de pied.`, { niveau: niveauOf(grade(T, -2)), restMin: 8 }),
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
