# Contxt — le bon contact, le bon numéro, au bon moment

> Application mobile qui unifie tes carnets d'adresses, garde tes numéros à jour, et te propose le bon contact au bon moment selon le contexte (heure, agenda, habitudes).

**Statut : phase 1 démarrée.** Le cœur métier (moteur de suggestion contextuelle) est implémenté en Dart pur et **couvert par des tests exécutables**. Le scaffold de l'app Flutter consomme ce moteur.

## Structure du repo

```
packages/contxt_domain/   # cœur métier : modèles + moteur de contexte (Dart pur, testé)
  lib/                     #   ContextEngine, Contact, PhoneNumber, Availability, ...
  test/                    #   les 5 scénarios de spec + propriétés du moteur
  example/now_demo.dart    #   démonstrateur console de l'écran « Maintenant »
app/                       # application Flutter (iOS + Android) — scaffold phase 1
docs/                      # documentation produit & technique
```

### Lancer les tests du moteur (sans Flutter)

```bash
cd packages/contxt_domain
dart pub get
dart test                       # 9 tests, dont les 5 scénarios de la doc 04
dart run example/now_demo.dart  # aperçu console de l'écran « Maintenant »
```

### Lancer l'app (nécessite Flutter)

```bash
cd app && flutter pub get && flutter run
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

- **Mobile** : Flutter (un seul codebase iOS + Android).
- **Données** : local-first, l'app est source de vérité pour le contexte, avec import/synchro CardDAV + Google People API.
- **Backend** : aucun pour le MVP. Tout tourne sur le téléphone (privacy). Synchro multi-appareils ajoutée plus tard si besoin.

---

_Note : ce repo hébergeait auparavant un bundle Symfony pour l'API TheCallr, sans rapport avec ce projet. Les anciens fichiers seront retirés une fois le nouveau projet démarré._
