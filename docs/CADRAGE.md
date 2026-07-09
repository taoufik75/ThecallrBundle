# Cadrage — App de contacts contextuels

> Statut : brouillon initial (v0.1) · Branche : `claude/context-contact-app-m3rpd1`
> Ce document cadre le produit **avant** tout choix technologique figé. Les points
> marqués **[À TRANCHER]** attendent ta décision.

---

## 1. Problème

Aujourd'hui les contacts sont éclatés sur plusieurs répertoires — téléphone,
ordinateur, messagerie pro, messagerie privée — ce qui produit trois douleurs
concrètes :

1. **Fragmentation & doublons.** La même personne existe en 3 fiches
   incohérentes ; les numéros sont périmés ; on ne sait plus lequel est le bon.
2. **Le bon numéro au bon moment.** Une personne a souvent plusieurs numéros
   (mobile perso, ligne pro, domicile). Selon l'heure et le contexte, un seul
   est pertinent — mais rien ne le propose.
3. **Favoris statiques.** Les favoris du téléphone ne reflètent pas la période :
   les gens que j'appelle cette semaine (réunion projet X, déplacement, événement
   familial) ne sont pas ceux du mois dernier.

## 2. Vision produit

> Une app mobile qui maintient **un référentiel unique et à jour** de mes contacts,
> et qui, à chaque instant, **propose le bon contact et le bon numéro** en fonction
> du contexte (heure, agenda, lieu, habitudes).

Trois piliers, dans l'ordre de valeur :

| Pilier | Ce que ça résout | Le « waouh » |
|--------|------------------|--------------|
| **P1 — Référentiel unifié** | Fragmentation, doublons, numéros périmés | « Une seule fiche par personne, toujours juste » |
| **P2 — Numéro contextuel** | Le bon numéro au bon moment | « L'app me propose la ligne pro à 10h, le mobile perso le soir » |
| **P3 — Favoris dynamiques** | Favoris statiques | « Mes favoris suivent mon agenda tout seuls » |

## 3. Périmètre MVP (ce qu'on livre en premier)

Objectif du MVP : prouver **P1 + P2** sur mon propre téléphone. P3 vient juste
après, une fois le socle en place.

**Inclus (MVP)**
- Import des contacts de l'appareil (carnet natif).
- Import d'une 2e source (export CSV/vCard d'un autre répertoire, ou compte Google).
- Détection & fusion des doublons (assistée, avec validation manuelle).
- Fiche contact unifiée : plusieurs numéros typés (mobile perso, pro, fixe…) avec
  plages horaires / contexte d'usage.
- Écran d'accueil « qui appeler maintenant » : suggestions contextuelles simples
  basées sur l'heure + l'agenda du jour.

**Exclu du MVP (versions suivantes)**
- Favoris dynamiques avancés (P3 complet).
- Enrichissement automatique des numéros via annuaire externe.
- Synchro multi-appareils chiffrée.
- Collaboration / partage de contacts.

## 4. Concepts & modèle de données (indépendant de la techno)

Entités clés :

- **Person** — l'individu réel unifié. Une seule fiche par personne.
  - `id`, `displayName`, `notes`, `tags[]`
- **ContactPoint** — un moyen de joindre la personne.
  - `id`, `personId`, `type` (mobile_perso | mobile_pro | fixe_domicile | fixe_bureau | email | app_messagerie)
  - `value` (numéro/adresse), `label`, `isPrimary`
  - `availability` — quand ce point est pertinent : plages horaires, jours,
    contexte (`travail` / `perso`), fuseau.
  - `confidence` / `lastVerifiedAt` — pour gérer « numéro à jour ou périmé ».
- **SourceRecord** — la fiche brute telle qu'importée d'un répertoire (traçabilité).
  - `id`, `sourceType` (device | google | csv | vcard | outlook…), `rawPayload`,
    `personId` (après fusion), `mergedInto`.
- **MergeDecision** — historique des fusions/dédoublonnages (réversible).
- **SuggestionContext** — l'entrée du moteur de suggestion.
  - `now`, `location?`, `calendarEvents[]`, `recentInteractions[]`.

Règle P2 (numéro contextuel) : pour une `Person` donnée, le moteur classe ses
`ContactPoint` selon la correspondance entre `availability` et le
`SuggestionContext` courant, et met en avant le mieux classé.

Règle P3 (favoris dynamiques) : score de « pertinence maintenant » par `Person`
= f(événements agenda à venir, interactions récentes, tags de période actifs).

## 5. Sources de contacts & stratégie de fusion

- **Carnet de l'appareil** : lecture native (permission utilisateur).
- **Google Contacts / Outlook** : via API (OAuth) — post-MVP possible.
- **CSV / vCard** : import fichier, universel, bon pour le MVP.

**Dédoublonnage** : clé de rapprochement sur numéro normalisé (E.164), email,
nom normalisé. Score de similarité → propositions de fusion validées par
l'utilisateur (jamais de fusion destructrice silencieuse ; tout est réversible via
`MergeDecision` + `SourceRecord`).

## 6. Moteur de contexte (P2/P3)

Signaux d'entrée :
- **Temps** : heure locale, jour ouvré vs week-end.
- **Agenda** : événement en cours / à venir → participants = contacts prioritaires.
- **Lieu** (optionnel, post-MVP) : au bureau vs domicile.
- **Habitudes** : historique des appels/messages (fréquence, horaires).

Approche recommandée : commencer par des **règles explicites et lisibles**
(ex. « 9h–18h en semaine → privilégier la ligne pro ») avant toute idée de ML.
C'est plus simple, débuggable, et suffisant pour prouver la valeur.

## 7. Architecture — options **[À TRANCHER]**

### 7.1 Stack mobile
- **Option A — Flutter** *(recommandé par défaut)* : une base de code iOS+Android,
  très bon accès natif aux contacts, rapide pour un MVP.
- **Option B — React Native / Expo** : idem cross-platform, écosystème JS/TS.
- **Option C — iOS natif (Swift)** : meilleure intégration Contacts / EventKit /
  Focus, mais Android à refaire.

### 7.2 Où vivent les données (enjeu vie privée fort)
- **Local-first** *(recommandé par défaut)* : les contacts restent sur l'appareil,
  base locale chiffrée ; confidentialité maximale.
- **Cloud / backend** : serveur central, synchro multi-appareils facile mais
  données hébergées.
- **Hybride** : local-first + backend léger pour enrichissement/synchro chiffrée.

> Recommandation initiale : **Flutter + Local-first** pour le MVP, avec une
> couche de synchro chiffrée optionnelle ajoutée en P3. À confirmer.

### 7.3 Briques déjà dans ce repo
Le repo contient un **SDK TheCallR** (envoi SMS / déclenchement d'appels). Il
pourra alimenter une action « appeler / envoyer un SMS » côté backend si on part
sur une architecture hybride. Non requis pour le MVP.

## 8. Confidentialité & sécurité (non négociable)

Les contacts sont des données personnelles sensibles (les miennes **et** celles de
tiers). Principes :
- Minimisation : ne stocker que le nécessaire ; pas d'upload par défaut.
- Chiffrement au repos de la base locale.
- Consentement explicite avant tout accès carnet / agenda / localisation.
- Réversibilité : toute fusion/import annulable.
- Conformité RGPD dès la conception (base légale, droit à l'effacement).

## 9. Roadmap proposée

1. **Étape 0 — Cadrage** *(ce document)*.
2. **Étape 1 — Maquette de l'écran principal** « qui appeler maintenant » pour
   valider l'UX avant de coder.
3. **Étape 2 — Squelette app + modèle de données** (P1 : import + fusion).
4. **Étape 3 — Moteur contextuel v1** (P2 : numéro selon l'heure/agenda).
5. **Étape 4 — Favoris dynamiques** (P3).
6. **Étape 5 — Synchro chiffrée / enrichissement** (post-MVP).

## 10. Décisions en attente

| # | Décision | Défaut recommandé |
|---|----------|-------------------|
| D1 | Prochain livrable : maquette, ou scaffolding de code ? | Maquette (étape 1) |
| D2 | Stack mobile | Flutter |
| D3 | Stockage des données | Local-first |
| D4 | 2e source de contacts pour le MVP | Import CSV/vCard |

---
*Prochaine action suggérée : valider D1–D4, puis passer à la maquette de l'écran
« qui appeler maintenant ».*
