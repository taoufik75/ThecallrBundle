# Cadrage produit — Carnet de contacts intelligent et contextuel

> Nom de code provisoire : **Kontext** (à changer)
> Statut : document de démarrage (v0) — hypothèses à valider par le porteur du projet.

## 1. Problème (pain points)

1. **Répertoires éclatés** : contacts dispersés entre téléphone, ordinateur, annuaire pro et
   carnet privé → doublons, numéros obsolètes, aucune source de vérité.
2. **Mauvais canal au mauvais moment** : difficile d'obtenir *le bon numéro du bon contact au bon
   moment*, en tenant compte du moment de la journée (fixe pro en journée, mobile perso le soir…).
3. **Favoris figés** : les favoris du téléphone ne s'adaptent pas aux périodes ni au calendrier.

## 2. Vision

Une **app mobile** qui unifie tous les répertoires en une source de vérité propre, garde les
numéros à jour, et **propose le bon contact et le bon numéro selon le contexte du moment**
(heure, jour, calendrier, habitudes).

Slogan de travail : *« Le bon contact, le bon numéro, au bon moment. »*

## 3. Les trois piliers

| # | Pilier | Valeur | Dépendance |
|---|--------|--------|------------|
| 1 | **Consolidation & fraîcheur** | Une fiche unique par personne, sans doublon, à jour | Socle — indépendant |
| 2 | **Bon numéro au bon moment** | Choisit *quel* numéro proposer selon le contexte | Dépend du pilier 1 |
| 3 | **Favoris dynamiques** | Propose *qui* contacter (calendrier, habitudes) | Dépend des piliers 1 & 2 |

### Pilier 1 — Consolidation & fraîcheur
- Import multi-sources : contacts natifs de l'appareil, Google Contacts, iCloud/CardDAV,
  Exchange/Office 365.
- **Déduplication** : détection de doublons (nom, e-mail, numéro normalisé E.164, fuzzy match),
  proposition de fusion, historique réversible.
- **Fraîcheur** : signaler numéros probablement obsolètes ; résoudre les conflits (« 3 numéros
  pour Paul »). Stratégie réseau (chaque personne pousse sa fiche à jour) envisagée en v2.

### Pilier 2 — Bon numéro au bon moment
- Chaque contact peut avoir N canaux (mobile perso, fixe pro, WhatsApp…), chacun typé et avec des
  **fenêtres de disponibilité** (heures ouvrées, soir, week-end).
- Moteur de *ranking* : score chaque canal selon l'heure/jour courant et le type de relation.
- Apprentissage léger : ajuste selon les appels réellement passés/aboutis.

### Pilier 3 — Favoris dynamiques
- Signaux : événement calendaire imminent → participants ; récurrences (« tous les lundis 9h tu
  appelles X ») ; éventuellement lieu.
- Écran d'accueil = liste de suggestions contextuelles, recalculée en continu.

## 4. Périmètre MVP (v1)

**Objectif : le pilier 1 solide, une amorce du pilier 2.**

Inclus :
- Onboarding + import des contacts de l'appareil (+ Google Contacts).
- Normalisation E.164 des numéros (via l'indicatif pays).
- Détection et fusion assistée des doublons.
- Fiche contact unifiée avec plusieurs numéros typés.
- Numéro « suggéré » simple selon l'heure (heuristique de base, pas encore d'apprentissage).
- Passage d'appel direct depuis l'app.

Exclus du MVP (backlog) :
- Modèle réseau/collaboratif (contacts qui poussent leur fiche).
- Favoris dynamiques via calendrier (pilier 3).
- Sync cloud chiffrée multi-appareils (v1 = local-first pur).

Critère de succès MVP : « je fusionne mes doublons en < 10 min et l'app me propose spontanément le
bon numéro dans la majorité des cas. »

## 5. Architecture technique (hypothèse)

### Stack
- **Mobile : Flutter** (Dart) — iOS + Android en une base de code.
  - Contacts : plugin `flutter_contacts` (lecture/écriture `ContactsContract` / framework Contacts).
  - Appels : `url_launcher` (`tel:`) en v1 ; CallKit/ConnectionService plus tard si besoin.
  - Persistance locale : `drift` (SQLite typé) ou `isar`.
- **Modèle : local-first**. Toutes les données vivent sur l'appareil. Sync cloud = option v2,
  chiffrée de bout en bout.
- **Backend (v2 seulement)** : service de sync + normalisation. Techno à décider (Node/TS ou
  Symfony/PHP — compétence déjà présente dans l'historique du dépôt).

### Modèle de données (esquisse)
```
Person        (id, displayName, mergedFrom[], createdAt, updatedAt)
 └─ Channel   (id, personId, type[mobile|work|home|whatsapp|email], value,
               valueNormalized, availability[], confidence, source, lastVerifiedAt)
 └─ SourceRef (id, personId, sourceType[device|google|icloud|exchange], externalId)
Interaction   (id, personId, channelId, kind[call|msg], at, outcome)  // pour le ranking
MergeLog      (id, survivingId, mergedIds[], at, reversible)
```

### Déduplication (v1)
1. Clé forte : numéro normalisé E.164 ou e-mail identique → même personne.
2. Clé faible : similarité de nom (Jaro-Winkler) + recoupement partiel → proposition à l'utilisateur.
3. Toute fusion est journalisée et **réversible**.

### Ranking de canal (pilier 2, v1 heuristique)
```
score(canal) = w_type(type, moment)         // work fort en journée, perso fort le soir
             + w_availability(fenêtres, now) // dans une fenêtre déclarée ?
             + w_confidence(confidence)      // numéro récemment vérifié
             + w_recency(dernier appel abouti)
```

## 6. Roadmap

- **Étape 0 — Cadrage** *(ce document)* : valider stack, périmètre, modèle de données.
- **Étape 1 — Squelette** : projet Flutter, navigation, schéma local (drift/isar), écrans vides.
- **Étape 2 — Import & normalisation** : lecture contacts device + Google, E.164.
- **Étape 3 — Déduplication** : détection + UI de fusion réversible.
- **Étape 4 — Fiche unifiée + appel** : plusieurs canaux, passage d'appel.
- **Étape 5 — Numéro suggéré** : heuristique horaire (pilier 2 v1).
- **v2** : sync chiffrée, modèle réseau, favoris dynamiques via calendrier (pilier 3).

## 7. Risques & points ouverts

- **Confidentialité** : les contacts sont des données personnelles sensibles → local-first, pas de
  remontée serveur sans consentement explicite ; conformité RGPD dès la conception.
- **Fraîcheur** : sans effet réseau, on reste sur de la résolution de conflits passive. L'effet
  réseau (fiches poussées) est puissant mais suppose une masse d'utilisateurs → v2.
- **Accès plateformes** : quotas/permissions Google People API, restrictions iOS sur les appels.
- **Décisions à confirmer** : nom de code, Flutter vs React Native, local-first vs cloud dès v1,
  ordre des piliers.

## 8. Prochaine action proposée

Sur validation de ce cadrage : initialiser le **squelette Flutter** (étape 1) — arborescence,
navigation, schéma de base local et écrans vides — prêt à recevoir l'import de contacts.
