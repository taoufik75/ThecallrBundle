# Contacts intelligents (`context_contacts`)

App mobile Flutter qui **agrège** plusieurs carnets d'adresses, **détecte et
fusionne les doublons**, et maintient une base **propre et à jour** — puis, dans
les itérations suivantes, proposera le bon contact **au bon moment**.

Ce dépôt contient le **MVP « point 1 »** : agrégation multi-sources +
déduplication + fusion. Les suggestions contextuelles (point 2) et les favoris
dynamiques (point 3) sont préparés par l'architecture mais hors périmètre MVP.

## Pourquoi ce point d'abord ?

Tant que la base n'est pas propre, tout ce qu'on construit dessus (suggestion
du bon numéro, favoris dynamiques) suggère du bruit. La déduplication est donc
le socle.

## Architecture

Découpage *clean / feature-first*, avec un domaine **sans aucune dépendance
Flutter** (donc testable en Dart pur, sans émulateur) :

```
lib/
  domain/                    ← logique métier PURE (zéro Flutter)
    entities/                  ContactRecord, PhoneNumber, EmailAddress, ContactSource
    dedup/
      phone_normalizer.dart    normalisation E.164 (interface + impl. simple FR/intl)
      name_matcher.dart        similarité de noms (Jaccard + Levenshtein, sans accents)
      dedup_engine.dart        blocking + union-find + scoring de confiance
      merge_service.dart       consolidation avec arbitrage source/fraîcheur/complétude
      duplicate_group.dart     groupe de doublons + niveau de confiance
    repositories/              contrats (interfaces)
  data/
    sources/                   DeviceContactSource (flutter_contacts) + stubs Google/iCloud
                               + sources de démo (données d'exemple avec doublons)
    repositories/              DefaultContactRepository (orchestration, en mémoire)
  presentation/               Riverpod + écrans (Contacts, Doublons, Revue de fusion)
```

### Le moteur de déduplication en bref

1. **Normalisation** — chaque numéro est ramené à sa forme canonique E.164
   (`+33612345678`) ; c'est la clé de comparaison. Les emails sont comparés en
   minuscules.
2. **Blocking** — on ne compare que les fiches partageant une clé (même numéro,
   même email, ou même token de nom) → on évite le coût O(n²).
3. **Union-Find** — on relie les fiches par signal fort (même numéro/email) ou
   forte similarité de nom, ce qui forme des groupes **transitifs**
   (A~B et B~C ⇒ {A, B, C}).
4. **Confiance** :
   - `Certain` — même numéro ou email → **fusion automatique** ;
   - `Probable` — noms proches **+** signal faible (même société / domaine) → à confirmer ;
   - `À vérifier` — noms proches seulement → à confirmer.
5. **Fusion** — union des numéros/emails (rien n'est perdu), arbitrage des
   champs par **confiance de la source** puis **fraîcheur** puis **complétude**.
   La provenance (`sources`, `mergedFrom`) est conservée pour l'audit.

## Lancer le projet

Prérequis : Flutter ≥ 3.22.

```bash
cd app

# 1. Génère les dossiers de plateforme (android/ios/…) sans toucher à lib/
flutter create --project-name context_contacts --org com.example .

# 2. Dépendances
flutter pub get

# 3. Lance (l'app démarre sur des données de DÉMO avec doublons volontaires)
flutter run
```

L'app démarre sur des contacts de démonstration : pas besoin d'autoriser le
carnet natif pour voir l'agrégation et la fusion à l'œuvre. Pour brancher le
vrai carnet, voir *Brancher le carnet natif* ci-dessous.

## Tests

Logique métier (rapide, sans émulateur) :

```bash
cd app
flutter pub get
flutter test
```

Vérification ultra-rapide du domaine **sans même `pub get`** (pratique en dev) :

```bash
dart run tool/selfcheck.dart        # normalisation, matching, dédup, fusion
dart run tool/selfcheck_repo.dart   # orchestration du dépôt
```

## Brancher le carnet natif

Dans `lib/presentation/providers.dart`, remplacer les sources de démo :

```dart
final contactSourcesProvider = Provider<List<ContactSourceProvider>>((ref) {
  return [DeviceContactSource()];
});
```

Puis déclarer les permissions `flutter_contacts` :

- **Android** — `android/app/src/main/AndroidManifest.xml` :
  ```xml
  <uses-permission android:name="android.permission.READ_CONTACTS"/>
  <uses-permission android:name="android.permission.WRITE_CONTACTS"/>
  ```
- **iOS** — `ios/Runner/Info.plist` :
  ```xml
  <key>NSContactsUsageDescription</key>
  <string>L'app lit vos contacts pour détecter et fusionner les doublons.</string>
  ```

## Feuille de route

| Itération | Contenu |
|-----------|---------|
| **1 (ce MVP)** | Agrégation multi-sources, dédup, fusion, revue manuelle |
| 2 | Persistance locale (drift), normalisation E.164 exhaustive (`phone_numbers_parser`), écriture/synchro bidirectionnelle **Google** (People API) & **iCloud** (CardDAV) |
| 3 | **Point 2** : moteur de suggestion « bon numéro au bon moment » (heure, historique d'appels) |
| 4 | **Point 3** : favoris dynamiques pilotés par l'agenda (accès calendrier) |
| 5 | Enrichissement externe (signatures email, annuaires) sous contrôle RGPD |

## Décisions de conception

- **Domaine sans Flutter** : le cœur (dédup/fusion) est validé par des tests
  Dart purs et réutilisable côté serveur si besoin.
- **`PhoneNormalizer` est une interface** : `SimplePhoneNormalizer` (MVP) se
  remplace par une implémentation `phone_numbers_parser` sans toucher au domaine.
- **`ContactSourceProvider` uniformise les sources** : ajouter une source =
  implémenter une interface ; le reste (dédup, fusion, UI) ne change pas.
- **Fusion non destructive** : on unifie les moyens de contact et on garde la
  provenance ; aucune donnée n'est perdue, une fusion reste auditable.
