# Contxt — le bon contact, le bon numéro, au bon moment

> Application mobile qui unifie tes carnets d'adresses, garde tes numéros à jour, et te propose le bon contact au bon moment selon le contexte (heure, agenda, habitudes).

**Statut : phase 1 démarrée.** Le cœur métier (moteur de suggestion contextuelle + déduplication) est implémenté en **TypeScript pur** et **couvert par des tests exécutables**. L'app **Expo / React Native** consomme ce moteur.

## Structure du repo (monorepo npm workspaces)

```
packages/contxt-domain/    # cœur métier : TS pur, testé, sans dépendance UI
  src/                      #   ContextEngine, DedupeService, unify (pipeline), models
  test/                     #   26 tests : scénarios de spec + dédup + unification
app/                        # application Expo / React Native (iOS + Android)
  src/data/                 #   import expo-contacts/calendar, normalisation E.164,
                            #   unification, persistance expo-sqlite, hook de chargement
  src/ui/NowScreen.tsx      #   écran « Maintenant »
  src/ui/DedupeScreen.tsx   #   revue des doublons à fusionner
docs/                       # documentation produit & technique
```

### Lancer les tests (sans device)

```bash
npm install
npm test          # 42 tests : 34 (domaine) + 8 (data de l'app)
npm run typecheck
```

Le cœur (`contxt-domain`) et les mappers purs de la couche data sont testés en
Node ; les adaptateurs natifs (contacts/agenda/SQLite) et l'UI sont validés par
le typecheck et le bundle Metro (`npx expo export`).

### Lancer l'app

```bash
cd app && npx expo start   # puis simulateur iOS/Android ou l'app Expo Go
```

## Le problème

Nos contacts vivent éclatés entre plusieurs répertoires (téléphone, ordinateur, pro, privé). Résultat :

1. **Doublons et numéros périmés** — la même personne existe en 3 fiches, dont 2 avec un vieux numéro.
2. **Le bon numéro au mauvais moment** — appeler le fixe du bureau à 21h, ou le mobile perso en pleine réunion.
3. **Favoris figés** — les « favoris » du téléphone ne bougent jamais, alors que mes besoins changent selon la semaine et mon agenda.

## L'idée

Une app mobile qui :

- **unifie** les contacts de toutes les sources et **corrige** doublons + numéros périmés,
- modélise chaque contact avec **plusieurs numéros typés et contextualisés**,
- fait remonter, sur un écran « Maintenant », **les bons contacts/numéros selon le contexte** (heure du jour, prochains rendez-vous, historique d'appels).

Le différenciateur n'est pas « encore un carnet d'adresses » : c'est le **moteur de suggestion contextuelle**. Voir [`docs/04-context-engine.md`](docs/04-context-engine.md).

## Documentation

| Doc | Contenu |
|---|---|
| [`docs/01-vision-mvp.md`](docs/01-vision-mvp.md) | Vision, périmètre du MVP, roadmap |
| [`docs/02-architecture.md`](docs/02-architecture.md) | Stack technique et découpage |
| [`docs/03-data-model.md`](docs/03-data-model.md) | Modèle de données unifié |
| [`docs/04-context-engine.md`](docs/04-context-engine.md) | Le moteur de scoring contextuel (cœur du produit) |

## Choix par défaut (phase 0)

Ces choix sont des recommandations — à confirmer ou contredire.

- **Mobile** : React Native + Expo (TypeScript, un seul codebase iOS + Android).
- **Données** : local-first, l'app est source de vérité pour le contexte, avec import/synchro CardDAV + Google People API.
- **Backend** : aucun pour le MVP. Tout tourne sur le téléphone (privacy). Synchro multi-appareils ajoutée plus tard si besoin.

