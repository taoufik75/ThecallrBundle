# 02 — Architecture technique

## Choix de fond

| Décision | Choix retenu (MVP) | Pourquoi |
|---|---|---|
| Plateforme mobile | **Flutter** (Dart) | Un seul codebase iOS+Android, hot reload, accès natif aux contacts/agenda via plugins matures |
| Persistance locale | **SQLite via Drift** | Requêtes typées, migrations, parfait pour un modèle relationnel (contacts ↔ numéros ↔ sources) |
| État / architecture app | **Riverpod** + couche domaine séparée | Testable, découple le moteur de contexte de l'UI |
| Backend | **Aucun (MVP)** | Local-first, privacy par défaut, pas d'infra à opérer |
| Sources contacts | Contacts natifs + **Google People API** (OAuth) | Couvre la majorité des cas ; CardDAV/iCloud en phase 2 |
| Agenda | Lecture seule du calendrier de l'appareil | Alimente le moteur sans droits d'écriture |

> Ces choix sont des recommandations de départ. React Native ou natif restent défendables ; Flutter est retenu pour la vitesse de prototypage d'un MVP.

## Découpage en couches

```
┌─────────────────────────────────────────────┐
│  UI (Flutter widgets)                         │
│  - Écran « Maintenant »                        │
│  - Fiche contact / édition                     │
│  - Assistant de fusion des doublons            │
└───────────────┬───────────────────────────────┘
                │ (Riverpod providers)
┌───────────────▼───────────────────────────────┐
│  Domaine (Dart pur, testable, zéro Flutter)    │
│  - ContextEngine : scoring des numéros          │
│  - DedupeService : détection/fusion doublons    │
│  - SuggestionService : compose l'écran Maintenant│
└───────────────┬───────────────────────────────┘
                │
┌───────────────▼───────────────────────────────┐
│  Data                                          │
│  - Repositories (contacts, numéros, appels)     │
│  - Drift (SQLite) : source de vérité locale     │
│  - Importers : NativeContacts, GooglePeople     │
│  - CalendarReader : événements à venir           │
└─────────────────────────────────────────────────┘
```

Règle d'or : **le `ContextEngine` est du Dart pur**, sans dépendance Flutter ni I/O. Il prend en entrée un instantané (contacts + heure + événements + historique) et retourne une liste ordonnée. Ça le rend testable au cordeau (cf. les scénarios de `04-context-engine.md`).

## Arborescence cible (phase 1)

```
app/                       # projet Flutter
  lib/
    main.dart
    domain/
      context_engine.dart
      dedupe_service.dart
      suggestion_service.dart
      models/              # Contact, PhoneNumber, CallEvent, ...
    data/
      db/                  # Drift : tables + DAO
      importers/
      calendar/
      repositories/
    ui/
      now/                 # écran « Maintenant »
      contact/
      dedupe/
    app.dart
  test/
    domain/                # tests du moteur, scénarisés
docs/                      # cette documentation
```

## Permissions & vie privée

- **Contacts** : lecture (import) + écriture locale dans la base de l'app. Aucune donnée ne quitte l'appareil au MVP.
- **Agenda** : lecture seule.
- **Historique d'appels** : Android expose le journal d'appels (permission dédiée) ; **iOS ne le permet pas**. Conséquence : la phase 2 (apprentissage sur l'historique) sera plus riche sur Android ; sur iOS, l'apprentissage s'appuiera sur les appels *lancés depuis l'app* uniquement. À arbitrer en phase 2.
- Pas de compte requis pour le MVP (hors OAuth Google optionnel pour l'import).

## Points d'attention techniques

- **Normalisation des numéros** : E.164 systématique (via `libphonenumber`) — indispensable pour dédupliquer et comparer.
- **Idempotence de l'import** : réimporter ne doit pas recréer de doublons (clé de correspondance stable par source).
- **Fusion non destructive** : garder la trace des fiches sources d'une fusion pour pouvoir annuler.
