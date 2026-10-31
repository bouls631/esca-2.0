import Dexie, { type EntityTable } from 'dexie';
import type { Bloc, Cause, Chute, Energy, Feel, Intent, Location, Niveau, Pain, Profil, SessionType } from './lib/types';

export * from './lib/types';


export * from './lib/types';

export interface Profile {
  id: 'me';
  holdLabel?: string; // prise de référence pour le deadhang (ex: "réglette 2 doigts")
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

export const db = new Dexie('coach-voie') as Dexie & {
  profile: EntityTable<Profile, 'id'>;
  checkins: EntityTable<Checkin, 'id'>;
  seances: EntityTable<Seance, 'id'>;
  voies: EntityTable<Voie, 'id'>;
  readiness: EntityTable<ReadinessTest, 'id'>;
};

db.version(1).stores({
  profile: 'id',
  checkins: '++id, date',
  seances: '++id, date',
  voies: '++id, date, seanceId',
  readiness: '++id, date',
});

// Export JSON complet (backup) — appelé par la page Stats.
export function exportAll(): Promise<Record<string, unknown>> {
  return Promise.all([
    db.profile.toArray(),
    db.checkins.toArray(),
    db.seances.toArray(),
    db.voies.toArray(),
    db.readiness.toArray(),
  ]).then(([profile, checkins, seances, voies, readiness]) => ({
    app: 'coach-voie',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile, checkins, seances, voies, readiness,
  }));
}
