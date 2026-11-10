import rawRoutes from '../data/routes.json';
import type { Niveau, Profil } from './types';

export interface OblykRoute {
  id: number;
  relais: number | null;
  secteur: string | null;
  secteur_id: number | null;
  cotation: string;
  cotation_val: number;
  couleur: string | null;
  ouverte_le: string | null;
  hauteur: number | null;
  lien: string;
}

export const RAPPEL_ROUTES: OblykRoute[] = rawRoutes as OblykRoute[];

/** Convertit une cotation Oblyk (4b..8a) vers le Niveau le plus proche de Coach Voie. */
export function cotationToNiveau(cot: string): Niveau {
  if (cot.startsWith('4') || cot.startsWith('5')) return '5+';
  if (cot === '6a' || cot === '6a+') return '6a';
  if (cot === '6b') return '6b';
  if (cot === '6b+') return '6b+';
  if (cot === '6c' || cot === '6c+') return '6c';
  return '7a';
}

/** Déduit le profil du mur depuis le nom du secteur de la salle RAPPEL. */
export function secteurToProfil(secteur: string | null): Profil {
  const s = (secteur ?? '').toLowerCase();
  if (s.includes('dévers') || s.includes('devers')) return 'devers';
  if (s.includes('dièdre') || s.includes('diedre')) return 'diedre';
  if (s.includes('toit')) return 'toit';
  if (s.includes('arête') || s.includes('arete')) return 'arete';
  return 'dalle';
}

/** Cotations uniques présentes dans la salle, triées par difficulté croissante. */
export function uniqueGrades(routes: OblykRoute[] = RAPPEL_ROUTES): { cotation: string; val: number }[] {
  const seen = new Set<string>();
  const uniq: { cotation: string; val: number }[] = [];
  for (const r of routes) {
    const k = `${r.cotation}|${r.cotation_val}`;
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push({ cotation: r.cotation, val: r.cotation_val });
    }
  }
  return uniq.sort((a, b) => a.val - b.val);
}

/** Filtre les voies de la salle par plage de valeur de cotation et secteur optionnel. */
export function filterRoutes(
  minVal: number,
  maxVal: number,
  secteur?: string,
  routes: OblykRoute[] = RAPPEL_ROUTES,
): OblykRoute[] {
  const [lo, hi] = minVal <= maxVal ? [minVal, maxVal] : [maxVal, minVal];
  return routes.filter(
    (r) => r.cotation_val >= lo && r.cotation_val <= hi && (!secteur || r.secteur === secteur),
  );
}

/** Suggère des voies montées de la salle RAPPEL correspondant à un Niveau et un Profil optionnel. */
export function suggestRoutesFor(niveau: Niveau, profil?: Profil | null, limit = 3): OblykRoute[] {
  const matchesGrade = RAPPEL_ROUTES.filter((r) => cotationToNiveau(r.cotation) === niveau);
  if (!profil) return matchesGrade.slice(0, limit);
  const byProfil = matchesGrade.filter((r) => secteurToProfil(r.secteur) === profil);
  return (byProfil.length > 0 ? byProfil : matchesGrade).slice(0, limit);
}
