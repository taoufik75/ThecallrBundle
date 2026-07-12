# 02 — Architecture technique

## Choix de fond

| Décision | Choix retenu (MVP) | Pourquoi |
|---|---|---|
| Plateforme mobile | **React Native + Expo** (TypeScript) | Un seul codebase iOS+Android, fast refresh, écosystème JS, `expo-contacts` / `expo-calendar` / `expo-sqlite` clés en main |
| Persistance locale | **SQLite via `expo-sqlite`** (+ Drizzle) | Requêtes typées, migrations, modèle relationnel (contacts ↔ numéros ↔ sources) |
| État / architecture app | **Zustand** (ou Context) + couche domaine séparée | Léger, testable, découple le moteur de contexte de l'UI |
| Backend | **Aucun (MVP)** | Local-first, privacy par défaut, pas d'infra à opérer |
| Sources contacts | `expo-contacts` (carnet natif) + **Google People API** (OAuth) | Couvre la majorité des cas ; CardDAV/iCloud en phase 2 |
| Agenda | `expo-calendar` en lecture seule | Alimente le moteur sans droits d'écriture |

> Choix de départ. Le cœur métier (`contxt-domain`) est en **TypeScript pur, sans dépendance UI** : réutilisable tel quel par l'app, un futur backend Node, ou du tooling.

## Découpage en couches

```
┌─────────────────────────────────────────────┐
│  UI (React Native / Expo)                     │
│  - Écran « Maintenant »                        │
│  - Fiche contact / édition                     │
│  - Assistant de fusion des doublons            │
└───────────────┬───────────────────────────────┘
                │ (store Zustand / hooks)
┌───────────────▼───────────────────────────────┐
│  Domaine — packages/contxt-domain (TS pur)     │
│  - ContextEngine : scoring des numéros          │
│  - DedupeService : détection/fusion doublons    │
│  - models : types unifiés                        │
└───────────────┬───────────────────────────────┘
                │
┌───────────────▼───────────────────────────────┐
│  Data (app)                                     │
│  - Repositories (contacts, numéros, appels)     │
│  - expo-sqlite (+ Drizzle) : vérité locale      │
│  - Importers : expo-contacts, Google People     │
│  - CalendarReader : expo-calendar               │
└─────────────────────────────────────────────────┘
```

Règle d'or : **le `ContextEngine` est du TypeScript pur**, sans dépendance UI ni I/O. Il prend un instantané (contacts + heure + événements + historique) et retourne une liste ordonnée. Ça le rend testable au cordeau (cf. les scénarios de `04-context-engine.md`).

## Arborescence (phase 1)

```
packages/contxt-domain/    # cœur métier, TS pur, testé
  src/
    models.ts              # Contact, PhoneNumber, Availability, RawContact, ...
    contextEngine.ts       # scoring contextuel
    dedupeService.ts       # détection/fusion des doublons
    index.ts
  test/                    # 18 tests (scénarios + propriétés)
app/                       # projet Expo / React Native
  App.tsx
  metro.config.js          # résolution monorepo
  src/
    data/sampleSnapshot.ts # données de démo (temporaire)
    ui/NowScreen.tsx        # écran « Maintenant »
docs/                      # cette documentation
```

## Permissions & vie privée

- **Contacts** : lecture (import) + écriture locale dans la base de l'app. Aucune donnée ne quitte l'appareil au MVP.
- **Agenda** : lecture seule.
- **Historique d'appels** : Android expose le journal d'appels (permission dédiée) ; **iOS ne le permet pas**. Conséquence : la phase 2 (apprentissage sur l'historique) sera plus riche sur Android ; sur iOS, l'apprentissage s'appuiera sur les appels *lancés depuis l'app* uniquement. À arbitrer en phase 2.
- Pas de compte requis pour le MVP (hors OAuth Google optionnel pour l'import).

## Points d'attention techniques

- **Normalisation des numéros** : E.164 systématique (via `libphonenumber-js`) — indispensable pour dédupliquer et comparer. La couche d'import normalise avant de peupler `RawContact.phoneE164s`.
- **Idempotence de l'import** : réimporter ne doit pas recréer de doublons (clé de correspondance stable par source).
- **Fusion non destructive** : garder la trace des fiches sources d'une fusion pour pouvoir annuler.
