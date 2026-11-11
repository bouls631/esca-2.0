// Types métier Coach Voie + libellés FR (une seule source de vérité pour l'UI)

export type SessionType = 'intensite' | 'volume';
export type Location = 'club' | 'maison' | 'repos_force';
export type Energy = 1 | 2 | 3 | 4; // épuisé / fatigué / ok / pleine forme
export type Pain = 'doigts' | 'avant_bras' | 'epaules' | 'dos' | 'aucune';
export type Feel = 'facile' | 'moyen' | 'dur' | 'echec'; // ressenti dernière séance
export type Ressenti = Exclude<Feel, 'echec'>; // ressenti d'un exercice (pas de voie)
export type Intent = 'standard' | 'alleger' | 'renforcer' | 'reporter';
export type Niveau = '5+' | '6a' | '6b' | '6b+' | '6c' | '7a';
export type Chute = 'depart' | 'milieu' | 'fin' | 'top';
export type Cause = 'force' | 'souffle' | 'technique' | 'mental' | 'doigts';
export type Profil = 'dalle' | 'devers' | 'toit' | 'diedre' | 'arete';
export type Axis = 'force' | 'endurance' | 'technique' | 'mental';

export interface Bloc {
  id: string;
  titre: string;
  detail: string;
  niveau?: Niveau;
  restMin?: number;
  done?: boolean;
  skipped?: boolean;
  ressenti?: Ressenti; // exercice maison noté facile/moyen/dur → calibre les séries suivantes
}

export const ENERGY_LABELS = ['', 'épuisé', 'fatigué', 'ok', 'pleine forme'] as const;
export const PAIN_LABELS: Record<Pain, string> = {
  doigts: 'doigts',
  avant_bras: 'avant-bras',
  epaules: 'épaules',
  dos: 'dos',
  aucune: 'aucune',
};
export const FEEL_LABELS: Record<Feel, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  dur: 'Dur',
  echec: 'Échec',
};
export const INTENT_LABELS: Record<Intent, string> = {
  standard: 'Standard',
  alleger: 'Alléger',
  renforcer: 'Renforcer',
  reporter: 'Reporter',
};
export const LOCATION_LABELS: Record<Location, string> = {
  club: 'Club',
  maison: 'Maison (poutre)',
  repos_force: 'Repos forcé',
};
export const CHUTE_LABELS: Record<Chute, string> = {
  depart: 'Départ',
  milieu: 'Milieu',
  fin: 'Fin (top du haut loupé)',
  top: 'Top ✓',
};
export const CAUSE_LABELS: Record<Cause, string> = {
  force: 'Pas assez de force',
  souffle: 'Souffle coupé',
  technique: 'Technique ratée',
  mental: 'Mental lâché',
  doigts: 'Doigts lâchent',
};
export const NIVEAU_LABELS: Record<Niveau, string> = {
  '5+': '5+',
  '6a': '6a',
  '6b': '6b',
  '6b+': '6b+',
  '6c': '6c',
  '7a': '7a',
};
export const PROFIL_LABELS: Record<Profil, string> = {
  dalle: 'Dalle',
  devers: 'Dévers',
  toit: 'Toit',
  diedre: 'Dièdre',
  arete: 'Arête',
};
export const SESSION_LABELS: Record<SessionType, string> = {
  intensite: 'Intensité',
  volume: 'Volume',
};
export const AXIS_LABELS: Record<Axis, string> = {
  force: 'Force',
  endurance: 'Endurance',
  technique: 'Technique',
  mental: 'Mental',
};
export const NIVEAUX_ORDER: Niveau[] = ['5+', '6a', '6b', '6b+', '6c', '7a'];
export type Objectif = '6a' | '6b' | '6c' | '7a';
export const OBJECTIFS: Objectif[] = ['6a', '6b', '6c', '7a'];
