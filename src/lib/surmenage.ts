import type { Checkin, Seance, Voie } from '../db';

// Détection de surmenage — 14 jours glissants. Pure, testée dans tests/lib.test.ts.
// shortcut: la règle "douleurs 3 jours de suite" est évaluée sur les check-ins (2/sémaine,
// ce check-in n'existe pas les autres jours), quand 3 check-ins consécutifs signalent une douleur.

export type AlertId = 'pains3' | 'restDelta' | 'fail6c' | 'epuise48';
export interface Alert {
  id: AlertId;
  sev: 'rouge' | 'orange';
  title: string;
  message: string;
}
export type VerdictState = 'ok' | 'attention' | 'repos_actif' | 'bloque';
export interface Verdict {
  state: VerdictState;
  alerts: Alert[];
}

export interface UserData {
  checkins: Checkin[];
  seances: Seance[];
  voies: Voie[];
}

export function evaluateSurmenage(u: UserData, now: Date): Verdict {
  const alerts: Alert[] = [];

  // 1) Douleurs récurrentes : 3 derniers check-ins avec douleur (≠ aucune) → séance bloquée
  const painful = [...u.checkins]
    .filter((c) => c.pains.some((p) => p !== 'aucune'))
    .sort((a, b) => b.createdAt - a.createdAt);
  if (painful.length >= 3 && painful.slice(0, 3).every((c) => c.pains.some((p) => p !== 'aucune'))) {
    alerts.push({
      id: 'pains3',
      sev: 'rouge',
      title: 'Douleurs récurrentes',
      message: '3 check-ins consécutifs avec douleur. Consulte ou repose-toi. Séance bloquée.',
    });
  }

  // 2) Temps de récupération entre voies : +5 min par semaine → fatigue cumulée
  const last = restIntervalDelta(u);
  if (last !== null && last >= 5) {
    alerts.push({
      id: 'restDelta',
      sev: 'rouge',
      title: 'Fatigue cumulée détectée',
      message: 'Temps de récupération entre voies en hausse de +5 min. Repos forcé recommandé.',
    });
  }

  // 3) 2 échecs consécutifs sur 6c (mardi) → alerte rouge, report sur volume facile
  if (twoConsecutive6cFails(u)) {
    alerts.push({
      id: 'fail6c',
      sev: 'orange',
      title: '2 échecs consécutifs sur 6c',
      message: 'Risque blessure. Mardi : stop projet (volume 6b). Jeudi : 6a fluide uniquement ou repos.',
    });
  }

  // 4) Énergie épuisée + dernière séance < 48h → repos actif imposé (mobilité 20 min)
  const in14d = (ts: number) => now.getTime() - ts <= 14 * 24 * 3600 * 1000;
  const latestCheckin = [...u.checkins].sort((a, b) => b.createdAt - a.createdAt)
    .find((c) => in14d(c.createdAt));
  const lastActivity = maxActivityTs(u, now);
  if (latestCheckin?.energy === 1 && lastActivity > -Infinity && now.getTime() - lastActivity < 48 * 3600 * 1000) {
    alerts.push({
      id: 'epuise48',
      sev: 'orange',
      title: 'Repos actif imposé',
      message: 'Énergie épuisée + séance il y a moins de 48h. Mobilité 20 min, au lieu de la séance.',
    });
  }

  const has = (id: AlertId) => alerts.some((a) => a.id === id);
  const state: VerdictState = has('pains3') || has('restDelta') ? 'bloque'
    : has('epuise48') ? 'repos_actif'
    : has('fail6c') ? 'attention'
    : 'ok';
  return { state, alerts };
}

/** Dernière activité (création de séance ou log de voie) recente sur `now`. -Infinity si rien. */
function maxActivityTs(u: UserData, now: Date): number {
  const window = now.getTime() - 14 * 24 * 3600 * 1000;
  let max = -Infinity;
  for (const s of u.seances) {
    if (s.createdAt <= now.getTime() && s.createdAt >= window) max = Math.max(max, s.createdAt);
  }
  for (const v of u.voies) {
    if (v.date <= now.getTime() && v.date >= window) max = Math.max(max, v.date);
  }
  return max;
}

// Échecs 6c consécutifs : les 2 derniers essais 6c de séances "intensité" (ou tombées le mardi)…
function twoConsecutive6cFails(u: UserData): boolean {
  const intensiteIds = new Set(u.seances.filter((s) => s.type === 'intensite').map((s) => s.id));
  const fails = u.voies
    .filter((v) => v.niveau === '6c' && (v.seanceId === undefined ? isTuesday(v.date) : intensiteIds.has(v.seanceId)))
    .sort((a, b) => b.date - a.date)
    .slice(0, 2);
  return fails.length === 2 && fails.every((v) => v.chute !== 'top');
}

// …evaluées par intervalles entre log de voies. Retourne la hausse (min) de la médiane entre les 2 dernières séances intensité, null si incomparable.
function restIntervalDelta(u: UserData): number | null {
  const medians: { date: number; median: number }[] = [];
  for (const s of u.seances.filter((s) => s.type === 'intensite').sort((a, b) => b.createdAt - a.createdAt)) {
    const voies = u.voies.filter((v) => v.seanceId === s.id).sort((a, b) => a.date - b.date);
    if (voies.length < 3) continue; // il faut ≥2 intervalles pour une médiane utile
    const deltas: number[] = [];
    for (let i = 1; i < voies.length; i++) deltas.push((voies[i].date - voies[i - 1].date) / 60000);
    medians.push({ date: s.createdAt, median: median(deltas) });
    if (medians.length === 2) break; // les 2 dernières séances intensité
  }
  if (medians.length < 2) return null;
  return medians[0].median - medians[1].median;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function isTuesday(ts: number): boolean {
  return new Date(ts).getDay() === 2;
}

/** Était la séance mardi dernière intense (essais 6c/7a) ? Utilisé pour calibrer le volume du jeudi. */
export function lastMardiIntense(u: UserData, now: Date): boolean {
  const from = now.getTime() - 7 * 24 * 3600 * 1000;
  const seanceIds = new Set(
    u.seances
      .filter((s) => {
        const d = new Date(s.createdAt);
        return d.getDay() === 2 && s.createdAt >= from;
      })
      .map((s) => s.id),
  );
  return u.voies.some((v) => (v.seanceId === undefined ? isTuesday(v.date) : seanceIds.has(v.seanceId))
    && v.date >= from
    && (v.niveau === '6c' || v.niveau === '7a'));
}
