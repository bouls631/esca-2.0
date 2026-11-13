# AGENTS.md

Coach Voie : PWA française (React 19 + Vite 7 + TypeScript strict + Dexie), coach préventif pour un grimpeur 6a → 7a. Données 100 % locales (IndexedDB), pas de backend.

## Commandes

- `npm install`, `npm run dev` (localhost:5173)
- `npm test` = `vitest run`. Un seul fichier de tests : `tests/lib.test.ts`. Filtrer : `npx vitest run -t "nom du test"`.
- `npm run build` = `tsc --noEmit && vite build`. C'est le seul typecheck du repo.
- Avant de pousser : lancer `npm test` puis `npm run build`. Le CI (`.github/workflows/pages.yml`) lance `npx vitest run` puis `npx vite build` sans `tsc`, donc un type cassé peut passer le CI.
- `npm run fetch-routes` réécrit `src/data/routes.json` et `public/routes.json` depuis l'API Oblyk (réseau requis). Ne pas éditer ces fichiers à la main.
- `npm run icons` régénère `public/icons/*.png`.

## Déploiement

- Chaque push sur `main` déploie GitHub Pages (URL `https://bouls631.github.io/esca-2.0/`). Le repo est poussé directement sur `main` ; ne pas garder de travail non poussé.
- Settings → Pages → Source doit rester **GitHub Actions**. En mode « Deploy from a branch », Pages sert le `index.html` source (page blanche).
- `vite.config.ts` met `base = '/esca-2.0/'` seulement si `GITHUB_ACTIONS` est défini ; en local la base est `/`. Ne pas la figer en dur.
- Après déploiement, `/esca-2.0/manifest.webmanifest` et `/esca-2.0/assets/index-*.js` doivent répondre 200.
- Windows : `git push` écrit sur stderr, PowerShell affiche alors `NativeCommandError` alors que le push a réussi. Vérifier la ligne `main -> main`, pas le code de sortie.

## Architecture

- `src/lib/` : logique métier pure, testée. Les composants ne doivent pas contenir d'algorithme.
  - `generator.ts` : génère la séance du jour à partir d'un `GenCtx` (mardi intensité, jeudi volume, maison, repos forcé).
  - `surmenage.ts`, `readiness.ts`, `analyse-causes.ts`, `cycles.ts`, `plan.ts`, `routes.ts`.
- `src/screens/` : écrans. `CheckIn.tsx` assemble le `GenCtx` et écrit checkin + séance.
- `src/App.tsx` : charge toutes les tables via `useLiveQuery`, et définit `AppData` (importé en `import type` par les écrans).
- `src/db.ts` : schéma Dexie (v1, v2), types d'entités, export/import JSON.
- `src/lib/types.ts` : unions et libellés FR. Les libellés affichés viennent d'ici.

## Deux échelles de cotation (ne pas les confondre)

- `Niveau` (`types.ts`) : `'5+' | '6a' | '6b' | '6b+' | '6c' | '7a'`, utilisé par les blocs, les voies loggées et l'UI. Tout ce qui est sous 6a est `'5+'` (`cotationToNiveau` dans `routes.ts`).
- `PLAN_GRADES` (`plan.ts`) : `'4a'…'8a'`, utilisé par le curseur `profile.level` (1..9, 5 = 6c) et les cibles de volume.
- `Objectif` (`types.ts`) : `'6a' | '6b' | '6c' | '7a'`, stocké dans `profile.objectif` (défaut 6c). La fonction `grade(obj, d)` de `generator.ts` calcule les cotations à `d` crans de l'objectif. L'échauffement est à −3 crans (6c → 5c), le projet à 0, la technique à −1.
- Le curseur de niveau et l'objectif sont indépendants. Le curseur pilote doigts, mobilité et renforcement.
- Règles encore figées sur le 6c : porte 7a (tops 6c le mardi), `lastMardiIntense`. Elles ne suivent pas `objectif`.

## Règles métier (ne pas bifurquer sans demande)

- Calendrier fixe : mardi = intensité, jeudi = volume. Hors calendrier, le check-in force le type.
- Surmenage (14 j glissants) : douleurs sur les 3 derniers relevés (check-in ou test readiness) avec douleur → bloqué (`pains3`) ; un relevé sans douleur coupe la série ; récupération entre voies en hausse (`restDelta`) → bloqué ; énergie 1 et séance < 48 h → repos actif (`epuise48`). Source : `surmenage.ts`.
- « J'assume le risque » est toujours possible, mais le check-in garde `override: true` et Stats l'affiche avec ⚠.
- Readiness : baisse > 20 % vs moyenne des 4 tests précédents → intensité −20 %.
- Porte 7a : 3 tops 6c le mardi en 4 semaines + readiness stable + pas de blocage.
- Mardi intense (essais 6c/7a loggés) → jeudi limité à 7 voies, sans 6c.
- Pratique voie/bloc (check-in, club uniquement) : `Checkin.pratique` (défaut voie). Bloc = couleurs `COULEURS_BLOC` (jaune → rose), objectif `profile.objectifBloc` (défaut rouge), bornées au jaune/rose, sans `niveau` (donc pas de journal voie).
- `restDelta` ignore les séances d'intensité avec moins de 3 voies (`surmenage.ts`, « il faut ≥2 intervalles »).

## Pièges TypeScript / React

- `verbatimModuleSyntax` : imports de types en `import type`.
- `dexie-react-hooks` 1.1.7 : écrire `useLiveQuery<AppData, null>(querier, [], null)`, sinon le type ne se réduit pas.
- JSX : ne jamais écrire `>20%` en texte brut (TS1382). Utiliser `≥20%` ou `{'>'}`.
- `noUnusedLocals` et `noUnusedParameters` sont actifs : les imports inutilisés cassent le build.
- Dexie : ajouter un champ optionnel (ex. `profile.objectif`) ne demande pas de migration. Un nouveau champ indexé demande une nouvelle `db.version(n)`.
- Tests : les fixtures de `voie(...)` doivent recevoir un vrai `seanceId` (un `undefined` explicite prend la valeur par défaut).

## Décisions déjà refusées (ne pas re-proposer)

- Notifications locales, mode bêta qui change mardi/jeudi, catalogue complet des 36 relais (suggestions par profil seulement).

## Docs

- `README.md` : la ligne « 23 tests » est périmée, la suite compte 33 tests.
- Ce fichier et `README.md` décrivent les règles métier ; si une règle change, mettre à jour les deux.
