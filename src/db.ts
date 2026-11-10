import Dexie, { type EntityTable } from 'dexie';
import type { Bloc, Cause, Chute, Energy, Feel, Intent, Location, Niveau, Pain, Profil, SessionType } from './lib/types';

export * from './lib/types';

export interface Profile {
  id: 'me';
  holdLabel?: string; // prise de référence pour le deadhang (ex: "réglette 2 doigts")
  level?: number; // 1..9 (5 = 6c, curseur Escalade Pro Training)
  cycleStart?: string; // 'yyyy-MM-dd' lancement du cycle de 12 semaines
  weekOffset?: number; // décalage manuel de semaine
}

export interface Checkin {
  id?: number;
  date: string; // 'yyyy-MM-dd'
  type: SessionType; // type de séance attendu ce jour
  location: Location;
  energy: Energy;
  pains: Pain[];
  feel: Feel; // ressenti de la DERNIÈRE séance
  intent: Intent;
  override: boolean; // "j'assume le risque" quand la séance est bloquée
  createdAt: number;
}

export interface Seance {
  id?: number;
  date: string;
  type: SessionType;
  checkinId?: number;
  note?: string;
  blocs: Bloc[];
  createdAt: number;
}

export interface Voie {
  id?: number;
  seanceId?: number;
  date: number; // timestamp de fin de l'essai
  niveau: Niveau;
  profil: Profil;
  chute: Chute;
  cause?: Cause; // cause de la chute (absente si top)
  essai: number; // n° d'essai sur ce niveau ce jour
  relais?: number; // n° de relais salle RAPPEL (Oblyk)
  secteur?: string;
  couleur?: string;
  oblykId?: number;
  note?: string;
  createdAt: number;
}

export interface ReadinessTest {
  id?: number;
  date: string;
  holdLabel: string;
  deadhangS: number;
  tractions: number;
  ressenti: number; // 1-10
  createdAt: number;
}

export interface FingerSession {
  id?: number;
  date: string;
  hold: string; // '20mm' | '15mm' | '10mm' | '8mm'
  kg: number;
  sets: number;
  work: number;
  week: number;
  createdAt: number;
}

export const db = new Dexie('coach-voie') as Dexie & {
  profile: EntityTable<Profile, 'id'>;
  checkins: EntityTable<Checkin, 'id'>;
  seances: EntityTable<Seance, 'id'>;
  voies: EntityTable<Voie, 'id'>;
  readiness: EntityTable<ReadinessTest, 'id'>;
  finger: EntityTable<FingerSession, 'id'>;
};

db.version(1).stores({
  profile: 'id',
  checkins: '++id, date',
  seances: '++id, date',
  voies: '++id, date, seanceId',
  readiness: '++id, date',
});

db.version(2).stores({
  profile: 'id',
  checkins: '++id, date',
  seances: '++id, date',
  voies: '++id, date, seanceId',
  readiness: '++id, date',
  finger: '++id, date',
});

// Export JSON complet (backup) — appelé par la page Stats.
export function exportAll(): Promise<Record<string, unknown>> {
  return Promise.all([
    db.profile.toArray(),
    db.checkins.toArray(),
    db.seances.toArray(),
    db.voies.toArray(),
    db.readiness.toArray(),
    db.finger.toArray(),
  ]).then(([profile, checkins, seances, voies, readiness, finger]) => ({
    app: 'coach-voie',
    version: 2,
    exportedAt: new Date().toISOString(),
    profile, checkins, seances, voies, readiness, finger,
  }));
}

// Import JSON complet (restauration).
export async function importAll(raw: Record<string, unknown>): Promise<void> {
  if (raw.app !== 'coach-voie') throw new Error('Fichier invalide');
  await db.transaction('rw', [db.profile, db.checkins, db.seances, db.voies, db.readiness, db.finger], async () => {
    if (Array.isArray(raw.profile)) { await db.profile.clear(); await db.profile.bulkPut(raw.profile as Profile[]); }
    if (Array.isArray(raw.checkins)) { await db.checkins.clear(); await db.checkins.bulkPut(raw.checkins as Checkin[]); }
    if (Array.isArray(raw.seances)) { await db.seances.clear(); await db.seances.bulkPut(raw.seances as Seance[]); }
    if (Array.isArray(raw.voies)) { await db.voies.clear(); await db.voies.bulkPut(raw.voies as Voie[]); }
    if (Array.isArray(raw.readiness)) { await db.readiness.clear(); await db.readiness.bulkPut(raw.readiness as ReadinessTest[]); }
    if (Array.isArray(raw.finger)) { await db.finger.clear(); await db.finger.bulkPut(raw.finger as FingerSession[]); }
  });
}
