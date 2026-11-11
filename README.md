# Coach Voie — PWA grimpeur 6a → 7a

Coach préventif et adaptatif pour un grimpeur **6a-6b en tête, 6c en travail, objectif 7a en tête**, 2 séances/semaine fixes :
**mardi = intensité/voie max** (fraîcheur neurologique), **jeudi = volume/endurance** (capitalise sur la fatigue).

- **Au club** : mur 36 relais (dalles, dévers, toits, dièdres, arêtes), max 5-6 voies/séance, **max 2× 6c**.
- **À la maison** : poutre verticale, anneaux, élastiques, corde à sauter (pas de campus board).

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 23 tests unitaires (logique métier)
npm run build    # build PWA offline-first → dist/
```

## Lancer / installer

- Sur téléphone : ouvrir l'URL (dev ou Pages) → « Ajouter à l'écran d'accueil » → mode standalone, offline après première visite.
- Données 100% locales (IndexedDB), export JSON depuis l'onglet Stats.

## Déployer sur GitHub Pages

Le workflow `.github/workflows/pages.yml` est déjà présent. Dans **Settings → Pages → Source : GitHub Actions**.
À chaque push sur `main` : tests + build (base `/esca-2.0/` automatique) + déploiement.
URL finale : `https://bouls631.github.io/esca-2.0/`.

## Architecture

```
src/
  main.tsx               Amorçage React
  App.tsx                Tabs (Aujourd'hui / Séance / Stats) + données live Dexie
  db.ts                  Schéma Dexie + export JSON
  styles.css             Tailwind v4 + thème sombre terminal
  components/
    ui.tsx               Btn/Card/Chip/Tag/Bar/TimerCard (gros boutons, thumb zone)
    Sheet.tsx            Feuilles modales basses (une main)
  lib/
    types.ts             Types métier + libellés FR
    cycles.ts            Rotation anti-spécialisation (4 semaines ISO)
    surmenage.ts         Détecteur de surmenage 14 jours glissants
    readiness.ts         Test hebdo + facteur −20% + porte 7a
    generator.ts         Générateur de séances adaptatif (mardi/jeudi/maison/repos)
    analyse-causes.ts    Analyse des chutes → jauges + prescriptions + micro-workouts
    timer.ts             Timer de récupération (vibration + bip, survit aux onglets)
    useSwipe.ts          Swipe droite=Fait, gauche=Reporté, bas=Modifié
  screens/
    Aujourdhui.tsx       selon le jour : check-in / mobilité (mer) / micro-workout (ven) / renforcement (sam) / readiness / porte 7a
    Seance.tsx           check-in 30 s + plan swipeable + journal de voie + timer
    CheckIn.tsx          check-in quadruple (lieu/énergie/douleurs/ressenti/intention)
    JournalVoie.tsx      niveau + point de chute + cause (20 s)
    ReadinessSheet.tsx   deadhang poutre + tractions + ressenti (dimanche, 5 min)
    Stats.tsx            calendrier 14 j, jauges, porte 7a, historique, export JSON
tests/lib.test.ts        23 tests : surmenage, readiness, 7a, générateur, analyse
```

### Schéma Dexie (v1)

| Table      | Index          | Contenu |
|----------- | -------------- | ------- |
| `profile`  | `id`           | prise de référence du deadhang |
| `checkins` | `++id, date`   | lieu, énergie 1-4, douleurs, ressenti dernière séance, intention, **override** |
| `seances`  | `++id, date`   | type, note d'adaptation, blocs (avec état fait/reporté) |
| `voies`    | `++id, date, seanceId` | niveau, profil, chute, cause, n° d'essai |
| `readiness`| `++id, date`   | deadhang s (prise), tractions, ressenti 1-10 |

## Logique métier

### Détecteur de surmenage (14 jours glissants) — par priorité
1. **Douleurs récurrentes** (3 derniers check-ins ≠ aucune) → **séance bloquée**.
2. **Récupération entre voies +5 min** (médianes des 2 dernières séances d'intensité) → **repos forcé**.
3. **2 échecs 6c consécutifs** (mardi) → mardi = volume 6b, jeudi = 6a fluide ou repos.
4. **Énergie épuisée + séance < 48 h** → **repos actif** (mobilité 20 min).
   Override « J'assume le risque » : tout est possible, la décision est tracée (check-in `override`).

### Readiness (dimanche)
deadhang (prise choisie) + tractions + ressenti /10. **Baisse > 20 % vs moyenne des 4 précédentes → intensité −20 %** (1 essai chrono sur le 6c au lieu de 2, plus de volume facile).

### Porte 7a
3 tops 6c **le mardi** en 4 semaines + readiness stable + aucun blocage → le mardi passe en **projet 7a (3 essais, repos 20 min)**.

### Rotation anti-spécialisation (semaines ISO)
S1 dévers/dalle · S2 toit/arête · S3 dièdre/dévers · S4 libre ou récupération.

### Journal de chute → analyse (fenêtre 14 jours)
- 3× « Fin » → déficit endurance → jeudi +1 voie d'enchaînement.
- 2× « Milieu » sur dévers/toit → déficit lock-off → micro-workout poutre vendredi.
- 2× cause « Mental » → respiration 4-7-8 + visualisation avant chaque séance.

### Mercredi mobilité & samedi renforcement
- **Mercredi** — chrono mobilité (hanches, épaules, ischios, avant-bras, colonne ; + rotation thoracique dès le niveau 6b+). Tenue 30/40/50 s selon le niveau, 2 tours, environ 9 à 18 min.
- **Samedi** — chrono renforcement (fentes bulgares, pompes, gainage latéral, Y-T-W, poignets), sans anneaux. Séries 2 à 4 selon le niveau, une série de moins en semaine de décharge (S4/S8/S12).

Micro-workout maison (10 min, vendredi) prescrit selon la dernière cause de chute : force → lock-offs + anneaux ; souffle → corde à sauter ; technique → silent feet ; mental → 4-7-8 + visualisation.

## Scénarios concrets

### 1) Semaine type
- **Mardi** (semaine 1 = dévers) — check-in : ok, ok, aucune, moyen → plan : 2 voies 5+/6a fluides → 2× 6c dévers (2 essais chacun, repos 15 min) → 6b+ technique → retour au calme. Journal : 6c #1 `Top ✓`, 6c #2 `Milieu — souffle`, 6b+ `Top ✓`.
- **Jeudi** — mardi était intense : 6a échauffement → 7 voies 6a/6b dalle (repos 8-12 min, timer) → pas de 6c. Journal noté voie par voie.

### 2) Semaine avec alerte surmenage
- **Mardi -1** : 6c → `Fin — souffle`. **Mardi J** : check-in ok → 6c → `Milieu — force`.
- Le détecteur relève **2 échecs 6c consécutifs** → bandeau rouge. Le jeudi : check-in → plan override « 6a fluide uniquement », et le mardi suivant passe automatiquement en volume 6b.
- Si en plus les douleurs « doigts » apparaissent sur 3 relevés consécutifs (check-in ou test readiness) → **séance bloquée** ; un relevé sans douleur (test readiness compris) lève le blocage : l'app propose « Repos forcé » ou « J'assume le risque » (décision notée, marqueur ⚠ dans l'historique).

### 3) Semaine avec adaptation (readiness bas)
- **Dimanche** : deadhang 76s vs moyenne 100s (−24 %) → le test est invalidé (>20 %).
- **Mardi** : check-in pleine forme → plan allégé « intensité −20 % » : 2 voies 5+/6a → **1 essai chrono 6c** (pas de 2e essai si échec franc) → 5 voies 6b lecture → retour au calme. La porte 7a reste fermée jusqu'à un readiness stable.

## Choix techniques

- React 19 + Vite 7 + TypeScript strict, Tailwind v4 (thème sombre « terminal », mono système → zéro webfont hors ligne).
- **Composants UI maison type shadcn** (Btn/Card/Chip/Sheet) plutôt que shadcn/CLI : même apparence/emptabilité, zéro dépendance radix.
- Dexie.js + dexie-react-hooks (`useLiveQuery`) : réactive, offline-first, `vite-plugin-pwa` (autoUpdate, precache complet).
- Algorithme métier 100 % pur + testé (`npm test`) — pas de logique cachée dans les composants.
