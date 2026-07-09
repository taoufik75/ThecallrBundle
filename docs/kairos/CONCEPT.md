# Kairos — le bon contact, au bon numéro, au bon moment

> **Kairos** (καιρός) : en grec, « le moment opportun ». C'est exactement la promesse
> de l'app. Nom de travail — à changer librement.

Document de cadrage produit + architecture. Point de départ pour un projet lancé de 0.

---

## 1. Le problème (tes pain points)

| # | Douleur | Symptôme concret |
|---|---------|------------------|
| 1 | **Répertoires éclatés** | Contacts dispersés entre téléphone, ordi, pro, privé → doublons et numéros périmés |
| 2 | **Mauvais numéro / mauvais moment** | On rappelle le fixe bureau à 21h, ou le mobile perso en pleine réunion |
| 3 | **Favoris figés** | La liste des favoris ne colle pas aux besoins du moment (agenda, période, projet) |

L'idée : **une app mobile qui maintient un carnet propre et à jour, et qui propose le
bon contact / le bon numéro en fonction du contexte** (heure, agenda, relation, fuseau).

---

## 2. Le produit en 3 briques

### Brique 1 — Une source de vérité unique (résout #1)

**But :** un seul carnet propre, dédoublonné, à jour, alimenté par toutes tes sources.

- **Ingestion multi-sources**
  - Contacts natifs iOS / Android
  - Google Contacts, iCloud, carnet pro (CardDAV / Exchange)
  - Import fichier (vCard `.vcf`, CSV)
- **Normalisation**
  - Numéros → format international **E.164** (`+33612345678`) via *libphonenumber*
  - Noms, emails, casse, espaces → normalisés pour comparaison
- **Détection de doublons**
  - *Déterministe* : même numéro E.164 ou même email → fusion quasi-certaine
  - *Approximative (fuzzy)* : noms proches (Jaro-Winkler) + numéros voisins → **score de confiance**
  - Au-dessus d'un seuil : fusion auto ; en dessous : **proposition à valider** (swipe « fusionner / garder séparés »)
- **Fusion réversible**
  - On garde la **provenance de chaque champ** (quel numéro vient de quelle source)
  - → on peut **défusionner** et auditer, jamais de perte de donnée
- **Fraîcheur des numéros** (le point clé pour « à jour »)
  - Signaux : dernier appel/SMS **abouti**, retour « ce numéro ne marche plus », bounce
  - **HLR lookup via CALLR** : vérifier qu'un mobile est actif / porté → *score de fraîcheur* par numéro
  - Option self-service : lien envoyé au contact pour qu'il confirme/corrige ses coordonnées

### Brique 2 — Le bon numéro au bon moment (résout #2)

**But :** un contact a plusieurs numéros typés ; l'app choisit lequel proposer *par défaut*.

- Chaque numéro est **typé** : mobile perso, mobile pro, fixe bureau, domicile
- **Score contextuel** par numéro, calculé à la volée :

  ```
  score(numéro | contexte) =
        w1 · adéquationType(heure, jour)        // pro en journée, perso le soir
      + w2 · fraîcheur(numéro)                   // brique 1
      + w3 · historiqueSuccès(numéro, heure)     // ce numéro a-t-il déjà abouti à cette heure ?
      + w4 · lienAgenda(contact)                 // réunion imminente avec ce contact ?
      − penalité(fuseauHoraire)                  // ne pas suggérer 3h du mat' chez le contact
  ```

- **D'abord des règles transparentes** (heuristiques lisibles, réglables par l'utilisateur),
  **puis** apprentissage léger (bandit / régression logistique) sur les retours *abouti / échoué*.
- Respect du **fuseau horaire du contact** et des **heures de bureau**.
- UI : un seul gros bouton « Appeler » qui compose *le bon numéro*, + accès aux autres en un tap.

### Brique 3 — Favoris dynamiques (résout #3)

**But :** un écran d'accueil qui **change au fil de la journée et de tes besoins**.

- Sources du classement :
  - **Agenda** : participants des prochaines réunions → remontés juste avant / pendant
  - **Fréquence & récence** de contact
  - **Moment** : contacts pro en journée, famille/amis le soir et le week-end
  - **Périodes / projets** : tags temporels (ex. « période déménagement » → déménageur,
    propriétaire, notaire remontent ; détectés via agenda ou déclarés)
- Rendu : un **widget écran d'accueil** + un onglet « Suggestions » qui se recompose seul.

---

## 3. Architecture technique

**Principe directeur : *local-first + privacy by design*.** Les contacts sont des données
personnelles sensibles (RGPD). Le carnet et le moteur de contexte vivent **sur l'appareil**
par défaut ; le cloud est **opt-in** pour la synchro multi-appareils.

```
┌─────────────────────────── Mobile (React Native + Expo, TypeScript) ───────────────────────────┐
│                                                                                                  │
│  Accès système            Cœur local (source de vérité)          Intelligence (on-device)        │
│  ─────────────            ──────────────────────────────         ─────────────────────────       │
│  expo-contacts            SQLite (op-sqlite / WatermelonDB)       Normalisation E.164             │
│  expo-calendar            - contacts, numéros typés, provenance   Détection doublons + fusion     │
│  expo-notifications       - historique d'appels/SMS               Moteur de scoring contextuel    │
│                           - scores fraîcheur & contexte           Favoris dynamiques              │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │ (opt-in, chiffré)
                         ┌──────────────────────┴───────────────────────┐
                         │   Backend de sync (optionnel)                 │
                         │   Supabase (Postgres + Auth + Realtime)       │
                         │   - sync multi-appareils                      │
                         │   - dédoublonnage lourd côté serveur          │
                         └──────────────────────┬───────────────────────┘
                                                │
                         ┌──────────────────────┴───────────────────────┐
                         │   Télécom — CALLR (le bundle de ce repo !)    │
                         │   - HLR lookup (validité / portabilité num.)  │
                         │   - click-to-call                             │
                         │   - vérification par SMS                      │
                         └───────────────────────────────────────────────┘
```

**Choix par défaut (à valider) :**
- **Mobile :** React Native + Expo (iOS + Android, un seul code, prototypage rapide, TS)
- **Base locale :** SQLite (moteur on-device, offline, privé)
- **Sync :** Supabase en option (rapide à mettre en place) — activable plus tard
- **Télécom :** CALLR, déjà présent dans ce repo, pour fraîcheur des numéros + appels + SMS

### Modèle de données (esquisse)

```
Contact        { id, displayName, relationType(pro|famille|ami|…), timezone, tags[], mergedFrom[] }
PhoneNumber    { id, contactId, e164, type(mobilePerso|mobilePro|fixeBureau|domicile),
                 source, freshnessScore, lastSuccessAt, verifiedAt }
Interaction    { id, contactId, numberId, kind(call|sms), outcome(success|fail), at }
CalendarLink   { id, contactId, eventId, startAt, endAt }              // pour favoris + score
FavoriteHint   { id, contactId, reason(agenda|frequence|moment|projet), score, computedAt }
```

---

## 4. Feuille de route (MVP → v1)

| Phase | Contenu | Pain résolu |
|-------|---------|-------------|
| **0 — Carnet propre** | Import contacts natifs → normalisation E.164 → détection doublons → **fusion assistée** réversible | #1 |
| **1 — Bon numéro** | Numéros typés + moteur de règles heure/jour + bouton « appeler le bon numéro » | #2 |
| **2 — Favoris dynamiques** | Intégration agenda (expo-calendar) + écran de suggestions + widget | #3 |
| **3 — Fraîcheur & sync** | HLR/appels via CALLR, score de fraîcheur, sync cloud opt-in, apprentissage léger des poids | tous |

**Reco : commencer par la Phase 0.** C'est le socle (sans carnet propre, le reste n'a pas de
sens), c'est le pain le plus douloureux, et c'est démontrable vite.

---

## 5. Points de vigilance

- **RGPD / vie privée** : traitement on-device par défaut, chiffrement at-rest, minimisation,
  consentement explicite avant tout envoi cloud, droit à l'effacement.
- **Permissions** : accès contacts + agenda = friction à l'onboarding → bien expliquer la valeur.
- **Qualité de fusion** : une fausse fusion est coûteuse → seuil prudent + toujours réversible.
- **Coût HLR** : les lookups CALLR sont payants → les déclencher intelligemment (numéros
  douteux, avant un appel important), pas en masse.

---

## 6. Décisions à trancher avec toi

1. **Stack mobile** : React Native (reco) / Flutter / natif ?
2. **Cloud** : 100 % local d'abord, ou sync cloud dès le départ ?
3. **Plateforme prioritaire** : iOS, Android, ou les deux d'emblée ?
4. **Nom** : on garde *Kairos* ou tu as une autre idée ?

Dis-moi tes réponses (ou « pars sur les recos ») et j'enchaîne sur le scaffolding de la Phase 0.
